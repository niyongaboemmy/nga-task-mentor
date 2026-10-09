import { Request, Response } from "express";
import { sendControllerError } from "../utils/controllerErrors";
import { loadStudentOverview } from "../services/studentOverview.loader";

/**
 * GET /api/dashboard/student/overview
 *
 * The student's own work across their enrolled subjects this term: every
 * published assignment and quiz with its state and timing (running attempt,
 * due today, opens later, awaiting a mark, graded, missed) plus the reminders
 * built from them. Reminders only cover publicly accessible work: published
 * assignments and quizzes whose "publicly accessible" switch is on. Subjects come from getScopedSubjects (MIS enrolment), and
 * only the caller's own submissions/attempts are read. The loading lives in
 * services/studentOverview.loader.ts, shared with the MIS Home summary.
 */
export const getStudentOverview = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { overview } = await loadStudentOverview(req, userId);
    return res.status(200).json({ success: true, data: overview });
  } catch (error) {
    return sendControllerError(res, error, "getStudentOverview");
  }
};
