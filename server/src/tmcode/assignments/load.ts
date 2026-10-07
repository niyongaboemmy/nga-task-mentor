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

export async function loadTmAssignment(id: number): Promise<TmAssignment | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [assignment, tm] = await Promise.all([
    Assignment.findByPk(id),
    AssignmentTmcode.findByPk(id, { attributes: TM_ATTRS }),
  ]);
  if (!assignment || !tm) return null;
  return { assignment, tm };
}

/** Ids of every TMCode assignment (tmcode_kind set) with their TMCode columns. */
export async function tmcodeColumns(ids?: number[]): Promise<Map<number, AssignmentTmcode>> {
  const where: any = { tmcode_kind: { [Op.ne]: null } };
  if (ids) {
    if (ids.length === 0) return new Map();
    where.id = { [Op.in]: ids };
  }
  const rows = await AssignmentTmcode.findAll({ where, attributes: TM_ATTRS });
  return new Map(rows.map((r) => [r.id, r]));
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
