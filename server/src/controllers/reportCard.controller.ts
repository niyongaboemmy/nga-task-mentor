import { Request, Response } from "express";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAttribute } from "../models/ReportCardAttribute.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { Submission } from "../models/Submission.model";
import { User } from "../models/User.model";
import {
  calculateSubjectGrade,
  parseAssignmentGrade,
  AssessmentScore,
} from "../services/reportCardGrader.service";
import {
  generateReportCardPdf,
  savePdfToDisk,
} from "../services/reportCardPdf.service";
import type {
  BuilderSavePayload,
  AttributesSavePayload,
  GeneratePdfPayload,
} from "../validations/reportCard.validation";

// ─── POST /api/report-cards/builder/save ─────────────────────────────────────

export const saveBuilder = async (req: Request, res: Response) => {
  try {
    const body = req.body as BuilderSavePayload;
    const { student_id, term, academic_year, assessments } = body;

    const [reportCard] = await ReportCard.findOrCreate({
      where: { student_id, term, academic_year },
      defaults: {
        student_id,
        term,
        academic_year,
        attendance_present: 0,
        attendance_absent: 0,
        attendance_late: 0,
      },
    });

    // Upsert each assessment mapping (destroy existing for this report card and re-create)
    await ReportCardAssessment.destroy({
      where: { report_card_id: reportCard.id },
    });

    const created = await ReportCardAssessment.bulkCreate(
      assessments.map((a) => ({
        report_card_id: reportCard.id!,
        subject_id: a.subject_id,
        assessment_type: a.assessment_type,
        assessment_id: a.assessment_id,
        category: a.category,
      })),
    );

    res.status(200).json({
      success: true,
      message: "Assessment mappings saved successfully",
      data: {
        report_card_id: reportCard.id,
        mappings_count: created.length,
        assessments: created,
      },
    });
  } catch (error) {
    console.error("saveBuilder error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/report-cards/attributes/save ──────────────────────────────────

export const saveAttributes = async (req: Request, res: Response) => {
  try {
    const body = req.body as AttributesSavePayload;
    const {
      student_id,
      term,
      academic_year,
      class_teacher_comment,
      attendance_present,
      attendance_absent,
      attendance_late,
      attributes,
    } = body;

    const [reportCard] = await ReportCard.findOrCreate({
      where: { student_id, term, academic_year },
      defaults: {
        student_id,
        term,
        academic_year,
        attendance_present: attendance_present ?? 0,
        attendance_absent: attendance_absent ?? 0,
        attendance_late: attendance_late ?? 0,
      },
    });

    // Update attendance and comment fields on every call
    await reportCard.update({
      class_teacher_comment: class_teacher_comment ?? null,
      attendance_present: attendance_present ?? reportCard.attendance_present,
      attendance_absent: attendance_absent ?? reportCard.attendance_absent,
      attendance_late: attendance_late ?? reportCard.attendance_late,
    });

    // Replace all attributes for this report card
    await ReportCardAttribute.destroy({
      where: { report_card_id: reportCard.id },
    });

    const created = await ReportCardAttribute.bulkCreate(
      attributes.map((a) => ({
        report_card_id: reportCard.id!,
        attribute_name: a.attribute_name,
        rating: a.rating,
      })),
    );

    res.status(200).json({
      success: true,
      message: "Attributes and teacher comment saved successfully",
      data: {
        report_card_id: reportCard.id,
        class_teacher_comment: reportCard.class_teacher_comment,
        attendance: {
          present: reportCard.attendance_present,
          absent: reportCard.attendance_absent,
          late: reportCard.attendance_late,
        },
        attributes: created,
      },
    });
  } catch (error) {
    console.error("saveAttributes error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Shared aggregation helper ───────────────────────────────────────────────

async function aggregateReportCardData(reportCard: ReportCard) {
  const studentId = reportCard.student_id;

  const assessmentMappings = await ReportCardAssessment.findAll({
    where: { report_card_id: reportCard.id },
  });

  const quizIds       = assessmentMappings.filter((m) => m.assessment_type === "quiz").map((m) => m.assessment_id);
  const assignmentIds = assessmentMappings.filter((m) => m.assessment_type === "assignment").map((m) => m.assessment_id);

  const [quizSubmissions, assignmentSubmissions, attributes] = await Promise.all([
    quizIds.length > 0
      ? QuizSubmission.findAll({
          where: { student_id: studentId, quiz_id: { [Op.in]: quizIds } },
          attributes: ["quiz_id", "total_score", "max_score", "percentage"],
        })
      : [],
    assignmentIds.length > 0
      ? Submission.findAll({
          where: { student_id: studentId, assignment_id: { [Op.in]: assignmentIds } },
          attributes: ["assignment_id", "grade"],
        })
      : [],
    ReportCardAttribute.findAll({
      where: { report_card_id: reportCard.id },
      attributes: ["id", "attribute_name", "rating"],
    }),
  ]);

  const quizScoreMap = new Map(
    (quizSubmissions as QuizSubmission[]).map((s) => [s.quiz_id, s]),
  );
  const assignmentScoreMap = new Map(
    (assignmentSubmissions as Submission[]).map((s) => [s.assignment_id, s]),
  );

  const subjectMap = new Map<number, AssessmentScore[]>();

  for (const mapping of assessmentMappings) {
    let entry: AssessmentScore | null = null;

    if (mapping.assessment_type === "quiz") {
      const sub = quizScoreMap.get(mapping.assessment_id);
      if (sub) {
        entry = {
          assessment_id: mapping.assessment_id,
          assessment_type: "quiz",
          category: mapping.category as any,
          raw_score: parseFloat(String(sub.total_score)),
          max_score: parseFloat(String(sub.max_score)),
        };
      }
    } else {
      const sub = assignmentScoreMap.get(mapping.assessment_id);
      if (sub) {
        const parsed = parseAssignmentGrade(sub.grade ?? null);
        if (parsed) {
          entry = {
            assessment_id: mapping.assessment_id,
            assessment_type: "assignment",
            category: mapping.category as any,
            raw_score: parsed.raw_score,
            max_score: parsed.max_score,
          };
        }
      }
    }

    if (entry) {
      const list = subjectMap.get(mapping.subject_id) ?? [];
      list.push(entry);
      subjectMap.set(mapping.subject_id, list);
    }
  }

  const grades = Array.from(subjectMap.entries()).map(([subject_id, scores]) =>
    calculateSubjectGrade(subject_id, scores),
  );

  return { grades, attributes };
}

// ─── GET /api/report-cards/student/:studentId ────────────────────────────────

export const getStudentReportCard = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid studentId" });
    }

    const { term, academic_year } = req.query as { term?: string; academic_year?: string };
    const whereClause: any = { student_id: studentId };
    if (term) whereClause.term = term;
    if (academic_year) whereClause.academic_year = academic_year;

    const reportCard = await ReportCard.findOne({ where: whereClause });
    if (!reportCard) {
      return res.status(404).json({ success: false, message: "Report card not found" });
    }

    const { grades, attributes } = await aggregateReportCardData(reportCard);

    res.status(200).json({
      success: true,
      data: {
        report_card: {
          id: reportCard.id,
          uuid: reportCard.uuid,
          student_id: reportCard.student_id,
          term: reportCard.term,
          academic_year: reportCard.academic_year,
          class_teacher_comment: reportCard.class_teacher_comment ?? null,
          attendance: {
            present: reportCard.attendance_present,
            absent: reportCard.attendance_absent,
            late: reportCard.attendance_late,
            total_days:
              reportCard.attendance_present +
              reportCard.attendance_absent +
              reportCard.attendance_late,
          },
        },
        grades,
        attributes,
      },
    });
  } catch (error) {
    console.error("getStudentReportCard error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/report-cards/generate-pdf ─────────────────────────────────────

export const generatePdf = async (req: Request, res: Response) => {
  try {
    const { report_card_id } = req.body as GeneratePdfPayload;

    const reportCard = await ReportCard.findByPk(report_card_id, {
      include: [{ model: User, as: "student", attributes: ["id", "first_name", "last_name"] }],
    });

    if (!reportCard) {
      return res.status(404).json({ success: false, message: "Report card not found" });
    }

    const student = (reportCard as any).student as User | undefined;
    const studentName = student
      ? `${student.first_name} ${student.last_name}`
      : `Student #${reportCard.student_id}`;

    const { grades, attributes } = await aggregateReportCardData(reportCard);

    const verificationBaseUrl =
      process.env.APP_PUBLIC_URL ||
      process.env.FRONTEND_URL?.replace(/\/$/, "") ||
      "http://localhost:5002";

    const pdfBuffer = await generateReportCardPdf({
      student_name: studentName,
      student_id: reportCard.student_id,
      report_card_id: reportCard.id!,
      uuid: reportCard.uuid,
      term: reportCard.term,
      academic_year: reportCard.academic_year,
      attendance_present: reportCard.attendance_present,
      attendance_absent: reportCard.attendance_absent,
      attendance_late: reportCard.attendance_late,
      grades,
      attributes: attributes.map((a) => ({
        attribute_name: a.attribute_name,
        rating: a.rating,
      })),
      class_teacher_comment: reportCard.class_teacher_comment,
      verification_base_url: verificationBaseUrl,
    });

    // Persist path so we can serve it without re-generating
    const relativePath = savePdfToDisk(pdfBuffer, reportCard.uuid);
    await reportCard.update({ pdf_path: relativePath });

    const filename = `ReportCard-${studentName.replace(/\s+/g, "_")}-${reportCard.term}-${reportCard.academic_year}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
      "X-Report-Card-UUID": reportCard.uuid,
    });
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("generatePdf error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/public/verify/report-card/:uuid ────────────────────────────────

export const verifyReportCard = async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

    if (!uuid || uuid.trim().length === 0) {
      return res.status(400).json({ success: false, message: "UUID is required" });
    }

    const reportCard = await ReportCard.findOne({
      where: { uuid },
      include: [{ model: User, as: "student", attributes: ["id", "first_name", "last_name"] }],
    });

    if (!reportCard) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: "No report card found for this verification code",
      });
    }

    const student = (reportCard as any).student as User | undefined;
    const studentName = student
      ? `${student.first_name} ${student.last_name}`
      : `Student #${reportCard.student_id}`;

    const { grades } = await aggregateReportCardData(reportCard);
    const averageScore =
      grades.length > 0
        ? parseFloat(
            (grades.reduce((s, g) => s + g.total_score, 0) / grades.length).toFixed(2),
          )
        : 0;

    res.status(200).json({
      success: true,
      verified: true,
      data: {
        student_name: studentName,
        term: reportCard.term,
        academic_year: reportCard.academic_year,
        average_score: averageScore,
        subjects_count: grades.length,
        issued_by: "National Grammar Academy",
        generated_at: reportCard.updatedAt,
      },
    });
  } catch (error) {
    console.error("verifyReportCard error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
