import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ClipboardCheck, Code2, EyeOff, PenLine, RefreshCw, Search, TerminalSquare, Trash2, Undo2, Users } from "lucide-react";
import ReturnForChangesDialog from "../../Projects/ReturnForChangesDialog";
import { Skeleton } from "../../ui/Skeleton";
import { Avatar, LiveDot, Pill } from "../../Projects/ProjectBadges";
import { formatDateTime, timeAgo } from "../../Projects/projectFormat";
import { apiErrorMessage } from "../../../services/projectsApi";
import { gradingWorkspaceHref } from "../../../services/practicalsApi";
import {
  KIND_LABEL,
  STATE_META,
  tmcodeAssignmentsApi,
  type WorkState,
  type WorkspaceRow,
  type WorkspacesView,
} from "../../../services/tmcodeAssignmentsApi";

/**
 * Teacher "Workspaces" panel of a TMCode practical (GET
 * /tmcode/assignments/:id/workspaces): every enrolled student with their
 * state, a live dot when they share their live status, a link to their code
 * at the submitted revision, and Grade, which opens the page's existing
 * grading dialog.
 */

type Filter = "all" | WorkState | "live" | "removed";
const POLL_MS = 30_000;

/** Where "View code" goes: the submitted revision, else the latest save. */
export const workspaceCodeHref = (row: Pick<WorkspaceRow, "project_id" | "revision_id">): string | null =>
  row.project_id ? `/projects/${row.project_id}?tab=files${row.revision_id ? `&rev=${row.revision_id}` : ""}` : null;

const TmcodeWorkspacesPanel: React.FC<{
  assignmentId: number;
  /** Opens the existing grading dialog for this student; absent = no grading here. */
  onGrade?: (row: WorkspaceRow) => void;
  /** Bump to reload (e.g. after grading). */
  refreshKey?: number;
}> = ({ assignmentId, onGrade, refreshKey = 0 }) => {
  const [data, setData] = useState<WorkspacesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [returning, setReturning] = useState<WorkspaceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await tmcodeAssignmentsApi.workspaces(assignmentId));
      setNow(Date.now());
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load the workspaces."));
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Live dots age out: refresh quietly while the tab is visible.
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.workspaces ?? []).filter((r) => {
      if (filter === "live" && !(r.presence?.shared && r.presence.online)) return false;
      if (filter === "removed") {
        if (r.project_status !== "removed") return false;
      } else if (filter !== "all" && filter !== "live" && r.state !== filter) return false;
      return !q || r.user.name.toLowerCase().includes(q) || (r.user.email ?? "").toLowerCase().includes(q);
    });
  }, [data, filter, query]);

  const counts = data?.counts;
  const chips: { value: Filter; label: string; count?: number }[] = [
    { value: "all", label: "All", count: counts?.students },
    { value: "live", label: "Live now", count: counts?.live },
    { value: "in_progress", label: "Working", count: data?.workspaces.filter((r) => r.state === "in_progress").length },
    { value: "submitted", label: "To grade", count: data?.workspaces.filter((r) => r.state === "submitted").length },
    { value: "graded", label: "Graded", count: counts?.graded },
    { value: "not_started", label: "Not started", count: data?.workspaces.filter((r) => r.state === "not_started").length },
  ];
  const removedCount = data?.workspaces.filter((r) => r.project_status === "removed").length ?? 0;
  if (removedCount) chips.push({ value: "removed", label: "Removed", count: removedCount });

  return (
    <section
      aria-label="Workspaces"
      data-testid="tmcode-workspaces"
      className="overflow-hidden rounded-2xl border border-gray-200/70 bg-card-light shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30"
    >
      <header className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <TerminalSquare className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">Workspaces</h2>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {data?.assignment.kind ? `TMCode ${KIND_LABEL[data.assignment.kind].toLowerCase()}` : "TMCode"} · each student&apos;s
              copy of the starter files
              {data?.assignment.read_only ? " · completed (read-only)" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onGrade && (
            <Link
              to={gradingWorkspaceHref("assignment", assignmentId)}
              data-testid="open-grading-workspace"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Grade in workspace
            </Link>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-white/5 sm:grid-cols-4">
        {[
          { label: "Students", value: counts?.students },
          { label: "Started", value: counts?.started },
          { label: "Submitted", value: counts?.submitted },
          { label: "Graded", value: counts?.graded },
        ].map((s) => (
          <div key={s.label} className="bg-card-light px-4 py-3 dark:bg-gray-900/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/70">{s.label}</p>
            {data ? (
              <p className="text-xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark" data-testid={`ws-count-${s.label.toLowerCase()}`}>
                {s.value ?? 0}
              </p>
            ) : (
              <Skeleton className="mt-1 h-6 w-10" />
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 p-3 sm:p-4 lg:flex-row lg:items-center">
        <div role="radiogroup" aria-label="Show" className="flex gap-1 overflow-x-auto pb-0.5">
          {chips.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={filter === c.value}
              onClick={() => setFilter(c.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === c.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-slate-600 hover:bg-gray-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              {c.value === "live" && <LiveDot live={!!c.count} className="!h-2 !w-2" label="Live" />}
              {c.label}
              {c.count !== undefined && <span className="tabular-nums opacity-80">{c.count}</span>}
            </button>
          ))}
        </div>
        <label className="relative lg:ml-auto lg:w-64">
          <span className="sr-only">Search students</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
          />
        </label>
      </div>

      {/* Rows */}
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        {error && !data ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={load} className="font-semibold hover:underline">
              Try again
            </button>
          </div>
        ) : !data ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-700" data-testid="workspaces-empty">
            <Users className="h-6 w-6 text-slate-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {data.workspaces.length ? "No student matches" : "No students yet"}
            </p>
            <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
              {data.workspaces.length
                ? "Try another filter."
                : "Students appear here from the course roster and as soon as they start the assignment in TMCode."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-white/5 dark:border-white/5">
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <WorkspaceRowItem
                  key={r.user.id ?? `m${r.user.mis_user_id}`}
                  row={r}
                  now={now}
                  assignmentId={assignmentId}
                  onGrade={onGrade}
                  onReturn={setReturning}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <ReturnForChangesDialog
        open={!!returning}
        projectId={returning?.project_id ?? null}
        studentName={returning?.user.name ?? "the student"}
        onClose={() => setReturning(null)}
        onReturned={load}
      />
    </section>
  );
};

const WorkspaceRowItem: React.FC<{
  row: WorkspaceRow;
  now: number;
  assignmentId: number;
  onGrade?: (row: WorkspaceRow) => void;
  onReturn?: (row: WorkspaceRow) => void;
}> = ({ row: r, now, assignmentId, onGrade, onReturn }) => {
  const meta = STATE_META[r.state];
  const href = workspaceCodeHref(r);
  const live = !!(r.presence?.shared && r.presence.online);
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-3 bg-white/60 p-3 dark:bg-gray-900/30 md:flex-row md:items-center"
      data-testid="workspace-row"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={r.user.name} src={r.user.avatar_url} size="md" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            <span className="truncate">{r.user.name}</span>
            {r.presence?.shared && <LiveDot live={live} label={live ? "Open in TMCode now" : "Not open in TMCode"} />}
          </p>
          <p className="truncate text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {live && r.presence?.file
              ? `editing ${r.presence.file}`
              : r.submitted_at
                ? `submitted ${formatDateTime(r.submitted_at)}`
                : r.last_activity_at
                  ? `active ${timeAgo(r.last_activity_at, now)}`
                  : r.user.id
                    ? "hasn't started"
                    : "hasn't signed in to Task Mentor yet"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Pill tone={meta.tone} testId="workspace-state">
          {meta.label}
          {r.revision_number ? ` · rev ${r.revision_number}` : ""}
        </Pill>
        {r.project_status === "removed" && (
          <Pill tone="slate" icon={<Trash2 className="h-3 w-3" aria-hidden="true" />} title="The student removed this project">
            Removed
          </Pill>
        )}
        {r.presence && !r.presence.shared && (
          <Pill tone="slate" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />} title="The student turned Share live status off">
            Live status not shared
          </Pill>
        )}
        {r.grade !== null && (
          <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {r.grade}
            <span className="text-xs font-medium text-slate-500"> / {r.max_points}</span>
          </span>
        )}
        {href && (
          <Link
            to={href}
            data-track="tm.assignment.workspace_code"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:text-slate-200 dark:hover:text-blue-300"
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            {r.revision_id ? `Code at rev ${r.revision_number ?? ""}`.trim() : "View code"}
          </Link>
        )}
        {onReturn && r.project_id && r.state === "submitted" && r.project_status === "submitted" && (
          <button
            type="button"
            onClick={() => onReturn(r)}
            data-testid="workspace-return"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:text-amber-700 dark:border-gray-700 dark:text-slate-200 dark:hover:text-amber-300"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Return for changes
          </button>
        )}
        {onGrade && r.project_id && r.user.id && (r.state === "submitted" || r.state === "graded") ? (
          // A submitted project: grade it against the criteria in the workspace.
          <Link
            to={gradingWorkspaceHref("assignment", assignmentId, { studentId: r.user.id })}
            data-track="tm.assignment.workspace_grade"
            data-testid="workspace-grade"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              r.state === "submitted"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
            }`}
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            {r.state === "graded" ? "Regrade" : "Grade"}
          </Link>
        ) : onGrade && (r.state === "submitted" || r.state === "graded" || r.user.mis_user_id) && (
          <button
            type="button"
            onClick={() => onGrade(r)}
            data-track="tm.assignment.workspace_grade"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              r.state === "submitted"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
            }`}
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            {r.state === "graded" ? "Regrade" : "Grade"}
          </button>
        )}
      </div>
    </motion.li>
  );
};

export default TmcodeWorkspacesPanel;
