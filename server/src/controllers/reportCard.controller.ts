import { inactiveMisIds, isActiveStatus, misRowStatus } from "../utils/activeUsers";
import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAttribute } from "../models/ReportCardAttribute.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { SubjectAssessmentMapping } from "../models/SubjectAssessmentMapping.model";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { combineAnnualSubjectGrades } from "../services/reportCardGrader.service";
import type { SubjectGrade } from "../services/reportCardGrader.service";
import { componentOfManual, loadStudentScores, resolveCardStudent } from "../utils/reportCardScores";
import {
  buildProvisionalCard,
  suggestedCategory,
  type ItemKind,
  type PreviewSource,
  type PreviewSubjectInput,
} from "../services/reportCardPreview.service";
import type { AssessmentCategory } from "../services/reportCardGrader.service";
import { Quiz } from "../models/Quiz.model";
import { Assignment, COUNTED_MARKS } from "../models/Assignment.model";
import { generateAnnualReportCardPdf } from "../services/reportCardPdf.service";
import {
  buildCardDocuments,
  computeCardGrades,
  loadCohort,
  resolveStudentInfo,
  resolveSubjectNames,
  type ReportCardDocument,
} from "../services/reportCardDocument";
import { renderReportCardPdf } from "../services/reportCardDocumentPdf";
import { loadLetterhead } from "../services/documentLetterhead";
import {
  activeSnapshot,
  cardPdf,
  frozenDocument,
  snapshotOfVersion,
  verificationBase,
} from "../services/reportCardSnapshot.service";
import { isEditable, isFrozen, legacyStatusToActions } from "../services/reportCardWorkflow";
import { getReportCardScheme } from "../services/tenantSettings";
import { builderStructure, effectiveCategory, gradingOf } from "../services/reportCardBuilders";
import {
  COMPONENT_KEYS,
  COMPONENT_LABEL,
  getComponentWeights,
  setDefaultComponentWeights,
  setSubjectComponentWeights,
  weightsFor,
} from "../services/componentWeights";
import { runTransition } from "./reportCardWorkflow.controller";
import type {
  BuilderSavePayload,
  SubjectMappingSavePayload,
  AttributesSavePayload,
  GeneratePdfPayload,
  UpdateStatusPayload,
} from "../validations/reportCard.validation";
import {
  resolveCurrentAcademicPeriodNames,
  resolveAcademicTermIdByName,
  resolveAcademicTermId,
  resolveAcademicYearId,
  getMisToken,
  fetchEnrolledStudentsRaw,
} from "../utils/misUtils";
import {
  cardStudentIds,
  cardStudentTarget,
  denyResponse,
  filterCardStudents,
  once,
  rejectLocked,
  reportCardReadAccess,
  scopedAllow,
  userPermissions,
} from "../utils/reportCardAccess";
import { loadSchoolDirectory } from "../services/schoolDirectory";
import { loadTermAssessments, pickUnmapped, type UnmappedMark } from "../services/marksAttention";
import { sendControllerError } from "../utils/controllerErrors";

// ─── Access control v2: report-card scoping ──────────────────────────────────
// Report-card chain (docs/REPORTS_AND_REPORT_CARD_REVIEW.md §6): marks =
// REPORT_CARDS_EDIT (subject x class), comment = REPORT_CARDS_COMMENT (class
// group), review = REPORT_CARDS_REVIEW, approve = REPORT_CARDS_APPROVE,
// publish = REPORT_CARDS_PUBLISH. Only a DRAFT card can be edited; every write
// below goes through rejectLocked / the fan-out's locked-card skip.

const SHELL_DEFAULTS = { status: "draft" as const, attendance_present: 0, attendance_absent: 0, attendance_late: 0 };

/** The card of a student for a period under any id it may be keyed on (MIS first). */
async function findStudentCard(studentId: number, where: Record<string, unknown>): Promise<ReportCard | null> {
  const ids = await cardStudentIds(studentId);
  const cards = await ReportCard.findAll({
    where: { ...where, student_id: { [Op.in]: ids } },
    order: [["createdAt", "DESC"]],
  });
  return cards.find((c) => c.student_id === studentId) ?? cards[0] ?? null;
}

/** The card's document: its snapshot when frozen, else rendered live with its class. */
async function documentFor(req: Request, card: ReportCard, opts: { staff: boolean }): Promise<ReportCardDocument> {
  const frozen = await frozenDocument(req, card);
  if (frozen) return frozen;
  const yearId = opts.staff ? await resolveAcademicYearId(req).catch(() => null) : null;
  const directory = opts.staff ? await loadSchoolDirectory(req, yearId ?? null).catch(() => null) : null;
  const docs = await buildCardDocuments(req, [card], { directory, cohort: await loadCohort(card) });
  return docs.get(card.id!)!;
}

/**
 * Staff guidance on a draft card: per subject, the term's counted assessments
 * (not "part of" another) that have marks but aren't mapped, so they count
 * nowhere. Frozen cards can't change, so they get none.
 */
async function unmappedFor(req: Request, card: ReportCard, doc: ReportCardDocument, rawMappings: ReportCardAssessment[]): Promise<Record<number, UnmappedMark[]>> {
  if (isFrozen(card.status)) return {};
  const subjectIds = doc.groups.flatMap((g) => g.subjects.map((s) => s.subject_id));
  if (!subjectIds.length) return {};
  const termId = await resolveAcademicTermIdByName(req, card.term, card.academic_year).catch(() => null);
  const loaded = await loadTermAssessments(subjectIds, termId, card.term, card.academic_year);
  // Without the term id, quizzes/assignments of other terms can't be told apart: keep manual ones only.
  const assessments = termId ? loaded.assessments : loaded.assessments.filter((a) => a.kind === "manual");
  const keys = new Set([...loaded.mapped, ...rawMappings.map((m) => `${m.assessment_type}:${m.assessment_id}`)]);
  const open = assessments.filter((a) => !keys.has(`${a.kind}:${a.id}`));
  if (!open.length) return {};
  const scores = await loadStudentScores(
    await resolveCardStudent(card.student_id),
    open.map((a) => ({ assessment_type: a.kind, assessment_id: a.id })),
  );
  return pickUnmapped(open, keys, scores);
}

/** The legacy read shape (report_card + grades + ...) with the full document alongside. */
function readShape(card: ReportCard, doc: ReportCardDocument, rawMappings: ReportCardAssessment[] = []) {
  const subjectNames: Record<number, string> = {};
  for (const g of doc.groups) for (const s of g.subjects) subjectNames[s.subject_id] = s.name;
  return {
    report_card: {
      id: card.id,
      uuid: card.uuid,
      student_id: card.student_id,
      term: card.term,
      academic_year: card.academic_year,
      status: card.status,
      version: card.version,
      editable: isEditable(card.status),
      reviewed_at: card.reviewed_at,
      approved_at: card.approved_at,
      published_at: card.published_at,
      publish_at: card.publish_at,
      returned_reason: card.returned_reason,
      class_teacher_comment: card.class_teacher_comment ?? null,
      head_teacher_comment: card.head_teacher_comment ?? null,
      behaviour_mark: card.behaviour_mark ?? null,
      attendance: {
        present: doc.attendance.present,
        absent: doc.attendance.absent,
        late: doc.attendance.late,
        excused: doc.attendance.excused,
        sick: doc.attendance.sick,
        total_days: doc.attendance.total,
        source: doc.attendance.source,
      },
    },
    grades: doc.grades,
    attributes: doc.attributes,
    subject_names: subjectNames,
    raw_assessments: rawMappings.map((m) => ({
      subject_id: m.subject_id,
      assessment_type: m.assessment_type,
      assessment_id: m.assessment_id,
      category: m.category,
      mark_status: m.mark_status,
    })),
    document: doc,
  };
}

// ─── POST /api/report-cards/builder/save (legacy, per student) ───────────────

/**
 * Assignments whose marks are part of another assessment (marks_scope
 * "part_of", e.g. Section C of an exam) never go on a report card: mapping
 * them would count the same marks twice. Returns the refusal message, or null.
 */
async function partOfRefusal(assessments: Array<{ assessment_type: string; assessment_id: number }>): Promise<string | null> {
  const ids = [...new Set(assessments.filter((a) => a.assessment_type === "assignment").map((a) => a.assessment_id))];
  if (!ids.length) return null;
  const parts = await Assignment.findAll({
    where: { id: { [Op.in]: ids }, marks_scope: "part_of" },
    attributes: ["id", "title", "part_of_title"],
    raw: true,
  });
  if (!parts.length) return null;
  const list = parts.map((a: any) => `"${a.title}"${a.part_of_title ? ` (part of ${a.part_of_title})` : ""}`).join(", ");
  return `${list} ${parts.length === 1 ? "is" : "are"} part of another assessment, so ${parts.length === 1 ? "it" : "they"} can't be mapped to the report card. Map the assessment ${parts.length === 1 ? "it belongs" : "they belong"} to instead.`;
}

export const saveBuilder = async (req: Request, res: Response) => {
  try {
    const { student_id, term, academic_year, assessments } = req.body as BuilderSavePayload;
    const refusedB = await partOfRefusal(assessments);
    if (refusedB) return res.status(400).json({ success: false, code: "PART_OF_ANOTHER_ASSESSMENT", message: refusedB });

    const builderTarget = once(() => cardStudentTarget(req, student_id));
    for (const subjectId of [...new Set(assessments.map((a) => a.subject_id))]) {
      const ok = await scopedAllow(req, {
        caps: ["REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT"],
        target: async () => ({ ...(await builderTarget()), subjectId }),
        legacy: true,
      });
      if (!ok) return denyResponse(req, res, "Not authorized to enter marks for this subject and class");
    }

    const existing = await findStudentCard(student_id, { term, academic_year });
    if (rejectLocked(res, [existing])) return;
    const [reportCard, created] = existing
      ? [existing, false]
      : await ReportCard.findOrCreate({
          where: { student_id, term, academic_year },
          defaults: { student_id, term, academic_year, ...SHELL_DEFAULTS },
        });

    if (assessments.length > 0) {
      const incomingSubjectIds = [...new Set(assessments.map((a) => a.subject_id))];
      await ReportCardAssessment.destroy({
        where: { report_card_id: reportCard.id, subject_id: { [Op.in]: incomingSubjectIds } },
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

    const allMappings = await ReportCardAssessment.findAll({
      where: { report_card_id: reportCard.id },
      attributes: ["subject_id", "assessment_id"],
    });
    res.status(200).json({
      success: true,
      message: created ? "Report card initialized and assessments saved" : "Assessment mappings updated for subject",
      data: {
        report_card_id: reportCard.id,
        status: reportCard.status,
        is_new: created,
        subject_mappings_saved: assessments.length,
        total_subjects_mapped: new Set(allMappings.map((m) => m.subject_id)).size,
        total_assessments_mapped: allMappings.length,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "saveBuilder");
  }
};

// ─── GET /api/report-cards/subject-mapping ───────────────────────────────────

export const getSubjectMapping = async (req: Request, res: Response) => {
  try {
    const subjectId = parseInt(req.query.subject_id as string, 10);
    const { term, academic_year } = req.query as { term?: string; academic_year?: string };
    if (isNaN(subjectId) || !term || !academic_year) {
      return res.status(400).json({ success: false, message: "subject_id, term, and academic_year are required" });
    }
    const [mappings, lockedCards] = await Promise.all([
      SubjectAssessmentMapping.findAll({
        where: { subject_id: subjectId, term, academic_year },
        attributes: ["assessment_type", "assessment_id", "category"],
      }),
      ReportCard.count({
        where: { term, academic_year, status: { [Op.ne]: "draft" } },
        include: [{ model: ReportCardAssessment, as: "assessments", where: { subject_id: subjectId }, attributes: [], required: true }],
        distinct: true,
      }).catch(() => 0),
    ]);
    res.status(200).json({
      success: true,
      data: {
        subject_id: subjectId,
        term,
        academic_year,
        locked_cards: lockedCards,
        assessments: mappings.map((m) => ({ assessment_type: m.assessment_type, assessment_id: m.assessment_id, category: m.category })),
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getSubjectMapping");
  }
};

// ─── POST /api/report-cards/subject-mapping/save ─────────────────────────────
// Full-replaces the subject's canonical mapping, then fans it out to every
// enrolled student's DRAFT card. Cards past draft are left exactly as they
// are (their content is reviewed or frozen) and counted as skipped. A
// student's absent/exempt resolutions survive the rewrite.

export const saveSubjectMapping = async (req: Request, res: Response) => {
  try {
    const { subject_id, term, academic_year, assessments } = req.body as SubjectMappingSavePayload;
    const refused = await partOfRefusal(assessments);
    if (refused) return res.status(400).json({ success: false, code: "PART_OF_ANOTHER_ASSESSMENT", message: refused });

    const mayMap = await scopedAllow(req, {
      caps: ["REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT"],
      target: { subjectId: subject_id },
      legacy: true,
    });
    if (!mayMap) return denyResponse(req, res, "Not authorized to map assessments for this subject");

    await SubjectAssessmentMapping.destroy({ where: { subject_id, term, academic_year } });
    if (assessments.length > 0) {
      await SubjectAssessmentMapping.bulkCreate(
        assessments.map((a) => ({
          subject_id,
          term,
          academic_year,
          assessment_type: a.assessment_type,
          assessment_id: a.assessment_id,
          category: a.category,
          created_by: (req as any).user?.id ?? null,
        })),
      );
    }

    const token = getMisToken(req);
    let studentsUpdated = 0;
    let studentsSkipped = 0;

    if (token) {
      let termId = await resolveAcademicTermIdByName(req, term, academic_year);
      if (termId == null) termId = await resolveAcademicTermId(req);

      // Inactive students' existing cards still get the mapping (history), but
      // no new draft is created for them (ACTIVE_USERS_CONTRACTS.md).
      const enrolled = await fetchEnrolledStudentsRaw(token, subject_id, termId);
      const studentIds: number[] = enrolled
        .map((s: any) => s.id ?? s.user_id)
        .filter((id: any) => typeof id === "number" && !isNaN(id));
      const inactiveIds = new Set<number>(
        enrolled.filter((s: any) => !isActiveStatus(misRowStatus(s))).map((s: any) => Number(s.id ?? s.user_id)),
      );
      for (const id of await inactiveMisIds(studentIds)) inactiveIds.add(id);

      for (const studentId of studentIds) {
        const reportCard = inactiveIds.has(studentId)
          ? await ReportCard.findOne({ where: { student_id: studentId, term, academic_year } })
          : (
              await ReportCard.findOrCreate({
                where: { student_id: studentId, term, academic_year },
                defaults: { student_id: studentId, term, academic_year, ...SHELL_DEFAULTS },
              })
            )[0];
        if (!reportCard) continue;
        if (!isEditable(reportCard.status)) {
          studentsSkipped++;
          continue;
        }

        const previous = await ReportCardAssessment.findAll({
          where: { report_card_id: reportCard.id, subject_id },
          attributes: ["assessment_type", "assessment_id", "mark_status"],
        });
        const keep = new Map(
          previous.filter((p) => p.mark_status && p.mark_status !== "auto").map((p) => [`${p.assessment_type}:${p.assessment_id}`, p.mark_status]),
        );
        await ReportCardAssessment.destroy({ where: { report_card_id: reportCard.id, subject_id } });
        if (assessments.length > 0) {
          await ReportCardAssessment.bulkCreate(
            assessments.map((a) => ({
              report_card_id: reportCard.id!,
              subject_id,
              assessment_type: a.assessment_type,
              assessment_id: a.assessment_id,
              category: a.category,
              mark_status: keep.get(`${a.assessment_type}:${a.assessment_id}`) ?? "auto",
            })),
          );
        }
        studentsUpdated++;
      }
    }

    const plural = (n: number) => `${n} student${n !== 1 ? "s" : ""}`;
    res.status(200).json({
      success: true,
      message:
        `Assessment mapping saved and applied to ${plural(studentsUpdated)}` +
        (studentsSkipped ? `; ${plural(studentsSkipped)} with a card past draft left unchanged` : ""),
      data: {
        subject_id,
        term,
        academic_year,
        total_assessments_mapped: assessments.length,
        students_updated: studentsUpdated,
        students_skipped_locked: studentsSkipped,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "saveSubjectMapping");
  }
};

// ─── POST /api/report-cards/attributes/save ──────────────────────────────────

export const saveAttributes = async (req: Request, res: Response) => {
  try {
    const body = req.body as AttributesSavePayload;
    const { student_id, term, academic_year, class_teacher_comment, attributes } = body;

    const mayComment = await scopedAllow(req, {
      caps: "REPORT_CARDS_COMMENT",
      target: () => cardStudentTarget(req, student_id),
      legacy: true,
    });
    if (!mayComment) return denyResponse(req, res, "Not authorized to comment on this student's report card");

    const existing = await findStudentCard(student_id, { term, academic_year });
    if (rejectLocked(res, [existing])) return;
    const reportCard =
      existing ??
      (
        await ReportCard.findOrCreate({
          where: { student_id, term, academic_year },
          defaults: { student_id, term, academic_year, ...SHELL_DEFAULTS },
        })
      )[0];

    // The head of school's remark: only approvers/reviewers write it.
    const perms = userPermissions(req);
    const mayHeadComment = perms.has("REPORT_CARDS_APPROVE") || perms.has("REPORT_CARDS_REVIEW");
    const attendanceTouched =
      body.attendance_present != null || body.attendance_absent != null || body.attendance_late != null ||
      body.attendance_excused != null || body.attendance_sick != null;

    await reportCard.update({
      class_teacher_comment: class_teacher_comment ?? null,
      attendance_present: body.attendance_present ?? reportCard.attendance_present,
      attendance_absent: body.attendance_absent ?? reportCard.attendance_absent,
      attendance_late: body.attendance_late ?? reportCard.attendance_late,
      attendance_excused: body.attendance_excused ?? reportCard.attendance_excused,
      attendance_sick: body.attendance_sick ?? reportCard.attendance_sick,
      ...(attendanceTouched && body.attendance_source !== "imported" ? { attendance_source: "manual" as const } : {}),
      ...(body.behaviour_mark !== undefined ? { behaviour_mark: body.behaviour_mark == null ? null : Math.round(body.behaviour_mark * 100) / 100 } : {}),
      ...(mayHeadComment && body.head_teacher_comment !== undefined ? { head_teacher_comment: body.head_teacher_comment ?? null } : {}),
    });

    await ReportCardAttribute.destroy({ where: { report_card_id: reportCard.id } });
    const created = await ReportCardAttribute.bulkCreate(
      attributes.map((a) => ({ report_card_id: reportCard.id!, attribute_name: a.attribute_name, rating: a.rating })),
    );

    res.status(200).json({
      success: true,
      message: "Attributes and teacher comment saved successfully",
      data: {
        report_card_id: reportCard.id,
        status: reportCard.status,
        class_teacher_comment: reportCard.class_teacher_comment,
        head_teacher_comment: reportCard.head_teacher_comment,
        attendance: {
          present: reportCard.attendance_present,
          absent: reportCard.attendance_absent,
          late: reportCard.attendance_late,
          excused: reportCard.attendance_excused,
          sick: reportCard.attendance_sick,
          source: reportCard.attendance_source,
        },
        attributes: created,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "saveAttributes");
  }
};

// ─── GET /api/report-cards/overview ──────────────────────────────────────────

const parseIds = (raw: string) =>
  raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

export const getCourseOverview = async (req: Request, res: Response) => {
  try {
    const { term, academic_year, student_ids } = req.query as { term?: string; academic_year?: string; student_ids?: string };
    if (!term || !academic_year || !student_ids) {
      return res.status(400).json({ success: false, message: "term, academic_year, and student_ids are required" });
    }
    const requestedIds = parseIds(student_ids);
    if (requestedIds.length === 0) return res.status(400).json({ success: false, message: "No valid student_ids provided" });

    const ids = await filterCardStudents(req, requestedIds, ["REPORT_CARDS_VIEW_ALL"], { minDepth: "detail" });
    const reportCards = await ReportCard.findAll({
      where: { student_id: { [Op.in]: ids }, term, academic_year },
      attributes: ["id", "student_id", "status", "version", "updated_at", "publish_at"],
    });
    const rcIds = reportCards.map((rc) => rc.id!);
    const [assessmentCounts, attributeCounts] = await Promise.all([
      rcIds.length ? ReportCardAssessment.findAll({ where: { report_card_id: { [Op.in]: rcIds } }, attributes: ["report_card_id", "subject_id"] }) : [],
      rcIds.length ? ReportCardAttribute.findAll({ where: { report_card_id: { [Op.in]: rcIds } }, attributes: ["report_card_id"] }) : [],
    ]);
    const subjectsPerCard = new Map<number, Set<number>>();
    for (const a of assessmentCounts as ReportCardAssessment[]) {
      if (!subjectsPerCard.has(a.report_card_id)) subjectsPerCard.set(a.report_card_id, new Set());
      subjectsPerCard.get(a.report_card_id)!.add(a.subject_id);
    }
    const hasAttributesPerCard = new Set((attributeCounts as ReportCardAttribute[]).map((a) => a.report_card_id));
    const rcByStudent = new Map(reportCards.map((rc) => [rc.student_id, rc]));

    res.status(200).json({
      success: true,
      data: ids.map((studentId) => {
        const rc = rcByStudent.get(studentId);
        if (!rc) {
          return { student_id: studentId, report_card_id: null, status: null, version: 0, subjects_mapped: 0, has_attributes: false, updated_at: null, publish_at: null };
        }
        return {
          student_id: studentId,
          report_card_id: rc.id,
          status: rc.status,
          version: rc.version,
          subjects_mapped: subjectsPerCard.get(rc.id!)?.size ?? 0,
          has_attributes: hasAttributesPerCard.has(rc.id!),
          updated_at: rc.updatedAt,
          publish_at: rc.publish_at,
        };
      }),
    });
  } catch (error) {
    sendControllerError(res, error, "getCourseOverview");
  }
};

// ─── GET /api/report-cards/subject-overview ──────────────────────────────────
// One subject's grade per student + class average. Frozen cards report their
// approved figures; drafts are computed live.

export const getSubjectOverview = async (req: Request, res: Response) => {
  try {
    const { subject_id, term, academic_year, student_ids } = req.query as {
      subject_id?: string;
      term?: string;
      academic_year?: string;
      student_ids?: string;
    };
    const subjectId = parseInt(subject_id ?? "", 10);
    if (isNaN(subjectId) || !term || !academic_year || !student_ids) {
      return res.status(400).json({ success: false, message: "subject_id, term, academic_year, and student_ids are required" });
    }
    const requestedIds = parseIds(student_ids);
    if (requestedIds.length === 0) return res.status(400).json({ success: false, message: "No valid student_ids provided" });

    const ids = await filterCardStudents(req, requestedIds, ["REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT", "REPORT_CARDS_VIEW_ALL"], {
      minDepth: "detail",
      subjectId,
    });
    const reportCards = await ReportCard.findAll({ where: { student_id: { [Op.in]: ids }, term, academic_year } });
    const grading = gradingOf(await getReportCardScheme());

    // The school's builder decides the categories (Normal CW/HW/MD/EOT, TVET FA/CA/IA).
    const categoryTotals: Record<string, { sum: number; count: number }> = Object.fromEntries(
      builderStructure(grading.builder).categories.map((c) => [c.key, { sum: 0, count: 0 }]),
    );
    let classSum = 0;
    let classCount = 0;

    const studentResults = [];
    for (const reportCard of reportCards) {
      const frozen = isFrozen(reportCard.status) ? await frozenDocument(req, reportCard) : null;
      const grades: SubjectGrade[] = frozen ? frozen.grades : (await computeCardGrades(reportCard, grading)).grades;
      const subjectGrade = grades.find((g) => g.subject_id === subjectId);
      if (subjectGrade) {
        classSum += subjectGrade.total_score;
        classCount += 1;
        for (const cat of Object.keys(categoryTotals)) {
          const catResult = subjectGrade.categories[cat as keyof typeof subjectGrade.categories];
          if (catResult) {
            categoryTotals[cat].sum += catResult.scaled_score;
            categoryTotals[cat].count += 1;
          }
        }
      }
      studentResults.push({
        student_id: reportCard.student_id,
        report_card_id: reportCard.id,
        status: reportCard.status,
        total_score: subjectGrade ? subjectGrade.total_score : null,
      });
    }

    const resultByStudent = new Map(studentResults.map((r) => [r.student_id, r]));
    res.status(200).json({
      success: true,
      data: {
        subject_id: subjectId,
        term,
        academic_year,
        class_average: classCount > 0 ? parseFloat((classSum / classCount).toFixed(2)) : null,
        category_averages: Object.fromEntries(
          Object.entries(categoryTotals).map(([cat, { sum, count }]) => [cat, count > 0 ? parseFloat((sum / count).toFixed(2)) : null]),
        ),
        students: ids.map(
          (studentId) => resultByStudent.get(studentId) ?? { student_id: studentId, report_card_id: null, status: null, total_score: null },
        ),
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getSubjectOverview");
  }
};

// ─── PATCH /api/report-cards/:id/status (legacy) ─────────────────────────────
// Kept for one release: the body's target status is mapped onto workflow
// actions (POST /api/report-cards/transition) so the same rules apply.

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    if (isNaN(cardId)) return res.status(400).json({ success: false, message: "Invalid report card ID" });
    const { status } = req.body as UpdateStatusPayload & { reason?: string };
    const reason = (req.body as any)?.reason ?? "Changed from the status menu";
    const reportCard = await ReportCard.findByPk(cardId);
    if (!reportCard) return res.status(404).json({ success: false, message: "Report card not found" });
    const actions = legacyStatusToActions(reportCard.status, status);
    if (!actions) {
      return res.status(409).json({
        success: false,
        code: "INVALID_TRANSITION",
        message: `A ${reportCard.status} card can't be set to ${status}`,
      });
    }
    let last = { ok: true, status: reportCard.status as string, message: "" };
    for (const action of actions) {
      const [r] = await runTransition(req, { card_ids: [cardId], action, reason });
      if (!r.ok) {
        const code = r.code === "FORBIDDEN" ? 403 : 409;
        return res.status(code).json({ success: false, code: r.code, message: r.message, data: { blockers: r.blockers ?? [] } });
      }
      last = { ok: true, status: r.status ?? status, message: "" };
    }
    res.status(200).json({
      success: true,
      message: `Report card status updated to '${last.status}'`,
      data: { report_card_id: cardId, status: last.status },
    });
  } catch (error) {
    sendControllerError(res, error, "updateStatus");
  }
};

// ─── GET /api/report-cards/student/:studentId ────────────────────────────────
// Students/parents: their PUBLISHED card only. Staff: any status. Frozen cards
// are served from their snapshot; drafts are rendered live.

export const getStudentReportCard = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) return res.status(400).json({ success: false, message: "Invalid studentId" });

    const access = await reportCardReadAccess(req, studentId);
    if (!access.allowed) return denyResponse(req, res, "Not authorized to view this student's report card");
    const canViewAll = access.canViewAll;
    let { term, academic_year } = req.query as { term?: string; academic_year?: string };
    if (!term && !academic_year) {
      const current = await resolveCurrentAcademicPeriodNames(req);
      term = current.term ?? undefined;
      academic_year = current.academicYear ?? undefined;
    }
    const where: Record<string, unknown> = {};
    if (term) where.term = term;
    if (academic_year) where.academic_year = academic_year;
    if (!canViewAll) where.status = "published";

    const reportCard = await findStudentCard(studentId, where);
    if (!reportCard) {
      return res.status(404).json({
        success: false,
        message: !canViewAll ? "No published report card found for this term" : "Report card not found",
      });
    }
    const doc = await documentFor(req, reportCard, { staff: canViewAll });
    const rawMappings = canViewAll ? await ReportCardAssessment.findAll({ where: { report_card_id: reportCard.id } }) : [];
    // The mapping guidance is for the card preview (?guide=1), not bulk readers like the comments page.
    const wantsGuide = String(req.query.guide ?? "") === "1";
    const unmapped = canViewAll && wantsGuide ? await unmappedFor(req, reportCard, doc, rawMappings).catch(() => ({})) : undefined;
    res.status(200).json({ success: true, data: { ...readShape(reportCard, doc, rawMappings), ...(unmapped ? { unmapped } : {}) } });
  } catch (error) {
    sendControllerError(res, error, "getStudentReportCard");
  }
};

// ─── GET /api/report-cards/preview/:studentId ────────────────────────────────
// Staff-only provisional card for the period (services/reportCardPreview).

const MAX_PENDING_PER_SUBJECT = 12;

export const getReportCardPreview = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid studentId" });
    const access = await reportCardReadAccess(req, studentId);
    if (!access.allowed || !access.canViewAll) return denyResponse(req, res, "Not authorized to preview this student's report card");

    let { term, academic_year } = req.query as { term?: string; academic_year?: string };
    if (!term || !academic_year) {
      const current = await resolveCurrentAcademicPeriodNames(req);
      term = term || current.term || undefined;
      academic_year = academic_year || current.academicYear || undefined;
    }
    if (!term || !academic_year) return res.status(400).json({ success: false, message: "term and academic_year are required" });

    const identity = await resolveCardStudent(studentId);
    const candidateIds = [...new Set([studentId, ...identity.localIds])];
    const cards = await ReportCard.findAll({
      where: { student_id: { [Op.in]: candidateIds }, term, academic_year },
      order: [["createdAt", "DESC"]],
    });
    const reportCard = cards.find((c) => c.student_id === studentId) ?? cards[0] ?? null;
    const cardMappings = reportCard ? await ReportCardAssessment.findAll({ where: { report_card_id: reportCard.id } }) : [];

    const names = new Map<number, string>();
    const token = getMisToken(req, { quiet: true });
    const yearId = await resolveAcademicYearId(req);
    if (token) {
      try {
        const enrolled = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/students/${studentId}/enrolled-subjects`, {
          headers: { Authorization: `Bearer ${token}` },
          params: yearId ? { academic_year_id: yearId } : {},
        });
        for (const e of enrolled.data?.data ?? []) {
          const id = Number(e.subject_id ?? e.id);
          if (Number.isFinite(id)) names.set(id, e.subject_name ?? e.name ?? `Subject #${id}`);
        }
      } catch (e: any) {
        console.warn(`getReportCardPreview: enrolled subjects for ${studentId} failed:`, e.message);
      }
    }
    for (const m of cardMappings) if (!names.has(m.subject_id)) names.set(m.subject_id, "");
    const subjectIds = [...names.keys()];

    const [subjectMappings, manualForPeriod] = subjectIds.length
      ? await Promise.all([
          SubjectAssessmentMapping.findAll({ where: { subject_id: { [Op.in]: subjectIds }, term, academic_year } }),
          ManualAssessment.findAll({
            where: { course_id: { [Op.in]: subjectIds }, term, academic_year },
            attributes: ["id", "course_id", "title", "assessment_type", "add_to_final_grade"],
          }),
        ])
      : [[], []];

    const bySubject = <T extends { subject_id: number }>(rows: T[]) => {
      const m = new Map<number, T[]>();
      for (const r of rows) m.set(r.subject_id, [...(m.get(r.subject_id) ?? []), r]);
      return m;
    };
    const cardBySubject = bySubject(cardMappings);
    const subjectBySubject = bySubject(subjectMappings);

    type Chosen = { source: PreviewSource; rows: Array<{ assessment_type: string; assessment_id: number; category: string }> };
    const chosen = new Map<number, Chosen>();
    for (const id of subjectIds) {
      const own = cardBySubject.get(id);
      const shared = subjectBySubject.get(id);
      if (own?.length) chosen.set(id, { source: "report_card", rows: own });
      else if (shared?.length) chosen.set(id, { source: "subject_mapping", rows: shared });
      else {
        const suggested = manualForPeriod
          .filter((a) => a.course_id === id && a.add_to_final_grade !== false)
          .map((a) => ({ assessment_type: "manual", assessment_id: a.id!, category: suggestedCategory(a.assessment_type) }))
          .filter((r): r is { assessment_type: string; assessment_id: number; category: AssessmentCategory } => r.category != null);
        chosen.set(id, { source: suggested.length ? "suggested" : "none", rows: suggested });
      }
    }

    const allRows = [...chosen.values()].flatMap((c) => c.rows);
    const idsOf = (type: string) => [...new Set(allRows.filter((r) => r.assessment_type === type).map((r) => r.assessment_id))];
    const [quizzes, assignments, manuals] = await Promise.all([
      idsOf("quiz").length ? Quiz.findAll({ where: { id: { [Op.in]: idsOf("quiz") } }, attributes: ["id", "title"], raw: true }) : [],
      idsOf("assignment").length
        ? Assignment.findAll({ where: { id: { [Op.in]: idsOf("assignment") }, ...COUNTED_MARKS }, attributes: ["id", "title"], raw: true })
        : [],
      idsOf("manual").length ? ManualAssessment.findAll({ where: { id: { [Op.in]: idsOf("manual") } }, attributes: ["id", "title", "assessment_type"], raw: true }) : [],
    ]);
    const manualKind = new Map((manuals as any[]).map((m) => [m.id, componentOfManual(m.assessment_type)]));
    const titles = new Map<string, string>();
    for (const q of quizzes as any[]) titles.set(`quiz:${q.id}`, q.title);
    for (const a of assignments as any[]) titles.set(`assignment:${a.id}`, a.title);
    for (const m of manuals as any[]) titles.set(`manual:${m.id}`, m.title);

    const scores = await loadStudentScores(identity, allRows);
    const missingNames = subjectIds.filter((id) => !names.get(id));
    if (missingNames.length) {
      const resolved = await resolveSubjectNames(req, missingNames);
      for (const id of missingNames) names.set(id, resolved[id] ?? `Subject #${id}`);
    }

    const grading = gradingOf(await getReportCardScheme());
    const inputs: PreviewSubjectInput[] = subjectIds
      .map((id) => {
        const c = chosen.get(id)!;
        return {
          subject_id: id,
          name: names.get(id) || `Subject #${id}`,
          source: c.source,
          items: c.rows
            .filter((r) => r.assessment_type === "manual" || titles.has(`${r.assessment_type}:${r.assessment_id}`))
            .map((r) => ({
              assessment_type: r.assessment_type as ItemKind,
              assessment_id: r.assessment_id,
              category: effectiveCategory(grading.builder, r.category) as AssessmentCategory,
              title: titles.get(`${r.assessment_type}:${r.assessment_id}`) ?? `${r.assessment_type} #${r.assessment_id}`,
              component: r.assessment_type === "manual" ? manualKind.get(r.assessment_id) ?? "manual" : r.assessment_type,
            }))
            .filter((r) => r.category != null),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const componentConfig = await getComponentWeights();
    const card = buildProvisionalCard(inputs, scores, grading.weights, (id) => weightsFor(componentConfig, id));

    const attributes = reportCard
      ? await ReportCardAttribute.findAll({ where: { report_card_id: reportCard.id }, attributes: ["id", "attribute_name", "rating"] })
      : [];
    const present = reportCard?.attendance_present ?? 0;
    const absent = reportCard?.attendance_absent ?? 0;
    const late = reportCard?.attendance_late ?? 0;
    const excused = reportCard?.attendance_excused ?? 0;
    const sick = reportCard?.attendance_sick ?? 0;
    res.status(200).json({
      success: true,
      data: {
        report_card: {
          id: reportCard?.id ?? null,
          uuid: reportCard?.uuid ?? null,
          student_id: studentId,
          term,
          academic_year,
          status: reportCard?.status ?? null,
          version: reportCard?.version ?? 0,
          editable: reportCard ? isEditable(reportCard.status) : true,
          class_teacher_comment: reportCard?.class_teacher_comment ?? null,
          head_teacher_comment: reportCard?.head_teacher_comment ?? null,
          attendance: { present, absent, late, excused, sick, total_days: present + absent + late + excused + sick },
        },
        grades: card.grades,
        attributes,
        subject_names: Object.fromEntries(inputs.map((i) => [i.subject_id, i.name])),
        raw_assessments: [],
        preview: {
          is_provisional: true,
          card_exists: reportCard != null,
          overall: card.overall,
          subjects: card.subjects.map((s) => ({ ...s, pending_total: s.pending.length, pending: s.pending.slice(0, MAX_PENDING_PER_SUBJECT) })),
        },
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getReportCardPreview");
  }
};

// ─── Annual (combined terms) ─────────────────────────────────────────────────

async function annualData(req: Request, studentId: number, academicYear: string, canViewAll: boolean, academicYearId?: string | number) {
  const ids = await cardStudentIds(studentId);
  const where: Record<string, unknown> = { student_id: { [Op.in]: ids }, academic_year: academicYear };
  if (!canViewAll) where.status = "published";
  const termCards = await ReportCard.findAll({ where, order: [["term", "ASC"]] });
  // One card per term (MIS-keyed first).
  const perTermCard = new Map<string, ReportCard>();
  for (const c of termCards) {
    const prev = perTermCard.get(c.term);
    if (!prev || c.student_id === studentId) perTermCard.set(c.term, c);
  }
  const cards = [...perTermCard.values()].sort((a, b) => a.term.localeCompare(b.term, undefined, { numeric: true }));
  const perTerm: Array<{
    term: string;
    status: string;
    attendance: Record<"present" | "absent" | "late" | "excused" | "sick", number>;
    attributes: Array<{ attribute_name: string; rating: string }>;
    grades: SubjectGrade[];
    names: Record<number, string>;
  }> = [];
  for (const rc of cards) {
    const doc = await documentFor(req, rc, { staff: false });
    perTerm.push({
      term: rc.term,
      status: rc.status,
      attendance: {
        present: doc.attendance.present,
        absent: doc.attendance.absent,
        late: doc.attendance.late,
        excused: doc.attendance.excused,
        sick: doc.attendance.sick,
      },
      attributes: doc.attributes,
      grades: doc.grades,
      names: Object.fromEntries(doc.groups.flatMap((g) => g.subjects.map((s) => [s.subject_id, s.name]))),
    });
  }
  const subjectIds = new Set<number>();
  for (const t of perTerm) for (const g of t.grades) subjectIds.add(g.subject_id);
  const annualGrades = Array.from(subjectIds).map((subjectId) =>
    combineAnnualSubjectGrades(
      subjectId,
      perTerm
        .filter((t) => t.grades.some((g) => g.subject_id === subjectId))
        .map((t) => ({ term: t.term, total_score: t.grades.find((g) => g.subject_id === subjectId)!.total_score })),
    ),
  );
  const subjectNames: Record<number, string> = Object.assign({}, ...perTerm.map((t) => t.names));
  const missing = [...subjectIds].filter((id) => !subjectNames[id]);
  if (missing.length) Object.assign(subjectNames, await resolveSubjectNames(req, missing));

  let missingTerms: string[] = [];
  const token = getMisToken(req, { quiet: true });
  const yearId = academicYearId ?? (await resolveAcademicYearId(req).catch(() => null));
  if (token && yearId) {
    try {
      const response = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/terms`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { academic_year_id: yearId },
      });
      const found = new Set(cards.map((rc) => rc.term));
      missingTerms = (response.data?.data || []).map((t: any) => t.name).filter((name: string) => !found.has(name));
    } catch (error: any) {
      console.error("annualData: could not resolve term catalog:", error?.message ?? error);
    }
  }
  return { cards, perTerm: perTerm.map(({ names: _n, ...t }) => t), annualGrades, subjectNames, missingTerms };
}

export const getAnnualReportCard = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) return res.status(400).json({ success: false, message: "Invalid studentId" });
    const access = await reportCardReadAccess(req, studentId);
    if (!access.allowed) return denyResponse(req, res, "Not authorized to view this student's report card");
    const { academic_year, academic_year_id } = req.query as { academic_year?: string; academic_year_id?: string };
    if (!academic_year) return res.status(400).json({ success: false, message: "academic_year is required" });
    const d = await annualData(req, studentId, academic_year, access.canViewAll, academic_year_id);
    res.status(200).json({
      success: true,
      data: {
        student_id: studentId,
        academic_year,
        annual_grades: d.annualGrades,
        subject_names: d.subjectNames,
        per_term: d.perTerm,
        missing_terms: d.missingTerms,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getAnnualReportCard");
  }
};

// ─── POST /api/report-cards/generate-pdf ─────────────────────────────────────
// Frozen cards download the stored PDF of their snapshot; drafts render live
// with a PROVISIONAL watermark (staff only). Students: published only.

const safeName = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "student";

export const generatePdf = async (req: Request, res: Response) => {
  try {
    const { report_card_id } = req.body as GeneratePdfPayload;
    const reportCard = await ReportCard.findByPk(report_card_id);
    if (!reportCard) return res.status(404).json({ success: false, message: "Report card not found" });

    const access = await reportCardReadAccess(req, reportCard.student_id);
    if (!access.allowed) return denyResponse(req, res, "Not authorized to export this student's report card");
    if (!access.canViewAll && reportCard.status !== "published") {
      return res.status(403).json({ success: false, message: "This report card has not been published yet" });
    }

    const doc = await documentFor(req, reportCard, { staff: access.canViewAll });
    const snap = isFrozen(reportCard.status) ? await activeSnapshot(reportCard.id!) : null;
    const pdfBuffer = snap
      ? await cardPdf(doc, snap, req)
      : await renderReportCardPdf(doc, { verificationBaseUrl: verificationBase(), letterhead: await loadLetterhead(req, { header: false }) });
    const filename = `ReportCard-${safeName(doc.student.name)}-${safeName(reportCard.term)}-${safeName(reportCard.academic_year)}${
      snap ? `-v${snap.version}` : "-PROVISIONAL"
    }.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
      "X-Report-Card-UUID": reportCard.uuid,
      "X-Report-Card-Version": String(snap?.version ?? 0),
    });
    res.status(200).send(pdfBuffer);
  } catch (error) {
    sendControllerError(res, error, "generatePdf");
  }
};

// ─── POST /api/report-cards/annual/generate-pdf ──────────────────────────────

export const generateAnnualPdf = async (req: Request, res: Response) => {
  try {
    const { student_id, academic_year, academic_year_id } = req.body as {
      student_id: number;
      academic_year: string;
      academic_year_id?: number;
    };
    if (!student_id || !academic_year) {
      return res.status(400).json({ success: false, message: "student_id and academic_year are required" });
    }
    const access = await reportCardReadAccess(req, Number(student_id));
    if (!access.allowed) return denyResponse(req, res, "Not authorized to export this student's report card");
    const d = await annualData(req, Number(student_id), academic_year, access.canViewAll, academic_year_id);
    if (d.cards.length === 0) {
      return res.status(404).json({
        success: false,
        message: access.canViewAll
          ? "No report cards found for this student/academic year"
          : "No published report cards found for this student/academic year",
      });
    }
    const studentName = (await resolveStudentInfo([Number(student_id)])).get(Number(student_id))?.name ?? `Student #${student_id}`;
    const pdfBuffer = await generateAnnualReportCardPdf({
      student_name: studentName,
      student_id,
      academic_year,
      annual_grades: d.annualGrades,
      subject_names: d.subjectNames,
      per_term: d.perTerm.map((t) => ({ term: t.term, attendance: t.attendance, attributes: t.attributes })),
      missing_terms: d.missingTerms,
      letterhead: await loadLetterhead(req, { header: false }),
    });
    const filename = `AnnualReport-${safeName(studentName)}-${safeName(academic_year)}.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
    });
    res.status(200).send(pdfBuffer);
  } catch (error) {
    sendControllerError(res, error, "generateAnnualPdf");
  }
};

// ─── GET /api/report-cards/admin/students ────────────────────────────────────

export const listReportCardStudents = async (req: Request, res: Response) => {
  try {
    let { term, academic_year } = req.query as { term?: string; academic_year?: string };
    const statusFilter = typeof req.query.status === "string" ? req.query.status : null;
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
    const allCards = await ReportCard.findAll({
      where: { term, academic_year, ...(statusFilter ? { status: statusFilter } : {}) },
      order: [["createdAt", "DESC"]],
    });
    const visible = new Set(
      await filterCardStudents(req, [...new Set(allCards.map((rc) => rc.student_id))], ["REPORT_CARDS_VIEW_ALL"], { minDepth: "detail" }),
    );
    const reportCards = allCards.filter((rc) => visible.has(rc.student_id));
    const info = await resolveStudentInfo([...new Set(reportCards.map((rc) => rc.student_id))]);
    res.status(200).json({
      success: true,
      data: reportCards.map((rc) => ({
        report_card_id: rc.id,
        student_id: rc.student_id,
        uuid: rc.uuid,
        status: rc.status,
        version: rc.version,
        class_name: rc.class_name,
        name: info.get(rc.student_id)?.name ?? `Student #${rc.student_id}`,
      })),
      term,
      academic_year,
    });
  } catch (error) {
    sendControllerError(res, error, "listReportCardStudents");
  }
};

// ─── GET /api/report-cards/admin/summary ─────────────────────────────────────

const ADMIN_SUMMARY_MAX_CARDS = 1500;

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
    const total = await ReportCard.count({ where: { term, academic_year } });
    const periodCards = await ReportCard.findAll({ where: { term, academic_year }, limit: ADMIN_SUMMARY_MAX_CARDS });
    const inScope = new Set(
      await filterCardStudents(req, [...new Set(periodCards.map((rc) => rc.student_id))], ["REPORT_CARDS_VIEW_ALL"], { minDepth: "summary" }),
    );
    const reportCards = periodCards.filter((rc) => inScope.has(rc.student_id));
    const grading = gradingOf(await getReportCardScheme());

    const statusCounts = { draft: 0, reviewed: 0, approved: 0, published: 0 };
    // The school's builder decides the categories (Normal CW/HW/MD/EOT, TVET FA/CA/IA).
    const categoryTotals: Record<string, { sum: number; count: number }> = Object.fromEntries(
      builderStructure(grading.builder).categories.map((c) => [c.key, { sum: 0, count: 0 }]),
    );
    const subjectTotals = new Map<number, { sum: number; count: number }>();
    let overallSum = 0;
    let overallCount = 0;

    for (const reportCard of reportCards) {
      statusCounts[reportCard.status as keyof typeof statusCounts] += 1;
      const frozen = isFrozen(reportCard.status) ? await frozenDocument(req, reportCard) : null;
      const grades = frozen ? frozen.grades : (await computeCardGrades(reportCard, grading)).grades;
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
        truncated: total > ADMIN_SUMMARY_MAX_CARDS,
        status_counts: statusCounts,
        overall_average: overallCount > 0 ? parseFloat((overallSum / overallCount).toFixed(2)) : null,
        category_averages: Object.fromEntries(
          Object.entries(categoryTotals).map(([cat, { sum, count }]) => [cat, count > 0 ? parseFloat((sum / count).toFixed(2)) : null]),
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
    sendControllerError(res, error, "getAdminSummary");
  }
};

// ─── GET /api/public/verify/report-card/:uuid[?v=N] ──────────────────────────
// Public: confirms an issued (approved or published) version from its
// snapshot. A superseded version answers verified:false with the reason.

export const verifyReportCard = async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;
    if (!uuid || uuid.trim().length === 0) return res.status(400).json({ success: false, message: "UUID is required" });
    const reportCard = await ReportCard.findOne({ where: { uuid } });
    const notFound = () =>
      res.status(404).json({ success: false, verified: false, message: "No verified report card found for this code" });
    if (!reportCard) return notFound();

    const requested = req.query.v != null ? Number(req.query.v) : null;
    if (requested != null && Number.isInteger(requested) && requested > 0) {
      const snap = await snapshotOfVersion(reportCard.id!, requested);
      if (!snap) return notFound();
      if (snap.superseded_at || !isFrozen(reportCard.status) || reportCard.version !== requested) {
        return res.status(200).json({
          success: true,
          verified: false,
          superseded: true,
          message: "This version of the report card was withdrawn and is no longer valid.",
          data: { term: reportCard.term, academic_year: reportCard.academic_year, version: requested, current_version: isFrozen(reportCard.status) ? reportCard.version : null },
        });
      }
    }
    if (!isFrozen(reportCard.status)) return notFound();
    const doc = await frozenDocument(req, reportCard);
    if (!doc) return notFound();
    const snap = await activeSnapshot(reportCard.id!);
    res.status(200).json({
      success: true,
      verified: true,
      data: {
        student_name: doc.student.name,
        class_name: doc.student.class_name,
        term: reportCard.term,
        academic_year: reportCard.academic_year,
        status: reportCard.status,
        version: doc.card.version,
        average_score: doc.summary.average ?? 0,
        grade: doc.summary.grade,
        subjects_count: doc.summary.subjects_counted,
        issued_by: doc.school.name,
        approved_at: doc.card.approved_at,
        generated_at: doc.card.approved_at ?? reportCard.updatedAt,
        pdf_sha256: snap?.pdf_sha256 ?? null,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "verifyReportCard");
  }
};

// ─── Component weights (kinds of work inside a category) ─────────────────────

/** GET /report-cards/component-weights?subject_id= : the school's weights, the subject's own, and what applies. */
export const getComponentWeightsHandler = async (req: Request, res: Response) => {
  try {
    const config = await getComponentWeights();
    const subjectId = Number(req.query.subject_id);
    const has = Number.isInteger(subjectId) && subjectId > 0;
    res.status(200).json({
      success: true,
      data: {
        components: COMPONENT_KEYS.map((key) => ({ key, label: COMPONENT_LABEL[key] })),
        default: config.default,
        subject: has ? (config.subjects[String(subjectId)] ?? null) : null,
        effective: has ? weightsFor(config, subjectId) : config.default,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getComponentWeights");
  }
};

/** PUT /report-cards/component-weights { weights }: the school's default weights (all categories). */
export const putDefaultComponentWeights = async (req: Request, res: Response) => {
  try {
    const config = await setDefaultComponentWeights(req.body?.weights ?? {}, (req as any).user?.id ?? null);
    res.status(200).json({ success: true, data: { default: config.default } });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    sendControllerError(res, error, "putDefaultComponentWeights");
  }
};

/** PUT /report-cards/component-weights/subjects/:id { category, weights | null }: a subject's own weights for one category. */
export const putSubjectComponentWeights = async (req: Request, res: Response) => {
  try {
    const subjectId = Number(req.params.id);
    if (!Number.isInteger(subjectId) || subjectId <= 0) return res.status(400).json({ success: false, message: "Unknown subject." });
    const mayMap = await scopedAllow(req, { caps: ["REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT"], target: { subjectId }, legacy: true });
    if (!mayMap) return denyResponse(req, res, "Not authorized to set weights for this subject");
    const category = String(req.body?.category ?? "");
    const config = await setSubjectComponentWeights(subjectId, category, req.body?.weights ?? null, (req as any).user?.id ?? null);
    res.status(200).json({ success: true, data: { subject: config.subjects[String(subjectId)] ?? null, effective: weightsFor(config, subjectId) } });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    sendControllerError(res, error, "putSubjectComponentWeights");
  }
};
