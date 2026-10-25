import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, LayoutGrid, List, RefreshCw } from "lucide-react";
import Select from "../ui/Select";
import { TaskRow } from "../Dashboard/student/StudentPanels";
import { WorkCard, WorkSkeleton } from "./StudentWork";
import { card, ink } from "./studentWorkTheme";
import { getStudentOverview, type StudentTask, type TaskKind } from "../../services/studentOverviewApi";

/**
 * What the student has handed in this term — assignments and quizzes — as one
 * grid, filtered by whether it's been marked yet. Subjects with nothing handed
 * in don't appear at all. Same per-student overview as the dashboard, so the
 * states always agree. Filters live in the URL (?type=&status=&subject=).
 */

type Status = "all" | "waiting" | "marked";
type Kind = "all" | TaskKind;

const STATUSES: Array<{ key: Status; label: string; match: (t: StudentTask) => boolean }> = [
  { key: "all", label: "All handed in", match: () => true },
  { key: "waiting", label: "Waiting for mark", match: (t) => t.state === "submitted" },
  { key: "marked", label: "Marked", match: (t) => t.state === "graded" },
];
const KINDS: Array<{ key: Kind; label: string }> = [
  { key: "all", label: "All" },
  { key: "assignment", label: "Assignments" },
  { key: "quiz", label: "Quizzes" },
];

const VIEW_KEY = "tm.submissions.view";
type View = "grid" | "list";
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

const handedIn = (t: StudentTask) => t.state === "submitted" || t.state === "graded";
const latest = (t: StudentTask) => new Date(t.graded_at ?? t.submitted_at ?? t.due_at ?? 0).getTime();

const StudentSubmissions: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState<StudentTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>(readView);

  const pick = <T extends string>(key: string, allowed: Array<{ key: T }>, fallback: T): T => {
    const v = params.get(key) as T | null;
    return v && allowed.some((a) => a.key === v) ? v : fallback;
  };
  const status = pick<Status>("status", STATUSES, "all");
  const kind = pick<Kind>("type", KINDS, "all");
  const subjectParam = params.get("subject");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const o = await getStudentOverview();
      setTasks(o.tasks.filter(handedIn));
      setError(null);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || "Couldn't load your submissions.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const subjects = useMemo(() => {
    const seen = new Map<number, string>();
    for (const t of tasks ?? []) seen.set(t.subject_id, t.subject_name);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);
  const subjectId = subjects.some((s) => String(s.id) === subjectParam) ? Number(subjectParam) : null;

  const scoped = (tasks ?? []).filter((t) => (kind === "all" || t.kind === kind) && (subjectId === null || t.subject_id === subjectId));
  const counts = Object.fromEntries(STATUSES.map((s) => [s.key, scoped.filter(s.match).length])) as Record<Status, number>;
  const shown = scoped.filter(STATUSES.find((s) => s.key === status)!.match).sort((a, b) => latest(b) - latest(a));
  const marked = (tasks ?? []).filter((t) => t.state === "graded" && t.score_pct != null);
  const average = marked.length ? Math.round(marked.reduce((n, t) => n + t.score_pct!, 0) / marked.length) : null;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const chooseView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${ink.primary}`}>Submissions</h1>
          {tasks && (
            <p className={`mt-1 text-sm ${ink.secondary}`}>
              <span className={`font-semibold ${ink.primary}`}>{tasks.length}</span> handed in this term
              {counts.waiting > 0 && (
                <>
                  {" · "}
                  <span className={`font-semibold ${ink.primary}`}>{(tasks ?? []).filter((t) => t.state === "submitted").length}</span> waiting for a mark
                </>
              )}
              {average !== null && (
                <>
                  {" · "}
                  <span className={`font-semibold ${ink.primary}`}>{average}%</span> average on marked work
                </>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={refreshing}
          aria-label="Refresh"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow ${ink.primary} disabled:opacity-60`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          {tasks && " Showing what was loaded before."}
          <button type="button" onClick={load} className="ml-auto font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {tasks === null ? (
        !error && <WorkSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Kind of work" className="inline-flex rounded-full bg-card-light dark:bg-card-dark/40 shadow-sm p-0.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  aria-pressed={kind === k.key}
                  onClick={() => setParam("type", k.key === "all" ? null : k.key)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    kind === k.key ? "bg-blue-600 text-white" : `${ink.secondary} hover:text-blue-600 dark:hover:text-blue-400`
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={status === s.key}
                  onClick={() => setParam("status", s.key === "all" ? null : s.key)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    status === s.key
                      ? "border-blue-600 text-blue-700 bg-blue-50 dark:bg-blue-900/25 dark:text-blue-300"
                      : `border-transparent bg-card-light dark:bg-card-dark/40 shadow-sm ${ink.primary} hover:text-blue-600 dark:hover:text-blue-400`
                  }`}
                >
                  {s.label} <span className="ml-0.5 tabular-nums opacity-75">{counts[s.key]}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {subjects.length > 1 && (
                <Select
                  aria-label="Subject"
                  value={subjectId ?? ""}
                  onChange={(e) => setParam("subject", e.target.value || null)}
                  className="w-56 max-w-full rounded-full border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark/40 px-3 py-1.5 text-sm"
                >
                  <option value="">All subjects ({subjects.length})</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
              <div role="group" aria-label="Layout" className="inline-flex rounded-full bg-card-light dark:bg-card-dark/40 shadow-sm p-0.5">
                {(["grid", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    aria-label={v === "grid" ? "Grid view" : "List view"}
                    onClick={() => chooseView(v)}
                    className={`p-1.5 rounded-full transition-colors ${view === v ? "bg-blue-600 text-white" : `${ink.secondary} hover:text-blue-600`}`}
                  >
                    {v === "grid" ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className={`${card} px-6 py-12 text-center`}>
              <p className={`font-medium ${ink.primary}`}>
                {tasks.length === 0
                  ? "You haven't handed anything in this term yet."
                  : status === "waiting"
                    ? "Nothing waiting for a mark."
                    : status === "marked"
                      ? "Nothing marked yet."
                      : "Nothing handed in here yet."}
              </p>
            </div>
          ) : view === "grid" ? (
            <ul aria-label="Submissions" className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((t) => (
                <WorkCard key={`${t.kind}-${t.id}`} task={t} />
              ))}
            </ul>
          ) : (
            <ul aria-label="Submissions" className={`${card} p-2 space-y-0.5`}>
              {shown.map((t) => (
                <TaskRow key={`${t.kind}-${t.id}`} task={t} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default StudentSubmissions;
