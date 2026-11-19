import { AlertTriangle, CheckCircle2, ListChecks, Tags, X } from "lucide-react";
import type { MarksAttention } from "../../services/instructorOverviewApi";
import { Skeleton } from "../ui/Skeleton";

export type AttentionFilter = "unmapped" | "missing" | null;

/**
 * What stands between the teacher's marks and the report cards, at the top
 * of Grades: assessments whose marks aren't mapped to a category (they count
 * nowhere), and finished assessments with missing marks. Each card filters
 * the list below to exactly those assessments.
 */
export default function MarksAttentionBar({
  data,
  loading,
  error,
  active,
  onFilter,
}: {
  data: MarksAttention | null;
  loading: boolean;
  error: boolean;
  active: AttentionFilter;
  onFilter: (f: AttentionFilter) => void;
}) {
  if (loading && !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" data-testid="marks-attention-loading">
        <Skeleton className="h-[72px] rounded-2xl" />
        <Skeleton className="h-[72px] rounded-2xl" />
      </div>
    );
  }
  if (error && !data) return null;
  if (!data) return null;
  const { unmapped, incomplete, missing_marks } = data.totals;
  const period = [data.term, data.academic_year].filter(Boolean).join(" · ");

  if (!unmapped && !incomplete) {
    return (
      <div
        className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-text-secondary-light dark:border-white/10 dark:bg-gray-900 dark:text-text-secondary-dark"
        data-testid="marks-attention"
      >
        <CheckCircle2 className="h-4 w-4 text-blue-600" />
        <span>
          <strong className="font-semibold text-text-primary-light dark:text-text-primary-dark">All marks are mapped and complete</strong>
          {period ? ` for ${period}` : ""}. They'll count on report cards.
        </span>
      </div>
    );
  }

  const cards: Array<{ key: Exclude<AttentionFilter, null>; n: number; title: string; body: string; Icon: typeof Tags }> = [
    {
      key: "unmapped",
      n: unmapped,
      title: `${unmapped} not mapped`,
      body: unmapped ? "Marks recorded but in no category (CW, HW, MD, EOT), so they don't count on report cards." : "Every assessment with marks is mapped.",
      Icon: Tags,
    },
    {
      key: "missing",
      n: incomplete,
      title: `${incomplete} with missing marks`,
      body: incomplete
        ? `${missing_marks} student mark${missing_marks === 1 ? "" : "s"} not recorded on finished assessments. Record them or mark absent/exempt.`
        : "Every finished assessment has a mark for each student.",
      Icon: ListChecks,
    },
  ];

  return (
    <section aria-label="Marks needing attention" data-testid="marks-attention">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          <AlertTriangle className="h-4 w-4 text-orange-500" /> Needs your attention{period ? <span className="font-normal text-text-secondary-light dark:text-text-secondary-dark"> · {period}</span> : null}
        </p>
        {active && (
          <button
            type="button"
            onClick={() => onFilter(null)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
          >
            <X className="h-3.5 w-3.5" /> Show all assessments
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ key, n, title, body, Icon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              type="button"
              disabled={!n}
              aria-pressed={on}
              onClick={() => onFilter(on ? null : key)}
              data-testid={`attention-${key}`}
              className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:cursor-default ${
                on
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400/60 dark:bg-blue-500/10"
                  : n
                    ? "border-orange-200 bg-white hover:border-orange-300 hover:bg-orange-50/50 dark:border-orange-500/30 dark:bg-gray-900 dark:hover:bg-orange-500/5"
                    : "border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900"
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  n ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                }`}
              >
                {n ? <Icon className="h-4.5 w-4.5" /> : <CheckCircle2 className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</span>
                <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">{body}</span>
                {n > 0 && (
                  <span className="mt-1 block text-xs font-semibold text-blue-700 dark:text-blue-300">{on ? "Showing these below" : "Show them →"}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
