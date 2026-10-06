import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Eye,
  FileCode2,
  GitBranch,
  History,
  Link2,
  RefreshCw,
  Settings,
  Users,
} from "lucide-react";
import {
  apiErrorMessage,
  normalizeEvent,
  normalizeLink,
  normalizePresence,
  normalizeRevision,
  projectsApi,
  projectsLiveUrl,
  type GitState,
  type ProjectDetail,
  type ProjectPresence,
  type RevisionSummary,
} from "../services/projectsApi";
import { useEventSource } from "../hooks/useEventSource";
import { Skeleton, LoadingAnnouncer } from "../components/ui/Skeleton";
import { KindBadge, LanguageBadge, Pill } from "../components/Projects/ProjectBadges";
import OpenProjectInTmcode from "../components/Projects/OpenProjectInTmcode";
import LivePanel from "../components/Projects/LivePanel";
import FilesTab from "../components/Projects/FilesTab";
import { ActivityTimeline, GitTab, RevisionsTab } from "../components/Projects/HistoryTabs";
import LinksTab from "../components/Projects/LinksTab";
import { MembersTab, SettingsTab } from "../components/Projects/ProjectAdminTabs";
import { formatBytes, timeAgo } from "../components/Projects/projectFormat";

/**
 * /projects/:id — one project (PROJECTS_PLAN.md §5): header with Open in
 * TMCode, the live panel (SSE), and Files / Revisions or Git / Activity /
 * Links / Members (GitHub) / Settings tabs. `?tab=` and `?rev=` deep-link, so
 * a teacher panel can open a submission at its frozen revision.
 */

type TabId = "files" | "revisions" | "git" | "activity" | "links" | "members" | "settings";

const presenceKey = (p: Pick<ProjectPresence, "user_id" | "device_id">) => `${p.user_id}:${p.device_id}`;

const ProjectDetailPage: React.FC = () => {
  const { id: idParam } = useParams<{ id: string }>();
  const projectId = Number(idParam);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await projectsApi.get(projectId);
      setProject(p);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError({
        status,
        message:
          status === 404
            ? "This project doesn't exist, or you don't have access to it."
            : apiErrorMessage(e, "Couldn't load the project."),
      });
    }
  }, [projectId]);

  useEffect(() => {
    setProject(null);
    setRevisions(null);
    load();
  }, [load]);

  const isTm = project?.kind === "tm";
  useEffect(() => {
    if (!project || !isTm) return;
    let cancelled = false;
    projectsApi
      .revisions(projectId)
      .then((r) => !cancelled && setRevisions(r))
      .catch(() => !cancelled && setRevisions([]));
    return () => {
      cancelled = true;
    };
    // Only when the project (id/kind) changes, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isTm, !!project]);

  // Presence ages out without an event; re-evaluate every 15 s.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  // ── Live updates (SSE) ──
  const patch = (fn: (p: ProjectDetail) => ProjectDetail) => setProject((p) => (p ? fn(p) : p));
  const live = useEventSource(project ? projectsLiveUrl(projectId) : null, {
    snapshot: (data) => {
      const list = Array.isArray(data?.presence) ? data.presence : Array.isArray(data) ? data : [];
      patch((p) => ({ ...p, presence: list.map(normalizePresence) }));
      setNow(Date.now());
    },
    presence: (data) => {
      const row = normalizePresence(data);
      patch((p) => {
        const others = p.presence.filter((x) => presenceKey(x) !== presenceKey(row));
        return { ...p, presence: [...others, row], last_activity_at: row.last_seen_at };
      });
      setNow(Date.now());
    },
    revision: (data) => {
      const rev = normalizeRevision(data?.revision ?? data);
      if (!rev) return;
      setRevisions((list) => (list ? [rev, ...list.filter((r) => r.id !== rev.id)] : list));
      patch((p) => ({
        ...p,
        head: !p.head || rev.number >= p.head.number ? rev : p.head,
        size_bytes: rev.size_bytes || p.size_bytes,
        file_count: rev.file_count || p.file_count,
        last_activity_at: rev.created_at,
      }));
    },
    event: (data) => {
      const ev = normalizeEvent(data);
      patch((p) => ({
        ...p,
        events: [ev, ...p.events.filter((e) => !(e.id && e.id === ev.id))].slice(0, 100),
      }));
    },
    git: (data) => patch((p) => ({ ...p, git: { ...(p.git ?? {}), ...(data as GitState) } })),
    link: (data) => {
      const link = normalizeLink(data);
      patch((p) => ({
        ...p,
        links: p.links.some((l) => l.id === link.id)
          ? p.links.map((l) => (l.id === link.id ? { ...l, ...link, activity_title: link.activity_title ?? l.activity_title, course: link.course ?? l.course } : l))
          : [...p.links, link],
      }));
    },
    project: (data) => patch((p) => ({ ...p, ...(data ?? {}), links: p.links, members: p.members, events: p.events, presence: p.presence })),
  });

  // ── Tabs ──
  const tabs = useMemo(() => {
    if (!project) return [];
    const owner = project.my_role === "owner";
    const list: { id: TabId; label: string; icon: React.ElementType; count?: number }[] = [];
    if (project.kind === "tm") {
      list.push({ id: "files", label: "Files", icon: FileCode2 });
      list.push({ id: "revisions", label: "Revisions", icon: History, count: project.head?.number });
    } else {
      list.push({ id: "git", label: "Git", icon: GitBranch });
    }
    list.push({ id: "activity", label: "Activity", icon: Activity });
    list.push({ id: "links", label: "Links", icon: Link2, count: project.links.length || undefined });
    if (project.kind === "github") list.push({ id: "members", label: "Members", icon: Users, count: project.members.filter((m) => m.status !== "removed" && m.role !== "owner").length || undefined });
    if (owner) list.push({ id: "settings", label: "Settings", icon: Settings });
    return list;
  }, [project]);

  const requested = params.get("tab") as TabId | null;
  const tab: TabId = tabs.find((t) => t.id === requested)?.id ?? tabs[0]?.id ?? "activity";
  const revParam = Number(params.get("rev"));
  const revisionId = Number.isFinite(revParam) && revParam > 0 ? revParam : null;

  const setTab = (next: TabId, extra?: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        Object.entries(extra ?? {}).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
        return p;
      },
      { replace: true },
    );

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  };

  // ── Render ──
  if (error && !project) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-10 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
          <AlertCircle className="h-8 w-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm text-rose-700 dark:text-rose-300">{error.message}</p>
          {error.status !== 404 && (
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!project) return <DetailSkeleton />;

  const owner = project.my_role === "owner";
  const readOnly = !project.my_role;

  return (
    <div className="mx-auto max-w-8xl space-y-4">
      <BackLink />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 rounded-2xl border border-gray-200/60 bg-white/80 p-4 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50 md:flex-row md:items-start md:justify-between"
      >
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-text-primary-light dark:text-text-primary-dark md:text-2xl">{project.name}</h1>
            <KindBadge kind={project.kind} />
            {project.archived_at && <Pill tone="amber">Archived</Pill>}
            {project.visibility === "course" && <Pill tone="violet">Course</Pill>}
            {readOnly && (
              <Pill tone="slate" icon={<Eye className="h-3 w-3" aria-hidden="true" />}>
                Read-only
              </Pill>
            )}
          </div>
          {project.description && <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{project.description}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <LanguageBadge language={project.language} />
            {!owner && <span>by {project.owner.name}</span>}
            {project.kind === "tm" ? (
              <span>
                {project.head ? `Revision #${project.head.number}` : "No revisions yet"} · {project.file_count} files · {formatBytes(project.size_bytes)}
              </span>
            ) : project.repo_url ? (
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline dark:text-blue-400">
                <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                {project.repo_full_name ?? project.repo_url.replace(/^https:\/\/github\.com\//, "")}
              </a>
            ) : null}
            <span>Updated {timeAgo(project.last_activity_at ?? project.updated_at, now)}</span>
          </div>
        </div>
        {!readOnly && <OpenProjectInTmcode projectId={project.id} className="shrink-0" />}
      </motion.header>

      <LivePanel presence={project.presence} status={live.status} onRetry={live.reconnect} now={now} />

      {/* Tabs */}
      <div className="overflow-hidden rounded-2xl border border-white bg-card-light shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        <div role="tablist" aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b border-gray-200 px-2 dark:border-gray-800 sm:px-4">
          {tabs.map((t, i) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-4 ${
                  active ? "text-blue-600 dark:text-blue-400" : "text-text-secondary-light hover:text-gray-900 dark:text-text-secondary-dark dark:hover:text-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
                {t.count ? (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-gray-800 dark:text-slate-300">
                    {t.count}
                  </span>
                ) : null}
                {active && <motion.span layoutId="project-tab-underline" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-500" />}
              </button>
            );
          })}
        </div>
        <div className="p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {tab === "files" && (
                <FilesTab
                  projectId={project.id}
                  revisions={revisions}
                  revisionId={revisionId}
                  onRevisionChange={(rev) => setTab("files", { rev: rev ? String(rev) : null })}
                />
              )}
              {tab === "revisions" && <RevisionsTab revisions={revisions} onBrowse={(rev) => setTab("files", { rev: String(rev) })} />}
              {tab === "git" && <GitTab git={project.git} repoUrl={project.repo_url} defaultBranch={project.default_branch} events={project.events} />}
              {tab === "activity" && <ActivityTimeline events={project.events} />}
              {tab === "links" && <LinksTab project={project} canEdit={owner} onLinksChange={(links) => patch((p) => ({ ...p, links }))} />}
              {tab === "members" && <MembersTab project={project} canEdit={owner} onMembersChange={(members) => patch((p) => ({ ...p, members }))} />}
              {tab === "settings" && owner && (
                <SettingsTab project={project} onUpdated={(changes) => patch((p) => ({ ...p, ...changes }))} onDeleted={() => navigate("/projects", { replace: true })} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const BackLink: React.FC = () => (
  <Link
    to="/projects"
    className="inline-flex items-center gap-2 rounded-full border border-gray-200/50 bg-white/80 px-3 py-2 text-xs font-medium text-text-secondary-light shadow-sm transition hover:bg-white hover:text-gray-900 hover:shadow-md dark:border-gray-700/50 dark:bg-gray-800/80 dark:text-text-secondary-dark dark:hover:bg-gray-800 dark:hover:text-white"
  >
    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Projects
  </Link>
);

const DetailSkeleton: React.FC = () => (
  <div className="mx-auto max-w-8xl space-y-4">
    <LoadingAnnouncer loading message="Loading project…" />
    <Skeleton className="h-8 w-28 rounded-full" />
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/60 bg-white/80 p-4 dark:border-gray-800/30 dark:bg-gray-900/50">
      <div className="flex-1 space-y-3">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-10 w-36 rounded-xl" />
    </div>
    <Skeleton className="h-24 rounded-2xl" />
    <div className="space-y-3 rounded-2xl border border-white bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30">
      <div className="flex gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  </div>
);

export default ProjectDetailPage;
