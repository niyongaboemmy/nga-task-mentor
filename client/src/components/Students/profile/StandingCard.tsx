import { Info, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { bandMeta, bandOf } from "../../../services/subjectReportApi";
import type { StandingKindFilter, StandingResult } from "../../../services/studentStandingApi";
import { BandChip, Pct, Segmented, SubjectSelect } from "./profileParts";
import { CARD, KIND_OPTIONS, type ProfileSubject } from "./profileTheme";

// ─── Class standing ───────────────────────────────────────────────────────────
// Rank, percentile and the gap to the class average, for all subjects or one,
// all work or one kind — plus a strip showing where the student sits among
// every ranked classmate (classmates are anonymous dots).

interface Props {
  result: StandingResult | null;
  loading: boolean;
  error: boolean;
  subjects: ProfileSubject[];
  subjectId: string | null;
  onSubject: (courseId: string | null) => void;
  kind: StandingKindFilter;
  onKind: (kind: StandingKindFilter) => void;
}

function Strip({ result }: { result: StandingResult }) {
  const me = result.score;
  return (
    <div className="pt-6 pb-1">
      <div className="relative h-8" aria-hidden>
        {/* band backdrop */}
        <div className="absolute inset-x-0 top-3.5 h-1 rounded-full bg-gradient-to-r from-red-400/40 via-amber-400/40 via-60% to-emerald-400/40" />
        {result.scores.map((s, i) => (
          <span
            key={i}
            className="absolute top-2.5 w-2.5 h-2.5 -ml-[5px] rounded-full bg-gray-400/70 dark:bg-gray-500/70 ring-2 ring-white dark:ring-gray-900"
            style={{ left: `${s}%` }}
          />
        ))}
        {result.classAverage !== null && (
          <span
            className="absolute top-0 bottom-0 w-px bg-gray-700 dark:bg-gray-200"
            style={{ left: `${result.classAverage}%` }}
          >
            <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
              avg {result.classAverage}%
            </span>
          </span>
        )}
        {me !== null && (
          <span
            className="absolute top-1 w-4 h-4 -ml-2 rounded-full ring-4 ring-white dark:ring-gray-900 shadow"
            style={{ left: `${me}%`, backgroundColor: bandMeta(bandOf(me)).color }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-text-secondary-light dark:text-text-secondary-dark/50 tabular-nums">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default function StandingCard({
  result,
  loading,
  error,
  subjects,
  subjectId,
  onSubject,
  kind,
  onKind,
}: Props) {
  const delta =
    result?.score !== null && result?.score !== undefined && result.classAverage !== null
      ? Math.round((result.score - result.classAverage) * 10) / 10
      : null;
  const kindLabel = KIND_OPTIONS.find((k) => k.value === kind)!.label.toLowerCase();
  const subjectName = subjects.find((s) => s.courseId === subjectId)?.name;

  return (
    <section className={`${CARD} p-4 sm:p-5 h-full`} aria-labelledby="standing-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="standing-title" className="text-base font-bold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" /> Class standing
        </h3>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <SubjectSelect subjects={subjects} value={subjectId} onChange={onSubject} />
          <Segmented label="Kind of work" value={kind} options={KIND_OPTIONS} onChange={onKind} />
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-3 gap-4 animate-pulse" data-testid="standing-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      ) : error || !result ? (
        <p className="mt-5 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
          Class ranking is unavailable right now. The marks below are unaffected.
        </p>
      ) : result.rank === null ? (
        <p className="mt-5 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
          No marked {kind === "all" ? "work" : kindLabel} yet{subjectName ? ` in ${subjectName}` : ""}, so there
          is nothing to rank.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                Rank
              </p>
              <p className="mt-1 flex items-baseline gap-1" data-testid="standing-rank">
                <span className="text-3xl font-extrabold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                  #{result.rank}
                </span>
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                  of {result.rankedCount}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                Position
              </p>
              <p className="mt-1 text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                Top {result.topPercent}%
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                Score
              </p>
              <p className="mt-1 flex items-center gap-2">
                <Pct value={result.score} className="text-2xl font-bold" />
                <BandChip value={result.score} />
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                vs class average
              </p>
              <p
                className={`mt-1 text-2xl font-bold flex items-center gap-1 tabular-nums ${
                  delta === null
                    ? "text-text-secondary-light"
                    : delta >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {delta !== null && (delta >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />)}
                {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta} pts`}
              </p>
            </div>
          </div>

          <Strip result={result} />

          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            <span>
              Ranked on marked work only, among {result.rankedCount} of {result.cohortSize} classmates with marks
              {subjectId ? "" : " across these subjects (each subject weighs the same)"}. Highest {result.highest}% ·
              median {result.median}% · lowest {result.lowest}%.
              {!result.rosterAvailable && " Class list unavailable from MIS — ranking may be incomplete."}
            </span>
          </p>
        </>
      )}
    </section>
  );
}
