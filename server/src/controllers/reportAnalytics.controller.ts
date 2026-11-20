import { Request, Response } from "express";
import axios from "axios";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardSnapshot } from "../models/ReportCardWorkflow.model";
import { computeCardGrades, resolveSubjectNames, type ReportCardDocument } from "../services/reportCardDocument";
import { frozenDocument } from "../services/reportCardSnapshot.service";
import { isFrozen } from "../services/reportCardWorkflow";
import { loadSchoolDirectory } from "../services/schoolDirectory";
import { getGradingBands, getReportCardScheme } from "../services/tenantSettings";
import { gradingOf } from "../services/reportCardBuilders";
import { computeSchoolAnalytics, normalizeGender, type AnalyticsRow } from "../services/reportAnalytics.service";
import { getMisToken, resolveAcademicYearId, resolveCurrentAcademicPeriodNames } from "../utils/misUtils";
import { filterCardStudents } from "../utils/reportCardAccess";
import { sendControllerError } from "../utils/controllerErrors";
import { tk } from "../tenancy/keys";

/**
 * GET /api/reports/school?term&academic_year[&class_group_id][&include_drafts=1][&fresh=1]
 *
 * The school reports hub: broadsheet, performance, gender, trends, at-risk.
 * Approved and published cards are read from their snapshots, so the
 * figures are the issued ones. Drafts of the selected term are added only
 * with include_drafts=1 (marked provisional). Trends span every term of the
 * year that has issued cards.
 *
 * Scope: aggregates over the students the caller may see at summary depth;
 * named lists (broadsheet, at-risk, improvement) only those at detail depth.
 */

const CACHE_MS = 2 * 60 * 1000;
const MAX_DRAFTS = 800;
const cache = new Map<string, { at: number; value: unknown }>();

/** Tests only. */
export function clearReportAnalyticsCache() {
  cache.clear();
}

async function termOrder(req: Request, year: string, terms: string[]): Promise<string[]> {
  const token = getMisToken(req, { quiet: true });
  const yearId = await resolveAcademicYearId(req).catch(() => null);
  if (token && yearId) {
    try {
      const r = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/terms`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { academic_year_id: yearId },
      });
      const names: string[] = (r.data?.data ?? []).map((t: any) => t.name).filter(Boolean);
      if (names.length) return [...names, ...terms.filter((t) => !names.includes(t))];
    } catch {
      /* fall back to natural order */
    }
  }
  return [...terms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export const getSchoolReports = async (req: Request, res: Response) => {
  try {
    let term = String(req.query.term ?? "").trim();
    let year = String(req.query.academic_year ?? "").trim();
    if (!term || !year) {
      const current = await resolveCurrentAcademicPeriodNames(req);
      term = term || current.term || "";
      year = year || current.academicYear || "";
    }
    if (!term || !year) return res.status(400).json({ success: false, message: "term and academic_year are required" });
    const classGroupId = req.query.class_group_id ? Number(req.query.class_group_id) : null;
    const includeDrafts = req.query.include_drafts === "1" || req.query.include_drafts === "true";

    const key = tk(`${(req as any).user?.id}|${term}|${year}|${classGroupId ?? ""}|${includeDrafts}`);
    const hit = cache.get(key);
    if (req.query.fresh !== "1" && hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.value);

    const [scheme, bands] = await Promise.all([getReportCardScheme(), getGradingBands()]);
    const yearId = await resolveAcademicYearId(req).catch(() => null);
    const directory = await loadSchoolDirectory(req, yearId ?? null).catch(() => null);
    const dirBy = new Map((directory?.students ?? []).map((s) => [s.mis_user_id, s]));
    const groupBy = new Map((directory?.class_groups ?? []).map((g) => [g.id, g]));

    const statusWhere = includeDrafts
      ? { [Op.or]: [{ status: { [Op.in]: ["approved", "published"] } }, { term, status: { [Op.in]: ["draft", "reviewed"] } }] }
      : { status: { [Op.in]: ["approved", "published"] } };
    let cards = await ReportCard.findAll({ where: { academic_year: year, ...statusWhere } as any });

    const ids = [...new Set(cards.map((c) => c.student_id))];
    const summarySet = new Set(await filterCardStudents(req, ids, ["REPORT_CARDS_VIEW_ALL"], { minDepth: "summary" }));
    const detailSet = new Set(await filterCardStudents(req, ids, ["REPORT_CARDS_VIEW_ALL"], { minDepth: "detail" }));
    cards = cards.filter((c) => summarySet.has(c.student_id));
    const classOf = (c: ReportCard) => c.class_group_id ?? dirBy.get(c.student_id)?.class_group_id ?? null;
    if (classGroupId) cards = cards.filter((c) => classOf(c) === classGroupId);

    // Frozen cards: their snapshots in one query (legacy cards get one made).
    const snaps = await ReportCardSnapshot.findAll({
      where: { report_card_id: { [Op.in]: cards.filter((c) => isFrozen(c.status)).map((c) => c.id!).concat(-1) }, superseded_at: { [Op.is]: null } as any },
    });
    const snapBy = new Map<number, ReportCardDocument>();
    for (const s of snaps.sort((a, b) => a.version - b.version)) snapBy.set(s.report_card_id, s.payload as ReportCardDocument);

    const rows: AnalyticsRow[] = [];
    let drafts = 0;
    let truncated = false;
    for (const c of cards) {
      let subjects: Record<number, number> = {};
      let docStudent: ReportCardDocument["student"] | null = null;
      if (isFrozen(c.status)) {
        const doc = snapBy.get(c.id!) ?? (await frozenDocument(req, c));
        if (!doc) continue;
        docStudent = doc.student;
        for (const g of doc.groups) for (const s of g.subjects) if (s.total != null) subjects[s.subject_id] = s.total;
      } else {
        if (drafts >= MAX_DRAFTS) {
          truncated = true;
          continue;
        }
        drafts++;
        const g = await computeCardGrades(c, gradingOf(scheme));
        subjects = Object.fromEntries(g.grades.map((x) => [x.subject_id, x.total_score]));
      }
      const totals = Object.values(subjects);
      const d = dirBy.get(c.student_id);
      const cg = classOf(c);
      const named = detailSet.has(c.student_id);
      rows.push({
        card_id: c.id!,
        student_id: c.student_id,
        name: named ? d?.name ?? docStudent?.name ?? `Student #${c.student_id}` : "—",
        registration_number: named ? d?.registration_number ?? docStudent?.registration_number ?? null : null,
        gender: normalizeGender(d?.gender ?? docStudent?.gender ?? null),
        class_group_id: cg,
        class_name: (cg != null ? groupBy.get(cg)?.name : null) ?? c.class_name ?? docStudent?.class_name ?? null,
        program_name: (cg != null ? groupBy.get(cg)?.program_name : null) ?? docStudent?.program_name ?? null,
        term: c.term,
        status: c.status,
        subjects,
        average: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100 : null,
        attendance: {
          present: c.attendance_present ?? 0,
          absent: c.attendance_absent ?? 0,
          late: c.attendance_late ?? 0,
          excused: c.attendance_excused ?? 0,
          sick: c.attendance_sick ?? 0,
        },
      });
    }

    const subjectIds = [...new Set(rows.flatMap((r) => Object.keys(r.subjects).map(Number)))];
    const names = await resolveSubjectNames(req, subjectIds);
    const order = await termOrder(req, year, [...new Set(rows.map((r) => r.term))]);
    const analytics = computeSchoolAnalytics(rows, { pass_mark: scheme.pass_mark, bands, subject_names: names, term, term_order: order });

    // Named lists: only students the caller may see by name.
    const namedIds = new Set(rows.filter((r) => detailSet.has(r.student_id)).map((r) => r.student_id));
    analytics.broadsheet.students = analytics.broadsheet.students.filter((s) => namedIds.has(s.student_id));
    analytics.at_risk = analytics.at_risk.filter((s) => namedIds.has(s.student_id));
    analytics.trends.improvement = analytics.trends.improvement.filter((s) => namedIds.has(s.student_id));

    const classes = (directory?.class_groups ?? [])
      .filter((g) => (directory?.rosters.get(g.id) ?? []).length > 0)
      .map((g) => ({ id: g.id, name: g.name, program_name: g.program_name }));
    const body = {
      success: true,
      data: {
        term,
        academic_year: year,
        class_group_id: classGroupId,
        basis: includeDrafts ? "issued_and_drafts" : "issued",
        provisional: includeDrafts && drafts > 0,
        drafts_included: drafts,
        truncated,
        pass_mark: scheme.pass_mark,
        bands,
        classes,
        ...analytics,
      },
    };
    cache.set(key, { at: Date.now(), value: body });
    res.status(200).json(body);
  } catch (error) {
    sendControllerError(res, error, "getSchoolReports");
  }
};
