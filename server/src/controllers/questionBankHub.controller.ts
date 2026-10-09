import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { getScopedSubjects, ScopedSubject } from "../utils/scopedSubjects";
import { sendControllerError } from "../utils/controllerErrors";

/**
 * Question Bank hub (GET /api/question-bank/overview): one dashboard across
 * every subject the caller teaches, instead of opening each subject's bank.
 *
 * The bank is a reusable asset, so -- like the per-subject list -- nothing
 * here is term-filtered; "recent" activity is measured in days instead.
 * Subjects come from getScopedSubjects (the teacher's MIS assignments) and
 * every query is bounded by that id list, so a teacher never sees another
 * teacher's subjects even with a forged `subjectId`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WEEKS = 12;
/** A subject with fewer questions than this can't build a varied quiz. */
export const THIN_BANK_THRESHOLD = 10;
/** Bloom's levels 4-6 (analyse / evaluate / create) = higher-order thinking. */
const HIGHER_ORDER_MIN_LEVEL = 4;

/** Non-empty explanation (rich-text editors leave `<p></p>` behind). */
const HAS_EXPLANATION_SQL =
  "(qb.explanation IS NOT NULL AND TRIM(qb.explanation) <> '' AND TRIM(qb.explanation) <> '<p></p>')";

export interface SubjectBankStats {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  total: number;
  mine: number;
  easy: number;
  medium: number;
  difficult: number;
  no_difficulty: number;
  with_explanation: number;
  blooms_classified: number;
  higher_order: number;
  sow_linked: number;
  topics_covered: number;
  used_in_quizzes: number;
  added_7d: number;
  added_30d: number;
  last_added_at: string | null;
  health_score: number;
}

export type AlertSeverity = "critical" | "warning" | "info" | "success";

export interface BankAlert {
  id: string;
  severity: AlertSeverity;
  subject_id: number | null;
  title: string;
  message: string;
}

type Totals = Omit<SubjectBankStats, "subject_id" | "subject_name" | "subject_code">;

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const pct = (part: number, whole: number) => Math.round(ratio(part, whole) * 100);

/**
 * 0-100 quality score for one bank. Weighted so a teacher can raise it by
 * doing the things that make questions reusable: explanations (25), Bloom's
 * classification (25), a difficulty on every question (15), a scheme-of-work
 * link (15) and a spread across all three difficulty levels (20).
 */
export function healthScore(s: Pick<SubjectBankStats,
  "total" | "easy" | "medium" | "difficult" | "no_difficulty" | "with_explanation" | "blooms_classified" | "sow_linked">): number {
  if (s.total <= 0) return 0;
  const levelsPresent = [s.easy, s.medium, s.difficult].filter((n) => n > 0).length;
  const score =
    0.25 * ratio(s.with_explanation, s.total) +
    0.25 * ratio(s.blooms_classified, s.total) +
    0.15 * ratio(s.total - s.no_difficulty, s.total) +
    0.15 * ratio(s.sow_linked, s.total) +
    0.2 * (levelsPresent / 3);
  return Math.round(score * 100);
}

/** The actionable notices shown in the hub, most severe first. */
export function buildAlerts(subjects: SubjectBankStats[]): BankAlert[] {
  const alerts: BankAlert[] = [];
  for (const s of subjects) {
    const label = s.subject_code ? `${s.subject_code} · ${s.subject_name}` : s.subject_name;
    const push = (kind: string, severity: AlertSeverity, title: string, message: string) =>
      alerts.push({
        id: `${kind}:${s.subject_id}`,
        severity,
        subject_id: s.subject_id,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        message,
      });

    if (s.total === 0) {
      push("empty", "critical", `${label} has no questions`,
        "Start its bank: add questions, import a Word/Excel file, or let AI draft some from your notes.");
      continue;
    }
    if (s.total < THIN_BANK_THRESHOLD) {
      push("thin", "warning", `${label} has only ${s.total} question${s.total === 1 ? "" : "s"}`,
        `Aim for at least ${THIN_BANK_THRESHOLD} so quizzes can draw varied questions.`);
    }
    const noExplanation = s.total - s.with_explanation;
    if (ratio(noExplanation, s.total) > 0.5) {
      push("explanations", "warning", `${noExplanation} questions in ${label} lack an explanation`,
        "Students see the explanation after answering. It's what turns a wrong answer into learning.");
    }
    const unclassified = s.total - s.blooms_classified;
    if (ratio(unclassified, s.total) > 0.3) {
      push("blooms", "warning", `${unclassified} questions in ${label} have no Bloom's level`,
        "Classify them to see which thinking skills your quizzes actually test.");
    }
    if (s.total >= 5 && s.difficult === 0) {
      push("no-difficult", "info", `${label} has no difficult questions`,
        "Add a few stretch questions to challenge your strongest students.");
    }
    if (s.blooms_classified >= 5 && ratio(s.higher_order, s.blooms_classified) < 0.2) {
      push("higher-order", "info", `${label} is mostly recall`,
        `Only ${pct(s.higher_order, s.blooms_classified)}% of classified questions reach Analyse, Evaluate or Create.`);
    }
    const unused = s.total - s.used_in_quizzes;
    if (s.total >= THIN_BANK_THRESHOLD && ratio(unused, s.total) > 0.5) {
      push("unused", "info", `${unused} questions in ${label} were never used`,
        "They haven't appeared in any quiz yet. Build one from the bank to put them to work.");
    }
    if (s.added_7d > 0) {
      push("activity", "success", `${s.added_7d} new question${s.added_7d === 1 ? "" : "s"} in ${label} this week`,
        "Nice momentum. Remember to tag and classify new questions.");
    }
  }
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function emptyStats(subject: ScopedSubject): SubjectBankStats {
  return {
    subject_id: subject.id,
    subject_name: subject.name,
    subject_code: subject.code,
    total: 0, mine: 0, easy: 0, medium: 0, difficult: 0, no_difficulty: 0,
    with_explanation: 0, blooms_classified: 0, higher_order: 0, sow_linked: 0,
    topics_covered: 0, used_in_quizzes: 0, added_7d: 0, added_30d: 0,
    last_added_at: null, health_score: 0,
  };
}

function sumTotals(rows: SubjectBankStats[]): Totals {
  const t: Totals = {
    total: 0, mine: 0, easy: 0, medium: 0, difficult: 0, no_difficulty: 0,
    with_explanation: 0, blooms_classified: 0, higher_order: 0, sow_linked: 0,
    topics_covered: 0, used_in_quizzes: 0, added_7d: 0, added_30d: 0,
    last_added_at: null, health_score: 0,
  };
  const numericKeys = Object.keys(t).filter(
    (k) => k !== "last_added_at" && k !== "health_score",
  ) as (keyof Totals)[];
  for (const r of rows) {
    for (const k of numericKeys) (t as any)[k] += r[k] as number;
    if (r.last_added_at && (!t.last_added_at || r.last_added_at > t.last_added_at)) {
      t.last_added_at = r.last_added_at;
    }
  }
  t.health_score = healthScore(t);
  return t;
}

const toIso = (v: unknown): string | null =>
  v == null ? null : new Date(v as string).toISOString();

/**
 * The dashboard payload for `focus` (the subjects whose questions are
 * counted). `available` feeds the client's subject picker, and
 * `focusedSubjectId` is set when the view is narrowed to one subject.
 */
async function buildOverview(
  req: Request,
  focus: ScopedSubject[],
  available: ScopedSubject[],
  focusedSubjectId: number | null,
) {
  const ids = focus.map((s) => s.id);
  const userId = req.user.id;
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since30 = new Date(now - 30 * DAY_MS);
  // Monday-aligned start of the trend window, so buckets are whole weeks.
  const trendStart = new Date(now);
  trendStart.setUTCHours(0, 0, 0, 0);
  trendStart.setUTCDate(trendStart.getUTCDate() - ((trendStart.getUTCDay() + 6) % 7) - (TREND_WEEKS - 1) * 7);

  const bySubject = new Map<number, SubjectBankStats>(focus.map((s) => [s.id, emptyStats(s)]));
  let byType: { type: string; count: number }[] = [];
  let byBlooms: { level_id: number | null; name: string; level_order: number | null; count: number }[] = [];
  let topTopics: { title: string; count: number }[] = [];
  let mostUsed: { id: number; subject_id: number; question_text: string; question_type: string; uses: number }[] = [];
  const weekly = new Map<string, number>();

  if (ids.length > 0) {
    const base = { replacements: { ids, userId, since7, since30, trendStart, minOrder: HIGHER_ORDER_MIN_LEVEL }, type: QueryTypes.SELECT as const };

    const [subjectRows, typeRows, bloomsRows, topicRows, usedRows, trendRows] = await Promise.all([
      sequelize.query<any>(
        `SELECT qb.course_id,
                COUNT(*) AS total,
                SUM(qb.created_by = :userId) AS mine,
                SUM(qb.difficulty_level = 'EASY') AS easy,
                SUM(qb.difficulty_level = 'MEDIUM') AS medium,
                SUM(qb.difficulty_level = 'DIFFICULT') AS difficult,
                SUM(qb.difficulty_level IS NULL) AS no_difficulty,
                SUM(${HAS_EXPLANATION_SQL}) AS with_explanation,
                SUM(qb.blooms_taxonomy_level_id IS NOT NULL) AS blooms_classified,
                SUM(bl.level_order >= :minOrder) AS higher_order,
                SUM(qb.scheme_of_work_entry_id IS NOT NULL) AS sow_linked,
                COUNT(DISTINCT qb.scheme_of_work_entry_id) AS topics_covered,
                SUM(qb.created_at >= :since7) AS added_7d,
                SUM(qb.created_at >= :since30) AS added_30d,
                MAX(qb.created_at) AS last_added_at
           FROM question_bank qb
           LEFT JOIN blooms_taxonomy_levels bl ON bl.id = qb.blooms_taxonomy_level_id
          WHERE qb.course_id IN (:ids)
          GROUP BY qb.course_id`,
        base,
      ),
      sequelize.query<any>(
        `SELECT question_type AS type, COUNT(*) AS count
           FROM question_bank WHERE course_id IN (:ids)
          GROUP BY question_type ORDER BY count DESC`,
        base,
      ),
      sequelize.query<any>(
        `SELECT bl.id AS level_id, bl.name, bl.level_order, COUNT(qb.id) AS count
           FROM blooms_taxonomy_levels bl
           LEFT JOIN question_bank qb
             ON qb.blooms_taxonomy_level_id = bl.id AND qb.course_id IN (:ids)
          GROUP BY bl.id, bl.name, bl.level_order
          ORDER BY bl.level_order`,
        base,
      ),
      sequelize.query<any>(
        `SELECT scheme_of_work_entry_title AS title, COUNT(*) AS count
           FROM question_bank
          WHERE course_id IN (:ids) AND scheme_of_work_entry_title IS NOT NULL
            AND scheme_of_work_entry_title <> ''
          GROUP BY scheme_of_work_entry_title
          ORDER BY count DESC, title ASC LIMIT 8`,
        base,
      ),
      sequelize.query<any>(
        `SELECT qb.id, qb.course_id, qb.question_text, qb.question_type,
                COUNT(DISTINCT qq.quiz_id) AS uses
           FROM question_bank qb
           JOIN quiz_questions qq ON qq.question_id = qb.id
          WHERE qb.course_id IN (:ids)
          GROUP BY qb.id, qb.course_id, qb.question_text, qb.question_type`,
        base,
      ),
      sequelize.query<any>(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
           FROM question_bank
          WHERE course_id IN (:ids) AND created_at >= :trendStart
          GROUP BY DATE(created_at)`,
        base,
      ),
    ]);

    for (const r of subjectRows) {
      const s = bySubject.get(Number(r.course_id));
      if (!s) continue;
      for (const k of [
        "total", "mine", "easy", "medium", "difficult", "no_difficulty", "with_explanation",
        "blooms_classified", "higher_order", "sow_linked", "topics_covered", "added_7d", "added_30d",
      ] as const) {
        s[k] = Number(r[k] ?? 0);
      }
      s.last_added_at = toIso(r.last_added_at);
    }
    for (const r of usedRows) {
      const s = bySubject.get(Number(r.course_id));
      if (s) s.used_in_quizzes += 1;
    }

    byType = typeRows.map((r) => ({ type: String(r.type), count: Number(r.count) }));
    const unclassified = [...bySubject.values()].reduce((n, s) => n + s.total - s.blooms_classified, 0);
    byBlooms = bloomsRows.map((r) => ({
      level_id: Number(r.level_id),
      name: String(r.name),
      level_order: Number(r.level_order),
      count: Number(r.count),
    }));
    if (unclassified > 0) byBlooms.push({ level_id: null, name: "Unclassified", level_order: null, count: unclassified });
    topTopics = topicRows.map((r) => ({ title: String(r.title), count: Number(r.count) }));
    mostUsed = usedRows
      .map((r) => ({
        id: Number(r.id),
        subject_id: Number(r.course_id),
        question_text: String(r.question_text ?? ""),
        question_type: String(r.question_type),
        uses: Number(r.uses),
      }))
      .sort((a, b) => b.uses - a.uses || b.id - a.id)
      .slice(0, 5);
    for (const r of trendRows) {
      const day = new Date(r.day);
      const monday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weekly.set(key, (weekly.get(key) ?? 0) + Number(r.count));
    }
  }

  const subjects = [...bySubject.values()].map((s) => ({ ...s, health_score: healthScore(s) }));
  const trend = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const d = new Date(trendStart.getTime() + i * 7 * DAY_MS).toISOString().slice(0, 10);
    return { week_start: d, count: weekly.get(d) ?? 0 };
  });

  return {
    generated_at: new Date(now).toISOString(),
    subject_id: focusedSubjectId,
    available_subjects: available,
    totals: sumTotals(subjects),
    subjects: subjects.sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
    by_type: byType,
    by_blooms: byBlooms,
    top_topics: topTopics,
    most_used: mostUsed,
    trend,
    alerts: buildAlerts(subjects),
  };
}

// @desc    Cross-subject question bank dashboard for the caller's own subjects
// @route   GET /api/question-bank/overview?subjectId=
// @access  QUESTION_BANK_HUB_VIEW
export const getQuestionBankOverview = async (req: Request, res: Response) => {
  try {
    const { subjects: scoped } = await getScopedSubjects(req);
    const subjectIdParam = req.query.subjectId ? Number(req.query.subjectId) : null;
    if (subjectIdParam != null && (isNaN(subjectIdParam) || !scoped.some((s) => s.id === subjectIdParam))) {
      return res.status(404).json({
        success: false,
        message: "That subject isn't one of the subjects you teach",
      });
    }
    const focus = subjectIdParam != null ? scoped.filter((s) => s.id === subjectIdParam) : scoped;
    const data = await buildOverview(req, focus, scoped, subjectIdParam);
    res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(res, error, "Failed to load the question bank overview");
  }
};

// @desc    The same dashboard for one subject, from its own question bank page
// @route   GET /api/courses/:courseId/question-bank/overview
// @access  QUESTION_BANK_VIEW (same gate as that subject's question list)
export const getCourseQuestionBankOverview = async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid subject id" });
    }
    // Only for the subject's display name in alerts; the figures don't depend on it.
    const { subjects: scoped } = await getScopedSubjects(req);
    const subject: ScopedSubject =
      scoped.find((s) => s.id === courseId) ?? { id: courseId, name: "this subject", code: null };
    const data = await buildOverview(req, [subject], [subject], courseId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    return sendControllerError(res, error, "Failed to load the question bank overview");
  }
};
