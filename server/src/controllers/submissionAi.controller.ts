import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Submission, Assignment } from "../models";
import { canGradeAssignment, GRADE_DENIED_MESSAGE } from "../utils/gradingAccess";
import fileServer from "../utils/fileServer";
import { DocumentExtractorService } from "../services/DocumentExtractorService";
import { draftFeedback, type RubricCriterion } from "../services/ai/feedbackDrafter";
import { sendControllerError } from "../utils/controllerErrors";

const parse = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
};

const READABLE = /\.(pdf|docx)$/i;

/** The submission's files as text (PDF/Word), and the names of those the AI can't read. */
async function readFiles(files: Array<{ filename?: string; originalname?: string; mimetype?: string }>) {
  const out: Array<{ name: string; text: string }> = [];
  const unread: string[] = [];
  for (const f of files.slice(0, 5)) {
    const name = f.originalname || f.filename || "file";
    if (!f.filename || !READABLE.test(f.originalname || f.filename)) {
      unread.push(name);
      continue;
    }
    try {
      const remote = `submissions/${f.filename}`;
      let buffer: Buffer | null = null;
      if (await fileServer.fileExists(remote)) buffer = await fileServer.downloadToBuffer(remote);
      else {
        const legacy = path.join(__dirname, "../../uploads", f.filename);
        if (fs.existsSync(legacy)) buffer = fs.readFileSync(legacy);
      }
      if (!buffer) {
        unread.push(name);
        continue;
      }
      const { text } = await DocumentExtractorService.extractText(buffer, f.mimetype || "", f.originalname || f.filename);
      if (text.trim()) out.push({ name, text });
      else unread.push(name);
    } catch {
      unread.push(name);
    }
  }
  return { files: out, unread };
}

/**
 * POST /api/submissions/:id/ai-feedback  { tone?, instructions?, provider? }
 * A marking draft (rubric scores + feedback) for the teacher to check and edit.
 * Nothing is saved; the student sees nothing until the teacher saves the grade.
 */
export const draftSubmissionFeedback = async (req: Request, res: Response) => {
  try {
    const submission = (await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          as: "assignment",
          attributes: ["id", "title", "description", "course_id", "academic_term_id", "max_score", "rubric", "created_by"],
        },
      ],
    })) as any;
    if (!submission) return res.status(404).json({ success: false, message: "Submission not found" });
    const assignment = submission.assignment;
    if (!(req as any).user.permissions?.has("SUBMISSIONS_GRADE") || !(await canGradeAssignment(req, assignment))) {
      return res.status(403).json({ success: false, message: GRADE_DENIED_MESSAGE });
    }
    const maxScore = Number(assignment?.max_score) || 0;
    if (!(maxScore > 0)) return res.status(400).json({ success: false, message: "Set the assignment's maximum marks first." });

    const rubric = parse<RubricCriterion[]>(assignment.rubric, [])
      .filter((c) => c && c.criteria)
      .map((c) => ({ criteria: String(c.criteria), description: c.description ? String(c.description) : undefined, max_score: Number(c.max_score) || 0 }));
    const { files, unread } = await readFiles(parse(submission.file_submissions, []));
    const { tone, instructions, provider } = req.body ?? {};
    const draft = await draftFeedback({
      title: String(assignment.title || ""),
      description: String(assignment.description || ""),
      maxScore,
      rubric,
      text: String(submission.text_submission || ""),
      files,
      unread,
      tone,
      instructions,
      provider,
    });
    return res.json({ success: true, data: draft });
  } catch (error: any) {
    if ([400, 502, 503].includes(error?.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return sendControllerError(res, error, "drafting feedback");
  }
};
