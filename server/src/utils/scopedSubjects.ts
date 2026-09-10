import { Request } from "express";
import axios from "axios";
import { getMisToken, resolveAcademicTermId, resolveAcademicYearId } from "./misUtils";

/**
 * A subject (MIS "subject" = this app's "course") the requester is allowed to
 * see, flattened to a single shape regardless of which MIS endpoint served it.
 */
export interface ScopedSubject {
  id: number;
  name: string;
  code: string | null;
}

export type SubjectScope = "all" | "assigned" | "enrolled" | "none";

/**
 * Which set of subjects a request may see, decided purely from the resolved
 * permission set (never the deprecated flat role string):
 *   - `all`      — school-wide admins (ASSIGNMENTS_MANAGE_ANY / USERS_EDIT)
 *   - `assigned` — instructors (ASSIGNMENTS_VIEW_SUBMISSIONS)
 *   - `enrolled` — students (fallback)
 *   - `none`     — authenticated but with no assignment visibility at all
 */
export function getSubjectScope(req: Request): SubjectScope {
  const perms: Set<string> = req.user?.permissions ?? new Set();
  if (perms.has("ASSIGNMENTS_MANAGE_ANY") || perms.has("USERS_EDIT")) return "all";
  if (perms.has("ASSIGNMENTS_VIEW_SUBMISSIONS")) return "assigned";
  if (perms.has("ASSIGNMENTS_VIEW") || perms.has("SUBMISSIONS_CREATE")) return "enrolled";
  return "none";
}

function flattenSubject(raw: any): ScopedSubject | null {
  const id = Number(raw?.id ?? raw?.subject_id);
  if (isNaN(id) || id <= 0) return null;
  return {
    id,
    name: raw?.name ?? raw?.subject_name ?? raw?.title ?? `Subject #${id}`,
    code: raw?.code ?? raw?.subject_code ?? null,
  };
}

function dedupeById(subjects: ScopedSubject[]): ScopedSubject[] {
  const map = new Map<number, ScopedSubject>();
  for (const s of subjects) if (!map.has(s.id)) map.set(s.id, s);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The subjects the caller may see, resolved from MIS per their scope.
 * Returns `{ scope, subjects }`. On any MIS failure `subjects` is `[]` — callers
 * should treat that as "show nothing" for the scoped roles rather than falling
 * back to an unscoped list (which would leak other teachers'/students' data).
 */
export async function getScopedSubjects(
  req: Request,
): Promise<{ scope: SubjectScope; subjects: ScopedSubject[] }> {
  const scope = getSubjectScope(req);
  if (scope === "none") return { scope, subjects: [] };

  const token = getMisToken(req);
  if (!token) return { scope, subjects: [] };

  const base = process.env.NGA_MIS_BASE_URL;
  const headers = { Authorization: `Bearer ${token}` };

  try {
    if (scope === "all") {
      const res = await axios.get(`${base}/academics/subjects`, {
        headers,
        params: { limit: 500 },
      });
      const rows: any[] = res.data?.data ?? [];
      return {
        scope,
        subjects: dedupeById(rows.map(flattenSubject).filter(Boolean) as ScopedSubject[]),
      };
    }

    if (scope === "assigned") {
      const termId = await resolveAcademicTermId(req);
      const res = await axios.get(`${base}/academics/my-assigned-subjects`, {
        headers,
        params: termId ? { academic_term_id: termId } : {},
      });
      const rows: any[] = res.data?.data ?? [];
      return {
        scope,
        subjects: dedupeById(rows.map(flattenSubject).filter(Boolean) as ScopedSubject[]),
      };
    }

    // scope === "enrolled"
    const misUserId = req.user?.mis_user_id;
    if (!misUserId) return { scope, subjects: [] };
    const yearId = await resolveAcademicYearId(req);
    const res = await axios.get(
      `${base}/academics/students/${misUserId}/enrolled-subjects`,
      { headers, params: yearId ? { academic_year_id: yearId } : {} },
    );
    const rows: any[] = res.data?.data ?? [];
    return {
      scope,
      subjects: dedupeById(rows.map(flattenSubject).filter(Boolean) as ScopedSubject[]),
    };
  } catch (error: any) {
    console.warn(
      `getScopedSubjects: MIS fetch failed for scope '${scope}':`,
      error.message,
    );
    return { scope, subjects: [] };
  }
}
