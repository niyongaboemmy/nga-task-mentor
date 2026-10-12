import { Request, Response } from "express";
import { Assignment } from "../models";
import { computeOverview, SubjectOutOfScopeError } from "./instructorOverview.controller";
import { practicalQuestionsOf } from "./tmcodePracticals.controller";
import { tmcodeColumns } from "../tmcode/assignments/load";
import { sendControllerError } from "../utils/controllerErrors";
import { gradingInboxItems } from "../services/gradingInbox.service";

// @desc    To grade (CODE_RUNNER_PLAN.md §7.6): every assignment and quiz in
//          the teacher's subjects with work waiting, most urgent first, each
//          with the one place to grade it (Grading for code work).
// @route   GET /api/dashboard/instructor/grading-inbox
// @access  Private (DASHBOARD_VIEW_INSTRUCTOR)
export const getGradingInbox = async (req: Request, res: Response) => {
  try {
    const { overview } = await computeOverview(req, { fresh: req.query.fresh === "1" });
    const queue = overview.grading_queue;
    const assignmentIds = queue.filter((q) => q.kind === "assignment").map((q) => q.id);
    const quizIds = queue.filter((q) => q.kind !== "assignment").map((q) => q.id);
    const [tm, projectAssignments, practicals] = await Promise.all([
      tmcodeColumns(assignmentIds),
      assignmentIds.length
        ? Assignment.findAll({ where: { id: assignmentIds, submission_type: "project" }, attributes: ["id"], raw: true })
        : [],
      practicalQuestionsOf(quizIds),
    ]);
    const codeAssignments = new Set<number>([...tm.keys(), ...projectAssignments.map((a: any) => Number(a.id))]);
    const items = gradingInboxItems(queue, codeAssignments, new Set(practicals.keys()));
    return res.status(200).json({
      success: true,
      data: {
        items,
        total_to_grade: items.reduce((n, i) => n + i.to_grade, 0),
        generated_at: overview.generated_at,
      },
    });
  } catch (error) {
    if (error instanceof SubjectOutOfScopeError) return res.status(404).json({ success: false, message: error.message });
    return sendControllerError(res, error, "getGradingInbox");
  }
};
