import { Request, Response } from "express";
import { generateRubric } from "../services/ai/rubricGenerator";
import { sendControllerError } from "../utils/controllerErrors";

/**
 * POST /api/assignments/ai/rubric
 * Reads the (unsaved) assignment description and returns a rubric whose
 * marks add up to exactly max_score. Nothing is stored — the teacher reviews
 * and edits the criteria in the form before saving the assignment.
 */
export const generateAssignmentRubric = async (req: Request, res: Response) => {
  try {
    const { title, description, max_score, criteria_count, instructions, provider } = req.body;
    const rubric = await generateRubric({
      title,
      description,
      maxScore: max_score,
      criteriaCount: criteria_count,
      instructions,
      provider,
    });
    return res.json({ success: true, data: rubric });
  } catch (error: any) {
    // 400 nothing to read, 502 empty AI reply, 503 no provider could answer —
    // all carry a teacher-friendly message.
    if ([400, 502, 503].includes(error?.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return sendControllerError(res, error, "generating the rubric");
  }
};
