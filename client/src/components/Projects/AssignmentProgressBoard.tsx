import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ClipboardList } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";
import { tmcodeAssignmentsApi, type AssignmentSummary } from "../../services/tmcodeAssignmentsApi";
import { dueCountdown } from "../Assignments/tmcode/tmcodeFormat";

/**
 * Teacher monitor: every open TMCode assignment they teach, with how far the
 * class is — not started / working / submitted / graded — as one stacked bar.
 * Each row opens the assignment, where the Workspaces panel has the students.
 */
const AssignmentProgressBoard: React.FC = () => {
  const [rows, setRows] = useState<AssignmentSummary[] | null>(null);

  useEffect(() => {
    tmcodeAssignmentsApi
      .list("teaching")
      .then((all) => setRows(all.filter((a) => a.status === "published" && a.teaching)))
      .catch(() => setRows([]));
  }, []);

  if (rows && rows.length === 0) return null;

  return (
    <section
      aria-label="Assignments in progress"
      data-testid="assignment-progress-board"
      className="rounded-2xl border border-gray-200/60 bg-white/80 p-4 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50"
    >
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <h2 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Assignments in progress</h2>
        <div className="ml-auto hidden items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 sm:flex" aria-hidden="true">
          {[
            ["bg-slate-200 dark:bg-white/10", "Not started"],
            ["bg-amber-400", "Working"],
            ["bg-blue-500", "Submitted"],
            ["bg-emerald-500", "Graded"],
          ].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${c}`} />
              {l}
            </span>
          ))}
        </div>
      </div>
      {rows === null ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((a) => {
            const t = a.teaching!;
            const total = Math.max(t.students, t.started, 1);
            const graded = t.graded;
            const submitted = Math.max(0, t.submitted - t.graded);
            const working = Math.max(0, t.started - t.submitted);
            const notStarted = Math.max(0, total - t.started);
            const due = dueCountdown(a.due_date);
            const seg = (n: number, cls: string, label: string) =>
              n > 0 ? <span className={`h-full ${cls}`} style={{ width: `${(n / total) * 100}%` }} title={`${n} ${label}`} /> : null;
            return (
              <li key={a.id}>
                <Link
                  to={`/assignments/${a.id}`}
                  className="group flex flex-col gap-2 rounded-xl px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-white/[0.04] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 sm:w-72">
                    <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{a.title}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {a.course_name ?? "Course"}
                      {due ? ` · ${due.text}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-1 items-center gap-3">
                    <div
                      className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
                      role="img"
                      aria-label={`${notStarted} not started, ${working} working, ${submitted} submitted, ${graded} graded`}
                    >
                      {seg(graded, "bg-emerald-500", "graded")}
                      {seg(submitted, "bg-blue-500", "submitted")}
                      {seg(working, "bg-amber-400", "working")}
                    </div>
                    <span className="w-28 text-right text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                      {submitted > 0 ? <span className="font-semibold text-blue-700 dark:text-blue-300">{submitted} to grade</span> : `${t.started}/${t.students} started`}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AssignmentProgressBoard;
