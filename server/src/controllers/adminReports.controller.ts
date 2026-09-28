import { Request, Response } from "express";
import { Op, fn, col } from "sequelize";
import { z } from "zod";
import { ReportCard, SubjectAssessmentMapping, User } from "../models";
import { sendControllerError } from "../utils/controllerErrors";
import { resolveCurrentAcademicPeriodNames } from "../utils/misUtils";
import { loadMarkSources } from "../utils/markSources";
import { collectMarks, rankStudents, studentKey } from "../utils/overallRanking";
import { computeOverview } from "./instructorOverview.controller";
import {
  buildAdminInsights,
  buildStudentRows,
  buildSubjectRows,
  queryStudents,
  querySubjects,
  studentFacets,
  subjectFacets,
  STUDENT_SORTS,
  STUDENT_STATUSES,
  SUBJECT_SORTS,
  type AdminStudentRow,
  type AdminSubjectRow,
  type ReportCardStats,
  type SubjectRef,
} from "../services/adminReports.service";
import type { InstructorOverview } from "../services/instructorOverview.service";
import type { SchoolDirectory } from "../services/schoolDirectory";

// @route GET /api/dashboard/admin/subjects | students | insights
// @access DASHBOARD_VIEW_ADMIN, and a school-wide subject scope
//
// The admin reports are the teacher dashboard over every subject: one
// computeOverview() call (the teacher dashboard's loader, scope "all"), the
// Overall Ranking's mark scoring for student averages, and the MIS school
// directory for class groups, teachers and rosters. The whole bundle is
// cached briefly per caller and period, so paging, sorting and filtering
// only slice it. `?fresh=1` rebuilds it.

const TTL_MS = 60 * 1000;
const CACHE_MAX = 50;

interface AdminData {
  at: number;
  overview: InstructorOverview;
  directory: SchoolDirectory | null;
  subjects: SubjectRef[];
  subjectRows: AdminSubjectRow[];
  studentRows: AdminStudentRow[];
  reportCards: ReportCardStats;
}

const cache = new Map<string, AdminData>();

/** Test hook. */
export function clearAdminReportsCache() {
  cache.clear();
}

class NotSchoolWideError extends Error {}

async function periodNames(req: Request) {
  const term = (req.query.term as string) || null;
  const academicYear = (req.query.academic_year as string) || null;
  if (term || academicYear) return { term, academicYear };
  return resolveCurrentAcademicPeriodNames(req);
}

async function loadAdminData(req: Request, fresh: boolean): Promise<AdminData> {
  const names = await periodNames(req);
  const { scope, scoped, overview, directory, term_id } = await computeOverview(req, {
    fresh,
    includeAllStudents: true,
  });
  if (scope !== "all") throw new NotSchoolWideError("These reports need school-wide access");

  const key = [req.user?.id, term_id ?? "", names.term ?? "", names.academicYear ?? ""].join(":");
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit;

  const ids = scoped.map((s) => s.id);
  const subjects: SubjectRef[] = scoped.map((s) => ({ id: s.id, name: s.name, code: s.code }));

  // Report-card readiness for the period (both tables key on names).
  const periodWhere: Record<string, string> = {};
  if (names.term) periodWhere.term = names.term;
  if (names.academicYear) periodWhere.academic_year = names.academicYear;
  const [mappingRows, cardRows] = await Promise.all([
    ids.length
      ? SubjectAssessmentMapping.findAll({
          where: { subject_id: { [Op.in]: ids }, ...periodWhere },
          attributes: ["subject_id", [fn("COUNT", col("id")), "items"]],
          group: ["subject_id"],
          raw: true,
        })
      : [],
    ReportCard.findAll({
      where: periodWhere,
      attributes: ["status", [fn("COUNT", col("id")), "n"]],
      group: ["status"],
      raw: true,
    }),
  ]);
  const mapped = new Map<number, number>();
  for (const r of mappingRows as any[]) mapped.set(Number(r.subject_id), Number(r.items));
  const cards = { draft: 0, saved: 0, approved: 0, total: 0 };
  for (const r of cardRows as any[]) {
    const n = Number(r.n);
    if (r.status in cards) (cards as any)[r.status] += n;
    cards.total += n;
  }

  // Student averages: the Overall Ranking's scoring over every subject.
  const knownMisIds = (directory?.students ?? []).map((s) => s.mis_user_id);
  const sources = ids.length ? await loadMarkSources(req, ids, term_id, knownMisIds) : null;
  const marks = sources ? collectMarks(sources) : [];
  const ranked = rankStudents(marks, ids.map(String), "all");

  const rosterKeys = new Set(knownMisIds.map((id) => `m${id}`));
  const offRoster = ranked.map((r) => r.key).filter((k) => !rosterKeys.has(k));
  const localIds = offRoster.filter((k) => k.startsWith("l")).map((k) => Number(k.slice(1)));
  const misIds = offRoster.filter((k) => k.startsWith("m")).map((k) => Number(k.slice(1)));
  const fallbackUsers =
    localIds.length || misIds.length
      ? await User.findAll({
          where: {
            [Op.or]: [
              ...(localIds.length ? [{ id: { [Op.in]: localIds } }] : []),
              ...(misIds.length ? [{ mis_user_id: { [Op.in]: misIds } }] : []),
            ],
          },
          attributes: ["id", "mis_user_id", "first_name", "last_name"],
        })
      : [];
  const fallbackNames = new Map<string, { name: string; mis_user_id: number | null; local_id: number | null }>();
  for (const u of fallbackUsers) {
    const misId = u.mis_user_id ?? null;
    fallbackNames.set(studentKey(misId, u.id), {
      name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || `Student #${misId ?? u.id}`,
      mis_user_id: misId,
      local_id: u.id,
    });
  }

  const data: AdminData = {
    at: Date.now(),
    overview,
    directory,
    subjects,
    subjectRows: buildSubjectRows(overview.subjects, directory, mapped),
    studentRows: buildStudentRows({
      directory,
      subjects,
      ranked,
      overviewStudents: overview.students.all ?? [],
      fallbackNames,
    }),
    reportCards: { term: names.term, academic_year: names.academicYear, cards },
  };
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, data);
  return data;
}

const optionalInt = z.coerce.number().int().positive().optional();
const common = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  fresh: z.string().optional(),
};

export const adminSubjectsQuery = z.object({
  ...common,
  health: z.enum(["on_track", "watch", "at_risk", "no_data"]).optional(),
  programme: z.string().trim().max(120).optional(),
  classGroupId: optionalInt,
  teacherId: optionalInt,
  flag: z.enum(["unmapped", "no_work", "no_teacher", "grading_overdue"]).optional(),
  sort: z.enum(SUBJECT_SORTS).optional(),
});

export const adminStudentsQuery = z.object({
  ...common,
  classGroupId: optionalInt,
  subjectId: optionalInt,
  programme: z.string().trim().max(120).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  attention: z.enum(["1", "true", "0", "false"]).optional().transform((v) => v === "1" || v === "true"),
  gender: z.string().trim().max(10).optional(),
  sort: z.enum(STUDENT_SORTS).optional(),
});

function badQuery(res: Response, error: z.ZodError) {
  return res.status(400).json({
    success: false,
    message: "Invalid filters",
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });
}

function handle(res: Response, error: unknown, label: string) {
  if (error instanceof NotSchoolWideError) return res.status(403).json({ success: false, message: error.message });
  return sendControllerError(res, error, label);
}

export const getAdminSubjects = async (req: Request, res: Response) => {
  const parsed = adminSubjectsQuery.safeParse(req.query);
  if (!parsed.success) return badQuery(res, parsed.error);
  try {
    const q = parsed.data;
    const data = await loadAdminData(req, q.fresh === "1");
    const { page, health_counts } = querySubjects(data.subjectRows, q);
    return res.status(200).json({
      success: true,
      data: {
        ...page,
        health_counts,
        facets: subjectFacets(data.subjectRows),
        totals: data.overview.totals,
        rosters_available: data.overview.rosters_available,
        generated_at: data.overview.generated_at,
      },
    });
  } catch (error) {
    return handle(res, error, "getAdminSubjects");
  }
};

export const getAdminStudents = async (req: Request, res: Response) => {
  const parsed = adminStudentsQuery.safeParse(req.query);
  if (!parsed.success) return badQuery(res, parsed.error);
  try {
    const q = parsed.data;
    const data = await loadAdminData(req, q.fresh === "1");
    const { page, status_counts, summary } = queryStudents(data.studentRows, q);
    return res.status(200).json({
      success: true,
      data: {
        ...page,
        status_counts,
        summary,
        facets: studentFacets(data.studentRows, data.subjects),
        rosters_available: data.directory?.rosters_complete ?? false,
        generated_at: data.overview.generated_at,
      },
    });
  } catch (error) {
    return handle(res, error, "getAdminStudents");
  }
};

export const getAdminInsights = async (req: Request, res: Response) => {
  try {
    const data = await loadAdminData(req, req.query.fresh === "1");
    return res.status(200).json({
      success: true,
      data: buildAdminInsights({
        now: new Date(),
        overview: data.overview,
        subjectRows: data.subjectRows,
        studentRows: data.studentRows,
        directory: data.directory,
        reportCards: data.reportCards,
      }),
    });
  } catch (error) {
    return handle(res, error, "getAdminInsights");
  }
};
