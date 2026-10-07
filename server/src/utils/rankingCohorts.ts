import { Request } from "express";
import axios from "axios";
import { getMisToken, resolveAcademicYearId } from "./misUtils";
import { loadSchoolDirectory, mapLimited } from "../services/schoolDirectory";
import type { ClassPlacement } from "./overallRanking";

// ─── Who is in which class, for the overall ranking ──────────────────────────
// utils/overallRanking is pure; this is where the class groups come from.
//
// Student: GET /academics/students/:id/class-group (their current placement)
// and GET /academics/class-groups/:id/students?academic_year_id (their
// classmates). Both need only a valid MIS session, so the student's own token
// can read them (subject rosters it cannot). The year is the placement's own,
// otherwise a class group's roster lists every past cohort of that label.
//
// Staff: an admin's school directory (every class group and roster, already
// cached for the admin reports), or a teacher's own class groups from
// my-assigned-subjects plus their rosters. A student in a subject the teacher
// shares with another teacher's class simply has no class group here.

const TTL_MS = 5 * 60 * 1000;
const ROSTER_CONCURRENCY = 5;

export interface StudentClassCohort {
  class_group_id: number;
  class_group_name: string;
  grade_id: number | null;
  grade_name: string | null;
  academic_year_id: number | null;
  /** Ranking keys ("m<mis id>") of everyone in the class group, the student included. */
  keys: Set<string>;
}

const studentCohorts = new Map<number, { at: number; value: StudentClassCohort }>();
const classRosters = new Map<string, { at: number; ids: number[] }>();

/** Test hook. */
export function clearRankingCohortCaches() {
  studentCohorts.clear();
  classRosters.clear();
}

const positive = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isInteger(n) && n > 0 ? n : null;
};

const misGet = (token: string, path: string, params: Record<string, unknown> = {}) =>
  axios.get(`${process.env.NGA_MIS_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

async function classRoster(token: string, classGroupId: number, yearId: number | null): Promise<number[]> {
  const key = `${classGroupId}:${yearId ?? ""}`;
  const hit = classRosters.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ids;
  const res = await misGet(token, `/academics/class-groups/${classGroupId}/students`, yearId ? { academic_year_id: yearId } : {});
  const ids = ((res.data?.data ?? []) as any[])
    .map((r) => positive(r?.user_id ?? r?.id))
    .filter((n): n is number => n !== null);
  classRosters.set(key, { at: Date.now(), ids });
  return ids;
}

/**
 * The student's current class group and everyone in it, or null when MIS
 * can't say (no token, no placement, MIS down). Callers then rank against the
 * subject cohort and must say so. Failures aren't cached.
 */
export async function loadStudentClassCohort(req: Request, misUserId: number | null): Promise<StudentClassCohort | null> {
  if (!misUserId) return null;
  const hit = studentCohorts.get(misUserId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const token = getMisToken(req, { quiet: true });
  if (!token) return null;
  try {
    const res = await misGet(token, `/academics/students/${misUserId}/class-group`);
    const p = res.data?.data;
    const classGroupId = positive(p?.class_group_id);
    if (!classGroupId) return null;
    const yearId = positive(p.academic_year_id);
    const ids = await classRoster(token, classGroupId, yearId);
    const value: StudentClassCohort = {
      class_group_id: classGroupId,
      class_group_name: p.class_group_name ?? `Class ${classGroupId}`,
      grade_id: positive(p.grade_id),
      grade_name: p.grade_name ?? null,
      academic_year_id: yearId,
      keys: new Set([...ids, misUserId].map((id) => `m${id}`)),
    };
    studentCohorts.set(misUserId, { at: Date.now(), value });
    return value;
  } catch (e: any) {
    console.warn(`rankingCohorts: class cohort for student ${misUserId} failed:`, e.message);
    return null;
  }
}

/**
 * Ranking key -> class group and grade for the staff leaderboard. Never
 * throws: what can't be loaded leaves those students without a class group.
 */
export async function loadStaffPlacements(
  req: Request,
  scope: "all" | "assigned",
  courseIds: number[],
  termId: number | null,
): Promise<Map<string, ClassPlacement>> {
  const out = new Map<string, ClassPlacement>();
  const token = getMisToken(req, { quiet: true });
  if (!token) return out;

  if (scope === "all") {
    try {
      const directory = await loadSchoolDirectory(req, await resolveAcademicYearId(req));
      const groups = new Map(directory.class_groups.map((g) => [g.id, g]));
      // A student in two class groups appears in both rosters; the directory
      // keeps the first, and so does this.
      for (const st of directory.students) {
        const g = groups.get(st.class_group_id);
        if (!g) continue;
        out.set(`m${st.mis_user_id}`, {
          class_group_id: g.id,
          class_group_name: g.name,
          grade_id: g.grade_id ?? null,
          grade_name: g.grade_name,
        });
      }
    } catch (e: any) {
      console.warn("rankingCohorts: school directory failed:", e.message);
    }
    return out;
  }

  // Teacher: the class groups they teach these subjects to.
  let assigned: any[] = [];
  try {
    const res = await misGet(token, "/academics/my-assigned-subjects", termId ? { academic_term_id: termId } : {});
    assigned = res.data?.data ?? [];
  } catch (e: any) {
    console.warn("rankingCohorts: my-assigned-subjects failed:", e.message);
    return out;
  }
  const wanted = new Set(courseIds);
  const groups = new Map<number, ClassPlacement & { yearId: number | null }>();
  for (const subject of assigned) {
    if (!wanted.has(Number(subject.subject_id ?? subject.id))) continue;
    for (const g of subject.grades ?? []) {
      const id = positive(g.class_group_id);
      if (!id || groups.has(id)) continue;
      groups.set(id, {
        class_group_id: id,
        class_group_name: g.class_group_name || `Class ${id}`,
        grade_id: positive(g.grade_id),
        grade_name: g.grade_name ?? null,
        yearId: positive(g.academic_year_id),
      });
    }
  }
  const list = [...groups.values()];
  const rosters = await mapLimited(list, ROSTER_CONCURRENCY, (g) =>
    classRoster(token, g.class_group_id, g.yearId).catch((e: any) => {
      console.warn(`rankingCohorts: roster for class group ${g.class_group_id} failed:`, e.message);
      return [] as number[];
    }),
  );
  list.forEach(({ yearId: _year, ...placement }, i) => {
    for (const id of rosters[i]) if (!out.has(`m${id}`)) out.set(`m${id}`, placement);
  });
  return out;
}
