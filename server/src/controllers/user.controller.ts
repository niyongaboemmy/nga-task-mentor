import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import fs from "fs";
import path from "path";
import fileServer from "../utils/fileServer";
import {
  getMisToken,
  handleMisError,
  resolveAcademicYearId,
  resolveAcademicTermId,
} from "../utils/misUtils";
import { Submission, Assignment, QuizSubmission, Quiz, User } from "../models";

// MIS role IDs (see nga_central_mis Role table) — used to filter the generic
// /users/ endpoint via its `userRole` query param.
const MIS_ROLE_IDS: Record<string, number> = {
  student: 6,
};

// The generic MIS /users/ endpoint returns `{ user, profile, roles, permissions }`
// per record (names live under `profile`), while the rest of this app (e.g. the
// admin Students list) expects a flat `{ first_name, last_name, ... }` shape —
// the same flat shape course.controller.ts::getCourse already produces when it
// maps MIS enrollment data. Normalize here so every caller of getUsers gets a
// consistent, flat contract regardless of which MIS endpoint served it.
function flattenMisUser(entry: any) {
  if (!entry || typeof entry !== "object") return entry;
  // Already flat (e.g. the /academics/subjects/:id/terms/:id/students endpoint).
  if (!entry.user && !entry.profile) return entry;

  const user = entry.user || {};
  const profile = entry.profile || {};
  return {
    user_id: user.user_id ?? user.id ?? "",
    username: user.username ?? user.email ?? "",
    first_name: profile.first_name ?? user.first_name ?? "",
    last_name: profile.last_name ?? user.last_name ?? "",
    gender: profile.gender ?? "",
    class_group_name: profile.class_group_name ?? "",
    grade_name: profile.grade_name ?? "",
    program_name: profile.program_name ?? "",
    enrolled_at: user.created_at ?? "",
  };
}

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
  try {
    const {
      role,
      page = 1,
      limit = 100,
      search,
      subjectId,
      termId,
    } = req.query;
    // Build query parameters
    let params: any = {
      page,
      limit,
    };

    // Determine MIS endpoint based on the requester's permissions.
    //
    // The raw MIS `/users/` list requires an admin-level MIS permission
    // (MANAGE_USERS) that instructors — and any custom local role that grants
    // USERS_VIEW_ALL without USERS_EDIT — do not hold. Those users must reach
    // students through the subject-scoped or search endpoints instead. Keying
    // this off the resolved permission set (rather than the deprecated flat
    // `req.user.role` string) means custom roles behave correctly too.
    let endpoint = "/users/";
    const canListAllUsers = !!req.user.permissions?.has("USERS_EDIT");

    if (!canListAllUsers && role === "student") {
      // Fall back to the requester's current term when the client didn't send
      // one explicitly, so selecting only a course is enough to load a roster.
      const scopedTermId =
        termId || (subjectId ? await resolveAcademicTermId(req) : null);
      if (subjectId && scopedTermId) {
        // Use the subject-scoped academic endpoint (enrolled students only)
        endpoint = `/academics/subjects/${subjectId}/terms/${scopedTermId}/students`;
      } else if (search) {
        // Non-admins use the search endpoint for students when they have a query
        endpoint = "/users/search";
        params.roleId = 6; // MIS Student Role ID
        params.q = search;
      } else {
        // Without a course (subjectId+termId) or a search term a non-admin
        // has no usable MIS endpoint — /users/ is forbidden for them and
        // /users/search requires a query. Return 200 with empty data and a
        // hint instead of letting the request fail.
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          message:
            "Please select a course or enter a search term to view students.",
        });
      }
    } else if (search) {
      // Admins using the regular users endpoint
      params.search = search;
    }

    // Every remaining path calls the MIS API — a token is required from here on.
    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Role filtering will be done after fetching from MIS for the main endpoint,
    // but the search and academic endpoints above already filter by role.
    if (role && endpoint === "/users/") {
      // Non-admin users have restrictions on the main endpoint
      if (!req.user.permissions?.has("USERS_EDIT")) {
        if (role !== "student" || !req.user.permissions?.has("USERS_VIEW_ALL")) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to access this resource",
          });
        }
      }

      // Forward the role filter to MIS so /users/ doesn't return every role
      // mixed together — MIS expects a numeric `userRole` (role id), not a name.
      const misRoleId = MIS_ROLE_IDS[role as string];
      if (misRoleId) {
        params.userRole = misRoleId;
      }
    }
    const response = await axios.get<{
      success: boolean;
      message: string;
      data: any[];
    }>(`${process.env.NGA_MIS_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      params,
      // Enforce HTTPS in production
      httpsAgent:
        process.env.NODE_ENV === "production"
          ? new (require("https").Agent)({ rejectUnauthorized: true })
          : undefined,
    });

    let rawUsers = response.data.data ?? [];

    // Defense in depth: params.userRole above already asks MIS to filter by
    // role, but re-check each record's own roles here too rather than
    // trusting that filter blindly -- a role-id mismatch on either side (or
    // a future edit that drops the userRole param) would otherwise leak
    // non-students into what's supposed to be a students-only list.
    if (role === "student" && endpoint === "/users/") {
      rawUsers = rawUsers.filter((entry: any) =>
        (entry.roles || []).some(
          (r: any) => String(r.name).toUpperCase() === "STUDENT",
        ),
      );
    }

    // /users/ returns nested { user, profile }; other endpoints are already
    // flat. flattenMisUser is a no-op for records that are already flat.
    const users =
      endpoint === "/users/" ? rawUsers.map(flattenMisUser) : rawUsers;

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    return handleMisError(error, res, "Error fetching users");
  }
};

const EMPTY_ROSTER = {
  success: true,
  count: 0,
  data: {
    students: [] as any[],
    filters: { subjects: [] as any[], class_groups: [] as any[] },
    academic_year_id: null as number | null,
    total: 0,
  },
};

// @desc    The roster an instructor needs: everyone in the class groups they're
//          assigned to teach, each tagged with which of the instructor's
//          subjects that student is actually enrolled in. Merges three MIS
//          endpoints teachers CAN reach (VIEW_MY_ASSIGNED_SUBJECTS /
//          VIEW_MY_STUDENTS / class-group roster) rather than the
//          subject-scoped endpoints that need the admin-only
//          VIEW_SUBJECT_ENROLLED_STUDENTS and so returned nothing for them.
// @route   GET /api/users/my-students
// @access  Private (USERS_VIEW_ALL)
export const getMyStudents = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    const base = process.env.NGA_MIS_BASE_URL;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const httpsAgent =
      process.env.NODE_ENV === "production"
        ? new (require("https").Agent)({ rejectUnauthorized: true })
        : undefined;

    const termId = await resolveAcademicTermId(req);
    const termParam = termId ? { academic_term_id: termId } : {};

    // 1. What the instructor is assigned to teach this term — the source of the
    //    subject + class-group filter lists and the "(subject, class group)"
    //    pairs that decide which subject badges a student gets.
    const assignedRes = await axios.get(`${base}/academics/my-assigned-subjects`, {
      headers: authHeaders,
      params: termParam,
      httpsAgent,
    });
    const assignedSubjectsRaw: any[] = assignedRes.data?.data ?? [];

    const subjectFilter = new Map<number, any>();
    const classGroupFilter = new Map<number, any>();
    const taughtPairs = new Set<string>(); // `${classGroupId}-${subjectId}`
    let yearId: number | null = null;

    for (const subj of assignedSubjectsRaw) {
      const sid = Number(subj.subject_id ?? subj.id);
      if (!isNaN(sid) && !subjectFilter.has(sid)) {
        subjectFilter.set(sid, {
          subject_id: sid,
          subject_name: subj.subject_name ?? subj.name ?? "",
          subject_code: subj.subject_code ?? subj.code ?? null,
        });
      }
      for (const g of subj.grades ?? []) {
        const cgId = Number(g.class_group_id);
        if (isNaN(cgId)) continue;
        yearId = yearId ?? (g.academic_year_id ? Number(g.academic_year_id) : null);
        if (!classGroupFilter.has(cgId)) {
          classGroupFilter.set(cgId, {
            class_group_id: cgId,
            class_group_name: g.class_group_name ?? g.grade_name ?? "",
            grade_name: g.grade_name ?? "",
            program_name: g.program_name ?? "",
          });
        }
        if (!isNaN(sid)) taughtPairs.add(`${cgId}-${sid}`);
      }
    }

    if (yearId == null) {
      yearId = (await resolveAcademicYearId(req)) ?? null;
    }

    // Optional narrowing from the UI
    const subjectIdParam = req.query.subjectId ? Number(req.query.subjectId) : null;
    const classGroupIdParam = req.query.classGroupId
      ? Number(req.query.classGroupId)
      : null;

    // 2. Strict roster — students who are BOTH in one of the instructor's class
    //    groups AND enrolled in the subject taught to that group. Gives us the
    //    per-student subject badges.
    const subjectsByStudent = new Map<number, Map<number, any>>();
    try {
      const myStudentsRes = await axios.get(`${base}/academics/my-students`, {
        headers: authHeaders,
        params: termParam,
        httpsAgent,
      });
      for (const s of myStudentsRes.data?.data?.students ?? []) {
        const uid = Number(s.user_id);
        if (isNaN(uid)) continue;
        const map = subjectsByStudent.get(uid) ?? new Map<number, any>();
        for (const sub of s.subjects ?? []) {
          const sid = Number(sub.subject_id);
          if (!isNaN(sid)) map.set(sid, sub);
        }
        subjectsByStudent.set(uid, map);
      }
    } catch (e: any) {
      console.warn("getMyStudents: my-students fetch failed:", e.message);
    }

    // 3. Full membership of each assigned class group — so students physically
    //    in the instructor's class are never hidden by a subject-enrollment gap.
    const targetClassGroups = [...classGroupFilter.values()].filter(
      (cg) => classGroupIdParam == null || cg.class_group_id === classGroupIdParam,
    );

    const byStudent = new Map<number, any>();
    await Promise.all(
      targetClassGroups.map(async (cg) => {
        try {
          const rosterRes = await axios.get(
            `${base}/academics/class-groups/${cg.class_group_id}/students`,
            {
              headers: authHeaders,
              params: yearId ? { academic_year_id: yearId } : {},
              httpsAgent,
            },
          );
          for (const s of rosterRes.data?.data ?? []) {
            const uid = Number(s.user_id);
            if (isNaN(uid)) continue;
            const enrolledSubjects = [
              ...(subjectsByStudent.get(uid)?.values() ?? []),
            ];
            const existing = byStudent.get(uid);
            const record = existing ?? {
              user_id: uid,
              username: s.username ?? null,
              email: s.email ?? null,
              first_name: s.first_name ?? null,
              last_name: s.last_name ?? null,
              gender: s.gender ?? null,
              class_group_id: cg.class_group_id,
              class_group_name: cg.class_group_name,
              grade_name: cg.grade_name,
              program_name: cg.program_name,
              subjects: enrolledSubjects,
            };
            if (existing) {
              // student in more than one of the instructor's groups — merge badges
              const seen = new Set(existing.subjects.map((x: any) => x.subject_id));
              for (const sub of enrolledSubjects) {
                if (!seen.has(sub.subject_id)) existing.subjects.push(sub);
              }
            } else {
              byStudent.set(uid, record);
            }
          }
        } catch (e: any) {
          console.warn(
            `getMyStudents: class-group ${cg.class_group_id} roster failed:`,
            e.message,
          );
        }
      }),
    );

    let students = [...byStudent.values()];
    if (subjectIdParam != null) {
      students = students.filter((s) =>
        s.subjects.some((sub: any) => sub.subject_id === subjectIdParam),
      );
    }
    students.sort((a, b) =>
      `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(
        `${b.first_name ?? ""} ${b.last_name ?? ""}`,
      ),
    );

    return res.status(200).json({
      success: true,
      count: students.length,
      data: {
        students,
        filters: {
          subjects: [...subjectFilter.values()].sort((a, b) =>
            a.subject_name.localeCompare(b.subject_name),
          ),
          class_groups: [...classGroupFilter.values()].sort((a, b) =>
            a.class_group_name.localeCompare(b.class_group_name),
          ),
        },
        academic_year_id: yearId,
        total: students.length,
      },
    });
  } catch (error: any) {
    // 404 (nothing there) or 403 (teacher with no assignments / missing the
    // MIS perm) both mean "empty roster", not a hard error for the UI.
    if (error.response?.status === 404 || error.response?.status === 403) {
      return res.status(200).json(EMPTY_ROSTER);
    }
    return handleMisError(error, res, "Error fetching your students");
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // IDOR Protection: Users can only view their own profile unless they hold USERS_VIEW_ALL
    if (
      req.user.id.toString() !== req.params.id &&
      !req.user.permissions?.has("USERS_VIEW_ALL")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this user profile",
      });
    }

    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/users/${req.params.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(200).json({ success: true, data: response.data.data });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return handleMisError(error, res, "Error fetching user profile");
  }
};

// @desc    Get user's enrolled courses
// @route   GET /api/users/:userId/courses
// @access  Private/Admin/Instructor
export const getUserCourses = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only holders of USERS_VIEW_OTHERS_ACTIVITY can view another user's courses
    if (!req.user.permissions?.has("USERS_VIEW_OTHERS_ACTIVITY")) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user's courses",
      });
    }

    // Fetch user's enrolled subjects from MIS API, scoped to the selected
    // academic year (otherwise MIS returns every enrollment across every
    // year the student has ever had).
    const userCoursesYearId = await resolveAcademicYearId(req);
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: userCoursesYearId
          ? { academic_year_id: userCoursesYearId }
          : {},
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      const courses = response.data.data || [];
      res.status(200).json({
        success: true,
        count: courses.length,
        data: courses,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch user courses from MIS",
      });
    }
  } catch (error: any) {
    return handleMisError(error, res, "Error fetching user courses");
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, roleIds } = req.body;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Input validation is now handled by middleware (see validation.middleware.ts)
    // but the controller handles the MIS integration securely

    const response = await axios.post(
      `${process.env.NGA_MIS_BASE_URL}/users/`,
      {
        email,
        firstName: first_name,
        lastName: last_name,
        roleIds: roleIds || [],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(201).json({
        success: true,
        data: response.data.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.message || "Failed to create user",
      });
    }
  } catch (error: any) {
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.response.data.message || "User already exists",
      });
    }
    return handleMisError(error, res, "Error creating user");
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email } = req.body;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const response = await axios.put(
      `${process.env.NGA_MIS_BASE_URL}/users/${req.params.id}`,
      {
        firstName: first_name,
        lastName: last_name,
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(200).json({
        success: true,
        data: response.data.data,
      });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return handleMisError(error, res, "Error updating user");
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const response = await axios.delete(
      `${process.env.NGA_MIS_BASE_URL}/users/${req.params.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(200).json({ success: true, data: {} });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error: any) {
    console.error("Delete user error:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// Note: Course enrollment is managed through the MIS system
// These endpoints are kept for backward compatibility but should ideally
// be handled through the MIS API's enrollment endpoints

// @desc    Enroll user in course
// @route   POST /api/users/:userId/enroll/:courseId
// @access  Private/Admin
export const enrollInCourse = async (req: Request, res: Response) => {
  try {
    // Course enrollment should be managed through MIS API
    // This is a placeholder for backward compatibility
    res.status(501).json({
      success: false,
      message: "Course enrollment is managed through the MIS system",
    });
  } catch (error) {
    console.error("Enroll in course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Withdraw user from course
// @route   DELETE /api/users/:userId/enroll/:courseId
// @access  Private/Admin
export const withdrawFromCourse = async (req: Request, res: Response) => {
  try {
    // Course withdrawal should be managed through MIS API
    // This is a placeholder for backward compatibility
    res.status(501).json({
      success: false,
      message: "Course withdrawal is managed through the MIS system",
    });
  } catch (error) {
    console.error("Withdraw from course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// @desc    Get user profile picture
// @route   GET /api/users/profile-picture/:filename
// @access  Public
export const getProfilePicture = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const found = await fileServer.streamTo(
      `profile-pictures/${filename}`,
      res,
    );
    if (found) return;

    // Pre-migration profile pictures were written directly to local disk.
    const legacyPath = path.join(
      __dirname,
      "../../uploads/profile-pictures",
      filename,
    );
    if (fs.existsSync(legacyPath)) {
      return res.sendFile(legacyPath);
    }
    res.status(404).json({ success: false, message: "Image not found" });
  } catch (error) {
    console.error("Get profile picture error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get student's assignments and submissions
// @route   GET /api/users/:userId/assignments
// @access  Private/Admin/Instructor
export const getStudentAssignments = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // IDOR Protection
    if (
      req.user.id.toString() !== userId &&
      !req.user.permissions?.has("USERS_VIEW_OTHERS_ACTIVITY")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these assignments",
      });
    }

    // userId from URL is the MIS user ID — find the matching local user record
    const localUser = await User.findOne({ where: { mis_user_id: Number(userId) } });
    const localStudentId = localUser?.id ?? null;

    // Fetch enrolled subjects from MIS — treat any failure as empty enrollment.
    // Scoped to the selected academic year (otherwise MIS returns every
    // enrollment across every year the student has ever had).
    let enrolledSubjects: any[] = [];
    try {
      const enrolledYearId = await resolveAcademicYearId(req);
      const misResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          params: enrolledYearId ? { academic_year_id: enrolledYearId } : {},
        },
      );
      enrolledSubjects = misResponse.data?.success
        ? misResponse.data.data || []
        : [];
    } catch (misError: any) {
      console.error("MIS enrolled-subjects fetch failed:", misError.message);
      // Non-fatal: student may simply have no enrollment data yet
    }

    const courseIds = enrolledSubjects
      .map((s: any) => Number(s.subject_id))
      .filter((id: number) => !isNaN(id) && id > 0);

    // No enrolled courses → return empty result immediately (avoids Op.in([]) edge case)
    if (courseIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // Fetch all assignments for enrolled courses, left-joining the student's
    // submission, scoped to the selected term so other terms' assignments
    // don't show up here.
    const assignmentsTermId = await resolveAcademicTermId(req);
    const assignmentsTermWhere = assignmentsTermId
      ? {
          [Op.or]: [
            { academic_term_id: assignmentsTermId },
            { academic_term_id: null },
          ],
        }
      : undefined;
    const submissionWhere = localStudentId ? { student_id: localStudentId } : undefined;
    const assignments = await Assignment.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: { [Op.in]: ["published", "completed"] },
        ...assignmentsTermWhere,
      },
      include: [
        {
          model: Submission,
          as: "submissions",
          where: submissionWhere,
          required: false,
        },
      ],
      order: [["due_date", "DESC"]],
    });

    const data = assignments.map((assignment: any) => {
      const subject = enrolledSubjects.find(
        (s: any) => Number(s.subject_id) === Number(assignment.course_id),
      );
      return {
        ...assignment.toJSON(),
        subject: subject
          ? {
              subject_name: subject.subject_name,
              subject_code: subject.subject_code,
              subject_description: subject.subject_description,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error("Get student assignments error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get student's quiz submissions
// @route   GET /api/users/:userId/quizzes
// @access  Private/Admin/Instructor
export const getStudentQuizzes = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // IDOR Protection
    if (
      req.user.id.toString() !== userId &&
      !req.user.permissions?.has("USERS_VIEW_OTHERS_ACTIVITY")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these quizzes",
      });
    }

    // userId from URL is the MIS user ID — find the matching local user record
    const localUser = await User.findOne({ where: { mis_user_id: Number(userId) } });
    const localStudentId = localUser?.id ?? null;

    // Fetch user's enrolled subjects from MIS API, scoped to the selected
    // academic year (otherwise MIS returns every enrollment across every
    // year the student has ever had).
    const studentQuizzesYearId = await resolveAcademicYearId(req);
    const misResponse = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: studentQuizzesYearId
          ? { academic_year_id: studentQuizzesYearId }
          : {},
      },
    );

    const enrolledSubjects = misResponse.data.success
      ? misResponse.data.data || []
      : [];
    const courseIds = enrolledSubjects
      .map((s: any) => Number(s.subject_id))
      .filter((id: number) => !isNaN(id) && id > 0);

    if (courseIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // Fetch all quizzes for these courses, scoped to the selected term, and
    // include the student's submission if it exists.
    const studentQuizzesTermId = await resolveAcademicTermId(req);
    const studentQuizzesTermWhere = studentQuizzesTermId
      ? {
          [Op.or]: [
            { academic_term_id: studentQuizzesTermId },
            { academic_term_id: null },
          ],
        }
      : undefined;
    const quizzes = await Quiz.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        // status: { [Op.in]: ["published", "completed"] },
        ...studentQuizzesTermWhere,
      },
      include: [
        {
          model: QuizSubmission,
          as: "quizSubmissions",
          where: localStudentId ? { student_id: localStudentId } : undefined,
          required: false, // Left join
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Map subject info onto quizzes
    const data = quizzes.map((quiz: any) => {
      const subject = enrolledSubjects.find(
        (s: any) => Number(s.subject_id) === Number(quiz.course_id),
      );
      return {
        ...quiz.toJSON(),
        subject: subject
          ? {
              subject_name: subject.subject_name,
              subject_code: subject.subject_code,
              subject_description: subject.subject_description,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error: any) {
    console.error("Get student quizzes error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
