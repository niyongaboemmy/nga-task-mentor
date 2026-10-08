import { Request, Response } from "express";
import { canGradeQuiz, GRADE_DENIED_MESSAGE } from "../utils/gradingAccess";
import { buildSpec, loadQuiz, saveResult, type PaperResult } from "../services/paperSheets";
import { sendControllerError } from "../utils/controllerErrors";

/**
 * GET /api/quizzes/:quizId/paper-sheet
 * What to print: the choice questions in order, how many bubbles each, the
 * sheet key (never the answers). The class list comes from GET /:quizId/students.
 */
export const getPaperSheet = async (req: Request, res: Response) => {
  try {
    const quiz = await loadQuiz(Number(req.params.quizId));
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found" });
    if (!(await canGradeQuiz(req, quiz))) return res.status(403).json({ success: false, message: GRADE_DENIED_MESSAGE });
    const spec = buildSpec(quiz, quiz.questions || []);
    if (!spec.questions.length) {
      return res.status(400).json({ success: false, message: "This quiz has no single-choice, multiple-choice or true/false questions to put on a paper sheet." });
    }
    return res.json({ success: true, data: spec });
  } catch (error) {
    return sendControllerError(res, error, "preparing the answer sheets");
  }
};

/**
 * POST /api/quizzes/:quizId/paper-results  { key, results: [{ studentId, answers: { [quizQuestionId]: number[] } }] }
 * The reviewed scans: stored and scored like online attempts. One result per row.
 */
export const savePaperResults = async (req: Request, res: Response) => {
  try {
    const quiz = await loadQuiz(Number(req.params.quizId));
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found" });
    if (!(await canGradeQuiz(req, quiz))) return res.status(403).json({ success: false, message: GRADE_DENIED_MESSAGE });
    const spec = buildSpec(quiz, quiz.questions || []);
    if (String(req.body?.key || "") !== spec.key) {
      return res.status(409).json({ success: false, message: "These sheets were printed before the quiz's questions changed. Print new sheets." });
    }
    const results: PaperResult[] = Array.isArray(req.body?.results) ? req.body.results : [];
    if (!results.length || results.length > 200) return res.status(400).json({ success: false, message: "Send between 1 and 200 sheets" });
    const by = Number((req as any).user?.id);
    const out = [];
    for (const r of results) {
      try {
        out.push({ ok: true, ...(await saveResult(quiz, spec, r, by)) });
      } catch (e: any) {
        out.push({ ok: false, studentId: r?.studentId, message: String(e?.message || "Couldn't save") });
      }
    }
    return res.json({ success: true, data: out });
  } catch (error) {
    return sendControllerError(res, error, "saving the paper results");
  }
};
