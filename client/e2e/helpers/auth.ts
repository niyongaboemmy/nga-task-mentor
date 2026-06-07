import type { Page } from "@playwright/test";

// ─── Mock user profiles ───────────────────────────────────────────────────────

export const MOCK_USERS = {
  instructor: {
    id: "101",
    first_name: "Alice",
    last_name: "Johnson",
    email: "alice.johnson@teacher.com",
    role: "instructor",
    roles: [{ id: 4, name: "instructor" }],
    permissions: ["manage_courses", "view_reports"],
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
    permissions: ["view_own_reports"],
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
    permissions: ["*"],
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

  // Mock the /auth/me or equivalent profile endpoint
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: user }),
    }),
  );

  // Mock token refresh or verify
  await page.route("**/api/v1/auth/verify**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, user }),
    }),
  );

  // Mock /dashboard endpoints based on role
  if (role === "instructor" || role === "admin") {
    await page.route("**/api/v1/dashboard/**", (route) =>
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
    await page.route("**/api/v1/dashboard/**", (route) =>
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
