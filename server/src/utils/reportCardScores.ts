import { Op } from "sequelize";
import { User } from "../models/User.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { Submission } from "../models/Submission.model";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { ManualAssessmentScore } from "../models/ManualAssessmentScore.model";
import { parseAssignmentGrade } from "../services/reportCardGrader.service";

/**
 * A report card's `student_id` is the student's MIS user id (the subject
 * mapping fans out over the MIS roster; the profile page reads by MIS id),
 * but quiz and assignment submissions are stored against the LOCAL users.id.
 * Looking submissions up by the MIS id — as the report-card aggregation used
 * to — found nothing for most students, or worse, another student whose local
 * id happened to equal it. This resolves every id the student is known by.
 *
 *  - local ids: local users linked to that MIS id; when none is linked, the
 *    id itself as a local account (local-only, or a legacy local-keyed card).
 *  - manual ids: manual scores are keyed on the MIS id for roster students
 *    and on the local id for local-only ones, so the card's own id; for a
 *    legacy card keyed on a linked local id, its MIS id as well.
 */
export interface StudentIdentity {
  localIds: number[];
  manualIds: number[];
}

export async function resolveCardStudent(studentId: number): Promise<StudentIdentity> {
  const users = await User.findAll({
    where: { [Op.or]: [{ mis_user_id: studentId }, { id: studentId }] },
    attributes: ["id", "mis_user_id"],
    raw: true,
  });
  const linked = users.filter((u: any) => Number(u.mis_user_id) === studentId).map((u: any) => Number(u.id));
  const self = users.find((u: any) => Number(u.id) === studentId) as any;
  if (linked.length > 0) {
    // A MIS id. Only the accounts linked to it are this student: a local
    // account that merely shares the number (local-only or linked to another
    // MIS id) is someone else, and its marks must never reach this card.
    return { localIds: linked, manualIds: [studentId] };
  }
  if (self) {
    // Local-only account, or a legacy card keyed on a linked local id.
    const misId = self.mis_user_id != null ? Number(self.mis_user_id) : null;
    return { localIds: [studentId], manualIds: misId != null ? [studentId, misId] : [studentId] };
  }
  // No local account yet (never logged in): only recorded marks can exist.
  return { localIds: [], manualIds: [studentId] };
}

export type ScoreKey = `${"quiz" | "assignment" | "manual"}:${number}`;
export interface RawScore {
  raw_score: number;
  max_score: number;
}

/**
 * The student's score on each listed assessment, keyed "type:id". Absent =
 * not recorded yet. Rules match the rest of the app: a quiz counts its best
 * completed attempt, an assignment its grade "a/b" (drafts aren't
 * submissions), a recorded mark its score against the assessment's max.
 */
export async function loadStudentScores(
  identity: StudentIdentity,
  items: Array<{ assessment_type: string; assessment_id: number }>,
): Promise<Map<ScoreKey, RawScore>> {
  const ids = (type: string) => [...new Set(items.filter((i) => i.assessment_type === type).map((i) => i.assessment_id))];
  const quizIds = ids("quiz");
  const assignmentIds = ids("assignment");
  const manualIds = ids("manual");
  const { localIds } = identity;

  const [quizSubs, assignmentSubs, manualAssessments, manualScores] = await Promise.all([
    quizIds.length && localIds.length
      ? QuizSubmission.findAll({
          where: { student_id: { [Op.in]: localIds }, quiz_id: { [Op.in]: quizIds }, status: "completed" },
          attributes: ["quiz_id", "total_score", "max_score", "percentage"],
          raw: true,
        })
      : [],
    assignmentIds.length && localIds.length
      ? Submission.findAll({
          where: {
            student_id: { [Op.in]: localIds },
            assignment_id: { [Op.in]: assignmentIds },
            status: { [Op.ne]: "draft" },
          },
          attributes: ["assignment_id", "grade"],
          raw: true,
        })
      : [],
    manualIds.length ? ManualAssessment.findAll({ where: { id: { [Op.in]: manualIds } }, attributes: ["id", "max_score"], raw: true }) : [],
    manualIds.length && identity.manualIds.length
      ? ManualAssessmentScore.findAll({
          where: { student_id: { [Op.in]: identity.manualIds }, manual_assessment_id: { [Op.in]: manualIds } },
          attributes: ["manual_assessment_id", "student_id", "score"],
          raw: true,
        })
      : [],
  ]);

  const out = new Map<ScoreKey, RawScore>();
  const pctOf = (s: RawScore) => (s.max_score > 0 ? s.raw_score / s.max_score : -1);
  const keepBest = (key: ScoreKey, s: RawScore) => {
    const prev = out.get(key);
    if (!prev || pctOf(s) > pctOf(prev)) out.set(key, s);
  };

  for (const q of quizSubs as any[]) {
    const max = parseFloat(String(q.max_score));
    const raw = parseFloat(String(q.total_score));
    if (Number.isFinite(max) && max > 0 && Number.isFinite(raw)) keepBest(`quiz:${q.quiz_id}`, { raw_score: raw, max_score: max });
  }
  for (const a of assignmentSubs as any[]) {
    const parsed = parseAssignmentGrade(a.grade ?? null);
    if (parsed) keepBest(`assignment:${a.assignment_id}`, parsed);
  }
  const maxById = new Map((manualAssessments as any[]).map((m) => [Number(m.id), parseFloat(String(m.max_score))]));
  // The card's own id wins over a secondary id when both hold a score.
  const primary = identity.manualIds[0];
  const sorted = [...(manualScores as any[])].sort(
    (a, b) => Number(Number(b.student_id) === primary) - Number(Number(a.student_id) === primary),
  );
  for (const s of sorted) {
    const key: ScoreKey = `manual:${s.manual_assessment_id}`;
    if (out.has(key)) continue;
    const max = maxById.get(Number(s.manual_assessment_id));
    const raw = parseFloat(String(s.score));
    if (max !== undefined && max > 0 && Number.isFinite(raw)) out.set(key, { raw_score: raw, max_score: max });
  }
  return out;
}
