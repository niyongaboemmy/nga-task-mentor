import { Request, Response } from "express";
import { Op } from "sequelize";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { ManualAssessmentScore } from "../models/ManualAssessmentScore.model";
import type {
  CreateManualAssessmentPayload,
  UpdateManualAssessmentPayload,
  UpsertScoresPayload,
} from "../validations/manualAssessment.validation";

// ─── POST /api/manual-assessments ────────────────────────────────────────────

export const createManualAssessment = async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateManualAssessmentPayload;
    const userId: number | undefined = (req as any).user?.id;

    const assessment = await ManualAssessment.create({
      course_id: body.course_id,
      title: body.title,
      max_score: body.max_score,
      term: body.term,
      academic_year: body.academic_year,
      created_by: userId ?? null,
    });

    res.status(201).json({
      success: true,
      message: "Manual assessment created",
      data: assessment,
    });
  } catch (error) {
    console.error("createManualAssessment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/manual-assessments?course_id=&term=&academic_year= ──────────────

export const listManualAssessments = async (req: Request, res: Response) => {
  try {
    const { course_id, term, academic_year } = req.query as {
      course_id?: string;
      term?: string;
      academic_year?: string;
    };

    if (!course_id) {
      return res.status(400).json({ success: false, message: "course_id is required" });
    }

    const courseIdNum = parseInt(course_id, 10);
    if (isNaN(courseIdNum)) {
      return res.status(400).json({ success: false, message: "course_id must be a number" });
    }

    const where: any = { course_id: courseIdNum };
    if (term) where.term = term;
    if (academic_year) where.academic_year = academic_year;

    const assessments = await ManualAssessment.findAll({
      where,
      order: [["created_at", "ASC"]],
    });

    res.status(200).json({ success: true, data: assessments });
  } catch (error) {
    console.error("listManualAssessments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/manual-assessments/:id ───────────────────────────────────────

export const updateManualAssessment = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const body = req.body as UpdateManualAssessmentPayload;
    const assessment = await ManualAssessment.findByPk(id);

    if (!assessment) {
      return res.status(404).json({ success: false, message: "Manual assessment not found" });
    }

    const updates: Partial<{ title: string; max_score: number }> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.max_score !== undefined) updates.max_score = body.max_score;

    await assessment.update(updates);

    res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    console.error("updateManualAssessment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE /api/manual-assessments/:id ──────────────────────────────────────

export const deleteManualAssessment = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const assessment = await ManualAssessment.findByPk(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Manual assessment not found" });
    }

    // Cascade: destroy scores first
    await ManualAssessmentScore.destroy({ where: { manual_assessment_id: id } });
    await assessment.destroy();

    res.status(200).json({ success: true, message: "Manual assessment deleted" });
  } catch (error) {
    console.error("deleteManualAssessment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/manual-assessments/:id/scores ──────────────────────────────────

export const getScores = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const assessment = await ManualAssessment.findByPk(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Manual assessment not found" });
    }

    const scores = await ManualAssessmentScore.findAll({
      where: { manual_assessment_id: id },
    });

    res.status(200).json({ success: true, data: scores });
  } catch (error) {
    console.error("getScores error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/manual-assessments/:id/scores ─────────────────────────────────
// Upsert: saves/updates scores for all provided students in one call.

export const upsertScores = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const { scores } = req.body as UpsertScoresPayload;

    const assessment = await ManualAssessment.findByPk(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Manual assessment not found" });
    }

    // Validate scores against max_score
    const maxScore = parseFloat(String(assessment.max_score));
    const invalid = scores.find((s) => parseFloat(String(s.score)) > maxScore);
    if (invalid) {
      return res.status(400).json({
        success: false,
        message: `Score for student ${invalid.student_id} exceeds max_score (${maxScore})`,
      });
    }

    // Upsert each score (update if exists, create if not)
    const studentIds = scores.map((s) => s.student_id);
    const existing = await ManualAssessmentScore.findAll({
      where: { manual_assessment_id: id, student_id: { [Op.in]: studentIds } },
    });
    const existingMap = new Map(existing.map((e) => [e.student_id, e]));

    const toCreate: any[] = [];
    const updatePromises: Promise<any>[] = [];

    for (const { student_id, score } of scores) {
      const ex = existingMap.get(student_id);
      if (ex) {
        updatePromises.push(ex.update({ score: parseFloat(String(score)) }));
      } else {
        toCreate.push({ manual_assessment_id: id, student_id, score: parseFloat(String(score)) });
      }
    }

    const [created] = await Promise.all([
      toCreate.length > 0 ? ManualAssessmentScore.bulkCreate(toCreate) : [],
      ...updatePromises,
    ]);

    res.status(200).json({
      success: true,
      message: `Scores saved for ${scores.length} student(s)`,
      data: { saved: scores.length },
    });
  } catch (error) {
    console.error("upsertScores error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
