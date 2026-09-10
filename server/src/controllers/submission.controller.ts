import { Request, Response } from "express";
import { Submission, Assignment, User, Quiz, QuizSubmission } from "../models";
import { Op } from "sequelize";
import { isPastDate } from "../utils/dateUtils";
import { resolveAcademicTermId, getCurrentTermId } from "../utils/misUtils";
import { getScopedSubjects } from "../utils/scopedSubjects";
import fs from "fs";
import path from "path";
import fileServer from "../utils/fileServer";
import {
  generateUniqueFilename,
  sanitizeKeepExtension,
} from "../utils/uploadFilename";

// @desc    Get all submissions
// @route   GET /api/submissions
// @access  Private
export const getSubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const canViewAll = (req as any).user.permissions?.has("SUBMISSIONS_VIEW_ALL");
    const academicTermId = await resolveAcademicTermId(req);

    const { course_id, assignment_id, student_id, status } = req.query;

    // Students (and anyone without SUBMISSIONS_VIEW_ALL) only ever see
    // their own submissions. Instructors/admins with SUBMISSIONS_VIEW_ALL
    // can list across students, optionally narrowed by the query filters.
    const submissionWhere: Record<string, unknown> = canViewAll
      ? {}
      : { student_id: userId };

    if (canViewAll && student_id) {
      submissionWhere.student_id = student_id;
    }
    if (canViewAll && assignment_id) {
      submissionWhere.assignment_id = assignment_id;
    }
    if (canViewAll && status) {
      submissionWhere.status = status;
    }

    const assignmentWhere: Record<string | symbol, unknown> = {};
    if (canViewAll && course_id) {
      assignmentWhere.course_id = course_id;
    }
    if (academicTermId) {
      // Scope to the resolved term, but keep legacy assignments that
      // predate academic_term_id tracking (null) so nothing vanishes.
      assignmentWhere[Op.or] = [
        { academic_term_id: academicTermId },
        { academic_term_id: null },
      ];
    }

    const submissions = await Submission.findAll({
      where: submissionWhere,
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id"],
          where: Object.keys(assignmentWhere).length ? assignmentWhere : undefined,
          required: !!academicTermId || (canViewAll && !!course_id),
        },
        ...(canViewAll
          ? [
              {
                model: User,
                as: "student",
                attributes: ["id", "first_name", "last_name", "email"],
              },
            ]
          : []),
      ],
    });

    res
      .status(200)
      .json({ success: true, count: submissions.length, data: submissions });
  } catch (error) {
    console.error("Get submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Assessments (quizzes + assignments) grouped by subject, each
//          carrying its submission stats — the redesigned /submissions page
//          drills subject → assessment → (its own submissions list, on the
//          quiz/assignment detail pages).
// @route   GET /api/submissions/grouped
// @access  Private (SUBMISSIONS_VIEW_OWN | SUBMISSIONS_VIEW_ALL)
export const getGroupedSubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const canViewAll = !!(req as any).user.permissions?.has("SUBMISSIONS_VIEW_ALL");
    const canGrade = !!(req as any).user.permissions?.has("SUBMISSIONS_GRADE");

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      24,
      Math.max(1, parseInt(String(req.query.pageSize ?? "8"), 10) || 8),
    );
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const typeFilter = String(req.query.type ?? "").trim(); // "assignment" | "quiz" | ""
    const statusFilter = String(req.query.status ?? "").trim();
    const subjectIdParam = req.query.subjectId ? Number(req.query.subjectId) : null;

    const { scope, subjects } = await getScopedSubjects(req);
    if (scope === "none") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view submissions" });
    }

    let visibleSubjects = subjects;
    if (subjectIdParam != null && !isNaN(subjectIdParam)) {
      visibleSubjects = visibleSubjects.filter((s) => s.id === subjectIdParam);
    }
    if (search) {
      visibleSubjects = visibleSubjects.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          (s.code ?? "").toLowerCase().includes(search),
      );
    }
    visibleSubjects = visibleSubjects.sort((a, b) => a.name.localeCompare(b.name));

    const totalSubjects = visibleSubjects.length;
    const totalPages = Math.max(1, Math.ceil(totalSubjects / pageSize));
    const pageSubjects = visibleSubjects.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );
    const pageIds = pageSubjects.map((s) => s.id);
    const allVisibleIds = visibleSubjects.map((s) => s.id);

    const termId = await getCurrentTermId(req);
    const termWhere = termId
      ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] }
      : {};

    const wantAssignments = typeFilter !== "quiz";
    const wantQuizzes = typeFilter !== "assignment";

    // Global submission total across every visible subject (header figure).
    let grandTotal = 0;
    if (allVisibleIds.length > 0) {
      const [aCount, qCount] = await Promise.all([
        wantAssignments
          ? Submission.count({
              where: canViewAll ? {} : { student_id: userId },
              include: [
                {
                  model: Assignment,
                  attributes: [],
                  where: { course_id: { [Op.in]: allVisibleIds }, ...termWhere },
                  required: true,
                },
              ],
            })
          : Promise.resolve(0),
        wantQuizzes
          ? QuizSubmission.count({
              where: {
                ...(canViewAll ? {} : { student_id: userId }),
                status: { [Op.in]: ["completed", "in_progress"] },
              },
              include: [
                {
                  model: Quiz,
                  as: "submissionQuiz",
                  attributes: [],
                  where: { course_id: { [Op.in]: allVisibleIds }, ...termWhere },
                  required: true,
                },
              ],
            })
          : Promise.resolve(0),
      ]);
      grandTotal = aCount + qCount;
    }

    const PER_GROUP_CAP = 25;

    interface Assessment {
      id: number;
      type: "assignment" | "quiz";
      subject_id: number;
      title: string;
      status: string;
      max_score: number | null;
      submission_count: number;
      graded_count: number;
      pending_count: number;
      avg_percentage: number | null;
      last_submission_at: string | null;
      my_status: string | null;
      my_grade_display: string | null;
      my_percentage: number | null;
      detail_url: string;
    }

    const assessments: Assessment[] = [];

    /* ── Assignments on the page's subjects ── */
    if (pageIds.length > 0 && wantAssignments) {
      const rows = await Assignment.findAll({
        where: {
          course_id: { [Op.in]: pageIds },
          status: { [Op.ne]: "removed" },
          ...termWhere,
        },
        attributes: ["id", "title", "course_id", "status", "max_score"],
        include: [
          {
            model: Submission,
            as: "submissions",
            required: false,
            where: canViewAll ? undefined : { student_id: userId },
            attributes: ["id", "student_id", "grade", "status", "submitted_at"],
          },
        ],
        order: [["due_date", "DESC"]],
      });

      for (const a of rows) {
        const subs: any[] = (a as any).submissions ?? [];
        // Managers see every published/completed assessment (plus any with
        // submissions); students see only assessments they've submitted to.
        if (!canViewAll && subs.length === 0) continue;
        if (
          canViewAll &&
          !["published", "completed"].includes(a.status) &&
          subs.length === 0
        ) {
          continue;
        }
        const gradedSubs = subs.filter(
          (s) => s.grade != null && s.grade !== "",
        );
        const pcts = gradedSubs
          .map((s) => {
            if (!s.grade || !String(s.grade).includes("/")) return null;
            const [n, d] = String(s.grade).split("/").map(parseFloat);
            return d > 0 ? (n / d) * 100 : null;
          })
          .filter((x): x is number => x != null);
        const mine = canViewAll ? null : subs[0] ?? null;
        assessments.push({
          id: a.id,
          type: "assignment",
          subject_id: a.course_id!,
          title: a.title,
          status: a.status,
          max_score: a.max_score ?? null,
          submission_count: subs.length,
          graded_count: gradedSubs.length,
          pending_count: subs.length - gradedSubs.length,
          avg_percentage:
            pcts.length > 0
              ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length)
              : null,
          last_submission_at: subs.reduce<string | null>((acc, s) => {
            if (!s.submitted_at) return acc;
            const t = new Date(s.submitted_at).toISOString();
            return !acc || t > acc ? t : acc;
          }, null),
          my_status: mine ? mine.status : null,
          my_grade_display: mine ? mine.grade ?? null : null,
          my_percentage: (() => {
            if (!mine?.grade || !String(mine.grade).includes("/")) return null;
            const [n, d] = String(mine.grade).split("/").map(parseFloat);
            return d > 0 ? Math.round((n / d) * 100) : null;
          })(),
          detail_url: `/assignments/${a.id}`,
        });
      }
    }

    /* ── Quizzes on the page's subjects ── */
    if (pageIds.length > 0 && wantQuizzes) {
      const rows = await Quiz.findAll({
        where: { course_id: { [Op.in]: pageIds }, ...termWhere },
        attributes: ["id", "title", "course_id", "status"],
        include: [
          {
            model: QuizSubmission,
            as: "quizSubmissions",
            required: false,
            where: {
              ...(canViewAll ? {} : { student_id: userId }),
              status: { [Op.in]: ["completed", "in_progress"] },
            },
            attributes: [
              "id",
              "student_id",
              "total_score",
              "max_score",
              "percentage",
              "grade_status",
              "status",
              "completed_at",
            ],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      for (const qz of rows) {
        const subs: any[] = (qz as any).quizSubmissions ?? [];
        if (!canViewAll && subs.length === 0) continue;
        if (
          canViewAll &&
          qz.status !== "published" &&
          qz.status !== "completed" &&
          subs.length === 0
        ) {
          continue;
        }
        // De-dupe to one submission per student (best attempt).
        const bestByStudent = new Map<number, any>();
        for (const s of subs) {
          const cur = bestByStudent.get(s.student_id);
          if (!cur || Number(s.total_score) > Number(cur.total_score)) {
            bestByStudent.set(s.student_id, s);
          }
        }
        const deduped = [...bestByStudent.values()];
        const graded = deduped.filter((s) =>
          ["graded", "auto_graded"].includes(s.grade_status),
        );
        const pcts = graded
          .map((s) => (s.percentage != null ? Number(s.percentage) : null))
          .filter((x): x is number => x != null);
        const mine = canViewAll ? null : deduped[0] ?? null;
        const mineGraded =
          mine && ["graded", "auto_graded"].includes(mine.grade_status);
        assessments.push({
          id: qz.id,
          type: "quiz",
          subject_id: qz.course_id!,
          title: qz.title,
          status: qz.status,
          max_score: deduped[0]?.max_score != null ? Number(deduped[0].max_score) : null,
          submission_count: deduped.length,
          graded_count: graded.length,
          pending_count: deduped.length - graded.length,
          avg_percentage:
            pcts.length > 0
              ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length)
              : null,
          last_submission_at: deduped.reduce<string | null>((acc, s) => {
            if (!s.completed_at) return acc;
            const t = new Date(s.completed_at).toISOString();
            return !acc || t > acc ? t : acc;
          }, null),
          my_status: mine
            ? mine.status === "in_progress"
              ? "in_progress"
              : mine.grade_status ?? "pending"
            : null,
          my_grade_display: mineGraded
            ? `${Number(mine.total_score)}/${Number(mine.max_score)}`
            : null,
          my_percentage:
            mine?.percentage != null ? Math.round(Number(mine.percentage)) : null,
          detail_url: canViewAll
            ? `/quizzes/${qz.id}/submissions`
            : `/quizzes/${qz.id}/results`,
        });
      }
    }

    /* ── Filters (search on title, status on assessment health) ── */
    const matchesStatus = (a: Assessment): boolean => {
      if (!statusFilter || statusFilter === "all") return true;
      if (canViewAll) {
        if (statusFilter === "needs_grading") return a.pending_count > 0;
        if (statusFilter === "fully_graded")
          return a.submission_count > 0 && a.pending_count === 0;
        if (statusFilter === "no_submissions") return a.submission_count === 0;
        return true;
      }
      return a.my_status === statusFilter;
    };

    const filtered = assessments.filter((a) => {
      if (!matchesStatus(a)) return false;
      if (!search) return true;
      const subjMatched = pageSubjects.some(
        (s) =>
          s.id === a.subject_id &&
          (s.name.toLowerCase().includes(search) ||
            (s.code ?? "").toLowerCase().includes(search)),
      );
      return subjMatched || a.title.toLowerCase().includes(search);
    });

    const bySubject = new Map<number, Assessment[]>();
    for (const a of filtered) {
      const list = bySubject.get(a.subject_id) ?? [];
      list.push(a);
      bySubject.set(a.subject_id, list);
    }

    const statusValues = canViewAll
      ? ["needs_grading", "fully_graded", "no_submissions"]
      : [...new Set(assessments.map((a) => a.my_status).filter(Boolean))].sort();

    const data = pageSubjects.map((s) => {
      const all = bySubject.get(s.id) ?? [];
      const assignments = all.filter((a) => a.type === "assignment");
      const quizzes = all.filter((a) => a.type === "quiz");
      const submissionTotal = all.reduce((n, a) => n + a.submission_count, 0);
      return {
        subject_id: s.id,
        subject_name: s.name,
        subject_code: s.code,
        assessment_count: all.length,
        submission_total: submissionTotal,
        graded_total: all.reduce((n, a) => n + a.graded_count, 0),
        pending_total: all.reduce((n, a) => n + a.pending_count, 0),
        assignments: {
          count: assignments.length,
          has_more: assignments.length > PER_GROUP_CAP,
          items: assignments.slice(0, PER_GROUP_CAP),
        },
        quizzes: {
          count: quizzes.length,
          has_more: quizzes.length > PER_GROUP_CAP,
          items: quizzes.slice(0, PER_GROUP_CAP),
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        scope,
        can_view_all: canViewAll,
        can_grade: canGrade,
        subjects: data,
        all_subjects: subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        })),
        status_values: statusValues,
        totals: {
          subjects: totalSubjects,
          submissions: grandTotal,
          assessments_on_page: data.reduce((n, s) => n + s.assessment_count, 0),
        },
        pagination: { page, page_size: pageSize, total_pages: totalPages },
      },
    });
  } catch (error) {
    console.error("Get grouped submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single submission
// @route   GET /api/submissions/:id
// @access  Private
export const getSubmission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const submission = await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id"],
        },
      ],
    });

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      !(req as any).user.permissions?.has("SUBMISSIONS_VIEW_ALL")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this submission",
      });
    }

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    console.error("Get submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create submission
// @route   POST /api/assignments/:assignmentId/submissions
// @access  Private/Student
export const createSubmission = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { text_submission, file_submissions } = req.body;
    const userId = (req as any).user.id;

    // Check if assignment exists
    const assignment = await Assignment.findByPk(assignmentId);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Check if due date has passed
    if (isPastDate(assignment.due_date)) {
      return res
        .status(400)
        .json({ success: false, message: "Assignment deadline has passed" });
    }

    // Check if user already submitted
    const existingSubmission = await Submission.findOne({
      where: {
        student_id: userId,
        assignment_id: parseInt(assignmentId),
      },
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: "Submission already exists for this assignment",
      });
    }

    const submission = await Submission.create({
      student_id: userId,
      assignment_id: parseInt(assignmentId),
      text_submission,
      file_submissions,
      status: "submitted",
      submitted_at: new Date(),
      is_late: isPastDate(assignment.due_date),
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    console.error("Create submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update submission
// @route   PUT /api/submissions/:id
// @access  Private
export const updateSubmission = async (req: Request, res: Response) => {
  try {
    const { text_submission, file_submissions } = req.body;
    const userId = (req as any).user.id;

    const submission = await Submission.findByPk(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if assignment is overdue
    const assignment = await Assignment.findByPk(submission.assignment_id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    if (isPastDate(assignment.due_date)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update submission. The due date has passed.",
      });
    }

    // Check if assignment is completed
    if (assignment.status === "completed") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot update submission. This assignment is marked as completed.",
      });
    }

    // Check if submission is already graded
    if (
      submission.status === "graded" ||
      submission.status === ("completed" as any)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot update submission. It has already been graded or completed.",
      });
    }

    if (submission.grade !== null && submission.grade !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Cannot update submission. It has already been graded.",
      });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      !(req as any).user.permissions?.has("SUBMISSIONS_VIEW_ALL")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this submission",
      });
    }

    // Update fields
    submission.text_submission =
      text_submission !== undefined
        ? text_submission
        : submission.text_submission;

    // Handle file update
    if ((req as any).file) {
      const file = (req as any).file;
      const filename = generateUniqueFilename(
        "submission",
        file.originalname,
        sanitizeKeepExtension,
      );
      await fileServer.uploadFile(file.buffer, `submissions/${filename}`);
      submission.file_submissions = [
        {
          filename,
          originalname: file.originalname,
          path: `submissions/${filename}`,
          size: file.size,
          mimetype: file.mimetype,
        },
      ];
    } else if (file_submissions !== undefined) {
      // Allows clearing files or setting from body if not using multer (though here we are)
      submission.file_submissions = file_submissions;
    }

    await submission.save();

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    console.error("Update submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete submission
// @route   DELETE /api/submissions/:id
// @access  Private
export const deleteSubmission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const submission = (await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "due_date"],
        },
      ],
    })) as any; // Type assertion for Sequelize include

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      !(req as any).user.permissions?.has("SUBMISSIONS_VIEW_ALL")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this submission",
      });
    }

    // Check if assignment is still open for submissions
    if (submission.Assignment) {
      if (isPastDate(submission.Assignment.due_date)) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete submission after the due date",
        });
      }
    }

    await submission.destroy();

    res.status(200).json({
      success: true,
      message: "Submission deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("Delete submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Download submission file
// @route   GET /api/submissions/:id/files/:fileId
// @access  Private
export const downloadFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const submission = await Submission.findByPk(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      !(req as any).user.permissions?.has("SUBMISSIONS_VIEW_ALL")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to download this file",
      });
    }

    // Parse file_submissions JSON if it's stored as a string
    let fileSubmissions = submission.file_submissions;
    if (typeof fileSubmissions === "string") {
      try {
        fileSubmissions = JSON.parse(fileSubmissions);
      } catch (error) {
        console.error("Error parsing file_submissions JSON:", error);
        return res
          .status(500)
          .json({ success: false, message: "Invalid file submissions data" });
      }
    }

    // Parse file_submissions JSON
    if (!fileSubmissions || fileSubmissions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No files attached to this submission",
      });
    }

    // The fileId parameter now contains the extracted filename from the frontend
    const fileName = decodeURIComponent(req.params.fileId);

    if (!fileName) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid filename" });
    }

    // Find the corresponding file metadata from the submission
    const fileSubmission = fileSubmissions.find(
      (file: any) => file.filename === fileName,
    );
    const originalName = fileSubmission?.originalname || fileName;
    const mimeType = fileSubmission?.mimetype || "application/octet-stream";

    // New uploads live at submissions/<filename> on the file-server. Older
    // submissions (uploaded before this migration) were written directly to
    // the local uploads/ root by the old diskStorage config -- fall back to
    // that so pre-migration submissions don't 404.
    const remotePath = `submissions/${fileName}`;
    let buffer: Buffer | null = null;
    if (await fileServer.fileExists(remotePath)) {
      buffer = await fileServer.downloadToBuffer(remotePath);
    } else {
      const legacyPath = path.join(__dirname, "../../uploads", fileName);
      if (fs.existsSync(legacyPath)) {
        buffer = fs.readFileSync(legacyPath);
      }
    }

    if (!buffer) {
      return res
        .status(404)
        .json({ success: false, message: "File not found on server" });
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalName}"`,
    );
    res.send(buffer);
  } catch (error) {
    console.error("Download file error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Grade submission
// @route   PATCH /api/submissions/:id/grade
// @access  Private/Instructor
export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const { score, maxScore, feedback, rubricScores } = req.body;
    const userId = (req as any).user.id;

    const submission = (await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id", "max_score"],
        },
      ],
    })) as any;

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    if (!(req as any).user.permissions?.has("SUBMISSIONS_GRADE")) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to grade submissions",
      });
    }

    // Get maxScore from assignment if not provided in request
    const finalMaxScore =
      maxScore ||
      (submission.Assignment?.max_score
        ? parseInt(submission.Assignment.max_score)
        : null);

    // Validate grade data
    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({
        success: false,
        message: "Score must be a non-negative number",
      });
    }

    if (!finalMaxScore || finalMaxScore <= 0) {
      return res.status(400).json({
        success: false,
        message: "Max score must be a positive number",
      });
    }

    if (score > finalMaxScore) {
      return res
        .status(400)
        .json({ success: false, message: "Score cannot exceed max score" });
    }

    // Create grade string in the format expected by frontend (e.g., "85/100")
    const gradeString = `${score}/${finalMaxScore}`;

    // Update submission - use update directly to avoid validation issues
    await Submission.update(
      {
        grade: gradeString,
        status: "graded",
        feedback: feedback || submission.feedback,
        rubric_scores: rubricScores || null,
        updated_at: new Date(),
      },
      {
        where: { id: req.params.id },
      },
    );

    // Fetch the updated submission to return
    const updatedSubmission = (await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id", "max_score"],
        },
      ],
    })) as any;

    res.status(200).json({
      success: true,
      message: "Submission graded successfully",
      data: updatedSubmission,
    });
  } catch (error) {
    console.error("Grade submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Add comment to submission
// @route   POST /api/submissions/:id/comments
// @access  Private
export const addComment = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = (req as any).user.id;
    const userPermissions: Set<string> = (req as any).user.permissions ?? new Set();

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
    }

    const submission = await Submission.findByPk(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user is student who owns submission or holds the view-all permission
    if (
      submission.student_id !== userId &&
      !userPermissions.has("SUBMISSIONS_VIEW_ALL")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to comment on this submission",
      });
    }

    // Get current comments
    let currentComments = submission.comments || [];
    if (typeof currentComments === "string") {
      try {
        currentComments = JSON.parse(currentComments);
      } catch (e) {
        currentComments = [];
      }
    }

    // Create new comment
    const newComment = {
      author: `${(req as any).user.first_name} ${(req as any).user.last_name}`,
      authorId: userId,
      content,
      createdAt: new Date().toISOString(),
      isInstructor: userPermissions.has("SUBMISSIONS_VIEW_ALL"),
    };

    // Update submission
    await Submission.update(
      {
        comments: [...currentComments, newComment],
      },
      {
        where: { id: req.params.id },
      },
    );

    // Fetch updated submission
    const updatedSubmission = await Submission.findByPk(req.params.id);

    res.status(200).json({
      success: true,
      data: updatedSubmission,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
