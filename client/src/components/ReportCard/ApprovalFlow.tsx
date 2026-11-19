import { Link } from "react-router-dom";
import { ArrowRight, Check, Loader2 } from "lucide-react";

/**
 * The class's report-card flow as five steps: marks submitted → comments &
 * attributes → reviewed → approved → published. Each step shows its progress,
 * the step to work on now is highlighted, and the step's next action is one
 * click away. Clicking a step's body filters the students to that stage.
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

const stateOf = (s: FlowStep) => (s.total > 0 && s.done >= s.total ? "done" : "open");

export default function ApprovalFlow({ steps }: { steps: FlowStep[] }) {
  const currentIdx = steps.findIndex((s) => stateOf(s) !== "done");
  const allDone = currentIdx === -1;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-gray-900" aria-label="Report card approval flow" data-testid="approval-flow">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Approval flow</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark" aria-live="polite">
          {allDone ? "Every step is done: the class's report cards are published." : `Now: step ${currentIdx + 1} of ${steps.length} — ${steps[currentIdx].title}`}
        </p>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-5">
        {steps.map((s, i) => {
          const done = stateOf(s) === "done";
          const current = i === currentIdx;
          const pct = s.total ? Math.min(100, Math.round((s.done / s.total) * 100)) : 0;
          return (
            <li
              key={s.key}
              data-testid={`flow-step-${s.key}`}
              aria-current={current ? "step" : undefined}
              className={`relative flex flex-col rounded-xl border p-3 transition-colors ${
                current
                  ? "border-blue-500 bg-blue-50/70 dark:border-blue-400/60 dark:bg-blue-500/10"
                  : done
                    ? "border-gray-200 bg-white dark:border-white/10 dark:bg-transparent"
                    : "border-dashed border-gray-200 dark:border-white/10"
              }`}
            >
              <button
                type="button"
                onClick={s.onSelect}
                disabled={!s.onSelect}
                className="flex flex-1 flex-col items-start gap-1.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default"
                title={s.onSelect ? "Show the students at this step" : undefined}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      done ? "bg-blue-600 text-white" : current ? "border-2 border-blue-600 text-blue-700 dark:text-blue-300" : "border border-gray-300 text-text-secondary-light dark:border-white/20 dark:text-text-secondary-dark"
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary-light dark:text-text-primary-dark">{s.title}</span>
                  <span className="text-xs font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                    {s.done}/{s.total}
                  </span>
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden="true">
                  <span className={`block h-full rounded-full transition-all duration-500 ${done ? "bg-blue-600" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="text-[11px] leading-snug text-text-secondary-light dark:text-text-secondary-dark">{s.detail}</span>
              </button>
              {s.action && <StepAction action={s.action} emphasise={current} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepAction({ action, emphasise }: { action: FlowAction; emphasise: boolean }) {
  const strong = action.primary && emphasise;
  const cls = `mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 ${
    strong
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-500/10"
  }`;
  const inner = (
    <>
      {action.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {action.label}
      {!action.busy && <ArrowRight className="h-3.5 w-3.5" />}
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
