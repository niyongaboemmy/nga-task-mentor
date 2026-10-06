import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowDownAZ,
  Download,
  FolderCode,
  GitCommitHorizontal,
  LayoutGrid,
  Link2,
  List,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import {
  apiErrorMessage,
  projectsApi,
  type ProjectList,
  type ProjectScope,
  type ProjectSummary,
} from "../services/projectsApi";
import { Skeleton, LoadingAnnouncer, TopProgressBar } from "../components/ui/Skeleton";
import { KindBadge, LanguageBadge, LiveDot, Pill } from "../components/Projects/ProjectBadges";
import NewProjectDialog from "../components/Projects/NewProjectDialog";
import { formatBytes, languageMeta, summaryLine, timeAgo } from "../components/Projects/projectFormat";
import Select from "../components/ui/Select";

/**
 * /projects — a user's TMCode projects (PROJECTS_PLAN.md §5): cards or a
 * table, live dots, search and filters, a stats strip, New project, and the
 * "Get TMCode" call to action. Scope, view and filters live in the URL so a
 * filtered list can be bookmarked.
 */

type View = "cards" | "table";
type Sort = "recent" | "name" | "size";
const VIEW_KEY = "tm.projects.view";

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
};

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canViewAll = can("PROJECTS_VIEW_ALL");
  const [params, setParams] = useSearchParams();

  const scope: ProjectScope =
    params.get("scope") === "shared" ? "shared" : params.get("scope") === "all" && canViewAll ? "all" : "mine";
  const query = params.get("q") ?? "";
  const kindFilter = params.get("kind") ?? "";
  const langFilter = params.get("lang") ?? "";
  const showArchived = params.get("archived") === "1";
  const sort: Sort = (["name", "size"] as const).find((s) => s === params.get("sort")) ?? "recent";

  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
  };

  const [data, setData] = useState<ProjectList | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const seq = useRef(0);

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (value) p.set(key, value);
          else p.delete(key);
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const load = useCallback(
    async (mode: "switch" | "refresh") => {
      const my = ++seq.current;
      if (mode === "switch") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const next = await projectsApi.list(scope);
        if (my !== seq.current) return;
        setData(next);
      } catch (e) {
        if (my !== seq.current) return;
        setError(apiErrorMessage(e, "Couldn't load your projects."));
      } finally {
        if (my === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [scope],
  );

  useEffect(() => {
    load("switch");
  }, [load]);

  // Live dots age out; refresh quietly while the tab is visible.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && load("refresh");
    const timer = window.setInterval(tick, 45_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [load]);

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const languages = useMemo(
    () => [...new Set(projects.map((p) => p.language).filter((l): l is string => !!l))].sort(),
    [projects],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = projects.filter((p) => {
      if (!showArchived && p.archived_at) return false;
      if (showArchived && !p.archived_at) return false;
      if (kindFilter && p.kind !== kindFilter) return false;
      if (langFilter && p.language !== langFilter) return false;
      if (!q) return true;
      return [p.name, p.description, p.language, p.owner.name, p.repo_full_name]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    });
    const lastAt = (p: ProjectSummary) => new Date(p.last_activity_at ?? p.updated_at).getTime();
    return rows.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.size_bytes - a.size_bytes : lastAt(b) - lastAt(a),
    );
  }, [projects, query, kindFilter, langFilter, showArchived, sort]);

  const archivedCount = projects.filter((p) => p.archived_at).length;
  const filtered = !!(query || kindFilter || langFilter);

  return (
    <div className="mx-auto max-w-8xl space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/60 bg-white/80 p-4 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <FolderCode className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark md:text-2xl">Projects</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your coding projects, kept in Task Mentor and opened in TMCode.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("PROJECTS_MONITOR") && (
            <Link
              to="/projects/monitor"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
            >
              <Radio className="h-4 w-4" aria-hidden="true" /> Monitor
            </Link>
          )}
          <Link
            to="/tmcode"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Get TMCode
          </Link>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New project
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsStrip data={data} loading={loading} />

      {/* Toolbar */}
      <div className="space-y-3 rounded-2xl border border-gray-200/60 bg-white/80 p-3 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Which projects" className="flex w-full shrink-0 sm:w-auto rounded-xl bg-gray-100 p-1 dark:bg-white/[0.04]">
            {(
              [
                ["mine", "My projects"],
                ["shared", "Shared with me"],
                ...(canViewAll ? [["all", "All"] as const] : []),
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={scope === value}
                onClick={() => setParam("scope", value === "mine" ? null : value)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition lg:flex-none ${
                  scope === value
                    ? "bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="relative block min-w-[220px] flex-1">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setParam("q", e.target.value || null)}
              placeholder="Search by name, language, owner…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Kind"
              value={kindFilter}
              onChange={(v) => setParam("kind", v || null)}
              options={[
                ["", "All kinds"],
                ["tm", "Task Mentor"],
                ["github", "GitHub"],
              ]}
            />
            <FilterSelect
              label="Language"
              value={langFilter}
              onChange={(v) => setParam("lang", v || null)}
              options={[["", "All languages"], ...languages.map((l) => [l, languageMeta(l)?.label ?? l] as [string, string])]}
            />
            <FilterSelect
              label="Sort"
              icon={<ArrowDownAZ className="h-4 w-4" aria-hidden="true" />}
              value={sort}
              onChange={(v) => setParam("sort", v === "recent" ? null : v)}
              options={[
                ["recent", "Recent activity"],
                ["name", "Name"],
                ["size", "Size"],
              ]}
            />
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setParam("archived", showArchived ? null : "1")}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                showArchived
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                  : "border-gray-200 text-slate-600 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
              }`}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archived{archivedCount ? ` (${archivedCount})` : ""}
            </button>
            <div className="flex rounded-xl border border-gray-200 p-0.5 dark:border-gray-700" role="group" aria-label="Layout">
              <button
                type="button"
                aria-label="Cards"
                aria-pressed={view === "cards"}
                onClick={() => setView("cards")}
                className={`rounded-lg p-1.5 ${view === "cards" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Table"
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
                className={`rounded-lg p-1.5 ${view === "table" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <TopProgressBar active={refreshing} label="Refreshing projects" />
      </div>
      <LoadingAnnouncer loading={loading} message="Loading projects…" />

      {/* Body */}
      {error && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-10 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
          <AlertCircle className="h-8 w-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button
            onClick={() => load("switch")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : loading ? (
        view === "cards" ? (
          <CardsSkeleton />
        ) : (
          <TableSkeleton />
        )
      ) : visible.length === 0 ? (
        <EmptyState
          scope={scope}
          filtered={filtered || showArchived}
          onNew={() => setNewOpen(true)}
          onClear={() => setParams(scope === "mine" ? {} : { scope }, { replace: true })}
        />
      ) : view === "cards" ? (
        <motion.ul
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
          aria-label="Projects"
        >
          <AnimatePresence initial={false}>
            {visible.map((p) => (
              <ProjectCard key={p.id} project={p} showOwner={scope !== "mine"} />
            ))}
          </AnimatePresence>
        </motion.ul>
      ) : (
        <ProjectTable projects={visible} showOwner={scope !== "mine"} />
      )}

      <NewProjectDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(p) => {
          setNewOpen(false);
          navigate(`/projects/${p.id}`);
        }}
      />
    </div>
  );
};

// ─── Pieces ───────────────────────────────────────────────────────────────────

const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  icon?: React.ReactNode;
}> = ({ label, value, onChange, options, icon }) => (
  <label className="relative">
    <span className="sr-only">{label}</span>
    {icon && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
    <Select variant="outline"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-xl border border-gray-200 bg-white py-2 pr-8 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark ${icon ? "pl-8" : "pl-3"}`}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  </label>
);

const STAT_DEFS = [
  { key: "total", label: "Projects", icon: FolderCode, accent: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" },
  { key: "live_now", label: "Open now", icon: Radio, accent: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { key: "active_this_week", label: "Active this week", icon: Activity, accent: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300" },
  { key: "revisions", label: "Revisions", icon: GitCommitHorizontal, accent: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300" },
  { key: "submissions", label: "Submissions", icon: Send, accent: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300" },
] as const;

const StatsStrip: React.FC<{ data: ProjectList | null; loading: boolean }> = ({ data, loading }) => (
  <section aria-label="Project statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {STAT_DEFS.map(({ key, label, icon: Icon, accent }, i) => (
      <div
        key={key}
        className={`rounded-2xl border border-white bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30 ${
          i === 0 ? "col-span-2 sm:col-span-1" : ""
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/70">
            {label}
          </span>
        </div>
        {loading || !data ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <p className="text-2xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark" data-testid={`stat-${key}`}>
            {data.stats[key]}
          </p>
        )}
      </div>
    ))}
  </section>
);

const ProjectCard: React.FC<{ project: ProjectSummary; showOwner: boolean }> = ({ project: p, showOwner }) => {
  const summary = p.presence_summary;
  const live = summary.online;
  return (
    <motion.li
      layout
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        to={`/projects/${p.id}`}
        className="group flex h-full flex-col rounded-2xl border border-gray-200/70 bg-card-light p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-border-dark/30 dark:bg-card-dark/30 dark:hover:border-blue-800"
        aria-label={`${p.name}${live ? ", open in TMCode now" : ""}`}
      >
        <div className="flex items-start gap-3">
          <LiveDot live={live} className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary-light group-hover:text-blue-700 dark:text-text-primary-dark dark:group-hover:text-blue-300">
              {p.name}
            </p>
            <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-xs text-slate-500 dark:text-slate-400">
              {p.description || (p.kind === "github" ? p.repo_full_name : "No description")}
            </p>
          </div>
          <KindBadge kind={p.kind} />
        </div>

        {live ? (
          <p className="mt-3 truncate rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {summaryLine(summary)}
          </p>
        ) : p.archived_at ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Archived {timeAgo(p.archived_at)}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
          <LanguageBadge language={p.language} />
          {p.kind === "tm" ? (
            <span>
              {p.head ? `rev ${p.head.number}` : "No revisions yet"} · {formatBytes(p.size_bytes)}
            </span>
          ) : p.git?.branch ? (
            <span className="font-mono">
              {p.git.branch}
              {p.git.ahead ? ` ↑${p.git.ahead}` : ""}
              {p.git.behind ? ` ↓${p.git.behind}` : ""}
            </span>
          ) : null}
          {p.links.total > 0 && (
            <Pill tone={p.links.submitted ? "emerald" : "blue"} icon={<Link2 className="h-3 w-3" aria-hidden="true" />}>
              {p.links.submitted ? `${p.links.submitted}/${p.links.total} submitted` : `${p.links.total} linked`}
            </Pill>
          )}
          <span className="ml-auto whitespace-nowrap">{timeAgo(p.last_activity_at ?? p.updated_at)}</span>
        </div>
        {showOwner && (
          <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-slate-500 dark:border-white/5 dark:text-slate-400">
            by <span className="font-medium text-slate-700 dark:text-slate-200">{p.owner.name}</span>
          </p>
        )}
      </Link>
    </motion.li>
  );
};

const ProjectTable: React.FC<{ projects: ProjectSummary[]; showOwner: boolean }> = ({ projects, showOwner }) => {
  const navigate = useNavigate();
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-card-light dark:border-border-dark/30 dark:bg-card-dark/30">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Project</th>
              {showOwner && <th scope="col" className="px-4 py-2.5 font-semibold">Owner</th>}
              <th scope="col" className="px-4 py-2.5 font-semibold">Language</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Kind</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Last activity</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Size</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Activities</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {projects.map((p) => {
              const live = p.presence_summary.online;
              return (
                <tr
                  key={p.id}
                  className="cursor-pointer transition hover:bg-blue-50/40 dark:hover:bg-blue-900/10"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <LiveDot live={live} />
                      <Link
                        to={`/projects/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-text-primary-light hover:text-blue-700 focus:outline-none focus-visible:underline dark:text-text-primary-dark dark:hover:text-blue-300"
                      >
                        {p.name}
                      </Link>
                      {p.archived_at && <Pill tone="amber">Archived</Pill>}
                    </div>
                  </td>
                  {showOwner && <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.owner.name}</td>}
                  <td className="px-4 py-3">
                    <LanguageBadge language={p.language} />
                  </td>
                  <td className="px-4 py-3">
                    <KindBadge kind={p.kind} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    {timeAgo(p.last_activity_at ?? p.updated_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {p.kind === "tm" ? formatBytes(p.size_bytes) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {p.links.total ? `${p.links.submitted}/${p.links.total} submitted` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CardsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="rounded-2xl border border-gray-200/70 bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30">
        <div className="flex items-start gap-3">
          <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-6 flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      </div>
    ))}
  </div>
);

const TableSkeleton: React.FC = () => (
  <div className="space-y-2 rounded-2xl border border-gray-200/70 bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30" aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="flex items-center gap-4 py-1.5">
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{
  scope: ProjectScope;
  filtered: boolean;
  onNew: () => void;
  onClear: () => void;
}> = ({ scope, filtered, onNew, onClear }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-700"
    data-testid="projects-empty"
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
      <FolderCode className="h-7 w-7" aria-hidden="true" />
    </div>
    {filtered ? (
      <>
        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">No projects match these filters</p>
        <button type="button" onClick={onClear} className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
          Clear filters
        </button>
      </>
    ) : scope === "shared" ? (
      <>
        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Nothing shared with you yet</p>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          When a classmate adds you to a GitHub project, it shows up here.
        </p>
      </>
    ) : (
      <>
        <p className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">Start your first project</p>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          Create a project here, then open it in TMCode, the NGA desktop code editor. Your saves, revisions and
          submissions show up on this page.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New project
          </button>
          <Link
            to="/tmcode"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-gray-800"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Get TMCode
          </Link>
        </div>
      </>
    )}
  </motion.div>
);

export default ProjectsPage;
