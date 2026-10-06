import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  Eye,
  FilePlus2,
  GitBranch,
  GitCommitHorizontal,
  Link2,
  MonitorUp,
  Pencil,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  UserMinus,
  UserPlus,
} from "lucide-react";
import type { GitState, ProjectEvent, RevisionSummary } from "../../services/projectsApi";
import { Skeleton } from "../ui/Skeleton";
import { Avatar, Pill } from "./ProjectBadges";
import { formatBytes, formatDateTime, shortSha, timeAgo } from "./projectFormat";

// ─── Revisions (Task Mentor projects) ─────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; tone: "blue" | "slate" | "emerald" }> = {
  save: { label: "Save", tone: "blue" },
  auto: { label: "Auto-save", tone: "slate" },
  submit: { label: "Submission", tone: "emerald" },
};

export const RevisionsTab: React.FC<{
  revisions: RevisionSummary[] | null;
  onBrowse: (revisionId: number) => void;
}> = ({ revisions, onBrowse }) => {
  if (!revisions) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
  if (revisions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:text-slate-400">
        No revisions yet. Each <strong>Save to Task Mentor</strong> in TMCode adds one.
      </p>
    );
  }
  return (
    <ol className="relative space-y-2" aria-label="Revisions">
      {revisions.map((r, i) => {
        const meta = SOURCE_META[r.source] ?? SOURCE_META.save;
        return (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: Math.min(i, 10) * 0.02 }}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200/70 bg-card-light px-4 py-3 dark:border-border-dark/30 dark:bg-card-dark/30"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold tabular-nums text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              #{r.number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                {r.message || (r.source === "auto" ? "Auto-saved" : "Saved")}
                {i === 0 && <span className="ml-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">latest</span>}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {r.author?.name ? `${r.author.name} · ` : ""}
                {formatDateTime(r.created_at)} · {r.file_count} files · {formatBytes(r.size_bytes)}
              </p>
            </div>
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <button
              type="button"
              onClick={() => onBrowse(r.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Browse files
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
};

// ─── Git (GitHub projects) ────────────────────────────────────────────────────

export const GitTab: React.FC<{
  git: GitState | null | undefined;
  repoUrl?: string | null;
  defaultBranch?: string | null;
  events: ProjectEvent[];
}> = ({ git, repoUrl, defaultBranch, events }) => {
  const pushes = useMemo(() => {
    if (git?.pushes?.length) return git.pushes;
    return events
      .filter((e) => e.type === "pushed")
      .map((e) => ({
        commit: String(e.data?.commit ?? ""),
        message: (e.data?.message as string | undefined) ?? null,
        at: e.created_at,
        user: e.user ?? null,
      }));
  }, [git, events]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GitStat label="Branch" value={git?.branch ?? defaultBranch ?? "—"} mono icon={<GitBranch className="h-4 w-4" />} />
        <GitStat label="Head" value={shortSha(git?.head_commit)} mono icon={<GitCommitHorizontal className="h-4 w-4" />} />
        <GitStat
          label="Ahead / behind"
          value={git ? `↑${git.ahead ?? 0}  ↓${git.behind ?? 0}` : "—"}
          icon={
            <span className="flex">
              <ArrowUp className="h-3.5 w-3.5" />
              <ArrowDown className="h-3.5 w-3.5" />
            </span>
          }
        />
        <GitStat label="Uncommitted" value={git?.changes != null ? String(git.changes) : "—"} icon={<Pencil className="h-4 w-4" />} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {git?.updated_at ? `Reported by TMCode ${timeAgo(git.updated_at)}.` : "TMCode hasn't reported this repository's state yet."}
        {repoUrl && (
          <>
            {" "}
            Files live on{" "}
            <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              GitHub
            </a>
            .
          </>
        )}
      </p>

      <div>
        <h3 className="mb-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Recent pushes</h3>
        {pushes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-slate-500 dark:border-gray-700 dark:text-slate-400">
            No pushes reported yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {pushes.slice(0, 20).map((p, i) => (
              <li
                key={`${p.commit}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200/70 bg-card-light px-4 py-2.5 dark:border-border-dark/30 dark:bg-card-dark/30"
              >
                <UploadCloud className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary-light dark:text-text-primary-dark">{p.message || "Pushed"}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {p.user?.name ? `${p.user.name} · ` : ""}
                    {formatDateTime(p.at)}
                  </p>
                </div>
                {repoUrl && p.commit ? (
                  <a
                    href={`${repoUrl.replace(/\.git$/, "")}/commit/${p.commit}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {shortSha(p.commit)}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-500">{shortSha(p.commit)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const GitStat: React.FC<{ label: string; value: string; icon: React.ReactNode; mono?: boolean }> = ({ label, value, icon, mono }) => (
  <div className="rounded-2xl border border-white bg-card-light p-3 dark:border-border-dark/30 dark:bg-card-dark/30">
    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
      <span aria-hidden="true">{icon}</span>
      {label}
    </p>
    <p className={`truncate text-base font-bold text-text-primary-light dark:text-text-primary-dark ${mono ? "font-mono" : "tabular-nums"}`}>{value}</p>
  </div>
);

// ─── Activity timeline ────────────────────────────────────────────────────────

const EVENT_META: Record<string, { icon: React.ElementType; color: string; text: (e: ProjectEvent) => string }> = {
  created: { icon: Sparkles, color: "text-violet-500", text: () => "created the project" },
  saved: {
    icon: Save,
    color: "text-blue-500",
    text: (e) => `saved revision #${e.data?.number ?? e.data?.revision_number ?? "?"}${e.data?.message ? ` — “${e.data.message}”` : ""}`,
  },
  pushed: {
    icon: UploadCloud,
    color: "text-emerald-500",
    text: (e) => `pushed ${shortSha(e.data?.commit as string | undefined)}${e.data?.message ? ` — “${e.data.message}”` : ""}`,
  },
  opened: { icon: MonitorUp, color: "text-sky-500", text: (e) => `opened it in TMCode${e.data?.device_name ? ` on ${e.data.device_name}` : ""}` },
  linked: { icon: Link2, color: "text-blue-500", text: (e) => `linked it to ${e.data?.activity_title ?? "an activity"}` },
  unlinked: { icon: Link2, color: "text-slate-400", text: (e) => `unlinked ${e.data?.activity_title ?? "an activity"}` },
  submitted: {
    icon: Send,
    color: "text-emerald-600",
    text: (e) => `submitted it to ${e.data?.activity_title ?? "an activity"}${e.data?.revision_number ? ` (revision #${e.data.revision_number})` : ""}`,
  },
  member_added: { icon: UserPlus, color: "text-violet-500", text: (e) => `added ${e.data?.name ?? e.data?.github_username ?? "a member"}` },
  member_removed: { icon: UserMinus, color: "text-orange-500", text: (e) => `removed ${e.data?.name ?? "a member"}` },
  renamed: { icon: Pencil, color: "text-slate-500", text: (e) => `renamed it to “${e.data?.name ?? ""}”` },
  updated: { icon: Pencil, color: "text-slate-500", text: () => "updated the project settings" },
  archived: { icon: Archive, color: "text-amber-500", text: () => "archived the project" },
  unarchived: { icon: Archive, color: "text-amber-500", text: () => "restored the project" },
  deleted: { icon: Trash2, color: "text-rose-500", text: () => "deleted files" },
};

const fallbackMeta = { icon: FilePlus2, color: "text-slate-400", text: (e: ProjectEvent) => e.type.replace(/_/g, " ") };

export const ActivityTimeline: React.FC<{ events: ProjectEvent[] }> = ({ events }) => {
  const days = useMemo(() => {
    const groups = new Map<string, ProjectEvent[]>();
    [...events]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((e) => {
        const key = new Date(e.created_at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
        groups.set(key, [...(groups.get(key) ?? []), e]);
      });
    return [...groups.entries()];
  }, [events]);

  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:text-slate-400">
        No activity yet.
      </p>
    );
  }

  return (
    <div className="space-y-5" aria-label="Activity timeline">
      {days.map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{day}</h3>
          <ol className="relative ml-3 space-y-3 border-l border-gray-200 pl-5 dark:border-white/10">
            {list.map((e) => {
              const meta = EVENT_META[e.type] ?? fallbackMeta;
              const Icon = meta.icon;
              return (
                <motion.li
                  key={`${e.id}-${e.created_at}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative"
                >
                  <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-gray-200 dark:bg-gray-900 dark:ring-white/10">
                    <Icon className={`h-3 w-3 ${meta.color}`} aria-hidden="true" />
                  </span>
                  <div className="flex items-start gap-2">
                    {e.user && <Avatar name={e.user.name} src={e.user.avatar_url} />}
                    <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
                      <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{e.user?.name ?? "Someone"}</span>{" "}
                      {meta.text(e)}
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        <time dateTime={e.created_at}>{timeAgo(e.created_at)}</time>
                      </span>
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
};
