/**
 * Canonical permission catalog for the local RBAC system.
 *
 * This is the single source of truth for every permission key used by
 * `authorizePermission` (see `middleware/auth.ts`) and by the
 * Roles & Permissions admin module. The seed migration
 * (`migrations/*-seed-default-roles-and-permissions.js`) duplicates this
 * list as a literal array rather than importing it, since Sequelize
 * migrations are meant to be frozen snapshots independent of `src`
 * evolving over time — if you add/rename a key here, also add a new
 * migration to reconcile the `permissions` table (never edit an already
 *-applied migration).
 *
 * NOTE: this is unrelated to the external NGA Central MIS's own
 * `roles`/`permissions` payload (e.g. `MANAGE_USERS`, `VIEW_PROGRAM_USERS`)
 * which is a different system's catalog, passed through to the frontend
 * `User.permissions` field but never consulted here.
 */

export const PERMISSION_CATEGORIES = [
  "USERS",
  "COURSES",
  "ASSIGNMENTS",
  "SUBMISSIONS",
  "QUIZZES",
  "QUIZ_QUESTIONS",
  "QUESTION_BANK",
  "GRADING",
  "PROCTORING",
  "REPORT_CARDS",
  "MANUAL_ASSESSMENTS",
  "DASHBOARD",
  "ACADEMICS",
  "DATABASE_ADMIN",
  "ROLES_PERMISSIONS",
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export interface PermissionDefinition {
  key: string;
  category: PermissionCategory;
  description: string;
}

export const PERMISSIONS: readonly PermissionDefinition[] = [
  // USERS
  { key: "USERS_VIEW_SELF", category: "USERS", description: "View own user profile" },
  { key: "USERS_VIEW_ALL", category: "USERS", description: "View any user's profile" },
  { key: "USERS_CREATE", category: "USERS", description: "Create user accounts" },
  { key: "USERS_EDIT", category: "USERS", description: "Edit any user account" },
  { key: "USERS_DELETE", category: "USERS", description: "Delete user accounts" },
  { key: "USERS_MANAGE_ENROLLMENT", category: "USERS", description: "Enroll/withdraw users from courses" },
  { key: "USERS_VIEW_OTHERS_ACTIVITY", category: "USERS", description: "View another user's assignments/quizzes/courses" },

  // COURSES
  { key: "COURSES_VIEW", category: "COURSES", description: "View course list/details" },
  { key: "COURSES_CREATE", category: "COURSES", description: "Create courses" },
  { key: "COURSES_EDIT", category: "COURSES", description: "Edit course details" },
  { key: "COURSES_DELETE", category: "COURSES", description: "Delete courses" },
  { key: "COURSES_VIEW_STUDENTS", category: "COURSES", description: "View a course's enrolled students" },
  { key: "COURSES_VIEW_GRADES", category: "COURSES", description: "View all students' grades for a course" },
  { key: "COURSES_VIEW_OWN_GRADES", category: "COURSES", description: "View own grades for a course" },

  // ASSIGNMENTS
  { key: "ASSIGNMENTS_VIEW", category: "ASSIGNMENTS", description: "View assignments" },
  { key: "ASSIGNMENTS_CREATE", category: "ASSIGNMENTS", description: "Create assignments" },
  { key: "ASSIGNMENTS_EDIT", category: "ASSIGNMENTS", description: "Edit/publish assignments" },
  { key: "ASSIGNMENTS_DELETE", category: "ASSIGNMENTS", description: "Delete assignments" },
  { key: "ASSIGNMENTS_VIEW_SUBMISSIONS", category: "ASSIGNMENTS", description: "View all submissions for an assignment" },
  { key: "ASSIGNMENTS_MANAGE_ANY", category: "ASSIGNMENTS", description: "Edit/delete any assignment regardless of ownership (bypasses the owning-instructor check)" },

  // SUBMISSIONS
  { key: "SUBMISSIONS_VIEW_OWN", category: "SUBMISSIONS", description: "View own submissions" },
  { key: "SUBMISSIONS_VIEW_ALL", category: "SUBMISSIONS", description: "View any student's submissions" },
  { key: "SUBMISSIONS_CREATE", category: "SUBMISSIONS", description: "Create/submit a submission" },
  { key: "SUBMISSIONS_GRADE", category: "SUBMISSIONS", description: "Grade a submission" },

  // QUIZZES
  { key: "QUIZZES_VIEW", category: "QUIZZES", description: "View quizzes" },
  { key: "QUIZZES_CREATE", category: "QUIZZES", description: "Create quizzes" },
  { key: "QUIZZES_EDIT", category: "QUIZZES", description: "Edit quizzes" },
  { key: "QUIZZES_DELETE", category: "QUIZZES", description: "Delete quizzes" },
  { key: "QUIZZES_ATTEMPT", category: "QUIZZES", description: "Attempt/take a quiz" },
  { key: "QUIZZES_VIEW_RESULTS_OWN", category: "QUIZZES", description: "View own quiz results" },
  { key: "QUIZZES_VIEW_RESULTS_ALL", category: "QUIZZES", description: "View any student's quiz results" },
  { key: "QUIZZES_GRADE", category: "QUIZZES", description: "Grade quiz submissions" },
  { key: "QUIZZES_MANAGE_ANY", category: "QUIZZES", description: "Edit/delete any quiz regardless of ownership (bypasses the owning-instructor check)" },

  // QUIZ_QUESTIONS
  { key: "QUIZ_QUESTIONS_VIEW_WITH_ANSWERS", category: "QUIZ_QUESTIONS", description: "View correct answers for quiz questions" },
  { key: "QUIZ_QUESTIONS_USE_AI_HINT", category: "QUIZ_QUESTIONS", description: "Request AI hints for a question" },
  { key: "QUIZ_QUESTIONS_RUN_CODE", category: "QUIZ_QUESTIONS", description: "Run/execute code for a coding question" },

  // QUESTION_BANK
  { key: "QUESTION_BANK_VIEW", category: "QUESTION_BANK", description: "View a course's question bank" },
  { key: "QUESTION_BANK_CREATE", category: "QUESTION_BANK", description: "Create question bank entries (incl. upload/AI-generate)" },
  { key: "QUESTION_BANK_EDIT", category: "QUESTION_BANK", description: "Edit question bank entries" },
  { key: "QUESTION_BANK_DELETE", category: "QUESTION_BANK", description: "Delete question bank entries" },
  { key: "QUESTION_BANK_MANAGE_ANY", category: "QUESTION_BANK", description: "Edit/delete any question bank entry regardless of ownership" },

  // GRADING
  { key: "GRADING_MANUAL_ASSESS", category: "GRADING", description: "Perform manual (paper-based) assessment scoring" },
  { key: "GRADING_OVERRIDE_SCORE", category: "GRADING", description: "Override an automatically computed score" },

  // PROCTORING
  { key: "PROCTORING_MANAGE_SETTINGS", category: "PROCTORING", description: "Create/edit proctoring settings for a quiz" },
  { key: "PROCTORING_START_SESSION", category: "PROCTORING", description: "Start a proctoring session for own quiz attempt" },
  { key: "PROCTORING_VIEW_SESSIONS", category: "PROCTORING", description: "View any student's proctoring sessions" },
  { key: "PROCTORING_VIEW_OWN_SESSIONS", category: "PROCTORING", description: "View own proctoring sessions" },
  { key: "PROCTORING_JOIN_LIVE_STREAM", category: "PROCTORING", description: "Join a student's live proctoring stream" },
  { key: "PROCTORING_VIEW_ANALYTICS", category: "PROCTORING", description: "View proctoring analytics for a quiz" },
  { key: "PROCTORING_LOG_EVENTS", category: "PROCTORING", description: "Log proctoring events during own attempt" },

  // REPORT_CARDS
  { key: "REPORT_CARDS_VIEW_OWN", category: "REPORT_CARDS", description: "View own report card" },
  { key: "REPORT_CARDS_VIEW_ALL", category: "REPORT_CARDS", description: "View any student's report card" },
  { key: "REPORT_CARDS_CREATE", category: "REPORT_CARDS", description: "Create/build report cards" },
  { key: "REPORT_CARDS_EDIT", category: "REPORT_CARDS", description: "Edit report cards" },
  { key: "REPORT_CARDS_APPROVE", category: "REPORT_CARDS", description: "Approve submitted report cards" },
  { key: "REPORT_CARDS_EXPORT_PDF", category: "REPORT_CARDS", description: "Export report cards as PDF" },

  // MANUAL_ASSESSMENTS
  { key: "MANUAL_ASSESSMENTS_VIEW", category: "MANUAL_ASSESSMENTS", description: "View manual assessments" },
  { key: "MANUAL_ASSESSMENTS_CREATE", category: "MANUAL_ASSESSMENTS", description: "Create manual assessments" },
  { key: "MANUAL_ASSESSMENTS_EDIT", category: "MANUAL_ASSESSMENTS", description: "Edit manual assessments" },
  { key: "MANUAL_ASSESSMENTS_DELETE", category: "MANUAL_ASSESSMENTS", description: "Delete manual assessments" },

  // DASHBOARD
  { key: "DASHBOARD_VIEW_ADMIN", category: "DASHBOARD", description: "View the admin dashboard" },
  { key: "DASHBOARD_VIEW_INSTRUCTOR", category: "DASHBOARD", description: "View the instructor dashboard" },
  { key: "DASHBOARD_VIEW_STUDENT", category: "DASHBOARD", description: "View the student dashboard" },

  // ACADEMICS
  { key: "ACADEMICS_VIEW", category: "ACADEMICS", description: "View academic years/terms" },
  { key: "ACADEMICS_MANAGE_PERIODS", category: "ACADEMICS", description: "Switch/manage academic periods" },

  // DATABASE_ADMIN
  { key: "DATABASE_ADMIN_ACCESS", category: "DATABASE_ADMIN", description: "Access the raw database administration tool" },

  // ROLES_PERMISSIONS
  { key: "ROLES_PERMISSIONS_VIEW", category: "ROLES_PERMISSIONS", description: "View roles and the permission catalog" },
  { key: "ROLES_PERMISSIONS_MANAGE", category: "ROLES_PERMISSIONS", description: "Create/edit/delete roles and assign permissions" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: readonly string[] = PERMISSIONS.map((p) => p.key);

export const PERMISSIONS_BY_CATEGORY: Record<PermissionCategory, PermissionDefinition[]> =
  PERMISSION_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = PERMISSIONS.filter((p) => p.category === category);
      return acc;
    },
    {} as Record<PermissionCategory, PermissionDefinition[]>,
  );

/**
 * Default permission set granted to each of the 3 seeded system roles.
 * Mirrored (as a literal array) in the seed migration.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<"admin" | "instructor" | "student", string[]> = {
  admin: ALL_PERMISSION_KEYS.slice(),

  instructor: [
    "COURSES_VIEW",
    "COURSES_EDIT",
    "COURSES_VIEW_STUDENTS",
    "COURSES_VIEW_GRADES",
    "ASSIGNMENTS_VIEW",
    "ASSIGNMENTS_CREATE",
    "ASSIGNMENTS_EDIT",
    "ASSIGNMENTS_DELETE",
    "ASSIGNMENTS_VIEW_SUBMISSIONS",
    "SUBMISSIONS_VIEW_ALL",
    "SUBMISSIONS_GRADE",
    "QUIZZES_VIEW",
    "QUIZZES_CREATE",
    "QUIZZES_EDIT",
    "QUIZZES_DELETE",
    "QUIZZES_VIEW_RESULTS_ALL",
    "QUIZZES_GRADE",
    "QUIZ_QUESTIONS_VIEW_WITH_ANSWERS",
    "QUIZ_QUESTIONS_USE_AI_HINT",
    "QUIZ_QUESTIONS_RUN_CODE",
    "QUESTION_BANK_VIEW",
    "QUESTION_BANK_CREATE",
    "QUESTION_BANK_EDIT",
    "QUESTION_BANK_DELETE",
    "GRADING_MANUAL_ASSESS",
    "GRADING_OVERRIDE_SCORE",
    "PROCTORING_MANAGE_SETTINGS",
    "PROCTORING_VIEW_SESSIONS",
    "PROCTORING_JOIN_LIVE_STREAM",
    "PROCTORING_VIEW_ANALYTICS",
    "REPORT_CARDS_VIEW_ALL",
    "REPORT_CARDS_CREATE",
    "REPORT_CARDS_EDIT",
    "REPORT_CARDS_EXPORT_PDF",
    "MANUAL_ASSESSMENTS_VIEW",
    "MANUAL_ASSESSMENTS_CREATE",
    "MANUAL_ASSESSMENTS_EDIT",
    "MANUAL_ASSESSMENTS_DELETE",
    "DASHBOARD_VIEW_INSTRUCTOR",
    "ACADEMICS_VIEW",
    "USERS_VIEW_ALL",
    "USERS_VIEW_OTHERS_ACTIVITY",
    "USERS_MANAGE_ENROLLMENT",
  ],

  student: [
    "USERS_VIEW_SELF",
    "COURSES_VIEW",
    "COURSES_VIEW_OWN_GRADES",
    "ASSIGNMENTS_VIEW",
    "SUBMISSIONS_VIEW_OWN",
    "SUBMISSIONS_CREATE",
    "QUIZZES_VIEW",
    "QUIZZES_ATTEMPT",
    "QUIZZES_VIEW_RESULTS_OWN",
    "QUIZ_QUESTIONS_USE_AI_HINT",
    "QUIZ_QUESTIONS_RUN_CODE",
    "PROCTORING_START_SESSION",
    "PROCTORING_VIEW_OWN_SESSIONS",
    "PROCTORING_LOG_EVENTS",
    "REPORT_CARDS_VIEW_OWN",
    "REPORT_CARDS_EXPORT_PDF",
    "DASHBOARD_VIEW_STUDENT",
    "ACADEMICS_VIEW",
  ],
};
