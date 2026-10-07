import { Op, QueryTypes, Transaction } from "sequelize";
import { sequelize } from "../../config/database";
import { Project, ProjectActivityLink, ProjectStatus } from "../../models";

/**
 * A project's status: draft -> submitted -> graded, or removed.
 *
 *  - draft:     the student is working on it (saves allowed).
 *  - submitted: handed in; saving is refused until it is withdrawn (by the
 *               student, while the assignment is open and not graded) or
 *               returned (by a teacher).
 *  - graded:    the linked assignment submission was graded; locked.
 *  - removed:   soft-deleted by the owner; hidden from their lists, kept for
 *               the record, restorable. Submitted or graded work can't be removed.
 *
 * The status is stored (lists filter and sort on it) but never set by hand
 * except for removed: everything else is derived from the project's links and
 * the owner's submissions by deriveProjectStatus, and syncProjectStatus writes
 * the result after every change to those (submit, withdraw, return, grading).
 * So it can't disagree with what the teacher's submission list shows.
 */

export interface StatusInputs {
  removed: boolean;
  links: { activity_type: string; status: string }[];
  /** The owner's submissions for the assignments this project is linked to. */
  submissions: { status?: string | null }[];
}

export function deriveProjectStatus({ removed, links, submissions }: StatusInputs): ProjectStatus {
  if (removed) return "removed";
  if (submissions.some((s) => s.status === "graded")) return "graded";
  // Only the project's own submission counts: files handed in for the same
  // assignment some other way don't make this project "submitted".
  if (links.some((l) => l.status === "submitted")) return "submitted";
  return "draft";
}

/** Saving a new revision is allowed only while the project is a draft. */
export function lockReason(status: ProjectStatus | null | undefined): { code: string; message: string } | null {
  switch (status) {
    case "submitted":
      return {
        code: "PROJECT_LOCKED",
        message: "This project is submitted, so it's locked. Withdraw the submission to keep working on it.",
      };
    case "graded":
      return { code: "PROJECT_GRADED", message: "This project has been graded; it can't be changed any more." };
    case "removed":
      return { code: "PROJECT_REMOVED", message: "This project was removed. Restore it to keep working on it." };
    default:
      return null;
  }
}

/** Re-derive and store one project's status; returns the new status. */
export async function syncProjectStatus(
  projectId: number,
  changedBy: number | null,
  transaction?: Transaction,
): Promise<ProjectStatus | null> {
  const p = await Project.findByPk(projectId, { transaction });
  if (!p) return null;
  const links = await ProjectActivityLink.findAll({ where: { project_id: p.id }, transaction });
  const assignmentIds = links.filter((l) => l.activity_type === "assignment").map((l) => l.activity_id);
  const submissions = assignmentIds.length
    ? await sequelize.query<{ status: string }>(
        `SELECT status FROM submissions WHERE student_id = ? AND assignment_id IN (${assignmentIds.map(() => "?").join(",")})`,
        { replacements: [p.owner_id, ...assignmentIds], type: QueryTypes.SELECT, transaction },
      )
    : [];
  const next = deriveProjectStatus({ removed: p.status === "removed", links, submissions });
  if (next !== p.status) {
    await p.update({ status: next, status_changed_at: new Date(), status_changed_by: changedBy }, { transaction });
  }
  return next;
}

/** After an assignment submission changed (graded, ungraded…): sync the owner's projects linked to it. */
export async function syncProjectsForSubmission(
  assignmentId: number,
  studentId: number,
  changedBy: number | null,
): Promise<void> {
  try {
    const mine = await Project.findAll({ where: { owner_id: studentId }, attributes: ["id"] });
    if (!mine.length) return;
    const links = await ProjectActivityLink.findAll({
      where: { activity_type: "assignment", activity_id: assignmentId, project_id: { [Op.in]: mine.map((p) => p.id) } },
      attributes: ["project_id"],
    });
    for (const l of links) await syncProjectStatus(l.project_id, changedBy);
  } catch (e: any) {
    // Grading must never fail because of the projects mirror (e.g. before the migration).
    console.error("[projects] status sync after grading failed:", e?.message);
  }
}

/**
 * Take a submitted project back to draft: its submitted links go back to
 * "linked" and the owner's assignment submission back to "draft" (so it drops
 * out of the teacher's to-grade list). Refused once graded. Shared by the
 * student's Withdraw and the teacher's Return for changes.
 */
export async function reopenProject(
  p: Project,
  by: number,
): Promise<{ ok: true; links: ProjectActivityLink[] } | { ok: false; code: string; message: string }> {
  if (p.status === "graded") {
    return { ok: false, code: "PROJECT_GRADED", message: "This project has been graded; it can't be reopened." };
  }
  if (p.status !== "submitted") {
    return { ok: false, code: "NOT_SUBMITTED", message: "This project isn't submitted." };
  }
  const links = await ProjectActivityLink.findAll({ where: { project_id: p.id, status: "submitted" } });
  const refused = await sequelize.transaction(async (transaction) => {
    for (const link of links) {
      if (link.activity_type === "assignment") {
        const [row] = await sequelize.query<{ id: number; status: string }>(
          "SELECT id, status FROM submissions WHERE assignment_id = ? AND student_id = ? LIMIT 1 FOR UPDATE",
          { replacements: [link.activity_id, p.owner_id], type: QueryTypes.SELECT, transaction },
        );
        if (row?.status === "graded") return "GRADED";
        if (row) {
          await sequelize.query("UPDATE submissions SET status = 'draft', updated_at = ? WHERE id = ?", {
            replacements: [new Date(), row.id],
            transaction,
          });
        }
      }
      await link.update({ status: "linked", submitted_at: null }, { transaction });
    }
    await syncProjectStatus(p.id, by, transaction);
    return null;
  });
  if (refused === "GRADED") {
    await syncProjectStatus(p.id, by);
    return { ok: false, code: "PROJECT_GRADED", message: "This project has been graded; it can't be reopened." };
  }
  return { ok: true, links };
}
