import { Op } from "sequelize";
import { Assignment, AssignmentTmcode, TmcodeKind } from "../../models";

/**
 * Loading TMCode assignments: the Assignment row plus its tmcode_* columns
 * (AssignmentTmcode, kept off the Assignment model -- see Project.model.ts).
 */

export interface TmAssignment {
  assignment: Assignment;
  tm: AssignmentTmcode;
}

export const TM_ATTRS = [
  "id",
  "tmcode_kind",
  "tmcode_language",
  "tmcode_starter_project_id",
  "tmcode_starter_revision_id",
  "tmcode_instructions",
];

/**
 * An assignment is a TMCode assignment when its "TMCode practical" section is
 * on (tmcode_kind) or when it is handed in as a TMCode project: the form's
 * "TMCode" submission type (submission_type 'project') with the practical
 * section left off. The latter is a practical without starter files; its kind
 * is derived here, in memory only (the settings endpoint writes explicit values).
 */
export const DERIVED_KIND: TmcodeKind = "practical";
export const handedInAsProject = (a: Pick<Assignment, "submission_type">) => String(a.submission_type ?? "").toLowerCase() === "project";

function deriveKind(tm: AssignmentTmcode) {
  if (!tm.tmcode_kind) tm.setDataValue("tmcode_kind", DERIVED_KIND);
  tm.changed("tmcode_kind", false);
}

export async function loadTmAssignment(id: number): Promise<TmAssignment | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [assignment, tm] = await Promise.all([
    Assignment.findByPk(id),
    AssignmentTmcode.findByPk(id, { attributes: TM_ATTRS }),
  ]);
  if (!assignment || !tm) return null;
  if (!tm.tmcode_kind && handedInAsProject(assignment)) deriveKind(tm);
  return { assignment, tm };
}

/** Ids of every TMCode assignment (see above) with their TMCode columns. */
export async function tmcodeColumns(ids?: number[]): Promise<Map<number, AssignmentTmcode>> {
  if (ids && ids.length === 0) return new Map();
  const only = ids ? { id: { [Op.in]: ids } } : {};
  const [explicit, projects] = await Promise.all([
    AssignmentTmcode.findAll({ where: { tmcode_kind: { [Op.ne]: null }, ...only } as any, attributes: TM_ATTRS }),
    Assignment.findAll({ where: { submission_type: "project", ...only } as any, attributes: ["id"] }),
  ]);
  const map = new Map(explicit.map((r) => [r.id, r]));
  const derived = projects.map((a) => a.id).filter((id) => !map.has(id));
  if (derived.length) {
    for (const r of await AssignmentTmcode.findAll({ where: { id: { [Op.in]: derived } }, attributes: TM_ATTRS })) {
      deriveKind(r);
      map.set(r.id, r);
    }
  }
  return map;
}

export interface AssignmentBrief {
  id: number;
  title: string;
  status: "draft" | "published" | "completed" | "removed";
  kind: TmcodeKind | null;
}

/** `{id, title, status, kind}` for the workspace badge on projects (GET /projects, /projects/:id). */
export async function assignmentBriefs(ids: Array<number | null | undefined>): Promise<Map<number, AssignmentBrief>> {
  const unique = [...new Set(ids.filter((n): n is number => !!n))];
  if (unique.length === 0) return new Map();
  const [rows, tm] = await Promise.all([
    Assignment.findAll({ where: { id: { [Op.in]: unique } }, attributes: ["id", "title", "status"] }),
    AssignmentTmcode.findAll({ where: { id: { [Op.in]: unique } }, attributes: ["id", "tmcode_kind"] }),
  ]);
  const kinds = new Map(tm.map((t) => [t.id, t.tmcode_kind ?? null]));
  return new Map(
    rows.map((a) => [a.id, { id: a.id, title: a.title, status: a.status, kind: kinds.get(a.id) ?? null }]),
  );
}
