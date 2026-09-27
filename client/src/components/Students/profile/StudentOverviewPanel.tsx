import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Award,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  HelpCircle,
  Info,
  Lightbulb,
  Target,
} from "lucide-react";
import {
  summariseMarks,
  type MarksSummary,
} from "../../../services/studentProfileApi";
import {
  needsAttention,
  toMarkInputs,
  type ActivityItem,
  type Tone,
} from "../../../services/studentActivity";
import type { Insight } from "../../../services/studentInsights";
import type {
  StandingKindFilter,
  StandingResult,
} from "../../../services/studentStandingApi";
import StandingCard from "./StandingCard";
import { BandChip, Meter, Pct, Segmented } from "./profileParts";
import { CARD, TONE_CLASSES, type ProfileSubject } from "./profileTheme";

// ─── Student profile → Overview ───────────────────────────────────────────────
// Decision board: the headline numbers, where the student stands in class,
// what needs doing about it, and a subject-by-subject breakdown that follows
// the same subject / kind filters as the standing card.

interface Props {
  items: ActivityItem[];
  subjects: ProfileSubject[];
  summary: MarksSummary;
  insights: Insight[];
  standing: StandingResult | null;
  subjectStanding: Record<string, StandingResult> | null;
  standingLoading: boolean;
  standingError: boolean;
  subjectId: string | null;
  onSubject: (courseId: string | null) => void;
  kind: StandingKindFilter;
  onKind: (kind: StandingKindFilter) => void;
  onInsight: (insight: Insight) => void;
}

const TONE_ICON: Record<Tone, React.ElementType> = {
  danger: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  neutral: CircleDot,
};

function Kpi({
  icon: Icon,
  label,
  children,
  hint,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70">
        <span
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}
        >
          <Icon className="w-4 h-4" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
        {children}
      </div>
      {hint && (
        <div className="mt-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
          {hint}
        </div>
      )}
    </div>
  );
}

type SortKey = "weakest" | "strongest" | "name";

export default function StudentOverviewPanel({
  items,
  subjects,
  summary,
  insights,
  standing,
  subjectStanding,
  standingLoading,
  standingError,
  subjectId,
  onSubject,
  kind,
  onKind,
  onInsight,
}: Props) {
  const [sort, setSort] = useState<SortKey>("weakest");

  // Headline tiles.
  const quizzes = items.filter((i) => i.kind === "quiz");
  const quizzesTaken = quizzes.filter((i) => i.status === "graded");
  const quizzesPassed = quizzesTaken.filter((i) => i.passed).length;
  const passRate = quizzesTaken.length
    ? Math.round((quizzesPassed / quizzesTaken.length) * 100)
    : null;
  const overdue = items.filter((i) => i.status === "overdue").length;
  const dueSoon = items.filter((i) => i.status === "due_soon").length;
  const completion = summary.totalCount
    ? Math.round((summary.markedCount / summary.totalCount) * 100)
    : null;

  // The subject list follows the kind filter.
  const kindSummary = useMemo(
    () =>
      kind === "all"
        ? summary
        : summariseMarks(toMarkInputs(items.filter((i) => i.kind === kind))),
    [items, kind, summary],
  );

  const rows = useMemo(() => {
    const list = subjects.map((s) => {
      const stats = kindSummary.byCourse[s.courseId];
      const subjectItems = items.filter(
        (i) => i.courseId === s.courseId && (kind === "all" || i.kind === kind),
      );
      return {
        ...s,
        average: stats?.average ?? null,
        marked: stats?.markedCount ?? 0,
        total: stats?.totalCount ?? 0,
        attention: subjectItems.filter(needsAttention).length,
        standing: subjectStanding?.[s.courseId] ?? null,
      };
    });
    const byName = (a: (typeof list)[number], b: (typeof list)[number]) =>
      a.name.localeCompare(b.name);
    return [...list].sort((a, b) => {
      if (sort === "name") return byName(a, b);
      // Unmarked subjects sink to the bottom either way.
      if (a.average === null || b.average === null)
        return a.average === null
          ? b.average === null
            ? byName(a, b)
            : 1
          : -1;
      return sort === "weakest" ? a.average - b.average : b.average - a.average;
    });
  }, [subjects, kindSummary, items, kind, subjectStanding, sort]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          icon={Award}
          label="Overall average"
          accent="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
          hint={
            summary.overallAverage === null
              ? "Nothing marked yet"
              : `${summary.markedCount} of ${summary.totalCount} marked`
          }
        >
          <span className="flex items-center gap-2" data-testid="kpi-average">
            <Pct value={summary.overallAverage} />
            <BandChip value={summary.overallAverage} />
          </span>
        </Kpi>
        <Kpi
          icon={Target}
          label="Work marked"
          accent="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
          hint={<Meter value={completion} color="#6366f1" />}
        >
          {completion === null ? "—" : `${completion}%`}
          <span className="ml-1 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark/60">
            {summary.markedCount}/{summary.totalCount}
          </span>
        </Kpi>
        <Kpi
          icon={HelpCircle}
          label="Quiz pass rate"
          accent="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
          hint={
            quizzesTaken.length
              ? `${quizzesPassed} passed of ${quizzesTaken.length} taken · ${quizzes.length} set`
              : `${quizzes.length} set, none taken`
          }
        >
          {passRate === null ? "—" : `${passRate}%`}
        </Kpi>
        <Kpi
          icon={overdue ? AlertOctagon : ClipboardCheck}
          label="Overdue / missed"
          accent={
            overdue
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
          }
          hint={
            dueSoon ? `${dueSoon} due in the next few days` : "Nothing due soon"
          }
        >
          <span className={overdue ? "text-red-600 dark:text-red-400" : ""}>
            {overdue}
          </span>
        </Kpi>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <div className="xl:col-span-2">
          <StandingCard
            result={standing}
            loading={standingLoading}
            error={standingError}
            subjects={subjects}
            subjectId={subjectId}
            onSubject={onSubject}
            kind={kind}
            onKind={onKind}
          />
        </div>

        <section
          className={`${CARD} p-4 sm:p-5`}
          aria-labelledby="insights-title"
        >
          <h3
            id="insights-title"
            className="text-base font-bold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2"
          >
            <Lightbulb className="w-4 h-4 text-amber-500" /> What needs doing
          </h3>
          {insights.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              Nothing to flag yet — insights appear as work gets marked.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {insights.map((insight) => {
                const Icon = TONE_ICON[insight.tone];
                const tone = TONE_CLASSES[insight.tone];
                const body = (
                  <>
                    <span
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.soft}`}
                    >
                      <Icon className={`w-4 h-4 ${tone.icon}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                        {insight.title}
                      </span>
                      {insight.detail && (
                        <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                          {insight.detail}
                        </span>
                      )}
                    </span>
                    {insight.target && (
                      <ChevronRight className="w-4 h-4 mt-1.5 text-gray-400 flex-shrink-0" />
                    )}
                  </>
                );
                return (
                  <li key={insight.id}>
                    {insight.target ? (
                      <button
                        type="button"
                        onClick={() => onInsight(insight)}
                        className="w-full flex items-start gap-3 p-2 -mx-2 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="flex items-start gap-3 p-2 -mx-2">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section
        className={`${CARD} overflow-hidden`}
        aria-labelledby="subjects-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3
              id="subjects-title"
              className="text-base font-bold text-text-primary-light dark:text-text-primary-dark"
            >
              Subject performance
            </h3>
            <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
              Tap a subject to focus the standing on it. The tick on each bar is
              the class average.
            </p>
          </div>
          <Segmented
            label="Sort subjects"
            value={sort}
            onChange={setSort}
            options={[
              { value: "weakest", label: "Weakest first" },
              { value: "strongest", label: "Strongest" },
              { value: "name", label: "A–Z" },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <p className="p-5 text-sm text-text-secondary-light dark:text-text-secondary-dark/60">
            Not enrolled in any subjects yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => {
              const selected = row.courseId === subjectId;
              return (
                <li
                  key={row.courseId}
                  data-testid={`subject-row-${row.courseId}`}
                  className={`flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors ${
                    selected
                      ? "bg-blue-50/70 dark:bg-blue-500/10"
                      : "hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSubject(selected ? null : row.courseId)}
                    className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] items-center gap-x-4 gap-y-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                        {row.name}
                      </span>
                      <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 truncate">
                        {row.code} ·{" "}
                        {row.total
                          ? `${row.marked}/${row.total} marked`
                          : "nothing set"}
                        {row.standing?.rank
                          ? ` · rank ${row.standing.rank}/${row.standing.rankedCount}`
                          : ""}
                      </span>
                    </span>
                    <Meter
                      value={row.average}
                      reference={row.standing?.classAverage ?? null}
                    />
                    <span className="flex items-center gap-2 justify-end">
                      <span className="w-10 flex justify-end">
                        {row.attention > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ring-1 ${TONE_CLASSES.danger.chip}`}
                            title={`${row.attention} need attention`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {row.attention}
                          </span>
                        )}
                      </span>
                      <Pct
                        value={row.average}
                        className="w-14 text-right text-sm font-bold"
                      />
                    </span>
                  </button>
                  <Link
                    to={`/courses/${row.courseId}`}
                    aria-label={`Open ${row.name}`}
                    title="Open subject"
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-white dark:hover:bg-white/10 transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
