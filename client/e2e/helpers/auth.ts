import type { Page } from "@playwright/test";

// ─── Mock user profiles ───────────────────────────────────────────────────────

// Local RBAC permission sets mirroring server/src/constants/permissions.ts's
// DEFAULT_ROLE_PERMISSIONS for the 3 seeded system roles — kept in sync
// manually since e2e tests run against mocked network responses, not the
// real DB-backed catalog.
const INSTRUCTOR_PERMISSIONS = [
  "COURSES_VIEW", "COURSES_EDIT", "COURSES_VIEW_STUDENTS", "COURSES_VIEW_GRADES",
  "ASSIGNMENTS_VIEW", "ASSIGNMENTS_CREATE", "ASSIGNMENTS_EDIT", "ASSIGNMENTS_DELETE",
  "ASSIGNMENTS_VIEW_SUBMISSIONS", "SUBMISSIONS_VIEW_ALL", "SUBMISSIONS_GRADE",
  "QUIZZES_VIEW", "QUIZZES_CREATE", "QUIZZES_EDIT", "QUIZZES_DELETE",
  "QUIZZES_VIEW_RESULTS_ALL", "QUIZZES_GRADE", "QUIZ_QUESTIONS_VIEW_WITH_ANSWERS",
  "QUIZ_QUESTIONS_USE_AI_HINT", "QUIZ_QUESTIONS_RUN_CODE", "QUESTION_BANK_VIEW",
  "QUESTION_BANK_CREATE", "QUESTION_BANK_EDIT", "QUESTION_BANK_DELETE",
  "GRADING_MANUAL_ASSESS", "GRADING_OVERRIDE_SCORE", "PROCTORING_MANAGE_SETTINGS",
  "PROCTORING_VIEW_SESSIONS", "PROCTORING_JOIN_LIVE_STREAM", "PROCTORING_VIEW_ANALYTICS",
  "REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT",
  "REPORT_CARDS_EXPORT_PDF", "MANUAL_ASSESSMENTS_VIEW", "MANUAL_ASSESSMENTS_CREATE",
  "MANUAL_ASSESSMENTS_EDIT", "MANUAL_ASSESSMENTS_DELETE", "DASHBOARD_VIEW_INSTRUCTOR",
  "ACADEMICS_VIEW", "USERS_VIEW_ALL", "USERS_VIEW_OTHERS_ACTIVITY", "USERS_MANAGE_ENROLLMENT",
];

const STUDENT_PERMISSIONS = [
  "USERS_VIEW_SELF", "COURSES_VIEW", "COURSES_VIEW_OWN_GRADES", "ASSIGNMENTS_VIEW",
  "SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_CREATE", "QUIZZES_VIEW", "QUIZZES_ATTEMPT",
  "QUIZZES_VIEW_RESULTS_OWN", "QUIZ_QUESTIONS_USE_AI_HINT", "QUIZ_QUESTIONS_RUN_CODE",
  "PROCTORING_START_SESSION", "PROCTORING_VIEW_OWN_SESSIONS", "PROCTORING_LOG_EVENTS",
  "REPORT_CARDS_VIEW_OWN", "REPORT_CARDS_EXPORT_PDF", "DASHBOARD_VIEW_STUDENT", "ACADEMICS_VIEW",
];

export const MOCK_USERS = {
  instructor: {
    id: "101",
    first_name: "Alice",
    last_name: "Johnson",
    email: "alice.johnson@teacher.com",
    role: "instructor",
    roles: [{ id: 4, name: "instructor" }],
    permissions: ["manage_courses", "view_reports"], // external MIS catalog — unrelated
    roleId: 2,
    roleName: "instructor",
    localPermissions: INSTRUCTOR_PERMISSIONS,
    currentAcademicYear: { id: 1, name: "2025-2026" },
    currentAcademicTerm: { id: 1, name: "Term 2" },
  },
  student: {
    id: "201",
    first_name: "John",
    last_name: "Doe",
    email: "john.doe@student.com",
    role: "student",
    roles: [{ id: 5, name: "student" }],
    permissions: ["view_own_reports"], // external MIS catalog — unrelated
    roleId: 3,
    roleName: "student",
    localPermissions: STUDENT_PERMISSIONS,
    currentAcademicYear: { id: 1, name: "2025-2026" },
    currentAcademicTerm: { id: 1, name: "Term 2" },
  },
  admin: {
    id: "1",
    first_name: "Admin",
    last_name: "User",
    email: "admin@nga.ac.rw",
    role: "admin",
    roles: [{ id: 1, name: "admin" }],
    permissions: ["*"], // external MIS catalog — unrelated
    roleId: 1,
    roleName: "admin",
    localPermissions: [...INSTRUCTOR_PERMISSIONS, ...STUDENT_PERMISSIONS, "DATABASE_ADMIN_ACCESS", "ROLES_PERMISSIONS_VIEW", "ROLES_PERMISSIONS_MANAGE", "USERS_CREATE", "USERS_EDIT", "USERS_DELETE", "COURSES_CREATE", "COURSES_DELETE", "REPORT_CARDS_APPROVE", "ASSIGNMENTS_MANAGE_ANY", "QUIZZES_MANAGE_ANY", "QUESTION_BANK_MANAGE_ANY", "PROCTORING_VIEW_ANALYTICS"],
    currentAcademicYear: { id: 1, name: "2025-2026" },
    currentAcademicTerm: { id: 1, name: "Term 2" },
  },
};

type MockUser = (typeof MOCK_USERS)[keyof typeof MOCK_USERS];

/**
 * Injects auth state into the browser by:
 *  1. Setting the JWT token in localStorage before the page loads
 *  2. Mocking the /api/v1/auth/me and /dashboard/* endpoints that AuthContext hits on mount
 */
export async function loginAs(page: Page, role: keyof typeof MOCK_USERS) {
  const user = MOCK_USERS[role];

  // Inject a fake token before any navigation
  await page.addInitScript((u) => {
    localStorage.setItem("token", "fake-e2e-jwt");
    localStorage.setItem("user", JSON.stringify(u));
    // Some SPA frameworks check this key
    localStorage.setItem("isAuthenticated", "true");
  }, user as any);

  // Mock the /auth/me endpoint AuthContext hits on mount. Real backend
  // shape is { success, data: { user, roles, permissions, ... } } — see
  // server/src/controllers/auth.controller.ts getMe().
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { user, roles: user.roles, permissions: user.permissions },
      }),
    }),
  );

  // Mock token refresh or verify
  await page.route("**/api/auth/verify**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, user }),
    }),
  );

  // Mock /dashboard endpoints based on role
  if (role === "instructor" || role === "admin") {
    await page.route("**/api/dashboard/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: { user_id: user.id, first_name: user.first_name, last_name: user.last_name },
            stats: {
              totalCourses: 3,
              totalAssignments: 12,
              pendingSubmissions: 4,
              completedAssignments: 8,
            },
            recentActivity: [],
            gradingSummary: [
              { course_id: 1, title: "Mathematics", code: "MATH101", average_grade: 78, active_students: 25, graded_submissions: 20 },
            ],
            gradeDistribution: { excellent: 5, good: 10, average: 8, poor: 2 },
          },
        }),
      }),
    );
  } else {
    await page.route("**/api/dashboard/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: { user_id: user.id, first_name: user.first_name, last_name: user.last_name },
            stats: { totalCourses: 3, totalAssignments: 5, pendingSubmissions: 2, completedAssignments: 3 },
            pendingAssignments: [],
            recentActivity: [],
            publicQuizzes: [],
            enrolledCourses: [{ id: 1 }],
            availableQuizzes: [],
          },
        }),
      }),
    );
  }
}
