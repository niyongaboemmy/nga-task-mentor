import { Request, Response } from "express";
import axios from "axios";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { SubjectAssessmentMapping } from "../models/SubjectAssessmentMapping.model";
import {
  ReportCardSnapshot,
  ReportCardTransition,
  ReportCycle,
  ReportCycleSubjectSignoff,
} from "../models/ReportCardWorkflow.model";
import { Quiz } from "../models/Quiz.model";
import { Assignment } from "../models/Assignment.model";
import { ManualAssessment } from "../models/ManualAssessment.model";
import {
  ACTION_RULES,
  actionsFrom,
  checkTransition,
  isEditable,
  isFrozen,
  reviewBlockers,
  reviewWarnings,
  type ReadinessFacts,
  type WorkflowAction,
} from "../services/reportCardWorkflow";
import {
  buildCardDocuments,
  computeCardGrades,
  resolveSubjectNames,
  resolveSubjectInfo,
  listSubjectInfo,
  forgetSubjectInfo,
  categoryFromCode,
  displayCode,
  type CardGrades,
  type ReportCardDocument,
} from "../services/reportCardDocument";
import { activeSnapshot, frozenDocument, supersedeSnapshots, verificationBase, writeSnapshot } from "../services/reportCardSnapshot.service";
import { renderClassReportCardsPdf } from "../services/reportCardDocumentPdf";
import { loadSchoolDirectory, type SchoolDirectory } from "../services/schoolDirectory";
import { getReportCardScheme, setReportCardScheme, getGradingBands } from "../services/tenantSettings";
import { builderStructure, gradingOf } from "../services/reportCardBuilders";
import { SCHOOL_PROFILE_FIELDS, getSchoolProfile, saveModuleWeight, saveSchoolProfile } from "../services/schoolProfile";
import { mapUnmappedToFormative } from "../services/formativeAutoMap";
import { getMisToken, resolveAcademicYearId, resolveAcademicTermIdByName, resolveCurrentAcademicPeriodNames, getCurrentTermId } from "../utils/misUtils";
import {
  actorName,
  cardStudentTarget,
  denyResponse,
  filterCardStudents,
  scopedAllow,
  userPermissions,
} from "../utils/reportCardAccess";
import { sendControllerError } from "../utils/controllerErrors";
import type {
  CycleSettingsPayload,
  SignoffPayload,
  TransitionPayload,
  AttendanceImportPayload,
} from "../validations/reportCardWorkflow.validation";

/**
 * Report card workflow (docs/REPORTS_AND_REPORT_CARD_REVIEW.md §6):
 *
 *   GET  /api/report-cycles                         classes x term with progress
 *   GET  /api/report-cycles/workbench               one class: students x subjects, blockers, actions
 *   PUT  /api/report-cycles/settings                deadlines, release date, next term
 *   GET  /api/report-cycles/signoff/preview         a subject's missing marks for one class
 *   POST /api/report-cycles/signoff                 submit / reopen a subject's marks for a class
 *   POST /api/report-cycles/attendance/import       term attendance from the attendance app
 *   POST /api/report-cards/transition               bulk review/return/approve/publish/unpublish/reopen
 *   GET  /api/report-cards/:id/history              transitions + versions
 *   GET  /api/report-cards/:id/diff                 live marks vs the approved snapshot
 *   GET|PUT /api/report-cards/scheme                the school's report card scheme
 */

const MAX_BULK = 200;

const perms = (req: Request) => userPermissions(req);
const legacyCan = (req: Request, capability: string) => capability.split("|").some((c) => perms(req).has(c));

// ─── Shared loaders ──────────────────────────────────────────────────────────

async function directoryFor(req: Request): Promise<SchoolDirectory> {
  const yearId = await resolveAcademicYearId(req);
  return loadSchoolDirectory(req, yearId ?? null);
}

async function findOrCreateCycle(classGroupId: number, term: string, year: string, className?: string | null) {
  const [cycle] = await ReportCycle.findOrCreate({
    where: { class_group_id: classGroupId, term, academic_year: year },
    defaults: { class_group_id: classGroupId, term, academic_year: year, class_name: className ?? null } as any,
  });
  if (className && cycle.class_name !== className) await cycle.update({ class_name: className });
  return cycle;
}

/** Readiness of a card from its grades and its class's sign-offs. */
function readinessOf(
  card: ReportCard,
  g: CardGrades,
  submitted: Set<number>,
  classSubjects: number[],
  names: Record<number, string>,
  attributesExpected: number,
): ReadinessFacts {
  const nameOf = (id: number) => names[id] ?? `Subject #${id}`;
  const mapped = [...g.mappedSubjects];
  return {
    unsubmitted_subjects: mapped.filter((id) => !submitted.has(id)).map((id) => ({ subject_id: id, name: nameOf(id) })),
    empty_subjects: classSubjects.filter((id) => !g.mappedSubjects.has(id)).map((id) => ({ subject_id: id, name: nameOf(id) })),
    missing_marks: [...g.missingBySubject.values()].reduce((a, b) => a + b, 0),
    has_comment: !!card.class_teacher_comment?.trim(),
    attributes_rated: g.attributes.length,
    attributes_expected: attributesExpected,
    attendance_days:
      (card.attendance_present ?? 0) +
      (card.attendance_absent ?? 0) +
      (card.attendance_late ?? 0) +
      (card.attendance_excused ?? 0) +
      (card.attendance_sick ?? 0),
  };
}

async function recordTransition(
  card: ReportCard,
  action: WorkflowAction | "signoff" | "edit",
  from: string,
  to: string,
  req: Request,
  name: string | null,
  reason?: string | null,
) {
  await ReportCardTransition.create({
    report_card_id: card.id!,
    action,
    from_status: from,
    to_status: to,
    version: card.version ?? null,
    actor_id: (req as any).user?.id ?? null,
    actor_name: name,
    reason: reason?.trim() ? reason.trim().slice(0, 500) : null,
  } as any);
}

/** May the caller take `action` on this card (v2 scoped over its student)? */
async function mayAct(req: Request, card: ReportCard, action: WorkflowAction): Promise<boolean> {
  const rule = ACTION_RULES[action];
  const caps = rule.capability.split("|");
  return scopedAllow(req, {
    caps,
    target: () => cardStudentTarget(req, card.student_id),
    legacy: legacyCan(req, rule.capability),
  });
}

// ─── POST /api/report-cards/transition ───────────────────────────────────────

export interface TransitionResult {
  report_card_id: number;
  student_id: number | null;
  ok: boolean;
  status: string | null;
  code?: string;
  message?: string;
  blockers?: Array<{ code: string; message: string }>;
  scheduled_for?: string | null;
}

/** Run one workflow action over cards; every card gets its own result. */
export async function runTransition(req: Request, body: TransitionPayload): Promise<TransitionResult[]> {
    const { card_ids, action, reason, publish_at, reopen_subject_ids } = body;
    const ids = [...new Set(card_ids)].slice(0, MAX_BULK);
    const cards = await ReportCard.findAll({ where: { id: { [Op.in]: ids } } });
    const byId = new Map(cards.map((c) => [c.id!, c]));
    const results: TransitionResult[] = [];
    const name = await actorName(req);
    const actorId = (req as any).user?.id ?? null;
    const scheme = await getReportCardScheme();
    const scheduleAt = publish_at ? new Date(publish_at) : null;
    const scheduled = action === "publish" && scheduleAt != null && scheduleAt.getTime() > Date.now() + 30_000;

    // Readiness for review needs the class's sign-offs and the card's grades.
    let directory: SchoolDirectory | null = null;
    const gradesOf = new Map<number, CardGrades>();
    if (action === "review" || action === "approve") {
      directory = await directoryFor(req).catch(() => null);
    }

    const candidates: ReportCard[] = [];
    for (const id of ids) {
      const card = byId.get(id);
      if (!card) {
        results.push({ report_card_id: id, student_id: null, ok: false, status: null, code: "NOT_FOUND", message: "Report card not found" });
        continue;
      }
      if (!(await mayAct(req, card, action))) {
        results.push({
          report_card_id: id,
          student_id: card.student_id,
          ok: false,
          status: card.status,
          code: "FORBIDDEN",
          message: `You can't ${ACTION_RULES[action].label.toLowerCase()} this student's report card`,
        });
        continue;
      }
      let readiness: ReadinessFacts | null = null;
      if (action === "review") {
        const g = await computeCardGrades(card, gradingOf(scheme));
        gradesOf.set(card.id!, g);
        const cg = card.class_group_id ?? directory?.students.find((s) => s.mis_user_id === card.student_id)?.class_group_id ?? null;
        const cycle = cg != null ? await ReportCycle.findOne({ where: { class_group_id: cg, term: card.term, academic_year: card.academic_year } }) : null;
        const signoffs = cycle ? await ReportCycleSubjectSignoff.findAll({ where: { cycle_id: cycle.id, status: "submitted" } }) : [];
        const names = await resolveSubjectNames(req, [...g.mappedSubjects]);
        readiness = readinessOf(card, g, new Set(signoffs.map((s) => s.subject_id)), [], names, scheme.attributes.length);
      }
      const check = checkTransition(action, card.status, {
        reason,
        readiness,
        actorId,
        reviewedBy: card.reviewed_by,
        requireDistinctApprover: scheme.require_distinct_approver,
      });
      if (!check.ok) {
        results.push({
          report_card_id: id,
          student_id: card.student_id,
          ok: false,
          status: card.status,
          code: check.code,
          message: check.message,
          blockers: check.blockers,
        });
        continue;
      }
      candidates.push(card);
    }

    // Approval renders the cards (with their class cohorts) before freezing.
    let docs = new Map<number, ReportCardDocument>();
    if (action === "approve" && candidates.length) {
      const cohortKeys = new Set(candidates.map((c) => `${c.class_group_id}|${c.term}|${c.academic_year}`));
      const cohort: ReportCard[] = [];
      for (const k of cohortKeys) {
        const [cg, term, year] = k.split("|");
        if (cg === "null") continue;
        cohort.push(...(await ReportCard.findAll({ where: { class_group_id: Number(cg), term, academic_year: year } })));
      }
      docs = await buildCardDocuments(req, candidates, { directory, cohort });
    }

    for (const card of candidates) {
      const from = card.status;
      try {
        if (action === "review") {
          await card.update({ status: "reviewed", reviewed_by: actorId, reviewed_at: new Date(), returned_reason: null });
        } else if (action === "return") {
          await card.update({ status: "draft", returned_reason: reason?.trim() ?? null });
          if (reopen_subject_ids?.length && card.class_group_id != null) {
            const cycle = await ReportCycle.findOne({
              where: { class_group_id: card.class_group_id, term: card.term, academic_year: card.academic_year },
            });
            if (cycle) {
              await ReportCycleSubjectSignoff.update(
                { status: "open", returned_reason: reason?.trim() ?? null },
                { where: { cycle_id: cycle.id, subject_id: { [Op.in]: reopen_subject_ids } } },
              );
            }
          }
        } else if (action === "approve") {
          const version = (card.version ?? 0) + 1;
          const approvedAt = new Date();
          await card.update({ status: "approved", version, approved_by: actorId, approved_at: approvedAt });
          const doc = docs.get(card.id!)!;
          doc.card.version = version;
          doc.card.status = "approved";
          doc.card.approved_at = approvedAt.toISOString();
          await writeSnapshot(card, doc, { actorId });
        } else if (action === "publish") {
          if (scheduled) {
            await card.update({ publish_at: scheduleAt });
          } else {
            await card.update({ status: "published", published_by: actorId, published_at: new Date(), publish_at: null });
          }
        } else if (action === "unpublish") {
          await card.update({ status: "approved", published_at: null, published_by: null, publish_at: null });
        } else if (action === "reopen") {
          await supersedeSnapshots(card.id!, reason ?? "Reopened");
          await card.update({
            status: "draft",
            returned_reason: reason?.trim() ?? null,
            reviewed_by: null,
            reviewed_at: null,
            publish_at: null,
          });
        }
        const to = card.status;
        await recordTransition(card, action, from, scheduled ? `${to}@scheduled` : to, req, name, reason);
        results.push({
          report_card_id: card.id!,
          student_id: card.student_id,
          ok: true,
          status: card.status,
          scheduled_for: scheduled ? scheduleAt!.toISOString() : null,
        });
      } catch (e: any) {
        console.error(`transitionCards: ${action} card ${card.id} failed:`, e);
        results.push({ report_card_id: card.id!, student_id: card.student_id, ok: false, status: from, code: "ERROR", message: "Could not update this card" });
      }
    }

    return results;
}

export const transitionCards = async (req: Request, res: Response) => {
  try {
    const body = req.body as TransitionPayload;
    const { action, publish_at } = body;
    const results = await runTransition(req, body);
    const scheduled =
      action === "publish" && publish_at != null && new Date(publish_at).getTime() > Date.now() + 30_000;
    const ok = results.filter((r) => r.ok).length;
    const label = ACTION_RULES[action].label.toLowerCase();
    res.status(ok > 0 || results.length === 0 ? 200 : 409).json({
      success: ok > 0,
      message:
        results.length === ok
          ? `${ok} report card${ok === 1 ? "" : "s"} ${scheduled ? "scheduled for publishing" : `updated (${label})`}`
          : `${ok} of ${results.length} report cards updated; ${results.length - ok} could not ${label}`,
      data: { action, ok, failed: results.length - ok, results },
    });
  } catch (error) {
    sendControllerError(res, error, "transitionCards");
  }
};

// ─── Scheduled publishing ────────────────────────────────────────────────────

/** Publish every approved card whose publish_at has passed (one tenant). */
export async function publishDueCards(now = new Date()): Promise<number> {
  const due = await ReportCard.findAll({
    where: { status: "approved", publish_at: { [Op.lte]: now } },
    limit: 500,
  });
  for (const card of due) {
    await card.update({ status: "published", published_at: now, publish_at: null });
    await ReportCardTransition.create({
      report_card_id: card.id!,
      action: "publish",
      from_status: "approved",
      to_status: "published",
      version: card.version,
      actor_id: card.published_by ?? null,
      actor_name: "Scheduled release",
      reason: null,
    } as any);
  }
  return due.length;
}

// ─── GET /api/report-cards/:id/history ───────────────────────────────────────

export const getCardHistory = async (req: Request, res: Response) => {
  try {
    const card = await ReportCard.findByPk(Number(req.params.id));
    if (!card) return res.status(404).json({ success: false, message: "Report card not found" });
    const ok = await scopedAllow(req, {
      caps: "REPORT_CARDS_VIEW_ALL",
      minDepth: "detail",
      target: () => cardStudentTarget(req, card.student_id),
      legacy: perms(req).has("REPORT_CARDS_VIEW_ALL"),
    });
    if (!ok) return denyResponse(req, res, "Not authorized to view this report card's history");
    const [transitions, versions] = await Promise.all([
      ReportCardTransition.findAll({ where: { report_card_id: card.id }, order: [["created_at", "DESC"]], limit: 200 }),
      ReportCardSnapshot.findAll({
        where: { report_card_id: card.id },
        attributes: ["version", "approved_at", "approved_by", "pdf_sha256", "superseded_at", "superseded_reason", "backfilled"],
        order: [["version", "DESC"]],
      }),
    ]);
    res.status(200).json({
      success: true,
      data: {
        report_card_id: card.id,
        status: card.status,
        version: card.version,
        returned_reason: card.returned_reason,
        publish_at: card.publish_at,
        transitions: transitions.map((t) => ({
          id: t.id,
          action: t.action,
          from_status: t.from_status,
          to_status: t.to_status,
          version: t.version,
          actor_name: t.actor_name,
          reason: t.reason,
          at: (t as any).created_at ?? (t as any).createdAt,
        })),
        versions: versions.map((v) => ({
          version: v.version,
          approved_at: v.approved_at,
          sha256: v.pdf_sha256,
          superseded_at: v.superseded_at,
          superseded_reason: v.superseded_reason,
          backfilled: v.backfilled,
        })),
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getCardHistory");
  }
};

// ─── GET /api/report-cards/:id/diff ──────────────────────────────────────────

/** Subject totals that changed since approval (live marks vs the snapshot). */
export function diffDocumentTotals(
  frozen: ReportCardDocument,
  live: CardGrades,
): Array<{ subject_id: number; name: string; approved: number | null; now: number | null }> {
  const liveBy = new Map(live.grades.map((g) => [g.subject_id, g.total_score]));
  const frozenSubjects = frozen.groups.flatMap((g) => g.subjects);
  const ids = new Set([...frozenSubjects.map((s) => s.subject_id), ...liveBy.keys()]);
  const out: Array<{ subject_id: number; name: string; approved: number | null; now: number | null }> = [];
  for (const id of ids) {
    const f = frozenSubjects.find((s) => s.subject_id === id);
    const approved = f?.total ?? null;
    const now = liveBy.get(id) ?? null;
    if ((approved == null) !== (now == null) || (approved != null && now != null && Math.abs(approved - now) >= 0.01)) {
      out.push({ subject_id: id, name: f?.name ?? `Subject #${id}`, approved, now });
    }
  }
  return out;
}

export const getCardDiff = async (req: Request, res: Response) => {
  try {
    const card = await ReportCard.findByPk(Number(req.params.id));
    if (!card) return res.status(404).json({ success: false, message: "Report card not found" });
    const ok = await scopedAllow(req, {
      caps: "REPORT_CARDS_VIEW_ALL",
      minDepth: "detail",
      target: () => cardStudentTarget(req, card.student_id),
      legacy: perms(req).has("REPORT_CARDS_VIEW_ALL"),
    });
    if (!ok) return denyResponse(req, res, "Not authorized to view this report card");
    const snap = isFrozen(card.status) ? await activeSnapshot(card.id!) : null;
    if (!snap) return res.status(200).json({ success: true, data: { frozen: false, changes: [] } });
    const live = await computeCardGrades(card);
    const frozen = snap.payload as ReportCardDocument;
    const changes = diffDocumentTotals(frozen, live);
    const names = await resolveSubjectNames(req, changes.map((c) => c.subject_id));
    res.status(200).json({
      success: true,
      data: {
        frozen: true,
        version: snap.version,
        approved_at: snap.approved_at,
        changes: changes.map((c) => ({ ...c, name: names[c.subject_id] ?? c.name })),
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getCardDiff");
  }
};

// ─── Scheme ──────────────────────────────────────────────────────────────────

export const getScheme = async (_req: Request, res: Response) => {
  try {
    const [scheme, bands] = await Promise.all([getReportCardScheme(), getGradingBands()]);
    res.status(200).json({ success: true, data: { scheme, bands } });
  } catch (error) {
    sendControllerError(res, error, "getScheme");
  }
};

export const putScheme = async (req: Request, res: Response) => {
  try {
    const scheme = await setReportCardScheme(req.body?.scheme ?? req.body, (req as any).user?.id ?? null);
    res.status(200).json({ success: true, data: { scheme } });
  } catch (error: any) {
    if (error instanceof Error && !(error as any).name?.startsWith?.("Sequelize")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    sendControllerError(res, error, "putScheme");
  }
};

/** GET /report-cards/structure: the school's builder, its categories and the template options teachers see. */
export const getStructure = async (_req: Request, res: Response) => {
  try {
    const scheme = await getReportCardScheme();
    res.status(200).json({
      success: true,
      data: {
        builder: scheme.builder,
        structure: builderStructure(scheme.builder, scheme.category_weights),
        competence_thresholds: scheme.competence_thresholds,
        pass_mark: scheme.pass_mark,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getStructure");
  }
};

/** GET /report-cards/templates/modules: every MIS module with its code, category and learning hours. */
export const getTemplateModules = async (req: Request, res: Response) => {
  try {
    const [modules, scheme] = await Promise.all([listSubjectInfo(req), getReportCardScheme()]);
    res.status(200).json({
      success: true,
      data: {
        modules: modules.map((m) => ({ ...m, override: scheme.tvet.module_weights[String(m.id)] ?? null })),
        default_module_weight: scheme.tvet.default_module_weight,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getTemplateModules");
  }
};

/** GET /report-cards/templates/school: the school's identity block from MIS (this tenant's School). */
export const getTemplateSchool = async (req: Request, res: Response) => {
  try {
    const r = await getSchoolProfile(req, { fresh: req.query.fresh === "1" });
    res.status(200).json({ success: true, data: { profile: r.profile, can_edit: r.canEdit, source: r.source } });
  } catch (error) {
    sendControllerError(res, error, "getTemplateSchool");
  }
};

/** PUT /report-cards/templates/school: saves identity fields to MIS (MIS requires Manage schools). */
export const putTemplateSchool = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, string | null> = {};
    for (const f of SCHOOL_PROFILE_FIELDS) if (f in body) patch[f] = body[f] == null ? null : String(body[f]);
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: "Nothing to save." });
    const profile = await saveSchoolProfile(req, patch);
    res.status(200).json({ success: true, data: { profile } });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    sendControllerError(res, error, "putTemplateSchool");
  }
};

/** PUT /report-cards/templates/modules/:id/weight: sets the module's weight on its MIS subject (MIS requires Manage academics). */
export const putModuleWeight = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const raw = (req.body ?? {}).weight;
    const weight = raw == null || raw === "" ? null : Number(raw);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: "Unknown module." });
    if (weight != null && (!Number.isInteger(weight) || weight < 1 || weight > 1000)) {
      return res.status(400).json({ success: false, message: "The module weight is a whole number from 1 to 1000." });
    }
    await saveModuleWeight(req, id, weight);
    forgetSubjectInfo();
    res.status(200).json({ success: true, data: { id, weight } });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ success: false, message: error.message });
    sendControllerError(res, error, "putModuleWeight");
  }
};

/**
 * POST /report-cards/templates/map-formative { dry_run? }: maps every unmapped
 * assessment of the caller's current term to FA (TVET schools only).
 */
export const postMapFormative = async (req: Request, res: Response) => {
  try {
    const scheme = await getReportCardScheme();
    if (scheme.builder !== "tvet") {
      return res.status(409).json({ success: false, message: "The school uses the Normal builder: switch to TVET first." });
    }
    const names = await resolveCurrentAcademicPeriodNames(req);
    if (!names.term || !names.academicYear) return res.status(400).json({ success: false, message: "There's no current term to map against." });
    const termId = await getCurrentTermId(req).catch(() => null);
    const result = await mapUnmappedToFormative({
      term: names.term,
      academicYear: names.academicYear,
      termId: termId != null ? Number(termId) : null,
      dryRun: req.body?.dry_run === true,
      by: (req as any).user?.id ?? null,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    sendControllerError(res, error, "postMapFormative");
  }
};

// ─── Workbench ───────────────────────────────────────────────────────────────

/** Which workflow actions the caller holds at all (UI hints; each card is re-checked). */
const callerActions = (req: Request) => ({
  review: legacyCan(req, "REPORT_CARDS_REVIEW") || accessV2Enforced(),
  approve: legacyCan(req, "REPORT_CARDS_APPROVE") || accessV2Enforced(),
  publish: legacyCan(req, "REPORT_CARDS_PUBLISH") || accessV2Enforced(),
  edit_settings: legacyCan(req, "REPORT_CARDS_APPROVE|REPORT_CARDS_REVIEW") || accessV2Enforced(),
  comment: legacyCan(req, "REPORT_CARDS_COMMENT|REPORT_CARDS_EDIT") || accessV2Enforced(),
});
const accessV2Enforced = () => (process.env.ACCESS_V2_MODE ?? "off").toLowerCase() === "enforce";

/**
 * One class x term: every student's card (draft shells are created for
 * active roster students who have none), per-subject totals, sign-offs,
 * blockers and what the caller can do. Cards get their class group stamped
 * here so cohort maths (class average, position) can find them.
 */
export const getWorkbench = async (req: Request, res: Response) => {
  try {
    const classGroupId = Number(req.query.class_group_id);
    const term = String(req.query.term ?? "").trim();
    const year = String(req.query.academic_year ?? "").trim();
    if (!Number.isInteger(classGroupId) || classGroupId <= 0 || !term || !year) {
      return res.status(400).json({ success: false, message: "class_group_id, term and academic_year are required" });
    }
    const directory = await directoryFor(req);
    const group = directory.class_groups.find((g) => g.id === classGroupId);
    const roster = directory.rosters.get(classGroupId) ?? [];
    const visible = new Set(
      await filterCardStudents(req, roster, ["REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE", "REPORT_CARDS_COMMENT"], {
        minDepth: "detail",
      }),
    );
    const studentIds = roster.filter((id) => visible.has(id));
    const scheme = await getReportCardScheme();
    const cycle = await findOrCreateCycle(classGroupId, term, year, group?.name ?? null);

    // Cards for every visible roster student (create draft shells), stamped with the class.
    const existing = await ReportCard.findAll({ where: { student_id: { [Op.in]: studentIds.length ? studentIds : [-1] }, term, academic_year: year } });
    const byStudent = new Map(existing.map((c) => [c.student_id, c]));
    const studentsById = new Map(directory.students.map((s) => [s.mis_user_id, s]));
    for (const sid of studentIds) {
      let card = byStudent.get(sid);
      if (!card) {
        [card] = await ReportCard.findOrCreate({
          where: { student_id: sid, term, academic_year: year },
          defaults: {
            student_id: sid,
            term,
            academic_year: year,
            status: "draft",
            attendance_present: 0,
            attendance_absent: 0,
            attendance_late: 0,
            class_group_id: classGroupId,
            class_name: group?.name ?? null,
          } as any,
        });
        byStudent.set(sid, card);
      }
      if (card.class_group_id !== classGroupId || (group?.name && card.class_name !== group.name)) {
        await card.update({ class_group_id: classGroupId, class_name: group?.name ?? card.class_name });
      }
    }
    const cards = studentIds.map((id) => byStudent.get(id)!).filter(Boolean);

    const classSubjects = directory.class_group_subjects.get(classGroupId) ?? [];
    await syncSubjectMappings(cards, classSubjects, term, year);
    const computed = new Map<number, CardGrades>();
    for (const c of cards) computed.set(c.id!, await computeCardGrades(c, gradingOf(scheme)));
    const subjectIds = new Set<number>(classSubjects);
    for (const g of computed.values()) g.mappedSubjects.forEach((id) => subjectIds.add(id));
    const subjectInfo = await resolveSubjectInfo(req, [...subjectIds]);
    const names: Record<number, string> = Object.fromEntries(Object.entries(subjectInfo).map(([id, v]) => [Number(id), v.name]));
    const schemeGroupOf = (sid: number) => scheme.subject_groups.find((g) => g.subject_ids.includes(sid))?.name?.toLowerCase() ?? "";
    const categoryOf = (sid: number) => {
      const n = schemeGroupOf(sid);
      if (n.includes("complementary")) return "complementary" as const;
      if (n.includes("general")) return "general" as const;
      if (n.includes("specific") || n.includes("core")) return "specific" as const;
      return categoryFromCode(subjectInfo[sid]?.code);
    };
    const thresholdOf = (sid: number) => scheme.competence_thresholds[categoryOf(sid) ?? "specific"] ?? scheme.pass_mark;
    const structure = builderStructure(scheme.builder, scheme.category_weights);

    const signoffs = await ReportCycleSubjectSignoff.findAll({ where: { cycle_id: cycle.id } });
    const signoffBy = new Map(signoffs.map((s) => [s.subject_id, s]));
    const submitted = new Set(signoffs.filter((s) => s.status === "submitted").map((s) => s.subject_id));

    // Frozen cards: totals that moved since approval.
    const snaps = await ReportCardSnapshot.findAll({
      where: { report_card_id: { [Op.in]: cards.filter((c) => isFrozen(c.status)).map((c) => c.id!).concat(-1) }, superseded_at: { [Op.is]: null } as any },
    });
    const snapBy = new Map<number, ReportCardSnapshot>();
    for (const s of snaps) {
      const prev = snapBy.get(s.report_card_id);
      if (!prev || prev.version < s.version) snapBy.set(s.report_card_id, s);
    }

    // Which assessments the missing marks are, so teachers know what to record.
    const missingKeys: Array<{ type: string; id: number }> = [];
    for (const g of computed.values()) for (const list of g.missingItems.values()) for (const m of list) missingKeys.push({ type: m.assessment_type, id: m.assessment_id });
    const missingTitles = missingKeys.length ? await assessmentTitles(missingKeys) : new Map<string, { title: string; href: string | null }>();

    const myId = (req as any).user?.mis_user_id != null ? Number((req as any).user.mis_user_id) : null;
    const subjects = [...subjectIds]
      .map((sid) => {
        const s = signoffBy.get(sid);
        const teachers = directory.class_subject_teachers.get(`${classGroupId}:${sid}`) ?? [];
        let missing = 0;
        let mapped = 0;
        for (const g of computed.values()) {
          missing += g.missingBySubject.get(sid) ?? 0;
          if (g.mappedSubjects.has(sid)) mapped++;
        }
        return {
          subject_id: sid,
          name: names[sid] ?? `Subject #${sid}`,
          code: displayCode(subjectInfo[sid]?.code),
          category: categoryOf(sid),
          threshold: thresholdOf(sid),
          teachers: teachers.map((t) => t.name),
          i_teach: myId != null && teachers.some((t) => t.mis_user_id === myId),
          mapped_cards: mapped,
          total_cards: cards.length,
          missing_marks: missing,
          signoff: {
            status: s?.status ?? "open",
            submitted_by: s?.submitted_by_name ?? null,
            submitted_at: s?.submitted_at ?? null,
            returned_reason: s?.returned_reason ?? null,
          },
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const students = cards.map((card) => {
      const g = computed.get(card.id!)!;
      const info = studentsById.get(card.student_id);
      const facts = readinessOf(card, g, submitted, classSubjects, names, scheme.attributes.length);
      const totals: Record<
        number,
        {
          total: number | null;
          missing: number;
          covered: number | null;
          points: number | null;
          categories: Record<string, number | null> | null;
          competent: boolean | null;
          missing_items: Array<{ assessment_type: string; assessment_id: number; category: string; title: string; href: string | null }>;
        }
      > = {};
      for (const sid of subjectIds) {
        const grade = g.grades.find((x) => x.subject_id === sid);
        totals[sid] = {
          total: grade ? grade.total_score : null,
          missing: g.missingBySubject.get(sid) ?? 0,
          // Share of the term assessed: Normal = weight of the categories with marks; TVET = FA and CA (IA is Term 3's extra).
          covered: grade ? (structure.key === "tvet" ? Math.min(100, Math.round(grade.weight_covered / 2)) : grade.weight_covered) : null,
          points: grade ? Math.round(grade.points * 100) / 100 : null,
          categories: grade
            ? Object.fromEntries(structure.categories.map((c) => [c.key, grade.categories[c.key]?.scaled_score ?? null]))
            : null,
          competent: grade ? grade.total_score >= thresholdOf(sid) : null,
          missing_items: (g.missingItems.get(sid) ?? []).map((m) => {
            const t = missingTitles.get(`${m.assessment_type}:${m.assessment_id}`);
            return { ...m, title: t?.title ?? `${m.assessment_type} #${m.assessment_id}`, href: t?.href ?? null };
          }),
        };
      }
      const avg = g.grades.length ? Math.round((g.grades.reduce((a, x) => a + x.total_score, 0) / g.grades.length) * 100) / 100 : null;
      const snap = snapBy.get(card.id!);
      const changed = snap ? diffDocumentTotals(snap.payload as ReportCardDocument, g).length : 0;
      return {
        student_id: card.student_id,
        name: info?.name ?? `Student #${card.student_id}`,
        registration_number: info?.registration_number ?? null,
        gender: info?.gender ?? null,
        card: {
          id: card.id,
          uuid: card.uuid,
          status: card.status,
          version: card.version,
          reviewed_at: card.reviewed_at,
          approved_at: card.approved_at,
          published_at: card.published_at,
          publish_at: card.publish_at,
          returned_reason: card.returned_reason,
          editable: isEditable(card.status),
        },
        subjects: totals,
        average: avg,
        has_comment: facts.has_comment,
        attributes_rated: facts.attributes_rated,
        attendance_days: facts.attendance_days,
        attendance_source: card.attendance_source,
        blockers: isEditable(card.status) ? reviewBlockers(facts) : [],
        warnings: isEditable(card.status) ? reviewWarnings(facts) : [],
        changed_since_approval: changed,
        actions: actionsFrom(card.status),
      };
    });

    const counts = { draft: 0, reviewed: 0, approved: 0, published: 0, scheduled: 0, ready: 0 };
    for (const s of students) {
      counts[s.card.status as keyof typeof counts] += 1;
      if (s.card.publish_at && s.card.status === "approved") counts.scheduled += 1;
      if (s.card.status === "draft" && s.blockers.length === 0) counts.ready += 1;
    }
    // Class-level blockers: grouped by code with how many students each affects.
    const blockerSummary = new Map<string, { code: string; students: number; example: string }>();
    for (const s of students) {
      for (const b of [...s.blockers, ...s.warnings]) {
        const e = blockerSummary.get(b.code) ?? { code: b.code, students: 0, example: b.message };
        e.students += 1;
        blockerSummary.set(b.code, e);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        class_group: {
          id: classGroupId,
          name: group?.name ?? cycle.class_name ?? `Class ${classGroupId}`,
          grade_name: group?.grade_name ?? null,
          program_name: group?.program_name ?? null,
        },
        term,
        academic_year: year,
        cycle: {
          id: cycle.id,
          marks_due_at: cycle.marks_due_at,
          review_due_at: cycle.review_due_at,
          publish_at: cycle.publish_at,
          next_term_begins_on: cycle.next_term_begins_on,
        },
        scheme: {
          attributes: scheme.attributes,
          pass_mark: scheme.pass_mark,
          require_distinct_approver: scheme.require_distinct_approver,
          category_weights: scheme.category_weights,
          competence_thresholds: scheme.competence_thresholds,
          builder: scheme.builder,
          structure: builderStructure(scheme.builder, scheme.category_weights),
        },
        subjects,
        students,
        counts,
        blockers: [...blockerSummary.values()].sort((a, b) => b.students - a.students),
        can: callerActions(req),
        roster_complete: directory.rosters_complete,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "getWorkbench");
  }
};

/**
 * A subject's saved mapping reaches a card only through the fan-out at save
 * time, which covers the students MIS listed as enrolled then. Cards created
 * later (the workbench makes a draft for every roster student) or students
 * MIS didn't list would never get it. Copy each class subject's canonical
 * mapping onto the class's DRAFT cards that have no rows for that subject.
 */
export async function syncSubjectMappings(cards: ReportCard[], subjectIds: number[], term: string, year: string): Promise<number> {
  const drafts = cards.filter((c) => isEditable(c.status));
  if (drafts.length === 0 || subjectIds.length === 0) return 0;
  const canonical = await SubjectAssessmentMapping.findAll({
    where: { subject_id: { [Op.in]: subjectIds }, term, academic_year: year },
    attributes: ["subject_id", "assessment_type", "assessment_id", "category"],
  });
  if (canonical.length === 0) return 0;
  const bySubject = new Map<number, SubjectAssessmentMapping[]>();
  for (const m of canonical) bySubject.set(m.subject_id, [...(bySubject.get(m.subject_id) ?? []), m]);
  const existing = await ReportCardAssessment.findAll({
    where: { report_card_id: { [Op.in]: drafts.map((c) => c.id!) }, subject_id: { [Op.in]: [...bySubject.keys()] } },
    attributes: ["report_card_id", "subject_id"],
  });
  const has = new Set(existing.map((e) => `${e.report_card_id}:${e.subject_id}`));
  const rows: Array<Record<string, unknown>> = [];
  for (const card of drafts) {
    for (const [sid, list] of bySubject) {
      if (has.has(`${card.id}:${sid}`)) continue;
      for (const m of list) {
        rows.push({
          report_card_id: card.id!,
          subject_id: sid,
          assessment_type: m.assessment_type,
          assessment_id: m.assessment_id,
          category: m.category,
        });
      }
    }
  }
  if (rows.length) await ReportCardAssessment.bulkCreate(rows as any);
  return rows.length;
}

// ─── GET /api/report-cycles ──────────────────────────────────────────────────

/** Every class group the caller can see, with this term's card progress. */
export const listCycles = async (req: Request, res: Response) => {
  try {
    const term = String(req.query.term ?? "").trim();
    const year = String(req.query.academic_year ?? "").trim();
    if (!term || !year) return res.status(400).json({ success: false, message: "term and academic_year are required" });
    const directory = await directoryFor(req);
    const allStudents = [...new Set([...directory.rosters.values()].flat())];
    const visible = new Set(
      await filterCardStudents(req, allStudents, ["REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE", "REPORT_CARDS_COMMENT"], {
        minDepth: "summary",
      }),
    );
    const cards = await ReportCard.findAll({
      where: { term, academic_year: year, student_id: { [Op.in]: allStudents.length ? allStudents : [-1] } },
      attributes: ["id", "student_id", "status", "publish_at"],
    });
    const cardBy = new Map(cards.map((c) => [c.student_id, c]));
    const cycles = await ReportCycle.findAll({ where: { term, academic_year: year } });
    const cycleBy = new Map(cycles.map((c) => [c.class_group_id, c]));
    const signoffs = cycles.length
      ? await ReportCycleSubjectSignoff.findAll({ where: { cycle_id: { [Op.in]: cycles.map((c) => c.id) }, status: "submitted" } })
      : [];
    const myId = (req as any).user?.mis_user_id != null ? Number((req as any).user.mis_user_id) : null;

    const rows = directory.class_groups
      .map((g) => {
        const roster = (directory.rosters.get(g.id) ?? []).filter((id) => visible.has(id));
        const counts = { draft: 0, reviewed: 0, approved: 0, published: 0, not_started: 0 };
        for (const sid of roster) {
          const c = cardBy.get(sid);
          if (!c) counts.not_started += 1;
          else counts[c.status as keyof typeof counts] += 1;
        }
        const cycle = cycleBy.get(g.id);
        const subjects = directory.class_group_subjects.get(g.id) ?? [];
        const submitted = cycle ? signoffs.filter((s) => s.cycle_id === cycle.id && subjects.includes(s.subject_id)).length : 0;
        const teachesHere =
          myId != null && subjects.some((sid) => (directory.class_subject_teachers.get(`${g.id}:${sid}`) ?? []).some((t) => t.mis_user_id === myId));
        return {
          class_group_id: g.id,
          name: g.name,
          grade_name: g.grade_name,
          program_name: g.program_name,
          students: roster.length,
          counts,
          subjects_total: subjects.length,
          subjects_submitted: submitted,
          i_teach: teachesHere,
          cycle: cycle
            ? { marks_due_at: cycle.marks_due_at, review_due_at: cycle.review_due_at, publish_at: cycle.publish_at, next_term_begins_on: cycle.next_term_begins_on }
            : null,
        };
      })
      .filter((r) => r.students > 0);
    res.status(200).json({ success: true, data: { term, academic_year: year, classes: rows, can: callerActions(req) } });
  } catch (error) {
    sendControllerError(res, error, "listCycles");
  }
};

// ─── PUT /api/report-cycles/settings ─────────────────────────────────────────

export const putCycleSettings = async (req: Request, res: Response) => {
  try {
    const body = req.body as CycleSettingsPayload;
    const ok = await scopedAllow(req, {
      caps: ["REPORT_CARDS_APPROVE", "REPORT_CARDS_REVIEW"],
      target: {},
      legacy: legacyCan(req, "REPORT_CARDS_APPROVE|REPORT_CARDS_REVIEW"),
    });
    if (!ok) return denyResponse(req, res, "Not authorized to change report card deadlines");
    const ids = [...new Set(body.class_group_ids)];
    const patch: Record<string, unknown> = { updated_by: (req as any).user?.id ?? null };
    for (const k of ["marks_due_at", "review_due_at", "publish_at", "next_term_begins_on"] as const) {
      if (k in body) patch[k] = (body as any)[k] ?? null;
    }
    for (const cg of ids) {
      const cycle = await findOrCreateCycle(cg, body.term, body.academic_year);
      await cycle.update(patch);
    }
    res.status(200).json({ success: true, message: `Settings saved for ${ids.length} class${ids.length === 1 ? "" : "es"}`, data: { updated: ids.length } });
  } catch (error) {
    sendControllerError(res, error, "putCycleSettings");
  }
};

// ─── Sign-off ────────────────────────────────────────────────────────────────

interface MissingItem {
  student_id: number;
  name: string;
  report_card_id: number;
  assessment_type: string;
  assessment_id: number;
  title: string;
  category: string;
}

/** Titles (and where to record the mark) of quiz / assignment / manual assessments. */
async function assessmentTitles(keys: Array<{ type: string; id: number }>): Promise<Map<string, { title: string; href: string | null }>> {
  const idsOf = (t: string) => [...new Set(keys.filter((k) => k.type === t).map((k) => k.id))];
  const [quizzes, assignments, manuals] = await Promise.all([
    idsOf("quiz").length ? Quiz.findAll({ where: { id: { [Op.in]: idsOf("quiz") } }, attributes: ["id", "title"], raw: true }) : [],
    idsOf("assignment").length ? Assignment.findAll({ where: { id: { [Op.in]: idsOf("assignment") } }, attributes: ["id", "title"], raw: true }) : [],
    idsOf("manual").length
      ? ManualAssessment.findAll({ where: { id: { [Op.in]: idsOf("manual") } }, attributes: ["id", "title", "course_id"], raw: true })
      : [],
  ]);
  const out = new Map<string, { title: string; href: string | null }>();
  for (const q of quizzes as any[]) out.set(`quiz:${q.id}`, { title: q.title, href: `/quizzes/${q.id}/submissions` });
  for (const a of assignments as any[]) out.set(`assignment:${a.id}`, { title: a.title, href: `/assignments/${a.id}` });
  for (const m of manuals as any[]) out.set(`manual:${m.id}`, { title: m.title, href: m.course_id ? `/courses/${m.course_id}/grades` : null });
  return out;
}

/** Marks of `subjectId` not recorded and not resolved, for the class's draft cards. */
async function missingMarksFor(
  req: Request,
  classGroupId: number,
  subjectId: number,
  term: string,
  year: string,
): Promise<{ items: MissingItem[]; cards: ReportCard[]; directory: SchoolDirectory }> {
  const directory = await directoryFor(req);
  const roster = directory.rosters.get(classGroupId) ?? [];
  const cards = await ReportCard.findAll({
    where: { student_id: { [Op.in]: roster.length ? roster : [-1] }, term, academic_year: year },
  });
  const names = new Map(directory.students.map((s) => [s.mis_user_id, s.name]));
  const items: MissingItem[] = [];
  const keys: Array<{ type: string; id: number }> = [];
  for (const card of cards.filter((c) => isEditable(c.status))) {
    const g = await computeCardGrades(card);
    if (!(g.missingBySubject.get(subjectId) ?? 0)) continue;
    const { loadStudentMarks, resolveCardStudent, resolveMark } = await import("../utils/reportCardScores");
    const rows = g.rawMappings.filter((m) => m.subject_id === subjectId);
    const marks = await loadStudentMarks(await resolveCardStudent(card.student_id), rows);
    for (const m of rows) {
      const key = `${m.assessment_type}:${m.assessment_id}` as const;
      if (!marks.valid.has(key as any)) continue;
      if (resolveMark(key as any, marks, m.mark_status)) continue;
      if (m.mark_status === "exempt" || marks.statuses.get(key as any) === "exempt") continue;
      items.push({
        student_id: card.student_id,
        name: names.get(card.student_id) ?? `Student #${card.student_id}`,
        report_card_id: card.id!,
        assessment_type: m.assessment_type,
        assessment_id: m.assessment_id,
        title: "",
        category: m.category,
      });
      keys.push({ type: m.assessment_type, id: m.assessment_id });
    }
  }
  const titles = await assessmentTitles(keys);
  for (const i of items) i.title = titles.get(`${i.assessment_type}:${i.assessment_id}`)?.title ?? `${i.assessment_type} #${i.assessment_id}`;
  items.sort((a, b) => a.name.localeCompare(b.name) || a.title.localeCompare(b.title));
  return { items, cards, directory };
}

async function maySignoff(req: Request, subjectId: number, classGroupId: number) {
  return scopedAllow(req, {
    caps: ["REPORT_CARDS_EDIT", "REPORT_CARDS_CREATE"],
    target: { subjectId, classGroupId } as any,
    legacy: legacyCan(req, "REPORT_CARDS_EDIT|REPORT_CARDS_CREATE"),
  });
}

export const previewSignoff = async (req: Request, res: Response) => {
  try {
    const classGroupId = Number(req.query.class_group_id);
    const subjectId = Number(req.query.subject_id);
    const term = String(req.query.term ?? "").trim();
    const year = String(req.query.academic_year ?? "").trim();
    if (!(classGroupId > 0) || !(subjectId > 0) || !term || !year) {
      return res.status(400).json({ success: false, message: "class_group_id, subject_id, term and academic_year are required" });
    }
    if (!(await maySignoff(req, subjectId, classGroupId))) return denyResponse(req, res, "Not authorized to submit marks for this subject and class");
    const { items, cards } = await missingMarksFor(req, classGroupId, subjectId, term, year);
    const cycle = await ReportCycle.findOne({ where: { class_group_id: classGroupId, term, academic_year: year } });
    const signoff = cycle ? await ReportCycleSubjectSignoff.findOne({ where: { cycle_id: cycle.id, subject_id: subjectId } }) : null;
    res.status(200).json({
      success: true,
      data: {
        status: signoff?.status ?? "open",
        returned_reason: signoff?.returned_reason ?? null,
        locked_cards: cards.filter((c) => !isEditable(c.status)).length,
        missing: items,
      },
    });
  } catch (error) {
    sendControllerError(res, error, "previewSignoff");
  }
};

export const signoffSubject = async (req: Request, res: Response) => {
  try {
    const { class_group_id, subject_id, term, academic_year, action, resolutions, reason } = req.body as SignoffPayload;
    const isOwnTeacher = await maySignoff(req, subject_id, class_group_id);
    const reviewer = legacyCan(req, "REPORT_CARDS_REVIEW|REPORT_CARDS_APPROVE");
    if (!isOwnTeacher && !(action === "reopen" && reviewer)) {
      return denyResponse(req, res, "Not authorized to change the sign-off of this subject and class");
    }
    const cycle = await findOrCreateCycle(class_group_id, term, academic_year);
    const [signoff] = await ReportCycleSubjectSignoff.findOrCreate({
      where: { cycle_id: cycle.id, subject_id },
      defaults: { cycle_id: cycle.id, subject_id, status: "open" } as any,
    });
    const name = await actorName(req);

    if (action === "reopen") {
      await signoff.update({ status: "open", returned_reason: reason?.trim() || signoff.returned_reason });
      return res.status(200).json({ success: true, message: "Subject reopened for marks", data: { status: "open" } });
    }

    // Apply absent/exempt resolutions to draft cards only, then require nothing missing.
    if (resolutions?.length) {
      const cardIds = [...new Set(resolutions.map((r) => r.report_card_id))];
      const cards = await ReportCard.findAll({ where: { id: { [Op.in]: cardIds } } });
      const draftIds = new Set(cards.filter((c) => isEditable(c.status)).map((c) => c.id!));
      for (const r of resolutions) {
        if (!draftIds.has(r.report_card_id)) continue;
        await ReportCardAssessment.update(
          { mark_status: r.status },
          {
            where: {
              report_card_id: r.report_card_id,
              subject_id,
              assessment_type: r.assessment_type,
              assessment_id: r.assessment_id,
            },
          },
        );
      }
    }
    const { items } = await missingMarksFor(req, class_group_id, subject_id, term, academic_year);
    if (items.length) {
      return res.status(409).json({
        success: false,
        code: "MISSING_MARKS",
        message: `${items.length} mark${items.length === 1 ? " is" : "s are"} still missing. Record ${items.length === 1 ? "it" : "them"}, or mark absent/exempt.`,
        data: { missing: items },
      });
    }
    await signoff.update({
      status: "submitted",
      submitted_by: (req as any).user?.id ?? null,
      submitted_by_name: name,
      submitted_at: new Date(),
      returned_reason: null,
    });
    res.status(200).json({ success: true, message: "Marks submitted for review", data: { status: "submitted" } });
  } catch (error) {
    sendControllerError(res, error, "signoffSubject");
  }
};

// ─── Attendance import ───────────────────────────────────────────────────────

export const attendanceAppUrl = () =>
  (process.env.ATTENDANCE_APP_URL || process.env.HOME_APP_ATTENDANCE_URL || "").replace(/\/$/, "");

/**
 * Term attendance per student from the attendance app (nga-discipline-attendance
 * GET /api/integration/attendance/class/:id/term), written onto the class's
 * draft cards. Sick days stay as entered: the attendance app has no such status.
 */
export const importAttendance = async (req: Request, res: Response) => {
  try {
    const { class_group_id, term, academic_year } = req.body as AttendanceImportPayload;
    const ok = await scopedAllow(req, {
      caps: "REPORT_CARDS_COMMENT",
      target: { classGroupId: class_group_id } as any,
      legacy: legacyCan(req, "REPORT_CARDS_EDIT|REPORT_CARDS_COMMENT|REPORT_CARDS_REVIEW"),
    });
    if (!ok) return denyResponse(req, res, "Not authorized to import attendance for this class");
    const base = attendanceAppUrl();
    const token = getMisToken(req, { quiet: true });
    if (!base || !token) {
      return res.status(503).json({ success: false, code: "ATTENDANCE_APP_UNAVAILABLE", message: "The attendance app isn't connected. Enter attendance by hand." });
    }
    const termId = await resolveAcademicTermIdByName(req, term, academic_year);
    let rows: any[] = [];
    try {
      const r = await axios.get(`${base}/api/integration/attendance/class/${class_group_id}/term`, {
        headers: { Authorization: `Bearer ${token}` },
        params: termId ? { academic_term_id: termId } : {},
        timeout: 15_000,
      });
      rows = r.data?.data?.students ?? [];
    } catch (e: any) {
      const status = e?.response?.status;
      console.warn("importAttendance: attendance app call failed:", status, e?.message);
      return res.status(502).json({
        success: false,
        code: "ATTENDANCE_APP_ERROR",
        message: status === 404 ? "The attendance app has no register for this class and term." : "The attendance app didn't answer. Try again, or enter attendance by hand.",
      });
    }
    const cards = await ReportCard.findAll({
      where: { student_id: { [Op.in]: rows.map((r) => Number(r.studentId ?? r.student_id)).filter(Number.isFinite).concat(-1) }, term, academic_year },
    });
    const cardBy = new Map(cards.map((c) => [c.student_id, c]));
    let updated = 0;
    let locked = 0;
    for (const r of rows) {
      const card = cardBy.get(Number(r.studentId ?? r.student_id));
      if (!card) continue;
      if (!isEditable(card.status)) {
        locked++;
        continue;
      }
      await card.update({
        attendance_present: Math.max(0, Number(r.present) || 0),
        attendance_absent: Math.max(0, Number(r.absent) || 0),
        attendance_late: Math.max(0, Number(r.late) || 0),
        attendance_excused: Math.max(0, Number(r.excused) || 0),
        attendance_source: "imported",
      });
      updated++;
    }
    res.status(200).json({
      success: true,
      message: `Attendance imported for ${updated} student${updated === 1 ? "" : "s"}${locked ? ` (${locked} past draft left unchanged)` : ""}`,
      data: { updated, locked, received: rows.length },
    });
  } catch (error) {
    sendControllerError(res, error, "importAttendance");
  }
};


// ─── GET /api/report-cycles/class-pdf ────────────────────────────────────────
// Every visible card of a class for a term in one PDF, in ranking order: a
// ranking cover, then one card per page. Approved/published cards print their
// frozen snapshot; the rest render live with the PROVISIONAL watermark.

export const getClassPdf = async (req: Request, res: Response) => {
  try {
    const classGroupId = Number(req.query.class_group_id);
    const term = String(req.query.term ?? "").trim();
    const year = String(req.query.academic_year ?? "").trim();
    if (!Number.isInteger(classGroupId) || classGroupId <= 0 || !term || !year) {
      return res.status(400).json({ success: false, message: "class_group_id, term and academic_year are required" });
    }
    const directory = await directoryFor(req);
    const group = directory.class_groups.find((g) => g.id === classGroupId);
    const roster = directory.rosters.get(classGroupId) ?? [];
    const visible = await filterCardStudents(req, roster, ["REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE", "REPORT_CARDS_COMMENT"], {
      minDepth: "detail",
    });
    const cards = visible.length ? await ReportCard.findAll({ where: { student_id: { [Op.in]: visible }, term, academic_year: year } }) : [];
    if (!cards.length) {
      return res.status(404).json({ success: false, message: "No report cards for this class and term yet. Open the class to create them." });
    }
    // Positions are within the whole class, whoever can see which card.
    const cohort = await ReportCard.findAll({ where: { class_group_id: classGroupId, term, academic_year: year } });
    const live = cards.filter((c) => !isFrozen(c.status));
    const docsLive = live.length ? await buildCardDocuments(req, live, { directory, cohort: cohort.length ? cohort : cards }) : new Map<number, ReportCardDocument>();
    const docs: ReportCardDocument[] = [];
    for (const c of cards) {
      const d = isFrozen(c.status) ? await frozenDocument(req, c) : docsLive.get(c.id!);
      if (d) docs.push(d);
    }
    const className = group?.name ?? cards.find((c) => c.class_name)?.class_name ?? `Class #${classGroupId}`;
    const pdf = await renderClassReportCardsPdf(docs, { class_name: className, term, academic_year: year }, { verificationBaseUrl: verificationBase() });
    const safe = (v: string) => v.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "class";
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ReportCards-${safe(className)}-${safe(term)}-${safe(year)}.pdf"`,
      "Content-Length": pdf.length,
      "Cache-Control": "no-store",
    });
    res.status(200).send(pdf);
  } catch (error) {
    sendControllerError(res, error, "getClassPdf");
  }
};
