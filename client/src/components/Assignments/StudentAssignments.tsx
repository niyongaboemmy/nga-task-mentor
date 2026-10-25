import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, LayoutGrid, List, RefreshCw } from "lucide-react";
import Select from "../ui/Select";
import { TaskRow } from "../Dashboard/student/StudentPanels";
import { WorkCard, WorkSkeleton } from "./StudentWork";
import { card, ink } from "./studentWorkTheme";
import {
  getStudentOverview,
  TODO_STATES,
  type StudentTask,
  type TaskState,
} from "../../services/studentOverviewApi";

/**
 * The student's own assignments for the term, as one grid filtered by where
 * each one stands (to do, waiting for a mark, marked, missed). Only subjects
 * that actually have work appear in the subject menu. Data comes from the same
 * per-student overview the dashboard uses, so the states always agree.
 * Filters live in the URL (?status=&subject=) so the dashboard can link here.
 */

type Filter = "todo" | "waiting" | "marked" | "missed" | "all";

const FILTERS: Array<{ key: Filter; label: string; match: (s: TaskState) => boolean }> = [
  { key: "todo", label: "To do", match: (s) => TODO_STATES.includes(s) },
  { key: "waiting", label: "Waiting for mark", match: (s) => s === "submitted" },
  { key: "marked", label: "Marked", match: (s) => s === "graded" },
  { key: "missed", label: "Missed", match: (s) => s === "missed" },
  { key: "all", label: "All", match: () => true },
];

const EMPTY: Record<Filter, string> = {
  todo: "Nothing to do right now.",
  waiting: "Nothing waiting for a mark.",
  marked: "No marked assignments yet.",
  missed: "Nothing missed.",
  all: "No assignments this term yet.",
};

const VIEW_KEY = "tm.assignments.view";
type View = "grid" | "list";

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

// Open work soonest first; everything else most recent first.
const sortKey = (t: StudentTask) => {
  const open = TODO_STATES.includes(t.state);
  const at = new Date(t.due_at ?? t.submitted_at ?? 0).getTime();
  return open ? at : Number.MAX_SAFE_INTEGER - at;
};

const StudentAssignments: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState<StudentTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>(readView);

  const statusParam = params.get("status") as Filter | null;
  const filter: Filter = FILTERS.some((f) => f.key === statusParam) ? statusParam! : "todo";
  const subjectParam = params.get("subject");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const o = await getStudentOverview();
      setTasks(o.tasks.filter((t) => t.kind === "assignment"));
      setError(null);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || "Couldn't load your assignments.");
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

  const inSubject = (tasks ?? []).filter((t) => subjectId === null || t.subject_id === subjectId);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, inSubject.filter((t) => f.match(t.state)).length])) as Record<Filter, number>;
  const shown = inSubject.filter((t) => FILTERS.find((f) => f.key === filter)!.match(t.state)).sort((a, b) => sortKey(a) - sortKey(b));

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
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${ink.primary}`}>Assignments</h1>
          {tasks && (
            <p className={`mt-1 text-sm ${ink.secondary}`}>
              {tasks.length} this term
              {subjects.length > 0 && ` across ${subjects.length} subject${subjects.length === 1 ? "" : "s"}`}
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
            <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setParam("status", f.key === "todo" ? null : f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : `bg-card-light dark:bg-card-dark/40 shadow-sm ${ink.primary} hover:text-blue-600 dark:hover:text-blue-400`
                  }`}
                >
                  {f.label} <span className="ml-0.5 tabular-nums opacity-75">{counts[f.key]}</span>
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
              <p className={`font-medium ${ink.primary}`}>{EMPTY[filter]}</p>
              {filter !== "all" && counts.all > 0 && (
                <button type="button" onClick={() => setParam("status", "all")} className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Show all {counts.all}
                </button>
              )}
            </div>
          ) : view === "grid" ? (
            <ul aria-label="Assignments" className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((t) => (
                <WorkCard key={t.id} task={t} />
              ))}
            </ul>
          ) : (
            <ul aria-label="Assignments" className={`${card} p-2 space-y-0.5`}>
              {shown.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}

          {filter === "missed" && shown.length > 0 && (
            <p className={`text-sm ${ink.secondary}`}>These deadlines have passed and late work isn't accepted online. Ask your teacher about catching up.</p>
          )}
        </>
      )}
    </div>
  );
};

export default StudentAssignments;
