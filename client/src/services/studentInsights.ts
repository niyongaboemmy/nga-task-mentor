import type { MarksSummary } from "./studentProfileApi";
import { needsAttention, PASS_MARK, type ActivityItem, type ActivityKind, type Tone } from "./studentActivity";
import type { StandingResult } from "./studentStandingApi";

// ─── Student profile insights ────────────────────────────────────────────────
// The "what should I do about this student" list on the Overview tab. Pure:
// it reads the same normalised activity and summary the rest of the page
// shows, so an insight can never cite a number that isn't on screen.

export type InsightTarget =
  | { type: "subject"; courseId: string }
  | { type: "tab"; tab: ActivityKind; status?: "attention" | "awaiting" | "not_recorded" };

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  detail?: string;
  target?: InsightTarget;
}

export interface SubjectRef {
  courseId: string;
  name: string;
  code: string;
}

/** Marks needed before a trend is worth reporting, and the swing that counts. */
const TREND_MIN_MARKS = 6;
const TREND_WINDOW = 3;
const TREND_SWING = 10;
/** Below this share of work marked, the standing is called provisional. */
const LOW_COVERAGE = 0.3;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const mean = (values: number[]) => values.reduce((a, v) => a + v, 0) / values.length;

export const buildInsights = ({
  items,
  subjects,
  summary,
  standing,
  subjectStanding,
}: {
  items: ActivityItem[];
  subjects: SubjectRef[];
  summary: MarksSummary;
  standing: StandingResult | null;
  subjectStanding: Record<string, StandingResult> | null;
}): Insight[] => {
  const out: Insight[] = [];

  // 1. Subjects below the pass line — the headline risk.
  const graded = subjects
    .map((s) => ({ ...s, average: summary.byCourse[s.courseId]?.average ?? null }))
    .filter((s): s is SubjectRef & { average: number } => s.average !== null);
  const atRisk = graded.filter((s) => s.average < PASS_MARK).sort((a, b) => a.average - b.average);
  if (atRisk.length > 0) {
    const worst = atRisk[0];
    const rank = subjectStanding?.[worst.courseId];
    out.push({
      id: "at-risk",
      tone: "danger",
      title:
        atRisk.length === 1
          ? `At risk in ${worst.name} (${worst.average}%)`
          : `At risk in ${plural(atRisk.length, "subject")}`,
      detail:
        atRisk.length === 1
          ? rank?.rank
            ? `Ranked ${rank.rank} of ${rank.rankedCount} in this subject. Consider remedial support.`
            : "Consider remedial support."
          : atRisk.map((s) => `${s.name} ${s.average}%`).join(" · "),
      target: { type: "subject", courseId: worst.courseId },
    });
  }

  // 2. Work the student owes.
  const overdue = items.filter((i) => i.status === "overdue");
  const overdueAssignments = overdue.filter((i) => i.kind === "assignment").length;
  const missedQuizzes = overdue.filter((i) => i.kind === "quiz").length;
  if (overdue.length > 0) {
    const parts = [
      overdueAssignments ? plural(overdueAssignments, "overdue assignment") : null,
      missedQuizzes ? plural(missedQuizzes, "missed quiz", "missed quizzes") : null,
    ].filter(Boolean);
    out.push({
      id: "overdue",
      tone: "danger",
      title: parts.join(", "),
      detail: "Follow up with the student — these count as pending, not zero, until handled.",
      target: { type: "tab", tab: overdueAssignments ? "assignment" : "quiz", status: "attention" },
    });
  }

  const dueSoon = items.filter((i) => i.status === "due_soon").length;
  if (dueSoon > 0) {
    out.push({
      id: "due-soon",
      tone: "warning",
      title: `${plural(dueSoon, "item")} due in the next few days`,
      target: {
        type: "tab",
        tab: items.find((i) => i.status === "due_soon")!.kind,
        status: "attention",
      },
    });
  }

  // 3. Momentum, from dated marks.
  const dated = items
    .filter((i) => i.status === "graded" && i.percentage !== null && i.countsToFinal)
    .map((i) => ({ pct: i.percentage as number, at: new Date(i.submittedAt ?? i.date ?? "").getTime() }))
    .filter((m) => !isNaN(m.at))
    .sort((a, b) => a.at - b.at);
  if (dated.length >= TREND_MIN_MARKS) {
    const recent = mean(dated.slice(-TREND_WINDOW).map((m) => m.pct));
    const earlier = mean(dated.slice(0, -TREND_WINDOW).map((m) => m.pct));
    const swing = Math.round((recent - earlier) * 10) / 10;
    if (Math.abs(swing) >= TREND_SWING) {
      out.push({
        id: "trend",
        tone: swing < 0 ? "warning" : "success",
        title: swing < 0 ? "Trending down" : "Improving",
        detail: `Last ${TREND_WINDOW} marks average ${Math.round(recent)}% vs ${Math.round(earlier)}% before.`,
      });
    }
  }

  // 4. Teacher-side actions.
  const awaiting = items.filter((i) => i.status === "awaiting");
  if (awaiting.length > 0) {
    out.push({
      id: "awaiting",
      tone: "info",
      title: `${plural(awaiting.length, "submission")} waiting to be marked`,
      target: { type: "tab", tab: awaiting[0].kind, status: "awaiting" },
    });
  }
  const unrecorded = items.filter((i) => i.status === "not_recorded").length;
  if (unrecorded > 0) {
    out.push({
      id: "not-recorded",
      tone: "info",
      title: `${plural(unrecorded, "recorded mark")} not entered yet`,
      detail: "Left out of every average until entered.",
      target: { type: "tab", tab: "recorded", status: "not_recorded" },
    });
  }

  // 5. Strength — worth saying out loud.
  const best = [...graded].sort((a, b) => b.average - a.average)[0];
  if (best && best.average >= 65 && (!atRisk.length || best.courseId !== atRisk[0].courseId)) {
    const rank = subjectStanding?.[best.courseId];
    out.push({
      id: "strength",
      tone: "success",
      title: `Strongest in ${best.name} (${best.average}%)`,
      detail: rank?.rank ? `Ranked ${rank.rank} of ${rank.rankedCount} in this subject.` : undefined,
      target: { type: "subject", courseId: best.courseId },
    });
  }

  // 6. How much to trust all of the above.
  if (summary.totalCount > 0 && summary.markedCount / summary.totalCount < LOW_COVERAGE) {
    out.push({
      id: "coverage",
      tone: "neutral",
      title: "Standing is provisional",
      detail: `Only ${summary.markedCount} of ${summary.totalCount} items are marked so far.`,
    });
  }

  if (standing?.rank && standing.rankedCount > 1 && out.every((i) => i.tone !== "danger")) {
    const above = standing.score !== null && standing.classAverage !== null && standing.score >= standing.classAverage;
    if (above && !out.some((i) => i.tone === "warning")) {
      out.unshift({
        id: "on-track",
        tone: "success",
        title: "On track",
        detail: "Above the class average with nothing overdue.",
      });
    }
  }

  return out;
};

/** Items needing attention, per kind — drives the tab-bar alert dots. */
export const attentionByKind = (items: ActivityItem[]): Record<ActivityKind, number> => {
  const counts: Record<ActivityKind, number> = { assignment: 0, quiz: 0, recorded: 0 };
  for (const item of items) if (needsAttention(item)) counts[item.kind] += 1;
  return counts;
};

