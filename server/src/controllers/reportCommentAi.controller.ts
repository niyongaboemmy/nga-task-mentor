import { Request, Response } from "express";
import { draftComment } from "../services/ai/reportCommentDrafter";
import { sendControllerError } from "../utils/controllerErrors";

/**
 * POST /api/report-cards/ai-comment
 * A draft class-teacher comment for one student ([NAME] in place of the name).
 * The screen sends what it already shows (subject totals, ratings, attendance);
 * nothing is read from or written to the card here.
 */
export const draftReportComment = async (req: Request, res: Response) => {
  try {
    const { term, academic_year, subjects, attributes, attendance, tone, current, provider } = req.body;
    const draft = await draftComment({
      term,
      academicYear: academic_year,
      subjects: subjects ?? [],
      attributes: attributes ?? [],
      attendance: attendance ?? null,
      tone,
      current,
      provider,
    });
    return res.json({ success: true, data: draft });
  } catch (error: any) {
    if ([400, 502, 503].includes(error?.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return sendControllerError(res, error, "drafting the comment");
  }
};
