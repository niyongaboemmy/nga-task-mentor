import type { SchoolDirectory, DirectoryClassGroup } from "./schoolDirectory";
import {
  PASS_MARK,
  GRADING_SLA_DAYS,
  type InstructorOverview,
  type SubjectSummary,
  type StudentSummary as OverviewStudent,
  type SubjectHealth,
  type DashboardAlert,
} from "./instructorOverview.service";
import {
  performanceStatus,
  type PerformanceStatus,
  type RankedStudent,
  type RankKind,
} from "../utils/overallRanking";

/**
 * Pure logic behind the admin reports (GET /api/dashboard/admin/{subjects,
 * students,insights}). The admin views are the teacher views over every
 * subject: the numbers come from the same overview builder
 * (instructorOverview.service) and the same mark scoring as the Overall
 * Ranking (utils/overallRanking), joined here with the MIS school directory
 * (class groups, teachers, rosters). No Sequelize or MIS calls, so every
 * number is unit-testable.
 */

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface Page<T> {
  rows: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export function paginate<T>(rows: T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.min(100, Math.floor(pageSize) || 20));
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return {
    rows: rows.slice((current - 1) * size, current * size),
    page: current,
    page_size: size,
    total: rows.length,
    total_pages: totalPages,
  };
}

/** Sort with nulls always last, whichever the direction. */
function compareNullable(a: number | string | null | undefined, b: number | string | null | undefined, dir: 1 | -1) {
  const an = a == null;
  const bn = b == null;
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b) * dir;
  return ((a as number) - (b as number)) * dir;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase();

// ─── Subjects ─────────────────────────────────────────────────────────────────

export interface SubjectRef {
  id: number;
  name: string;
  code: string | null;
}

export interface AdminSubjectRow extends SubjectSummary {
  teacher_list: Array<{ mis_user_id: number; name: string }>;
  class_group_list: DirectoryClassGroup[];
  programmes: string[];
  report_card: { mapped: boolean; mapped_items: number };
}

export function buildSubjectRows(
  subjects: SubjectSummary[],
  directory: SchoolDirectory | null,
  mappedItemsBySubject: Map<number, number>,
): AdminSubjectRow[] {
  const groupById = new Map((directory?.class_groups ?? []).map((g) => [g.id, g]));
  return subjects.map((s) => {
    const groups = (directory?.subject_class_groups.get(s.subject_id) ?? [])
      .map((id) => groupById.get(id))
      .filter((g): g is DirectoryClassGroup => !!g)
      .sort((a, b) => a.name.localeCompare(b.name));
    const items = mappedItemsBySubject.get(s.subject_id) ?? 0;
    return {
      ...s,
      teacher_list: directory?.subject_teachers.get(s.subject_id) ?? [],
      class_group_list: groups,
      programmes: [...new Set(groups.map((g) => g.program_name).filter((p): p is string => !!p))].sort(),
      report_card: { mapped: items > 0, mapped_items: items },
    };
  });
}

export const SUBJECT_SORTS = [
  "name",
  "health",
  "avg_score",
  "pass_rate",
  "participation",
  "pending",
  "overdue_pending",
  "at_risk",
  "students",
  "assessments",
  "last_activity",
] as const;
export type SubjectSort = (typeof SUBJECT_SORTS)[number];

export interface SubjectQuery {
  search?: string;
  health?: SubjectHealth;
  programme?: string;
  classGroupId?: number;
  teacherId?: number;
  /** "unmapped" = no report-card mapping yet; "no_work" = nothing published. */
  flag?: "unmapped" | "no_work" | "no_teacher" | "grading_overdue";
  sort?: SubjectSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const HEALTH_ORDER: Record<SubjectHealth, number> = { at_risk: 0, watch: 1, on_track: 2, no_data: 3 };

export function querySubjects(rows: AdminSubjectRow[], q: SubjectQuery) {
  const search = norm(q.search).trim();
  const matchesBase = (r: AdminSubjectRow) => {
    if (search) {
      const hay = [r.subject_name, r.subject_code, ...r.teacher_list.map((t) => t.name), ...r.class_groups].map(norm).join(" ");
      if (!hay.includes(search)) return false;
    }
    if (q.programme && !r.programmes.includes(q.programme)) return false;
    if (q.classGroupId != null && !r.class_group_list.some((g) => g.id === q.classGroupId)) return false;
    if (q.teacherId != null && !r.teacher_list.some((t) => t.mis_user_id === q.teacherId)) return false;
    if (q.flag === "unmapped" && r.report_card.mapped) return false;
    if (q.flag === "no_work" && r.published > 0) return false;
    if (q.flag === "no_teacher" && r.teacher_list.length > 0) return false;
    if (q.flag === "grading_overdue" && r.overdue_pending === 0) return false;
    return true;
  };
  const base = rows.filter(matchesBase);
  // Health counts ignore the health filter itself so the chips stay useful.
  const healthCounts: Record<SubjectHealth, number> = { at_risk: 0, watch: 0, on_track: 0, no_data: 0 };
  for (const r of base) healthCounts[r.health]++;
  const filtered = q.health ? base.filter((r) => r.health === q.health) : base;

  const dir: 1 | -1 = q.dir === "desc" ? -1 : 1;
  const sort = q.sort ?? "health";
  const key = (r: AdminSubjectRow): number | string | null => {
    switch (sort) {
      case "name":
        return r.subject_name;
      case "health":
        return HEALTH_ORDER[r.health];
      case "assessments":
        return r.assignments + r.quizzes;
      case "last_activity":
        return r.last_activity_at;
      default:
        return r[sort] as number | null;
    }
  };
  const sorted = [...filtered].sort(
    (a, b) => compareNullable(key(a), key(b), dir) || a.subject_name.localeCompare(b.subject_name),
  );
  return { page: paginate(sorted, q.page ?? 1, q.pageSize ?? 20), health_counts: healthCounts };
}

export function subjectFacets(rows: AdminSubjectRow[]) {
  const programmes = new Set<string>();
  const groups = new Map<number, DirectoryClassGroup>();
  const teachers = new Map<number, string>();
  for (const r of rows) {
    r.programmes.forEach((p) => programmes.add(p));
    r.class_group_list.forEach((g) => groups.set(g.id, g));
    r.teacher_list.forEach((t) => teachers.set(t.mis_user_id, t.name));
  }
  return {
    programmes: [...programmes].sort(),
    class_groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    teachers: [...teachers].map(([id, name]) => ({ mis_user_id: id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ─── Students ─────────────────────────────────────────────────────────────────

export interface AdminStudentRow {
  key: string;
  mis_user_id: number | null;
  local_id: number | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  username: string | null;
  gender: string | null;
  registration_number: string | null;
  class_group: DirectoryClassGroup | null;
  subjects: SubjectRef[];
  /** Mean of subject averages over assignments, quizzes and recorded marks. */
  average: number | null;
  rank: number | null;
  ranked_of: number;
  status: PerformanceStatus;
  marked_items: number;
  subjects_marked: number;
  by_kind: Partial<Record<RankKind, number>>;
  subject_scores: Array<SubjectRef & { score: number }>;
  weakest: (SubjectRef & { score: number }) | null;
  /** Closed online work never turned in. */
  missing: number;
  reasons: string[];
}

export function buildStudentRows(input: {
  directory: SchoolDirectory | null;
  subjects: SubjectRef[];
  ranked: RankedStudent[];
  overviewStudents: OverviewStudent[];
  /** Names for students with marks but no MIS roster row (local accounts). */
  fallbackNames: Map<string, { name: string; mis_user_id: number | null; local_id: number | null }>;
}): AdminStudentRow[] {
  const { directory } = input;
  const subjectById = new Map(input.subjects.map((s) => [String(s.id), s]));
  const inScope = new Set(input.subjects.map((s) => s.id));
  const groupById = new Map((directory?.class_groups ?? []).map((g) => [g.id, g]));
  const rankedByKey = new Map(input.ranked.map((r) => [r.key, r]));
  const overviewByMis = new Map<number, OverviewStudent>();
  const overviewByLocal = new Map<number, OverviewStudent>();
  for (const s of input.overviewStudents) {
    if (s.mis_user_id != null) overviewByMis.set(s.mis_user_id, s);
    else if (s.local_id != null) overviewByLocal.set(s.local_id, s);
  }
  const rankedOf = input.ranked.length;

  const toRow = (base: {
    key: string;
    mis_user_id: number | null;
    local_id: number | null;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    username?: string | null;
    gender?: string | null;
    registration_number?: string | null;
    class_group_id: number | null;
  }): AdminStudentRow => {
    const ranked = rankedByKey.get(base.key);
    const ov = base.mis_user_id != null ? overviewByMis.get(base.mis_user_id) : base.local_id != null ? overviewByLocal.get(base.local_id) : undefined;
    const group = base.class_group_id != null ? groupById.get(base.class_group_id) ?? null : null;
    const taught = base.class_group_id != null ? directory?.class_group_subjects.get(base.class_group_id) ?? [] : [];
    const subjectIds = new Set<number>(taught.filter((id) => inScope.has(id)));
    for (const id of Object.keys(ranked?.subjects ?? {})) subjectIds.add(Number(id));
    const subjects = [...subjectIds]
      .map((id) => subjectById.get(String(id)))
      .filter((s): s is SubjectRef => !!s)
      .sort((a, b) => a.name.localeCompare(b.name));

    const subjectScores = Object.entries(ranked?.subjects ?? {})
      .map(([id, r]) => {
        const s = subjectById.get(id);
        return s ? { ...s, score: r.score } : null;
      })
      .filter((s): s is SubjectRef & { score: number } => !!s)
      .sort((a, b) => a.score - b.score);

    const byKind: Partial<Record<RankKind, number>> = {};
    if (ranked) {
      const acc: Partial<Record<RankKind, [number, number]>> = {};
      for (const s of Object.values(ranked.subjects)) {
        for (const [k, v] of Object.entries(s.by_kind) as Array<[RankKind, { score: number; count: number }]>) {
          const t = (acc[k] ??= [0, 0]);
          t[0] += v.score * v.count;
          t[1] += v.count;
        }
      }
      for (const [k, [s, c]] of Object.entries(acc) as Array<[RankKind, [number, number]]>) byKind[k] = round1(s / c);
    }

    const average = ranked ? ranked.score : null;
    const missing = ov?.missing ?? 0;
    const reasons: string[] = [];
    if (average != null && average < PASS_MARK) reasons.push(`Average ${average}%`);
    const failing = subjectScores.filter((s) => s.score < PASS_MARK);
    if (failing.length > 0 && (average == null || average >= PASS_MARK)) {
      reasons.push(`Below ${PASS_MARK}% in ${failing.map((s) => s.code || s.name).join(", ")}`);
    }
    if (missing >= 2) reasons.push(`${missing} missing submissions`);

    return {
      key: base.key,
      mis_user_id: base.mis_user_id,
      local_id: base.local_id ?? ov?.local_id ?? null,
      name: base.name,
      first_name: base.first_name ?? null,
      last_name: base.last_name ?? null,
      email: base.email ?? null,
      username: base.username ?? null,
      gender: base.gender ?? null,
      registration_number: base.registration_number ?? null,
      class_group: group,
      subjects,
      average,
      rank: ranked?.rank ?? null,
      ranked_of: rankedOf,
      status: performanceStatus(average),
      marked_items: ranked?.marked_items ?? 0,
      subjects_marked: Object.keys(ranked?.subjects ?? {}).length,
      by_kind: byKind,
      subject_scores: subjectScores,
      weakest: subjectScores[0] ?? null,
      missing,
      reasons,
    };
  };

  const rows: AdminStudentRow[] = [];
  const seen = new Set<string>();
  for (const st of directory?.students ?? []) {
    const key = `m${st.mis_user_id}`;
    seen.add(key);
    rows.push(
      toRow({
        key,
        mis_user_id: st.mis_user_id,
        local_id: null,
        name: st.name,
        first_name: st.first_name,
        last_name: st.last_name,
        email: st.email,
        username: st.username,
        gender: st.gender,
        registration_number: st.registration_number,
        class_group_id: st.class_group_id,
      }),
    );
  }
  // Marked students the roster doesn't know (left the class, local accounts).
  for (const r of input.ranked) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    const f = input.fallbackNames.get(r.key);
    const misId = r.key.startsWith("m") ? Number(r.key.slice(1)) : f?.mis_user_id ?? null;
    const localId = r.key.startsWith("l") ? Number(r.key.slice(1)) : f?.local_id ?? null;
    rows.push(
      toRow({
        key: r.key,
        mis_user_id: misId,
        local_id: localId,
        name: f?.name ?? (misId != null ? `Student #${misId}` : `Student #${localId}`),
        class_group_id: null,
      }),
    );
  }
  return rows;
}

export const STUDENT_STATUSES = ["excelling", "on_track", "needs_attention", "at_risk", "no_marks"] as const;
export const STUDENT_SORTS = ["name", "average", "rank", "missing", "class_group", "marked_items"] as const;
export type StudentSort = (typeof STUDENT_SORTS)[number];

export interface StudentQuery {
  search?: string;
  classGroupId?: number;
  programme?: string;
  subjectId?: number;
  status?: PerformanceStatus;
  /** Students needing support: below the pass mark or with 2+ missing. */
  attention?: boolean;
  gender?: string;
  sort?: StudentSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function queryStudents(rows: AdminStudentRow[], q: StudentQuery) {
  const search = norm(q.search).trim();
  const base = rows.filter((r) => {
    if (search) {
      const hay = [r.name, r.email, r.username, r.registration_number, r.class_group?.name, String(r.mis_user_id ?? "")]
        .map(norm)
        .join(" ");
      if (!hay.includes(search)) return false;
    }
    if (q.classGroupId != null && r.class_group?.id !== q.classGroupId) return false;
    if (q.programme && r.class_group?.program_name !== q.programme) return false;
    if (q.subjectId != null && !r.subjects.some((s) => s.id === q.subjectId)) return false;
    if (q.gender && norm(r.gender).charAt(0) !== norm(q.gender).charAt(0)) return false;
    if (q.attention && r.reasons.length === 0) return false;
    return true;
  });
  const statusCounts: Record<PerformanceStatus, number> = {
    excelling: 0,
    on_track: 0,
    needs_attention: 0,
    at_risk: 0,
    no_marks: 0,
  };
  for (const r of base) statusCounts[r.status]++;
  const filtered = q.status ? base.filter((r) => r.status === q.status) : base;

  const dir: 1 | -1 = q.dir === "desc" ? -1 : 1;
  const sort = q.sort ?? "name";
  const key = (r: AdminStudentRow): number | string | null => {
    switch (sort) {
      case "name":
        return r.name;
      case "class_group":
        return r.class_group?.name ?? null;
      default:
        return r[sort];
    }
  };
  const sorted = [...filtered].sort((a, b) => compareNullable(key(a), key(b), dir) || a.name.localeCompare(b.name));
  const averages = base.map((r) => r.average).filter((x): x is number => x != null);
  return {
    page: paginate(sorted, q.page ?? 1, q.pageSize ?? 25),
    status_counts: statusCounts,
    summary: {
      students: base.length,
      with_marks: averages.length,
      average: averages.length ? round1(mean(averages)!) : null,
      needing_support: base.filter((r) => r.reasons.length > 0).length,
      missing_work: base.reduce((n, r) => n + r.missing, 0),
    },
  };
}

export function studentFacets(rows: AdminStudentRow[], subjects: SubjectRef[]) {
  const groups = new Map<number, DirectoryClassGroup & { students: number }>();
  const programmes = new Set<string>();
  for (const r of rows) {
    if (r.class_group) {
      const g = groups.get(r.class_group.id) ?? { ...r.class_group, students: 0 };
      g.students++;
      groups.set(g.id, g);
      if (r.class_group.program_name) programmes.add(r.class_group.program_name);
    }
  }
  return {
    class_groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    programmes: [...programmes].sort(),
    subjects: [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    unassigned: rows.filter((r) => !r.class_group).length,
  };
}

// ─── School insights ──────────────────────────────────────────────────────────

export type TeacherStatus = "active" | "behind" | "inactive";

export interface TeacherRow {
  mis_user_id: number;
  name: string;
  subjects: SubjectRef[];
  class_groups: number;
  assessments: number;
  published: number;
  drafts: number;
  submissions: number;
  pending: number;
  overdue_pending: number;
  avg_score: number | null;
  participation: number | null;
  at_risk_subjects: number;
  unmapped_subjects: number;
  last_activity_at: string | null;
  status: TeacherStatus;
  flags: string[];
}

export interface ClassGroupRow extends DirectoryClassGroup {
  students: number;
  with_marks: number;
  average: number | null;
  pass_rate: number | null;
  at_risk: number;
  excelling: number;
  missing: number;
  subjects: number;
}

export interface ProgrammeRow {
  name: string;
  class_groups: number;
  students: number;
  with_marks: number;
  average: number | null;
  at_risk: number;
}

export interface ReportCardStats {
  term: string | null;
  academic_year: string | null;
  cards: { draft: number; saved: number; approved: number; total: number };
}

export interface AdminInsights {
  generated_at: string;
  rosters_available: boolean;
  school: {
    subjects: number;
    subjects_with_work: number;
    class_groups: number;
    teachers: number;
    students: number;
    students_with_marks: number;
    average: number | null;
    pass_rate: number | null;
    needing_support: number;
    excelling: number;
    report_cards_mapped: number;
    report_cards_approved: number;
  };
  teachers: TeacherRow[];
  class_groups: ClassGroupRow[];
  programmes: ProgrammeRow[];
  coverage: {
    no_published_work: Array<SubjectRef & { teachers: string[] }>;
    no_teacher: SubjectRef[];
    unmapped: Array<SubjectRef & { teachers: string[]; published: number }>;
    students_without_marks: number;
  };
  report_cards: ReportCardStats & { subjects_mapped: number; subjects_total: number };
  decisions: DashboardAlert[];
}

export function buildAdminInsights(input: {
  now: Date;
  overview: InstructorOverview;
  subjectRows: AdminSubjectRow[];
  studentRows: AdminStudentRow[];
  directory: SchoolDirectory | null;
  reportCards: ReportCardStats;
}): AdminInsights {
  const { subjectRows, studentRows, directory, overview } = input;

  // ── Teachers: aggregate over the subjects each one teaches ──
  const byTeacher = new Map<number, { name: string; rows: AdminSubjectRow[] }>();
  for (const r of subjectRows) {
    for (const t of r.teacher_list) {
      const e = byTeacher.get(t.mis_user_id) ?? { name: t.name, rows: [] };
      e.rows.push(r);
      byTeacher.set(t.mis_user_id, e);
    }
  }
  const teacherGroups = new Map<number, Set<number>>();
  // Class groups per teacher only where they teach (teacher x subject x group
  // isn't in the directory, so count the groups of their subjects).
  for (const [tid, e] of byTeacher) {
    const set = new Set<number>();
    for (const r of e.rows) r.class_group_list.forEach((g) => set.add(g.id));
    teacherGroups.set(tid, set);
  }
  const teachers: TeacherRow[] = [...byTeacher].map(([tid, e]) => {
    const rows = e.rows;
    const sum = (f: (r: AdminSubjectRow) => number) => rows.reduce((n, r) => n + f(r), 0);
    const avgs = rows.map((r) => r.avg_score).filter((x): x is number => x != null);
    const parts = rows.map((r) => r.participation).filter((x): x is number => x != null);
    const last = rows.map((r) => r.last_activity_at).filter((x): x is string => !!x).sort().pop() ?? null;
    const published = sum((r) => r.published);
    const overdue = sum((r) => r.overdue_pending);
    const atRisk = rows.filter((r) => r.health === "at_risk").length;
    const unmapped = rows.filter((r) => !r.report_card.mapped).length;
    const flags: string[] = [];
    if (published === 0) flags.push("No published work this term");
    if (overdue > 0) flags.push(`${overdue} submission${overdue === 1 ? "" : "s"} waiting over ${GRADING_SLA_DAYS} days`);
    if (atRisk > 0) flags.push(`${atRisk} subject${atRisk === 1 ? "" : "s"} at risk`);
    if (unmapped > 0) flags.push(`${unmapped} subject${unmapped === 1 ? "" : "s"} not mapped to the report card`);
    const status: TeacherStatus = published === 0 ? "inactive" : overdue > 0 || atRisk > 0 ? "behind" : "active";
    return {
      mis_user_id: tid,
      name: e.name,
      subjects: rows.map((r) => ({ id: r.subject_id, name: r.subject_name, code: r.subject_code })),
      class_groups: teacherGroups.get(tid)?.size ?? 0,
      assessments: sum((r) => r.assignments + r.quizzes),
      published,
      drafts: sum((r) => r.drafts),
      submissions: sum((r) => r.submissions),
      pending: sum((r) => r.pending),
      overdue_pending: overdue,
      avg_score: avgs.length ? round1(mean(avgs)!) : null,
      participation: parts.length ? round1(mean(parts)!) : null,
      at_risk_subjects: atRisk,
      unmapped_subjects: unmapped,
      last_activity_at: last,
      status,
      flags,
    };
  });
  const TEACHER_ORDER: Record<TeacherStatus, number> = { inactive: 0, behind: 1, active: 2 };
  teachers.sort(
    (a, b) => TEACHER_ORDER[a.status] - TEACHER_ORDER[b.status] || b.overdue_pending - a.overdue_pending || a.name.localeCompare(b.name),
  );

  // ── Class groups & programmes, from the students' mark-based averages ──
  const groupRows = new Map<number, ClassGroupRow>();
  for (const g of directory?.class_groups ?? []) {
    groupRows.set(g.id, {
      ...g,
      students: 0,
      with_marks: 0,
      average: null,
      pass_rate: null,
      at_risk: 0,
      excelling: 0,
      missing: 0,
      subjects: (directory?.class_group_subjects.get(g.id) ?? []).length,
    });
  }
  const groupScores = new Map<number, number[]>();
  for (const s of studentRows) {
    if (!s.class_group) continue;
    const row = groupRows.get(s.class_group.id);
    if (!row) continue;
    row.students++;
    row.missing += s.missing;
    if (s.reasons.length > 0) row.at_risk++;
    if (s.status === "excelling") row.excelling++;
    if (s.average != null) {
      row.with_marks++;
      const list = groupScores.get(row.id) ?? [];
      list.push(s.average);
      groupScores.set(row.id, list);
    }
  }
  for (const row of groupRows.values()) {
    const xs = groupScores.get(row.id) ?? [];
    row.average = xs.length ? round1(mean(xs)!) : null;
    row.pass_rate = xs.length ? round1((xs.filter((x) => x >= PASS_MARK).length / xs.length) * 100) : null;
  }
  const class_groups = [...groupRows.values()]
    .filter((g) => g.students > 0 || g.subjects > 0)
    .sort((a, b) => compareNullable(a.average, b.average, 1) || a.name.localeCompare(b.name));

  const progMap = new Map<string, { groups: Set<number>; students: number; scores: number[]; at_risk: number }>();
  for (const g of class_groups) {
    const name = g.program_name ?? "Other";
    const p = progMap.get(name) ?? { groups: new Set<number>(), students: 0, scores: [], at_risk: 0 };
    p.groups.add(g.id);
    p.students += g.students;
    p.at_risk += g.at_risk;
    p.scores.push(...(groupScores.get(g.id) ?? []));
    progMap.set(name, p);
  }
  const programmes: ProgrammeRow[] = [...progMap]
    .map(([name, p]) => ({
      name,
      class_groups: p.groups.size,
      students: p.students,
      with_marks: p.scores.length,
      average: p.scores.length ? round1(mean(p.scores)!) : null,
      at_risk: p.at_risk,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Coverage ──
  const ref = (r: AdminSubjectRow): SubjectRef => ({ id: r.subject_id, name: r.subject_name, code: r.subject_code });
  const teacherNames = (r: AdminSubjectRow) => r.teacher_list.map((t) => t.name);
  const no_published_work = subjectRows
    .filter((r) => r.published === 0 && r.teacher_list.length > 0)
    .map((r) => ({ ...ref(r), teachers: teacherNames(r) }));
  const no_teacher = directory?.assignments_available ? subjectRows.filter((r) => r.teacher_list.length === 0).map(ref) : [];
  const unmapped = subjectRows
    .filter((r) => !r.report_card.mapped && r.teacher_list.length > 0)
    .map((r) => ({ ...ref(r), teachers: teacherNames(r), published: r.published }))
    .sort((a, b) => b.published - a.published || a.name.localeCompare(b.name));
  const withMarks = studentRows.filter((s) => s.average != null);
  const averages = withMarks.map((s) => s.average!);

  const mappedCount = subjectRows.filter((r) => r.report_card.mapped).length;
  const taughtCount = subjectRows.filter((r) => r.teacher_list.length > 0).length;

  // ── Decisions: the few things an admin should act on first ──
  const decisions: DashboardAlert[] = [];
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const inactive = teachers.filter((t) => t.status === "inactive");
  if (inactive.length > 0) {
    decisions.push({
      id: "admin-teachers-inactive",
      severity: inactive.length >= Math.max(3, teachers.length / 4) ? "critical" : "warning",
      title: `${plural(inactive.length, "teacher")} with no published work`,
      message: `${inactive.slice(0, 4).map((t) => t.name).join(", ")}${inactive.length > 4 ? ` and ${inactive.length - 4} more` : ""} have nothing published for their subjects this term.`,
      subject_id: null,
      action: { label: "See teachers", url: "#teachers" },
    });
  }
  const overdueTeachers = teachers.filter((t) => t.overdue_pending > 0);
  if (overdueTeachers.length > 0) {
    const total = overdueTeachers.reduce((n, t) => n + t.overdue_pending, 0);
    decisions.push({
      id: "admin-grading-overdue",
      severity: "critical",
      title: `${plural(total, "submission")} waiting over ${GRADING_SLA_DAYS} days for a grade`,
      message: `Across ${plural(overdueTeachers.length, "teacher")}; most with ${[...overdueTeachers].sort((a, b) => b.overdue_pending - a.overdue_pending)[0].name}.`,
      subject_id: null,
      action: { label: "Review subjects", url: "/courses?flag=grading_overdue" },
    });
  }
  if (unmapped.length > 0) {
    decisions.push({
      id: "admin-report-cards-unmapped",
      severity: unmapped.length > taughtCount / 2 ? "warning" : "info",
      title: `${plural(unmapped.length, "subject")} not yet mapped to the report card`,
      message: `Report cards can't include these subjects until a teacher maps their assessments to CW/HW/MD/EOT.`,
      subject_id: null,
      action: { label: "See subjects", url: "/courses?flag=unmapped" },
    });
  }
  const weakGroups = class_groups.filter((g) => g.average != null && g.average < PASS_MARK && g.with_marks >= 3);
  if (weakGroups.length > 0) {
    decisions.push({
      id: "admin-class-groups-low",
      severity: "warning",
      title: `${plural(weakGroups.length, "class")} averaging below ${PASS_MARK}%`,
      message: weakGroups.slice(0, 4).map((g) => `${g.name} (${g.average}%)`).join(", "),
      subject_id: null,
      action: { label: "See classes", url: "#classes" },
    });
  }
  const support = studentRows.filter((s) => s.reasons.length > 0).length;
  if (support > 0) {
    decisions.push({
      id: "admin-students-support",
      severity: support >= Math.max(10, studentRows.length / 5) ? "warning" : "info",
      title: `${plural(support, "student")} need${support === 1 ? "s" : ""} support`,
      message: `Below ${PASS_MARK}% or with 2+ missing submissions.`,
      subject_id: null,
      action: { label: "Open list", url: "/students?attention=1" },
    });
  }
  if (no_teacher.length > 0) {
    decisions.push({
      id: "admin-subjects-no-teacher",
      severity: "info",
      title: `${plural(no_teacher.length, "subject")} with no teacher assigned`,
      message: "No MIS teacher assignment for this academic year.",
      subject_id: null,
      action: { label: "See subjects", url: "/courses?flag=no_teacher" },
    });
  }
  return {
    generated_at: input.now.toISOString(),
    rosters_available: overview.rosters_available,
    school: {
      subjects: subjectRows.length,
      subjects_with_work: subjectRows.filter((r) => r.published > 0).length,
      class_groups: class_groups.length,
      teachers: teachers.length,
      students: studentRows.length,
      students_with_marks: withMarks.length,
      average: averages.length ? round1(mean(averages)!) : null,
      pass_rate: averages.length ? round1((averages.filter((x) => x >= PASS_MARK).length / averages.length) * 100) : null,
      needing_support: support,
      excelling: studentRows.filter((s) => s.status === "excelling").length,
      report_cards_mapped: mappedCount,
      report_cards_approved: input.reportCards.cards.approved,
    },
    teachers,
    class_groups,
    programmes,
    coverage: {
      no_published_work,
      no_teacher,
      unmapped,
      students_without_marks: studentRows.length - withMarks.length,
    },
    report_cards: { ...input.reportCards, subjects_mapped: mappedCount, subjects_total: subjectRows.length },
    decisions,
  };
}
