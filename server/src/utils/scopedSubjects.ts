import { Request } from "express";
import axios from "axios";
import { getMisToken, resolveAcademicTermId, resolveAcademicYearId } from "./misUtils";
import { AccessSnapshot, scopeFor, ScopeEntry } from "../vendor/nga-access";
import { accessMode } from "../access/mode";
import { recordShadowDiff, requestSnapshot, routeOf, runInBackground } from "../access/policy";

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
  const mode = accessMode();
  if (mode === "enforce") return getV2ScopedSubjects(req);
  const legacy = await getLegacyScopedSubjects(req);
  if (mode === "shadow") shadowCompareSubjects(req, legacy);
  return legacy;
}

async function getLegacyScopedSubjects(
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

// ─── Access control v2 ───────────────────────────────────────────────────────
// Course ids are MIS subject ids, so the v2 subject set is read straight off
// the snapshot: the union of where the user may manage assignments
// (ASSIGNMENTS_MANAGE_ANY), see submissions (ASSIGNMENTS_VIEW_SUBMISSIONS
// @detail) or view courses (COURSES_VIEW @detail). `all` anywhere -> every
// subject; subject / (subject, class) scopes -> those subjects; a holder of
// only SELF-scoped course access (a student) -> their MIS enrolment, exactly
// as before; nothing -> none.

export interface V2SubjectScope {
  scope: SubjectScope;
  /** subject ids for scope "assigned" */
  ids: number[];
}

const V2_SCOPE_CAPS: Array<[string, "detail" | null]> = [
  ["ASSIGNMENTS_MANAGE_ANY", null],
  ["ASSIGNMENTS_VIEW_SUBMISSIONS", "detail"],
  ["COURSES_VIEW", "detail"],
];
const V2_ENROLLED_CAPS = ["COURSES_VIEW", "ASSIGNMENTS_VIEW", "SUBMISSIONS_CREATE"];

export function v2SubjectScope(snap: AccessSnapshot | null): V2SubjectScope {
  if (!snap) return { scope: "none", ids: [] };
  const entries = V2_SCOPE_CAPS.map(([cap, depth]) => scopeFor(snap, cap, depth)).filter(
    (e): e is ScopeEntry => e !== null,
  );
  if (entries.some((e) => e.all)) return { scope: "all", ids: [] };
  const ids = new Set<number>();
  for (const e of entries) {
    for (const sId of e.subjects ?? []) ids.add(sId);
    for (const [sId] of e.pairs ?? []) ids.add(sId);
  }
  if (ids.size > 0) return { scope: "assigned", ids: [...ids].sort((a, b) => a - b) };
  const held = V2_ENROLLED_CAPS.some((cap) => (snap.caps?.[cap] ?? []).length > 0);
  return { scope: held ? "enrolled" : "none", ids: [] };
}

async function fetchSubjectCatalog(req: Request): Promise<ScopedSubject[]> {
  const token = getMisToken(req, { quiet: true });
  if (!token) return [];
  const res = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 500 },
  });
  const rows: any[] = res.data?.data ?? [];
  return dedupeById(rows.map(flattenSubject).filter(Boolean) as ScopedSubject[]);
}

/** enforce: v2 decides which subjects are visible (fails closed to []). */
async function getV2ScopedSubjects(
  req: Request,
): Promise<{ scope: SubjectScope; subjects: ScopedSubject[] }> {
  const snap = await requestSnapshot(req);
  const v2 = v2SubjectScope(snap);
  try {
    if (v2.scope === "all") return { scope: "all", subjects: await fetchSubjectCatalog(req) };
    if (v2.scope === "assigned") {
      // Names come from the catalog; an id it lacks still counts (named by id).
      const known = new Map((await fetchSubjectCatalog(req).catch(() => [] as ScopedSubject[])).map((sub) => [sub.id, sub]));
      return {
        scope: "assigned",
        subjects: dedupeById(v2.ids.map((id) => known.get(id) ?? { id, name: `Subject #${id}`, code: null })),
      };
    }
    if (v2.scope === "enrolled") {
      // The snapshot only says "self"; the enrolment itself lives in MIS.
      const token = getMisToken(req, { quiet: true });
      const misUserId = req.user?.mis_user_id;
      if (!token || !misUserId) return { scope: "enrolled", subjects: [] };
      const yearId = await resolveAcademicYearId(req);
      const res = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/students/${misUserId}/enrolled-subjects`, {
        headers: { Authorization: `Bearer ${token}` },
        params: yearId ? { academic_year_id: yearId } : {},
      });
      const rows: any[] = res.data?.data ?? [];
      return { scope: "enrolled", subjects: dedupeById(rows.map(flattenSubject).filter(Boolean) as ScopedSubject[]) };
    }
  } catch (error: any) {
    console.warn(`getScopedSubjects (v2): MIS fetch failed for scope '${v2.scope}':`, error.message);
    return { scope: v2.scope, subjects: [] };
  }
  return { scope: "none", subjects: [] };
}

/** shadow: compare the legacy subject set with v2's and record differences. */
function shadowCompareSubjects(req: Request, legacy: { scope: SubjectScope; subjects: ScopedSubject[] }) {
  if (!req.user?.id) return;
  runInBackground(async () => {
    const snap = await requestSnapshot(req);
    if (!snap) return;
    const v2 = v2SubjectScope(snap);
    const base = {
      userId: Number(req.user.id),
      misUserId: req.user?.mis_user_id ?? null,
      route: routeOf(req),
    };
    // Scope-level disagreement (e.g. legacy "all" vs v2 "assigned").
    if (legacy.scope !== v2.scope && !(legacy.scope === "enrolled" && v2.scope === "enrolled")) {
      await recordShadowDiff({
        ...base,
        capability: `scopedSubjects:${legacy.scope}->${v2.scope}`,
        legacyAllowed: legacy.scope === "all",
        v2: { allowed: v2.scope === "all", depth: null },
        target: v2.scope === "assigned" ? { v2_subjects: v2.ids.slice(0, 60) } : null,
      });
      return;
    }
    if (legacy.scope !== "assigned") return;
    const legacyIds = new Set(legacy.subjects.map((sub) => sub.id));
    const v2Ids = new Set(v2.ids);
    const onlyLegacy = [...legacyIds].filter((id) => !v2Ids.has(id));
    const onlyV2 = [...v2Ids].filter((id) => !legacyIds.has(id));
    if (onlyLegacy.length > 0) {
      await recordShadowDiff({
        ...base,
        capability: "scopedSubjects:assigned",
        legacyAllowed: true,
        v2: { allowed: false, depth: null },
        target: { subjects: onlyLegacy.slice(0, 60) },
      });
    }
    if (onlyV2.length > 0) {
      await recordShadowDiff({
        ...base,
        capability: "scopedSubjects:assigned",
        legacyAllowed: false,
        v2: { allowed: true, depth: null },
        target: { subjects: onlyV2.slice(0, 60) },
      });
    }
  });
}
