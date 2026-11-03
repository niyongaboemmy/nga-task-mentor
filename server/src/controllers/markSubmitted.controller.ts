import { Request, Response } from "express";
import { Op } from "sequelize";
import { Assignment, Project, ProjectActivityLink, ProjectRevision, Submission, User } from "../models";
import { canGradeAssignment, GRADE_DENIED_MESSAGE } from "../utils/gradingAccess";
import { loadActivity } from "../tmcode/projects/access";
import { syncProjectStatus, syncProjectsForSubmission } from "../tmcode/projects/status";
import { freezeLinkSubmission, publishEvent, recordEvent } from "./projects.controller";
import { clearInstructorOverviewCache } from "./instructorOverview.controller";

const HANDED_IN = ["submitted", "late", "resubmitted"];

/**
 * The student's saved TMCode work on this assignment: a link of one of their
 * projects (not removed), with the revision or commit it would freeze. Null
 * when they have no project, or never saved / pushed anything.
 */
async function savedWork(assignmentId: number, studentId: number) {
  const projects = await Project.findAll({ where: { owner_id: studentId, status: { [Op.ne]: "removed" } } });
  if (!projects.length) return null;
  const links = await ProjectActivityLink.findAll({
    where: { activity_type: "assignment", activity_id: assignmentId, project_id: { [Op.in]: projects.map((p) => p.id) } },
    order: [["id", "DESC"]],
  });
  for (const link of links) {
    const p = projects.find((x) => x.id === link.project_id)!;
    if (p.kind === "tm") {
      const revision = p.head_revision_id ? await ProjectRevision.findByPk(p.head_revision_id) : null;
      if (revision) return { project: p, link, revision, commit: null };
    } else {
      const commit = p.git_state?.head_commit ?? null;
      if (commit) return { project: p, link, revision: null, commit };
    }
  }
  return null;
}

// @desc    A teacher marks a student's assignment as submitted on their behalf,
//          so it can be graded. Saved TMCode work is handed in as the student
//          would (latest revision / commit frozen); else a draft row becomes
//          submitted; else a placeholder submission row is created.
// @route   POST /api/assignments/:assignmentId/students/:studentId/mark-submitted
// @access  Private (SUBMISSIONS_GRADE + may grade this assignment)
export const markStudentSubmitted = async (req: Request, res: Response) => {
  const assignmentId = Number(req.params.assignmentId);
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(assignmentId) || assignmentId <= 0 || !Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ success: false, message: "A valid assignment and student are required" });
  }
  try {
    const assignment = await Assignment.findByPk(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
    if (!(await canGradeAssignment(req, assignment))) {
      return res.status(403).json({ success: false, message: GRADE_DENIED_MESSAGE });
    }
    const student = await User.findByPk(studentId, { attributes: ["id"] });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const existing = await Submission.findOne({ where: { assignment_id: assignmentId, student_id: studentId } });
    if (existing?.status === "graded") {
      return res.status(409).json({ success: false, code: "ALREADY_GRADED", message: "This student's work is already graded." });
    }
    if (existing && HANDED_IN.includes(existing.status)) {
      return res.status(409).json({ success: false, code: "ALREADY_SUBMITTED", message: "This student has already submitted." });
    }

    const teacherId = Number(req.user.id);
    const now = new Date();
    const isLate = !!assignment.due_date && now > new Date(assignment.due_date);
    let source: "project" | "draft" | "placeholder";
    let submissionId: number;
    let status = "submitted";

    const work = await savedWork(assignmentId, studentId);
    if (work && work.link.status !== "submitted") {
      const activity = (await loadActivity("assignment", assignmentId))!;
      const { refused, submission } = await freezeLinkSubmission(work.project, work.link, activity, teacherId, work.revision, work.commit, now);
      if (refused) {
        return res.status(409).json({ success: false, code: refused, message: "This student's work is already graded." });
      }
      publishEvent(
        await recordEvent(work.project.id, teacherId, "submitted", {
          link_id: work.link.id,
          activity_type: "assignment",
          activity_id: assignmentId,
          title: assignment.title,
          revision_id: work.revision?.id ?? null,
          revision_number: work.revision?.number ?? null,
          git_commit: work.commit,
          by_teacher: true,
        }),
      );
      await syncProjectStatus(work.project.id, teacherId);
      source = "project";
      submissionId = submission!.id;
      status = submission!.status;
    } else if (existing) {
      await existing.update({ status: "submitted", submitted_at: now, submitted_by: teacherId, is_late: isLate } as any);
      source = "draft";
      submissionId = existing.id;
    } else {
      const created = await Submission.create({
        assignment_id: assignmentId,
        student_id: studentId,
        submitted_by: teacherId,
        status: "submitted",
        submitted_at: now,
        is_late: isLate,
        text_submission: "Marked as submitted by the teacher: nothing was handed in.",
        file_submissions: null,
      } as any);
      source = "placeholder";
      submissionId = created.id;
    }
    if (source !== "project") await syncProjectsForSubmission(assignmentId, studentId, teacherId);
    clearInstructorOverviewCache();

    return res.status(200).json({
      success: true,
      message: "Marked as submitted. You can grade it now.",
      data: { submission_id: submissionId, status, source },
    });
  } catch (error) {
    console.error("Mark submitted error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
