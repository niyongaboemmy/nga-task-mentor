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
  UpdateStatusPayload,
} from "../validations/reportCard.validation";

// ─── POST /api/report-cards/builder/save ─────────────────────────────────────
// Design: one report card per student+term+year. Multiple instructors each call
// this endpoint for their own subject (course). We do a partial replace —
// destroying only rows that belong to the subject_ids present in this payload,
// so that other subjects' mappings are never touched.

export const saveBuilder = async (req: Request, res: Response) => {
  try {
    const body = req.body as BuilderSavePayload;
    const { student_id, term, academic_year, assessments } = body;

    // Find or create the single report card for this student+term+year.
    const [reportCard, created] = await ReportCard.findOrCreate({
      where: { student_id, term, academic_year },
      defaults: {
        student_id,
        term,
        academic_year,
        status: "draft",
        attendance_present: 0,
        attendance_absent: 0,
        attendance_late: 0,
      },
    });

    // Partial replace: only wipe rows for the specific subject_ids being saved.
    // This preserves every other subject's mappings already in the report card.
    if (assessments.length > 0) {
      const incomingSubjectIds = [...new Set(assessments.map((a) => a.subject_id))];

      await ReportCardAssessment.destroy({
        where: {
          report_card_id: reportCard.id,
          subject_id: { [Op.in]: incomingSubjectIds },
        },
      });

      await ReportCardAssessment.bulkCreate(
        assessments.map((a) => ({
          report_card_id: reportCard.id!,
          subject_id: a.subject_id,
          assessment_type: a.assessment_type,
          assessment_id: a.assessment_id,
          category: a.category,
        })),
      );
    }

    // Count total assessments and unique subjects now in this report card
    const allMappings = await ReportCardAssessment.findAll({
      where: { report_card_id: reportCard.id },
      attributes: ["subject_id", "assessment_id"],
    });
    const subjectsMapped = new Set(allMappings.map((m) => m.subject_id)).size;

    res.status(200).json({
      success: true,
      message: created
        ? "Report card initialized and assessments saved"
        : "Assessment mappings updated for subject",
      data: {
        report_card_id: reportCard.id,
        status: reportCard.status,
        is_new: created,
        subject_mappings_saved: assessments.length,
        total_subjects_mapped: subjectsMapped,
        total_assessments_mapped: allMappings.length,
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
        status: "draft",
        attendance_present: attendance_present ?? 0,
        attendance_absent: attendance_absent ?? 0,
        attendance_late: attendance_late ?? 0,
      },
    });

    await reportCard.update({
      class_teacher_comment: class_teacher_comment ?? null,
      attendance_present: attendance_present ?? reportCard.attendance_present,
      attendance_absent: attendance_absent ?? reportCard.attendance_absent,
      attendance_late: attendance_late ?? reportCard.attendance_late,
    });

    await ReportCardAttribute.destroy({ where: { report_card_id: reportCard.id } });

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
        status: reportCard.status,
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

// ─── GET /api/report-cards/overview ──────────────────────────────────────────
// Returns the report card status for a batch of students in a given term/year.
// The frontend passes the student IDs it already holds from the enrollment list.
// Query params: term, academic_year, student_ids (comma-separated)

export const getCourseOverview = async (req: Request, res: Response) => {
  try {
    const { term, academic_year, student_ids } = req.query as {
      term?: string;
      academic_year?: string;
      student_ids?: string;
    };

    if (!term || !academic_year || !student_ids) {
      return res.status(400).json({
        success: false,
        message: "term, academic_year, and student_ids are required",
      });
    }

    const ids = student_ids
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: "No valid student_ids provided" });
    }

    // Fetch all report cards for these students in the given term/year
    const reportCards = await ReportCard.findAll({
      where: { student_id: { [Op.in]: ids }, term, academic_year },
      attributes: ["id", "student_id", "status", "updated_at"],
    });

    // For each report card, count distinct subjects mapped and whether attributes exist
    const rcIds = reportCards.map((rc) => rc.id!);

    const [assessmentCounts, attributeCounts] = await Promise.all([
      rcIds.length > 0
        ? ReportCardAssessment.findAll({
            where: { report_card_id: { [Op.in]: rcIds } },
            attributes: ["report_card_id", "subject_id"],
          })
        : [],
      rcIds.length > 0
        ? ReportCardAttribute.findAll({
            where: { report_card_id: { [Op.in]: rcIds } },
            attributes: ["report_card_id"],
          })
        : [],
    ]);

    // Build lookup maps
    const subjectsPerCard = new Map<number, Set<number>>();
    for (const a of assessmentCounts as ReportCardAssessment[]) {
      if (!subjectsPerCard.has(a.report_card_id)) {
        subjectsPerCard.set(a.report_card_id, new Set());
      }
      subjectsPerCard.get(a.report_card_id)!.add(a.subject_id);
    }

    const hasAttributesPerCard = new Set(
      (attributeCounts as ReportCardAttribute[]).map((a) => a.report_card_id),
    );

    const rcByStudent = new Map(reportCards.map((rc) => [rc.student_id, rc]));

    const result = ids.map((studentId) => {
      const rc = rcByStudent.get(studentId);
      if (!rc) {
        return {
          student_id: studentId,
          report_card_id: null,
          status: null,
          subjects_mapped: 0,
          has_attributes: false,
          updated_at: null,
        };
      }
      return {
        student_id: studentId,
        report_card_id: rc.id,
        status: rc.status,
        subjects_mapped: subjectsPerCard.get(rc.id!)?.size ?? 0,
        has_attributes: hasAttributesPerCard.has(rc.id!),
        updated_at: rc.updatedAt,
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("getCourseOverview error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/report-cards/:id/status ──────────────────────────────────────
// Instructors: draft ↔ saved
// Admins:      any → any (including approved)
// Students:    forbidden

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    if (isNaN(cardId)) {
      return res.status(400).json({ success: false, message: "Invalid report card ID" });
    }

    const { status } = req.body as UpdateStatusPayload;
    const userRole: string = (req as any).user?.role ?? "";

    if (userRole === "student") {
      return res.status(403).json({ success: false, message: "Students cannot change report card status" });
    }

    // Only admins can approve
    if (status === "approved" && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can approve report cards",
      });
    }

    // Instructors may only set draft or saved
    if (userRole === "instructor" && !["draft", "saved"].includes(status)) {
      return res.status(403).json({
        success: false,
        message: "Instructors can only set status to draft or saved",
      });
    }

    const reportCard = await ReportCard.findByPk(cardId);
    if (!reportCard) {
      return res.status(404).json({ success: false, message: "Report card not found" });
    }

    // Guard: cannot un-approve once approved (only admin can revert)
    if (reportCard.status === "approved" && status !== "approved" && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only an administrator can revert an approved report card",
      });
    }

    await reportCard.update({ status });

    res.status(200).json({
      success: true,
      message: `Report card status updated to '${status}'`,
      data: { report_card_id: cardId, status },
    });
  } catch (error) {
    console.error("updateStatus error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Shared aggregation helper ────────────────────────────────────────────────

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

  return { grades, attributes, rawMappings: assessmentMappings };
}

// ─── GET /api/report-cards/student/:studentId ────────────────────────────────
// Students: only returns approved cards.
// Instructors/admins: see any status.
// Includes raw assessment mappings so the builder can pre-populate.

export const getStudentReportCard = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid studentId" });
    }

    const userRole: string = (req as any).user?.role ?? "";
    const { term, academic_year } = req.query as { term?: string; academic_year?: string };

    const whereClause: any = { student_id: studentId };
    if (term) whereClause.term = term;
    if (academic_year) whereClause.academic_year = academic_year;

    // Students can only see approved report cards
    if (userRole === "student") {
      whereClause.status = "approved";
    }

    const reportCard = await ReportCard.findOne({ where: whereClause });
    if (!reportCard) {
      const message = userRole === "student"
        ? "No approved report card found for this term"
        : "Report card not found";
      return res.status(404).json({ success: false, message });
    }

    const { grades, attributes, rawMappings } = await aggregateReportCardData(reportCard);

    res.status(200).json({
      success: true,
      data: {
        report_card: {
          id: reportCard.id,
          uuid: reportCard.uuid,
          student_id: reportCard.student_id,
          term: reportCard.term,
          academic_year: reportCard.academic_year,
          status: reportCard.status,
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
        // Raw mappings included so the builder can restore previously saved state
        raw_assessments: rawMappings.map((m) => ({
          subject_id: m.subject_id,
          assessment_type: m.assessment_type,
          assessment_id: m.assessment_id,
          category: m.category,
        })),
      },
    });
  } catch (error) {
    console.error("getStudentReportCard error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/report-cards/generate-pdf ─────────────────────────────────────
// Only approved report cards can be downloaded by students.
// Instructors/admins can generate PDFs at any status.

export const generatePdf = async (req: Request, res: Response) => {
  try {
    const { report_card_id } = req.body as GeneratePdfPayload;
    const userRole: string = (req as any).user?.role ?? "";

    const reportCard = await ReportCard.findByPk(report_card_id, {
      include: [{ model: User, as: "student", attributes: ["id", "first_name", "last_name"] }],
    });

    if (!reportCard) {
      return res.status(404).json({ success: false, message: "Report card not found" });
    }

    // Students can only generate PDFs for approved cards
    if (userRole === "student" && reportCard.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "This report card has not been approved yet",
      });
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
// Public verification — no auth required, but only confirms approved cards.

export const verifyReportCard = async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

    if (!uuid || uuid.trim().length === 0) {
      return res.status(400).json({ success: false, message: "UUID is required" });
    }

    const reportCard = await ReportCard.findOne({
      where: { uuid, status: "approved" },
      include: [{ model: User, as: "student", attributes: ["id", "first_name", "last_name"] }],
    });

    if (!reportCard) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: "No verified report card found for this code",
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
        status: reportCard.status,
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
