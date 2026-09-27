import { motion } from "framer-motion";
import { ArrowUpRight, Lock, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { CARD } from "../Students/profile/profileTheme";
import { ordinal, type StudentRanking } from "../../services/rankingApi";
import { StatusChip } from "./rankingParts";

// The student's position, drawn instead of described: a solid blue rank tile,
// where that rank sits in the class (quarters, last → 1st), and their average
// against the class average and the pass mark. No gradients: blue is the one
// brand colour; status colours only appear on the status chip and the gap.

const PASS_MARK = 50;

// Left → right = last place → first, same direction as the dashboard's rank track.
const QUARTERS = [
  { key: "bottom", label: "Bottom quarter", cls: "bg-blue-100 dark:bg-blue-400/30" },
  { key: "lower", label: "Lower half", cls: "bg-blue-200 dark:bg-blue-400/45" },
  { key: "upper", label: "Upper half", cls: "bg-blue-300 dark:bg-blue-400/60" },
  { key: "top", label: "Top quarter", cls: "bg-blue-400 dark:bg-blue-400/80" },
] as const;

function quarterOf(rank: number, of: number): number {
  const share = rank / of; // 1/of = first place
  if (share <= 0.25) return 3;
  if (share <= 0.5) return 2;
  if (share <= 0.75) return 1;
  return 0;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export default function RankHero({ data, subjectName }: { data: StudentRanking; subjectName: string | null }) {
  const { overall } = data;
  const ranked = overall.rank !== null && overall.ranked_count > 0;
  const of = overall.ranked_count;
  const pos = ranked ? (of > 1 ? ((of - overall.rank!) / (of - 1)) * 100 : 100) : null;
  const q = ranked ? quarterOf(overall.rank!, of) : -1;
  const gap =
    overall.score !== null && overall.class_average !== null
      ? Math.round((overall.score - overall.class_average) * 10) / 10
      : null;
  const topShare = ranked && overall.top_percent !== null && overall.top_percent <= 50 ? overall.top_percent : null;

  return (
    <section className={`${CARD} p-4 sm:p-6`} aria-label="Your position">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        {/* Rank tile + band */}
        <div className="flex items-center gap-4 sm:gap-5 lg:w-[22rem] shrink-0">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ y: -3 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="flex flex-col items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25 shrink-0"
            title={ranked ? `You are ${ordinal(overall.rank!)} of ${of} ranked students` : undefined}
          >
            <Trophy className="w-5 h-5 opacity-90 mb-1" aria-hidden />
            {ranked ? (
              <>
                <span className="text-3xl sm:text-4xl font-extrabold tabular-nums leading-none">{ordinal(overall.rank!)}</span>
                <span className="mt-1 text-[11px] font-medium text-blue-100">of {of}</span>
              </>
            ) : (
              <span className="text-sm font-semibold px-2 text-center">Not ranked yet</span>
            )}
          </motion.div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
              {subjectName ? `Your position in ${subjectName}` : "Your overall position"}
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {ranked ? overall.band : "Get your first marks to be ranked"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusChip status={overall.status} />
              {topShare !== null && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  Top {topShare}%
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300">
                {overall.marked_items} marked item{overall.marked_items === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        {/* Visuals */}
        <div className="flex-1 min-w-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {/* Where I sit in the class */}
          <div className="rounded-xl bg-surface-light dark:bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/70">
              Place in class
            </p>
            <div className="relative mt-6" role="img" aria-label={ranked ? `${ordinal(overall.rank!)} of ${of}: ${QUARTERS[q].label}` : "Not ranked yet"}>
              {pos !== null && (
                <motion.div
                  initial={{ left: "0%", opacity: 0 }}
                  animate={{ left: `${pos}%`, opacity: 1 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="absolute -top-6 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                >
                  <span className="px-1.5 py-px rounded-md bg-blue-600 text-white text-[10px] font-bold">You</span>
                  <span className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-blue-600" />
                </motion.div>
              )}
              <div className="flex h-3 gap-0.5 rounded-full overflow-hidden">
                {QUARTERS.map((qu, i) => (
                  <div
                    key={qu.key}
                    title={qu.label}
                    className={`flex-1 transition-all ${qu.cls} ${i === q ? "ring-2 ring-inset ring-blue-600 dark:ring-blue-400" : "opacity-70 dark:opacity-90 hover:opacity-100"}`}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-text-secondary-light dark:text-text-secondary-dark/60">
                <span>{ranked ? `${ordinal(of)} (last)` : "Last"}</span>
                <span>1st</span>
              </div>
            </div>
            {ranked && overall.rank !== 1 && overall.points_to_next !== null && (
              <p className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
                +{overall.points_to_next} pts to reach {ordinal(overall.rank! - 1)}
              </p>
            )}
            {ranked && overall.rank === 1 && (
              <p className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <Trophy className="w-3.5 h-3.5" aria-hidden />
                You're at the top
              </p>
            )}
          </div>

          {/* Me vs class */}
          <div className="rounded-xl bg-surface-light dark:bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/70">
                You vs class
              </p>
              {gap !== null && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    gap >= 0
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                  }`}
                  title="Points above or below the class average"
                >
                  {gap >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {gap > 0 ? "+" : ""}
                  {gap} pts
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                {overall.score !== null ? `${overall.score}%` : "—"}
              </span>
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">your average</span>
            </div>
            <div
              className="relative mt-3 h-3 rounded-full bg-gray-200/80 dark:bg-white/10"
              role="img"
              aria-label={`Your average ${overall.score ?? "—"}%${overall.class_average !== null ? `, class average ${overall.class_average}%` : ""}, pass mark ${PASS_MARK}%`}
            >
              {overall.score !== null && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${clamp(overall.score)}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 rounded-full bg-blue-600"
                />
              )}
              <span className="absolute -top-1 -bottom-1 w-px bg-gray-400 dark:bg-gray-500" style={{ left: `${PASS_MARK}%` }} title={`Pass mark ${PASS_MARK}%`} />
              {overall.class_average !== null && (
                <span
                  className="absolute -top-1.5 -bottom-1.5 w-1 -ml-0.5 rounded bg-gray-900 dark:bg-white"
                  style={{ left: `${clamp(overall.class_average)}%` }}
                  title={`Class average ${overall.class_average}%`}
                />
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/70">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-1.5 rounded-full bg-blue-600" aria-hidden /> You
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1 h-3 rounded bg-gray-900 dark:bg-white" aria-hidden />
                Class {overall.class_average !== null ? `${overall.class_average}%` : "hidden"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Target className="w-3 h-3" aria-hidden /> Pass {PASS_MARK}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
        <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden />
        Only you can see your position. Other students' names and marks are never shown
        {data.privacy.aggregates_hidden && `, and averages are hidden when fewer than ${data.privacy.min_cohort} students are ranked`}.
      </p>
    </section>
  );
}
