import { Request } from "express";
import axios from "axios";
import { getMisToken } from "../utils/misUtils";

/**
 * The school as the MIS describes it for one academic year: class groups,
 * who teaches which subject to which class group, and every class group's
 * student roster. It is what a school-wide viewer needs to measure
 * participation and to list students, since the admin subject catalogue
 * (/academics/subjects) carries no rosters.
 *
 * Every call is one the admin token can make:
 *   /academics/class-groups                       (class groups + grade/programme)
 *   /academics/teacher-assignments?academic_year_id (subject x class group x teacher)
 *   /academics/class-groups/:id/students?academic_year_id (roster)
 *
 * Cached per (caller, year) for a few minutes: the MIS scopes class groups
 * to a programme lead's programmes, so two callers can see different schools.
 */

export interface DirectoryClassGroup {
  id: number;
  name: string;
  /** Absent when the MIS row didn't carry it. */
  grade_id?: number | null;
  grade_name: string | null;
  program_name: string | null;
}

export interface DirectoryStudent {
  mis_user_id: number;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  username: string | null;
  gender: string | null;
  registration_number: string | null;
  class_group_id: number;
}

export interface DirectoryTeacher {
  mis_user_id: number;
  name: string;
}

export interface SchoolDirectory {
  academic_year_id: number | null;
  class_groups: DirectoryClassGroup[];
  /** One row per student (a student in two class groups keeps the first). */
  students: DirectoryStudent[];
  /** False when any class-group roster failed to load. */
  rosters_complete: boolean;
  /** subject id -> class group ids it is taught to this year */
  subject_class_groups: Map<number, number[]>;
  /** subject id -> its teachers this year */
  subject_teachers: Map<number, DirectoryTeacher[]>;
  /** class group id -> subject ids taught to it this year */
  class_group_subjects: Map<number, number[]>;
  /** class group id -> student MIS ids */
  rosters: Map<number, number[]>;
  /** False when the teacher-assignment list failed to load. */
  assignments_available: boolean;
}

const TTL_MS = 5 * 60 * 1000;
const ROSTER_CONCURRENCY = 6;
const cache = new Map<string, { at: number; value: SchoolDirectory }>();

/** Test hook. */
export function clearSchoolDirectoryCache() {
  cache.clear();
}

export async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const fullName = (first?: string | null, last?: string | null, fallback?: string | null) =>
  [first, last].filter(Boolean).join(" ").trim() || fallback || "";

export async function loadSchoolDirectory(
  req: Request,
  yearId: number | null,
  opts: { fresh?: boolean } = {},
): Promise<SchoolDirectory> {
  const key = `${req.user?.id ?? "anon"}:${yearId ?? ""}`;
  const hit = cache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const token = getMisToken(req, { quiet: true });
  const empty: SchoolDirectory = {
    academic_year_id: yearId,
    class_groups: [],
    students: [],
    rosters_complete: false,
    subject_class_groups: new Map(),
    subject_teachers: new Map(),
    class_group_subjects: new Map(),
    rosters: new Map(),
    assignments_available: false,
  };
  if (!token) return empty;

  const base = process.env.NGA_MIS_BASE_URL;
  const headers = { Authorization: `Bearer ${token}` };
  const yearParams = yearId ? { academic_year_id: yearId } : {};

  const [groupsRes, assignmentsRes] = await Promise.all([
    axios.get(`${base}/academics/class-groups`, { headers }).catch((e) => {
      console.warn("schoolDirectory: class-groups failed:", e.message);
      return null;
    }),
    axios.get(`${base}/academics/teacher-assignments`, { headers, params: yearParams }).catch((e) => {
      console.warn("schoolDirectory: teacher-assignments failed:", e.message);
      return null;
    }),
  ]);

  const classGroups = new Map<number, DirectoryClassGroup>();
  for (const g of groupsRes?.data?.data ?? []) {
    const id = Number(g.class_group_id ?? g.id);
    if (!Number.isFinite(id)) continue;
    classGroups.set(id, {
      id,
      name: g.name ?? `Class ${id}`,
      grade_id: Number.isFinite(Number(g.grade_id)) && g.grade_id != null ? Number(g.grade_id) : null,
      grade_name: g.grade_name ?? null,
      program_name: g.program_name ?? null,
    });
  }

  const subjectGroups = new Map<number, Set<number>>();
  const subjectTeachers = new Map<number, Map<number, DirectoryTeacher>>();
  const groupSubjects = new Map<number, Set<number>>();
  for (const a of assignmentsRes?.data?.data ?? []) {
    // Without a year filter the list spans every year; keep the requested one.
    if (yearId != null && a.academic_year_id != null && Number(a.academic_year_id) !== yearId) continue;
    const sid = Number(a.subject_id);
    const cg = Number(a.class_group_id);
    if (!Number.isFinite(sid)) continue;
    if (Number.isFinite(cg)) {
      if (!subjectGroups.has(sid)) subjectGroups.set(sid, new Set());
      subjectGroups.get(sid)!.add(cg);
      if (!groupSubjects.has(cg)) groupSubjects.set(cg, new Set());
      groupSubjects.get(cg)!.add(sid);
      // Assignments can name a class group the caller's class-group list
      // lacks (e.g. outside a programme lead's programmes): keep a label.
      if (!classGroups.has(cg)) {
        classGroups.set(cg, {
          id: cg,
          name: a.class_group_name ?? `Class ${cg}`,
          grade_id: Number.isFinite(Number(a.grade_id)) && a.grade_id != null ? Number(a.grade_id) : null,
          grade_name: a.grade_name ?? null,
          program_name: a.program_name ?? null,
        });
      }
    }
    const tid = Number(a.user_id);
    if (Number.isFinite(tid)) {
      if (!subjectTeachers.has(sid)) subjectTeachers.set(sid, new Map());
      subjectTeachers.get(sid)!.set(tid, {
        mis_user_id: tid,
        name: String(a.teacher_name ?? "").trim() || a.teacher_username || `Teacher #${tid}`,
      });
    }
  }

  // Rosters: every class group the caller can see.
  const groupIds = [...classGroups.keys()];
  let rostersComplete = groupsRes != null;
  const rosterRows = await mapLimited(groupIds, ROSTER_CONCURRENCY, async (cg) => {
    try {
      const res = await axios.get(`${base}/academics/class-groups/${cg}/students`, { headers, params: yearParams });
      return res.data?.data ?? [];
    } catch (e: any) {
      console.warn(`schoolDirectory: roster for class group ${cg} failed:`, e.message);
      rostersComplete = false;
      return [];
    }
  });

  const students = new Map<number, DirectoryStudent>();
  const rosters = new Map<number, number[]>();
  groupIds.forEach((cg, i) => {
    const ids: number[] = [];
    for (const s of rosterRows[i]) {
      const id = Number(s.user_id);
      if (!Number.isFinite(id)) continue;
      ids.push(id);
      if (students.has(id)) continue;
      students.set(id, {
        mis_user_id: id,
        first_name: s.first_name ?? null,
        last_name: s.last_name ?? null,
        name: fullName(s.first_name, s.last_name, s.username) || `Student #${id}`,
        email: s.email ?? null,
        username: s.username ?? null,
        gender: s.gender ?? null,
        registration_number: s.registration_number ?? null,
        class_group_id: cg,
      });
    }
    rosters.set(cg, ids);
  });

  const value: SchoolDirectory = {
    academic_year_id: yearId,
    class_groups: [...classGroups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    students: [...students.values()].sort((a, b) => a.name.localeCompare(b.name)),
    rosters_complete: rostersComplete,
    subject_class_groups: new Map([...subjectGroups].map(([k, v]) => [k, [...v]])),
    subject_teachers: new Map(
      [...subjectTeachers].map(([k, v]) => [k, [...v.values()].sort((a, b) => a.name.localeCompare(b.name))]),
    ),
    class_group_subjects: new Map([...groupSubjects].map(([k, v]) => [k, [...v]])),
    rosters,
    assignments_available: assignmentsRes != null,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
