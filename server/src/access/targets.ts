import { Request } from "express";
import { Op } from "sequelize";
import { AccessSnapshot, scopeFor, Target, Depth } from "../vendor/nga-access";
import { User } from "../models/User.model";
import { getMisToken } from "../utils/misUtils";
import { fetchClassGroupRoster, fetchStudentPlacement } from "./misClient";
import { depthFor } from "./policy";

/**
 * Turning Task Mentor records into v2 targets. v2 scopes are MIS ids, so:
 *  - course ids ARE MIS subject ids;
 *  - local users.id -> MIS id via users.mis_user_id;
 *  - a student's class group comes from MIS (cached), so class-teacher / DOS
 *    scopes apply to student targets (README §6: "pass their class group too").
 */

const TTL_MS = 10 * 60 * 1000;
const localToMis = new Map<number, { mis: number | null; at: number }>();
const placements = new Map<number, { t: Target; at: number }>();
const rosters = new Map<number, { ids: number[]; at: number }>();

export function clearTargetCaches() {
  localToMis.clear();
  placements.clear();
  rosters.clear();
}

/** MIS user ids for local user ids (unknown / unmapped -> absent). */
export async function misIdsForLocalUsers(localIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const now = Date.now();
  const missing: number[] = [];
  for (const id of new Set(localIds.filter((n) => Number.isInteger(n) && n > 0))) {
    const c = localToMis.get(id);
    if (c && now - c.at < TTL_MS) {
      if (c.mis) out.set(id, c.mis);
    } else missing.push(id);
  }
  if (missing.length > 0) {
    const rows = await User.findAll({ where: { id: { [Op.in]: missing } }, attributes: ["id", "mis_user_id"] });
    const found = new Map(rows.map((u) => [u.id, u.mis_user_id ?? null]));
    for (const id of missing) {
      const mis = found.has(id) ? found.get(id)! : null;
      localToMis.set(id, { mis, at: now });
      if (mis) out.set(id, mis);
    }
  }
  return out;
}

export async function misIdForLocalUser(localId: number | null | undefined): Promise<number | null> {
  if (!localId) return null;
  return (await misIdsForLocalUsers([localId])).get(localId) ?? null;
}

/**
 * ReportCard.student_id is a FK to the local users table, but some writers
 * (saveSubjectMapping's fan-out) store MIS roster ids. Resolve: a local user
 * with a mis_user_id -> that id; otherwise the value is taken as a MIS id.
 */
export async function reportCardStudentMisIds(studentIds: number[]): Promise<Map<number, number>> {
  const mapped = await misIdsForLocalUsers(studentIds);
  const out = new Map<number, number>();
  for (const id of studentIds) out.set(id, mapped.get(id) ?? id);
  return out;
}

/** A student target carrying the student's MIS placement (class group, grade, programme). */
export async function studentTarget(req: Request, misStudentId: number, extra: Target = {}): Promise<Target> {
  const base: Target = { studentId: misStudentId, ...extra };
  const now = Date.now();
  const cached = placements.get(misStudentId);
  if (cached && now - cached.at < TTL_MS) return { ...cached.t, ...base };
  const token = getMisToken(req, { quiet: true });
  if (!token) return base;
  try {
    const p = await fetchStudentPlacement(token, misStudentId);
    const t: Target = p ? { classGroupId: p.classGroupId, gradeId: p.gradeId, programId: p.programId } : {};
    placements.set(misStudentId, { t, at: now });
    return { ...t, ...base };
  } catch {
    return base; // only student/self scopes can then cover it -- fails narrow
  }
}

async function roster(req: Request, classGroupId: number): Promise<number[]> {
  const now = Date.now();
  const cached = rosters.get(classGroupId);
  if (cached && now - cached.at < TTL_MS) return cached.ids;
  const token = getMisToken(req, { quiet: true });
  if (!token) return [];
  try {
    const ids = await fetchClassGroupRoster(token, classGroupId);
    rosters.set(classGroupId, { ids, at: now });
    return ids;
  } catch {
    return [];
  }
}

/**
 * Which of these MIS student ids may the user act on with any of `caps`
 * (at minDepth)? Mirrors decide() for the target
 * { studentId, classGroupId: <their class>, subjectId? } without one MIS
 * call per student: covered by the student / SELF lists, or by membership of
 * a class group in scope (or of a (subject, class) pair when a subject is
 * given), using class rosters.
 */
export async function allowedStudentIds(
  req: Request,
  snap: AccessSnapshot,
  caps: string[],
  misStudentIds: number[],
  opts: { minDepth?: Depth | null; subjectId?: number | null } = {},
): Promise<number[]> {
  const entries = caps.map((c) => scopeFor(snap, c, depthFor(c, opts.minDepth))).filter(Boolean);
  if (entries.length === 0) return [];
  if (entries.some((e) => e!.all)) return misStudentIds;

  const allowed = new Set<number>();
  const classes = new Set<number>();
  for (const e of entries) {
    for (const s of e!.students ?? []) allowed.add(s);
    if (e!.self != null) allowed.add(e!.self);
    for (const c of e!.class_groups ?? []) classes.add(c);
    if (opts.subjectId != null) {
      for (const [s, c] of e!.pairs ?? []) if (s === opts.subjectId) classes.add(c);
    }
  }
  const wanted = misStudentIds.filter((id) => !allowed.has(id));
  if (wanted.length > 0 && classes.size > 0) {
    for (const c of classes) {
      for (const id of await roster(req, c)) allowed.add(id);
    }
  }
  return misStudentIds.filter((id) => allowed.has(id));
}
