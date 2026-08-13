import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAttribute } from "../models/ReportCardAttribute.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { Submission } from "../models/Submission.model";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { ManualAssessmentScore } from "../models/ManualAssessmentScore.model";
import { User } from "../models/User.model";
import {
  calculateSubjectGrade,
  parseAssignmentGrade,
  combineAnnualSubjectGrades,
  AssessmentScore,
} from "../services/reportCardGrader.service";
import {
  generateReportCardPdf,
  generateAnnualReportCardPdf,
  saveReportCardPdf,
} from "../services/reportCardPdf.service";
import type {
  BuilderSavePayload,
  AttributesSavePayload,
  GeneratePdfPayload,
  UpdateStatusPayload,
} from "../validations/reportCard.validation";
import { resolveCurrentAcademicPeriodNames, getMisToken } from "../utils/misUtils";

// ─── Subject name resolution ─────────────────────────────────────────────────
// Report card data only stores subject_id. Both the on-screen preview and the
// downloaded PDF previously rendered "Subject #{id}" because neither the API
// response nor the PDF pipeline ever resolved the id to a real name. Fetch the
// MIS subject catalog once per request (small, ~1 page) and map ids -> names.
const resolveSubjectNames = async (
  req: Request,
  subjectIds: number[],
): Promise<Record<number, string>> => {
  const names: Record<number, string> = {};
  if (subjectIds.length === 0) return names;

  const token = getMisToken(req);
  if (!token) return names;

  try {
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/subjects`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 200 },
      },
    );
    const subjects = response.data?.data || [];
    for (const s of subjects) {
      const id = s.id ?? s.subject_id;
      if (id != null) {
        names[id] = s.name || s.subject_name || s.title || `Subject #${id}`;
      }
    }
  } catch (error) {
    console.error("resolveSubjectNames: could not fetch MIS subjects:", error);
  }

  return names;
};

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
    const userPermissions: Set<string> = (req as any).user?.permissions ?? new Set();
    const canApprove = userPermissions.has("REPORT_CARDS_APPROVE");
    const canEdit = userPermissions.has("REPORT_CARDS_EDIT");

    if (!canEdit && !canApprove) {
      return res.status(403).json({ success: false, message: "Not authorized to change report card status" });
    }

    // Only holders of REPORT_CARDS_APPROVE can approve
    if (status === "approved" && !canApprove) {
      return res.status(403).json({
        success: false,
        message: "Only administrators can approve report cards",
      });
    }

    // Editors without approve rights may only set draft or saved
    if (!canApprove && !["draft", "saved"].includes(status)) {
      return res.status(403).json({
        success: false,
        message: "Instructors can only set status to draft or saved",
      });
    }

    const reportCard = await ReportCard.findByPk(cardId);
    if (!reportCard) {
      return res.status(404).json({ success: false, message: "Report card not found" });
    }

    // Guard: cannot un-approve once approved (only holders of REPORT_CARDS_APPROVE can revert)
    if (reportCard.status === "approved" && status !== "approved" && !canApprove) {
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
  const manualIds     = assessmentMappings.filter((m) => m.assessment_type === "manual").map((m) => m.assessment_id);

  const [quizSubmissions, assignmentSubmissions, manualAssessments, manualScores, attributes] = await Promise.all([
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
    manualIds.length > 0
      ? ManualAssessment.findAll({
          where: { id: { [Op.in]: manualIds } },
          attributes: ["id", "max_score"],
        })
      : [],
    manualIds.length > 0
      ? ManualAssessmentScore.findAll({
          where: { student_id: studentId, manual_assessment_id: { [Op.in]: manualIds } },
          attributes: ["manual_assessment_id", "score"],
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
  const manualMaxScoreMap = new Map(
    (manualAssessments as ManualAssessment[]).map((a) => [a.id, parseFloat(String(a.max_score))]),
  );
  const manualScoreMap = new Map(
    (manualScores as ManualAssessmentScore[]).map((s) => [s.manual_assessment_id, parseFloat(String(s.score))]),
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
    } else if (mapping.assessment_type === "assignment") {
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
    } else if (mapping.assessment_type === "manual") {
      const score    = manualScoreMap.get(mapping.assessment_id);
      const maxScore = manualMaxScoreMap.get(mapping.assessment_id);
      if (score !== undefined && maxScore !== undefined && maxScore > 0) {
        entry = {
          assessment_id: mapping.assessment_id,
          assessment_type: "manual",
          category: mapping.category as any,
          raw_score: score,
          max_score: maxScore,
        };
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

    const userPermissions: Set<string> = (req as any).user?.permissions ?? new Set();
    const canViewAll = userPermissions.has("REPORT_CARDS_VIEW_ALL");
    let { term, academic_year } = req.query as { term?: string; academic_year?: string };

    // Without an explicit term/year, previously fell through to whichever row
    // Sequelize returned first (no ORDER BY) — could surface a stale term's
    // report card instead of the current one. Default to the requester's
    // current academic period; if MIS can't resolve it, fall back to most
    // recently created so behavior degrades gracefully rather than erroring.
    if (!term && !academic_year) {
      const current = await resolveCurrentAcademicPeriodNames(req);
      term = current.term ?? undefined;
      academic_year = current.academicYear ?? undefined;
    }

    const whereClause: any = { student_id: studentId };
    if (term) whereClause.term = term;
    if (academic_year) whereClause.academic_year = academic_year;

    // Callers without the view-all permission can only see approved report cards
    if (!canViewAll) {
      whereClause.status = "approved";
    }

    const reportCard = await ReportCard.findOne({
      where: whereClause,
      order: [["createdAt", "DESC"]],
    });
    if (!reportCard) {
      const message = !canViewAll
        ? "No approved report card found for this term"
        : "Report card not found";
      return res.status(404).json({ success: false, message });
    }

    const { grades, attributes, rawMappings } = await aggregateReportCardData(reportCard);
    const subjectNames = await resolveSubjectNames(
      req,
      grades.map((g) => g.subject_id),
    );

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
        subject_names: subjectNames,
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

// ─── GET /api/report-cards/annual/:studentId ─────────────────────────────────
// Read-only, computed-on-demand combination of every term's report card in
// one academic year — there is no "annual" ReportCard row; this endpoint
// averages whatever term rows already exist. Students: only approved term
// cards contribute. Instructors/admins: any status contributes.

export const getAnnualReportCard = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid studentId" });
    }

    const userPermissions: Set<string> = (req as any).user?.permissions ?? new Set();
    const canViewAll = userPermissions.has("REPORT_CARDS_VIEW_ALL");
    const { academic_year, academic_year_id } = req.query as {
      academic_year?: string;
      academic_year_id?: string;
    };

    if (!academic_year) {
      return res.status(400).json({ success: false, message: "academic_year is required" });
    }

    const whereClause: any = { student_id: studentId, academic_year };
    if (!canViewAll) {
      whereClause.status = "approved";
    }

    const termReportCards = await ReportCard.findAll({
      where: whereClause,
      order: [["term", "ASC"]],
    });

    // Per-term aggregation, reusing the same logic the single-term endpoints use.
    const perTerm = await Promise.all(
      termReportCards.map(async (rc) => {
        const { grades, attributes } = await aggregateReportCardData(rc);
        return {
          term: rc.term,
          status: rc.status,
          attendance: {
            present: rc.attendance_present,
            absent: rc.attendance_absent,
            late: rc.attendance_late,
          },
          attributes,
          grades,
        };
      }),
    );

    // Combine per-subject totals across whichever terms contributed.
    const subjectIds = new Set<number>();
    for (const t of perTerm) for (const g of t.grades) subjectIds.add(g.subject_id);

    const annualGrades = Array.from(subjectIds).map((subjectId) => {
      const termTotals = perTerm
        .filter((t) => t.grades.some((g) => g.subject_id === subjectId))
        .map((t) => ({
          term: t.term,
          total_score: t.grades.find((g) => g.subject_id === subjectId)!.total_score,
        }));
      return combineAnnualSubjectGrades(subjectId, termTotals);
    });

    const subjectNames = await resolveSubjectNames(req, Array.from(subjectIds));

    // Best-effort: determine which terms in this academic year are missing
    // a report card altogether. Requires a live MIS token to fetch the
    // canonical term list — degrades gracefully (empty list) without one,
    // same pattern as resolveSubjectNames.
    let missingTerms: string[] = [];
    const token = getMisToken(req);
    if (token && academic_year_id) {
      try {
        const response = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/terms`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { academic_year_id },
          },
        );
        const allTermNames: string[] = (response.data?.data || []).map(
          (t: any) => t.name,
        );
        const foundTermNames = new Set(termReportCards.map((rc) => rc.term));
        missingTerms = allTermNames.filter((name) => !foundTermNames.has(name));
      } catch (error) {
        console.error("getAnnualReportCard: could not resolve term catalog:", error);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        student_id: studentId,
        academic_year,
        annual_grades: annualGrades,
        subject_names: subjectNames,
        per_term: perTerm,
        missing_terms: missingTerms,
      },
    });
  } catch (error) {
    console.error("getAnnualReportCard error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/report-cards/generate-pdf ─────────────────────────────────────
// Only approved report cards can be downloaded by students.
// Instructors/admins can generate PDFs at any status.

export const generatePdf = async (req: Request, res: Response) => {
  try {
    const { report_card_id } = req.body as GeneratePdfPayload;
    const canViewAll = ((req as any).user?.permissions as Set<string> | undefined)?.has(
      "REPORT_CARDS_VIEW_ALL",
    );

    const reportCard = await ReportCard.findByPk(report_card_id, {
      include: [{ model: User, as: "student", attributes: ["id", "first_name", "last_name"] }],
    });

    if (!reportCard) {
      return res.status(404).json({ success: false, message: "Report card not found" });
    }

    // Callers without the view-all permission can only generate PDFs for approved cards
    if (!canViewAll && reportCard.status !== "approved") {
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
    const subjectNames = await resolveSubjectNames(
      req,
      grades.map((g) => g.subject_id),
    );

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
      subject_names: subjectNames,
      attributes: attributes.map((a) => ({
        attribute_name: a.attribute_name,
        rating: a.rating,
      })),
      class_teacher_comment: reportCard.class_teacher_comment,
      verification_base_url: verificationBaseUrl,
    });

    const relativePath = await saveReportCardPdf(pdfBuffer, reportCard.uuid);
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

// ─── POST /api/report-cards/annual/generate-pdf ──────────────────────────────
// Streams the annual PDF directly — unlike the per-term generatePdf, there's
// no ReportCard row to attach a pdf_path to (annual is computed on demand,
// never stored), so this skips the file-server upload entirely.

export const generateAnnualPdf = async (req: Request, res: Response) => {
  try {
    const { student_id, academic_year, academic_year_id } = req.body as {
      student_id: number;
      academic_year: string;
      academic_year_id?: number;
    };

    if (!student_id || !academic_year) {
      return res
        .status(400)
        .json({ success: false, message: "student_id and academic_year are required" });
    }

    const canViewAll = ((req as any).user?.permissions as Set<string> | undefined)?.has(
      "REPORT_CARDS_VIEW_ALL",
    );

    const whereClause: any = { student_id, academic_year };
    if (!canViewAll) whereClause.status = "approved";

    const termReportCards = await ReportCard.findAll({
      where: whereClause,
      order: [["term", "ASC"]],
    });

    if (termReportCards.length === 0) {
      return res.status(404).json({
        success: false,
        message: canViewAll
          ? "No report cards found for this student/academic year"
          : "No approved report cards found for this student/academic year",
      });
    }

    const student = await User.findByPk(student_id, {
      attributes: ["id", "first_name", "last_name"],
    });
    const studentName = student
      ? `${student.first_name} ${student.last_name}`
      : `Student #${student_id}`;

    const perTerm = await Promise.all(
      termReportCards.map(async (rc) => {
        const { grades, attributes } = await aggregateReportCardData(rc);
        return {
          term: rc.term,
          attendance: {
            present: rc.attendance_present,
            absent: rc.attendance_absent,
            late: rc.attendance_late,
          },
          attributes: attributes.map((a) => ({
            attribute_name: a.attribute_name,
            rating: a.rating,
          })),
          grades,
        };
      }),
    );

    const subjectIds = new Set<number>();
    for (const t of perTerm) for (const g of t.grades) subjectIds.add(g.subject_id);

    const annualGrades = Array.from(subjectIds).map((subjectId) => {
      const termTotals = perTerm
        .filter((t) => t.grades.some((g) => g.subject_id === subjectId))
        .map((t) => ({
          term: t.term,
          total_score: t.grades.find((g) => g.subject_id === subjectId)!.total_score,
        }));
      return combineAnnualSubjectGrades(subjectId, termTotals);
    });

    const subjectNames = await resolveSubjectNames(req, Array.from(subjectIds));

    let missingTerms: string[] = [];
    const token = getMisToken(req);
    if (token && academic_year_id) {
      try {
        const response = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/terms`,
          { headers: { Authorization: `Bearer ${token}` }, params: { academic_year_id } },
        );
        const allTermNames: string[] = (response.data?.data || []).map((t: any) => t.name);
        const foundTermNames = new Set(termReportCards.map((rc) => rc.term));
        missingTerms = allTermNames.filter((name) => !foundTermNames.has(name));
      } catch (error) {
        console.error("generateAnnualPdf: could not resolve term catalog:", error);
      }
    }

    const pdfBuffer = await generateAnnualReportCardPdf({
      student_name: studentName,
      student_id,
      academic_year,
      annual_grades: annualGrades,
      subject_names: subjectNames,
      per_term: perTerm.map((t) => ({
        term: t.term,
        attendance: t.attendance,
        attributes: t.attributes,
      })),
      missing_terms: missingTerms,
    });

    const filename = `AnnualReport-${studentName.replace(/\s+/g, "_")}-${academic_year}.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
    });
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("generateAnnualPdf error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/report-cards/admin/students ────────────────────────────────────
// Lists every report card for a term/year, sourced entirely from the local DB
// (ReportCard.student_id is a real FK to the local User table, so no MIS call
// is needed for names) — backs the admin "download report cards for a
// term/year" bulk-export flow and the "individual student" search.

export const listReportCardStudents = async (req: Request, res: Response) => {
  try {
    let { term, academic_year } = req.query as { term?: string; academic_year?: string };

    if (!term && !academic_year) {
      const current = await resolveCurrentAcademicPeriodNames(req);
      term = current.term ?? undefined;
      academic_year = current.academicYear ?? undefined;
    }

    if (!term || !academic_year) {
      return res.status(400).json({
        success: false,
        message: "term and academic_year are required (and could not be resolved from your current period)",
      });
    }

    const reportCards = await ReportCard.findAll({
      where: { term, academic_year },
      include: [{ model: User, as: "student", attributes: ["id", "first_name", "last_name"] }],
      order: [["createdAt", "DESC"]],
    });

    const data = reportCards.map((rc) => {
      const student = (rc as any).student as User | undefined;
      return {
        report_card_id: rc.id,
        student_id: rc.student_id,
        uuid: rc.uuid,
        status: rc.status,
        name: student
          ? `${student.first_name} ${student.last_name}`.trim()
          : `Student #${rc.student_id}`,
      };
    });

    res.status(200).json({ success: true, data, term, academic_year });
  } catch (error) {
    console.error("listReportCardStudents error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/report-cards/admin/summary ─────────────────────────────────────
// Cross-subject, cross-student aggregate for a term/year: status counts,
// per-category (CW/HW/MD/EOT) averages, and per-subject averages. Reuses
// aggregateReportCardData per card rather than re-deriving grade math, so this
// stays consistent with what each student's own report card shows. Capped at
// MAX_CARDS since it's a synchronous admin action, not a hot path.

const ADMIN_SUMMARY_MAX_CARDS = 300;

export const getAdminSummary = async (req: Request, res: Response) => {
  try {
    let { term, academic_year } = req.query as { term?: string; academic_year?: string };

    if (!term && !academic_year) {
      const current = await resolveCurrentAcademicPeriodNames(req);
      term = current.term ?? undefined;
      academic_year = current.academicYear ?? undefined;
    }

    if (!term || !academic_year) {
      return res.status(400).json({
        success: false,
        message: "term and academic_year are required (and could not be resolved from your current period)",
      });
    }

    const reportCards = await ReportCard.findAll({
      where: { term, academic_year },
      limit: ADMIN_SUMMARY_MAX_CARDS,
    });

    const statusCounts = { draft: 0, saved: 0, approved: 0 };
    const categoryTotals: Record<string, { sum: number; count: number }> = {
      CW: { sum: 0, count: 0 },
      HW: { sum: 0, count: 0 },
      MD: { sum: 0, count: 0 },
      EOT: { sum: 0, count: 0 },
    };
    const subjectTotals = new Map<number, { sum: number; count: number }>();
    let overallSum = 0;
    let overallCount = 0;

    for (const reportCard of reportCards) {
      statusCounts[reportCard.status as keyof typeof statusCounts] =
        (statusCounts[reportCard.status as keyof typeof statusCounts] ?? 0) + 1;

      const { grades } = await aggregateReportCardData(reportCard);
      for (const grade of grades) {
        overallSum += grade.total_score;
        overallCount += 1;

        const subjTotal = subjectTotals.get(grade.subject_id) ?? { sum: 0, count: 0 };
        subjTotal.sum += grade.total_score;
        subjTotal.count += 1;
        subjectTotals.set(grade.subject_id, subjTotal);

        for (const cat of Object.keys(categoryTotals)) {
          const catResult = grade.categories[cat as keyof typeof grade.categories];
          if (catResult) {
            categoryTotals[cat].sum += catResult.scaled_score;
            categoryTotals[cat].count += 1;
          }
        }
      }
    }

    const subjectIds = Array.from(subjectTotals.keys());
    const subjectNames = await resolveSubjectNames(req, subjectIds);

    res.status(200).json({
      success: true,
      data: {
        term,
        academic_year,
        total_report_cards: reportCards.length,
        truncated: reportCards.length >= ADMIN_SUMMARY_MAX_CARDS,
        status_counts: statusCounts,
        overall_average: overallCount > 0 ? parseFloat((overallSum / overallCount).toFixed(2)) : null,
        category_averages: Object.fromEntries(
          Object.entries(categoryTotals).map(([cat, { sum, count }]) => [
            cat,
            count > 0 ? parseFloat((sum / count).toFixed(2)) : null,
          ]),
        ),
        subject_averages: subjectIds.map((id) => {
          const { sum, count } = subjectTotals.get(id)!;
          return {
            subject_id: id,
            subject_name: subjectNames[id] ?? `Subject #${id}`,
            average_score: parseFloat((sum / count).toFixed(2)),
            student_count: count,
          };
        }),
      },
    });
  } catch (error) {
    console.error("getAdminSummary error:", error);
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
