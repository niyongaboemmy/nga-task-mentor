import { Request, Response } from "express";
import { Op } from "sequelize";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { ManualAssessmentScore } from "../models/ManualAssessmentScore.model";
import type {
  CreateManualAssessmentPayload,
  UpdateManualAssessmentPayload,
  UpsertScoresPayload,
} from "../validations/manualAssessment.validation";
import { resolveCurrentAcademicPeriodNames } from "../utils/misUtils";

// ─── POST /api/manual-assessments ────────────────────────────────────────────

export const createManualAssessment = async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateManualAssessmentPayload;
    const userId: number | undefined = (req as any).user?.id;

    const assessment = await ManualAssessment.create({
      course_id:         body.course_id,
      title:             body.title,
      assessment_type:   body.assessment_type ?? null,
      assessment_number: body.assessment_number ?? null,
      assessment_date:   body.assessment_date ?? null,
      add_to_final_grade: body.add_to_final_grade !== undefined ? body.add_to_final_grade : true,
      max_score:         body.max_score,
      term:              body.term,
      academic_year:     body.academic_year,
      created_by:        userId ?? null,
    });

    res.status(201).json({
      success: true,
      message: "Assessment created",
      data: assessment,
    });
  } catch (error) {
    console.error("createManualAssessment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/manual-assessments ─────────────────────────────────────────────
// Supports:
//   ?course_id=1             — single course (legacy)
//   ?course_ids=1,2,3        — multiple courses (Grades page)
//   &term=&academic_year=    — optional filters
//   &with_counts=true        — include recorded_count per assessment

export const listManualAssessments = async (req: Request, res: Response) => {
  try {
    let { course_id, course_ids, term, academic_year, with_counts } = req.query as {
      course_id?: string;
      course_ids?: string;
      term?: string;
      academic_year?: string;
      with_counts?: string;
    };

    // Previously term/academic_year were purely optional, so omitting them
    // returned assessments across every term for the course. Default to the
    // requester's current academic period so listings are scoped by default.
    if (!term && !academic_year) {
      const current = await resolveCurrentAcademicPeriodNames(req);
      term = current.term ?? undefined;
      academic_year = current.academicYear ?? undefined;
    }

    if (!course_id && !course_ids) {
      return res.status(400).json({ success: false, message: "course_id or course_ids is required" });
    }

    let courseIdList: number[] = [];
    if (course_ids) {
      courseIdList = course_ids.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
    } else if (course_id) {
      const parsed = parseInt(course_id, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ success: false, message: "course_id must be a number" });
      }
      courseIdList = [parsed];
    }

    if (courseIdList.length === 0) {
      return res.status(400).json({ success: false, message: "No valid course IDs provided" });
    }

    const where: any = { course_id: { [Op.in]: courseIdList } };
    if (term) where.term = term;
    if (academic_year) where.academic_year = academic_year;

    const assessments = await ManualAssessment.findAll({
      where,
      order: [["assessment_date", "DESC"], ["created_at", "DESC"]],
    });

    if (with_counts === "true" && assessments.length > 0) {
      const ids = assessments.map((a) => a.id);
      const allScores = await ManualAssessmentScore.findAll({
        where: { manual_assessment_id: { [Op.in]: ids } },
        attributes: ["manual_assessment_id"],
      });

      const countMap = new Map<number, number>();
      for (const s of allScores) {
        countMap.set(s.manual_assessment_id, (countMap.get(s.manual_assessment_id) ?? 0) + 1);
      }

      const enriched = assessments.map((a) => ({
        ...(a.toJSON() as object),
        recorded_count: countMap.get(a.id) ?? 0,
      }));
      return res.status(200).json({ success: true, data: enriched });
    }

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
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    const updates: any = {};
    if (body.title             !== undefined) updates.title             = body.title;
    if (body.assessment_type   !== undefined) updates.assessment_type   = body.assessment_type;
    if (body.assessment_number !== undefined) updates.assessment_number = body.assessment_number;
    if (body.assessment_date   !== undefined) updates.assessment_date   = body.assessment_date;
    if (body.add_to_final_grade !== undefined) updates.add_to_final_grade = body.add_to_final_grade;
    if (body.max_score         !== undefined) updates.max_score         = body.max_score;

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
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    await ManualAssessmentScore.destroy({ where: { manual_assessment_id: id } });
    await assessment.destroy();

    res.status(200).json({ success: true, message: "Assessment deleted" });
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
      return res.status(404).json({ success: false, message: "Assessment not found" });
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

export const upsertScores = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const { scores } = req.body as UpsertScoresPayload;

    const assessment = await ManualAssessment.findByPk(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    const maxScore = parseFloat(String(assessment.max_score));
    const invalid = scores.find((s) => parseFloat(String(s.score)) > maxScore);
    if (invalid) {
      return res.status(400).json({
        success: false,
        message: `Score for student ${invalid.student_id} exceeds max_score (${maxScore})`,
      });
    }

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

    await Promise.all([
      toCreate.length > 0 ? ManualAssessmentScore.bulkCreate(toCreate) : Promise.resolve(),
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
