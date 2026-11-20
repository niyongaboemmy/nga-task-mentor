import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Filter, Loader2, Lock } from "lucide-react";

/**
 * The class's report-card flow as five steps: marks submitted → comments &
 * attributes → reviewed → approved → published.
 *
 * A connected stepper shows where the class is at a glance; the panel under
 * it explains one step (the current one unless another is picked) with its
 * progress, what's left and its next action. "Show students" filters the
 * matrix to the cards at that step.
 */
export interface FlowAction {
  label: string;
  onClick?: () => void;
  to?: string;
  busy?: boolean;
  /** Secondary actions (navigate/filter) look lighter than doing the step. */
  primary?: boolean;
}

export interface FlowStep {
  key: string;
  title: string;
  done: number;
  total: number;
  /** One line on what's left (or who can do it). */
  detail: string;
  action?: FlowAction | null;
  onSelect?: () => void;
}

const isDone = (s: FlowStep) => s.total > 0 && s.done >= s.total;
const pctOf = (s: FlowStep) => (s.total ? Math.min(100, Math.round((s.done / s.total) * 100)) : 0);

export default function ApprovalFlow({ steps }: { steps: FlowStep[] }) {
  const currentIdx = steps.findIndex((s) => !isDone(s));
  const allDone = currentIdx === -1;
  const home = allDone ? steps.length - 1 : currentIdx;
  const [picked, setPicked] = useState(home);
  // Follow the flow: when the class moves to another step, show that one.
  useEffect(() => setPicked(home), [home]);

  const doneSteps = steps.filter(isDone).length;
  const sel = steps[Math.min(picked, steps.length - 1)];
  if (!sel) return null;
  const selIdx = steps.indexOf(sel);
  const selDone = isDone(sel);
  const selState = selDone ? "Done" : selIdx === currentIdx ? "Now" : selIdx > currentIdx ? "Up next" : "Open";

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-panel-line dark:bg-panel-dark" aria-label="Report card approval flow" data-testid="approval-flow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Approval flow</p>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark" aria-live="polite">
            {allDone ? "Every step is done: the class's report cards are published." : `Step ${currentIdx + 1} of ${steps.length}: ${steps[currentIdx].title}`}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          {doneSteps}/{steps.length} steps done
        </span>
      </div>

      {/* Stepper */}
      <ol className="mt-4 grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Steps">
        {steps.map((s, i) => {
          const done = isDone(s);
          const current = i === currentIdx;
          const active = i === selIdx;
          return (
            <li key={s.key} className="relative flex flex-col items-center" data-testid={`flow-step-${s.key}`} aria-current={current ? "step" : undefined}>
              {/* connector to the next step */}
              {i < steps.length - 1 && (
                <span className="absolute left-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-gray-200 dark:bg-white/10" aria-hidden="true">
                  <span className={`block h-full bg-blue-600 transition-all duration-500 ${done ? "w-full" : "w-0"}`} />
                </span>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${s.title}: ${s.done} of ${s.total}`}
                onClick={() => setPicked(i)}
                className="group relative z-10 flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 pb-1 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? "bg-blue-600 text-white"
                      : current
                        ? "border-2 border-blue-600 bg-white text-blue-700 dark:bg-panel-dark dark:text-blue-300"
                        : "border border-gray-300 bg-white text-text-secondary-light group-hover:border-blue-400 dark:border-white/20 dark:bg-panel-dark dark:text-text-secondary-dark"
                  } ${active ? "ring-4 ring-blue-500/20" : ""}`}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`hidden max-w-full truncate text-xs sm:block ${
                    active ? "font-semibold text-blue-700 dark:text-blue-300" : "font-medium text-text-primary-light group-hover:text-blue-700 dark:text-text-primary-dark dark:group-hover:text-blue-300"
                  }`}
                >
                  {s.title}
                </span>
                <span className="text-[11px] tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                  {s.done}/{s.total}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* The picked step */}
      <div
        className={`mt-3 flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center ${
          selIdx === currentIdx ? "border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/5" : "border-gray-200 bg-gray-50 dark:border-panel-line dark:bg-panel-raised"
        }`}
        role="tabpanel"
        data-testid={`flow-panel-${sel.key}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                selState === "Done"
                  ? "bg-blue-600 text-white"
                  : selState === "Now"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                    : "bg-gray-200 text-text-secondary-light dark:bg-white/10 dark:text-text-secondary-dark"
              }`}
            >
              {selState}
            </span>
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {selIdx + 1}. {sel.title}
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">{sel.detail}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" aria-hidden="true">
              <span className={`block h-full rounded-full transition-all duration-500 ${selDone ? "bg-blue-600" : "bg-blue-400"}`} style={{ width: `${pctOf(sel)}%` }} />
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
              {sel.done}/{sel.total} · {pctOf(sel)}%
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-[45%] sm:justify-end">
          {sel.onSelect && (
            <button
              type="button"
              onClick={sel.onSelect}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-text-secondary-light transition-colors hover:bg-gray-100 hover:text-text-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-text-secondary-dark dark:hover:bg-panel-raised dark:hover:text-text-primary-dark"
            >
              <Filter className="h-3.5 w-3.5" /> Show students
            </button>
          )}
          {sel.action ? (
            <StepAction action={sel.action} />
          ) : !selDone && selIdx > currentIdx ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              <Lock className="h-3.5 w-3.5" /> Opens after step {currentIdx + 1}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StepAction({ action }: { action: FlowAction }) {
  const cls = `inline-flex max-w-full items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 ${
    action.primary
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-500/10"
  }`;
  const inner = (
    <>
      {action.busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
      <span className="truncate" title={action.label}>
        {action.label}
      </span>
      {!action.busy && <ArrowRight className="h-3.5 w-3.5 shrink-0" />}
    </>
  );
  if (action.to) {
    return (
      <Link to={action.to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} disabled={action.busy} className={cls}>
      {inner}
    </button>
  );
}
