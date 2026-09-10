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

// @desc    Submissions grouped by subject then by type (assignment | quiz),
//          role-scoped and paginated by subject. Backs the redesigned
//          /submissions page.
// @route   GET /api/submissions/grouped
// @access  Private (SUBMISSIONS_VIEW_OWN | SUBMISSIONS_VIEW_ALL)
export const getGroupedSubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const canViewAll = !!(req as any).user.permissions?.has("SUBMISSIONS_VIEW_ALL");

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      24,
      Math.max(1, parseInt(String(req.query.pageSize ?? "8"), 10) || 8),
    );
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const typeFilter = String(req.query.type ?? "").trim(); // "assignment" | "quiz" | ""
    const statusFilter = String(req.query.status ?? "").trim();
    const subjectIdParam = req.query.subjectId
      ? Number(req.query.subjectId)
      : null;

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

    // Global totals across every visible subject (not just this page).
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
    const PER_GROUP_CAP = 20;

    type Row = {
      id: string;
      type: "assignment" | "quiz";
      subject_id: number;
      title: string;
      student: { id: number; name: string; email?: string } | null;
      status: string;
      submitted_at: string | null;
      grade_display: string | null;
      percentage: number | null;
      is_graded: boolean;
      detail_url: string;
    };

    const rows: Row[] = [];

    if (pageIds.length > 0 && wantAssignments) {
      const subs = await Submission.findAll({
        where: canViewAll ? {} : { student_id: userId },
        include: [
          {
            model: Assignment,
            attributes: ["id", "title", "course_id"],
            where: { course_id: { [Op.in]: pageIds }, ...termWhere },
            required: true,
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
        order: [["submitted_at", "DESC"]],
      });
      for (const s of subs) {
        const a = (s as any).assignment;
        if (!a) continue;
        const stu = (s as any).student;
        rows.push({
          id: `a-${s.id}`,
          type: "assignment",
          subject_id: a.course_id,
          title: a.title,
          student: stu
            ? {
                id: stu.id,
                name: `${stu.first_name} ${stu.last_name}`.trim(),
                email: stu.email,
              }
            : null,
          status: s.status,
          submitted_at: s.submitted_at ? new Date(s.submitted_at).toISOString() : null,
          grade_display: s.grade ?? null,
          percentage: (() => {
            if (!s.grade || !String(s.grade).includes("/")) return null;
            const [n, d] = String(s.grade).split("/").map(parseFloat);
            return d > 0 ? Math.round((n / d) * 100) : null;
          })(),
          is_graded: s.grade != null && s.grade !== "",
          detail_url: `/assignments/${a.id}`,
        });
      }
    }

    if (pageIds.length > 0 && wantQuizzes) {
      const qsubs = await QuizSubmission.findAll({
        where: {
          ...(canViewAll ? {} : { student_id: userId }),
          status: { [Op.in]: ["completed", "in_progress"] },
        },
        include: [
          {
            model: Quiz,
            as: "submissionQuiz",
            attributes: ["id", "title", "course_id"],
            where: { course_id: { [Op.in]: pageIds }, ...termWhere },
            required: true,
          },
          ...(canViewAll
            ? [
                {
                  model: User,
                  as: "submissionStudent",
                  attributes: ["id", "first_name", "last_name", "email"],
                },
              ]
            : []),
        ],
        order: [["completed_at", "DESC"]],
      });
      for (const s of qsubs) {
        const q = (s as any).submissionQuiz;
        if (!q) continue;
        const stu = (s as any).submissionStudent;
        const gs = (s as any).grade_status as string | undefined;
        const isGraded = gs === "graded" || gs === "auto_graded";
        rows.push({
          id: `q-${s.id}`,
          type: "quiz",
          subject_id: q.course_id,
          title: q.title,
          student: stu
            ? {
                id: stu.id,
                name: `${stu.first_name} ${stu.last_name}`.trim(),
                email: stu.email,
              }
            : null,
          status: s.status === "in_progress" ? "in_progress" : gs ?? "pending",
          submitted_at: s.completed_at
            ? new Date(s.completed_at).toISOString()
            : s.started_at
              ? new Date(s.started_at).toISOString()
              : null,
          grade_display: isGraded
            ? `${Number(s.total_score)}/${Number(s.max_score)}`
            : null,
          percentage:
            s.percentage != null ? Math.round(Number(s.percentage)) : null,
          is_graded: isGraded,
          detail_url: `/quizzes/${q.id}/submissions`,
        });
      }
    }

    // In-memory search on student name / title, and status filter.
    const q = search;
    const filtered = rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      // If the subject itself matched the search, keep all its rows.
      const subjMatched = pageSubjects.some(
        (s) =>
          s.id === r.subject_id &&
          (s.name.toLowerCase().includes(q) ||
            (s.code ?? "").toLowerCase().includes(q)),
      );
      return (
        subjMatched ||
        r.title.toLowerCase().includes(q) ||
        (r.student?.name.toLowerCase().includes(q) ?? false)
      );
    });

    const bySubject = new Map<number, Row[]>();
    for (const r of filtered) {
      const list = bySubject.get(r.subject_id) ?? [];
      list.push(r);
      bySubject.set(r.subject_id, list);
    }

    const statusValues = new Set<string>();
    for (const r of rows) statusValues.add(r.status);

    const data = pageSubjects.map((s) => {
      const all = bySubject.get(s.id) ?? [];
      const assignments = all.filter((r) => r.type === "assignment");
      const quizzes = all.filter((r) => r.type === "quiz");
      return {
        subject_id: s.id,
        subject_name: s.name,
        subject_code: s.code,
        total: all.length,
        graded: all.filter((r) => r.is_graded).length,
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
        can_grade: !!(req as any).user.permissions?.has("SUBMISSIONS_GRADE"),
        subjects: data,
        all_subjects: subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        })),
        status_values: [...statusValues].sort(),
        totals: {
          subjects: totalSubjects,
          submissions: grandTotal,
          submissions_on_page: data.reduce((n, s) => n + s.total, 0),
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
