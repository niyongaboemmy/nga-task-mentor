import { Router, Request, Response } from "express";
import { protect, authorizePermission } from "../middleware/auth";
import { Assignment, Quiz } from "../models";
import { canGradeAssignment, canGradeQuiz, GRADE_DENIED_MESSAGE } from "../utils/gradingAccess";
import { sendControllerError } from "../utils/controllerErrors";
import { trackOnSuccess } from "../activity/keyEvents";
import { CompetencyError, curriculum, getTaskCriteria, setTaskCriteria, type TaskType } from "../services/competencyEvidence";

/**
 * Learning outcomes on quizzes and assignments (services/competencyEvidence.ts).
 *   GET /api/competency/curriculum/:subjectId   the subject's outcomes + criteria (from MIS)
 *   GET /api/competency/tasks/:type/:id          { subject_id, criteria, can_edit }
 *   PUT /api/competency/tasks/:type/:id          { criteria_ids }
 * Tagging is open to whoever may grade the task (its subject's teachers, the creator, MANAGE_ANY).
 */
const router = Router();
router.use(protect);

const GRADERS = ["QUIZZES_GRADE", "SUBMISSIONS_GRADE"];
const fail = (res: Response, e: unknown, context: string) =>
  e instanceof CompetencyError ? res.status(e.status).json({ success: false, message: e.message }) : sendControllerError(res, e, context);

async function loadTask(req: Request, res: Response): Promise<{ type: TaskType; task: any } | null> {
  const type = req.params.type as TaskType;
  const id = Math.trunc(Number(req.params.id));
  if ((type !== "quiz" && type !== "assignment") || !(id > 0)) {
    res.status(400).json({ success: false, message: "Unknown task" });
    return null;
  }
  const task: any = type === "quiz" ? await Quiz.findByPk(id) : await Assignment.findByPk(id);
  if (!task) {
    res.status(404).json({ success: false, message: `${type === "quiz" ? "Quiz" : "Assignment"} not found` });
    return null;
  }
  if (!(await (type === "quiz" ? canGradeQuiz(req, task) : canGradeAssignment(req, task)))) {
    res.status(403).json({ success: false, message: GRADE_DENIED_MESSAGE });
    return null;
  }
  return { type, task };
}

router.get("/curriculum/:subjectId", authorizePermission(...GRADERS), async (req, res) => {
  try {
    const subjectId = Math.trunc(Number(req.params.subjectId));
    if (!(subjectId > 0)) return res.status(400).json({ success: false, message: "Unknown subject" });
    res.json({ success: true, data: { subject_id: subjectId, outcomes: await curriculum(subjectId) } });
  } catch (e) {
    fail(res, e, "loading the learning outcomes");
  }
});

router.get("/tasks/:type/:id", authorizePermission(...GRADERS), async (req, res) => {
  try {
    const t = await loadTask(req, res);
    if (!t) return;
    res.json({ success: true, data: { subject_id: Number(t.task.course_id) || null, criteria: await getTaskCriteria({ type: t.type, id: t.task.id }), can_edit: true } });
  } catch (e) {
    fail(res, e, "loading the learning outcomes");
  }
});

router.put(
  "/tasks/:type/:id",
  authorizePermission(...GRADERS),
  trackOnSuccess("tm.competency.tag", (req) => ({ task_type: req.params.type, task_id: Number(req.params.id) || null })),
  async (req, res) => {
    try {
      const t = await loadTask(req, res);
      if (!t) return;
      const subjectId = Number(t.task.course_id) || 0;
      if (!subjectId) return res.status(400).json({ success: false, message: "This task isn't linked to a subject, so it can't use learning outcomes." });
      const ids = Array.isArray(req.body?.criteria_ids) ? req.body.criteria_ids : null;
      if (!ids || ids.length > 200) return res.status(400).json({ success: false, message: "criteria_ids must be a list (at most 200)" });
      const criteria = await setTaskCriteria({ type: t.type, id: t.task.id }, subjectId, ids, Number((req as any).user?.id) || null);
      res.json({ success: true, data: { subject_id: subjectId, criteria, can_edit: true } });
    } catch (e) {
      fail(res, e, "saving the learning outcomes");
    }
  },
);

export default router;
