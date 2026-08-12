/**
 * E2E: Sidebar navigation is permission-gated and responsive.
 *
 * Scenario: each of the 3 seeded roles logs in and sees a sidebar whose
 * items match exactly what their local RBAC permissions allow — proving
 * the permission-gating chain works end-to-end (usePermissions -> routeConfig
 * -> Sidebar), not just at the route-guard level. Also covers the sidebar's
 * responsive behavior (mobile drawer open/close, desktop collapse persisted
 * across reload).
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

async function mockCatchAll(page: import("@playwright/test").Page) {
  // Broad fallback so any endpoint a dashboard/page fetches on mount that
  // this spec doesn't care about still resolves instead of hanging/erroring.
  // loginAs() registers its own routes afterward, which take priority.
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    }),
  );
}

test.describe("Sidebar — permission-gated visibility", () => {
  test("student sees only student-appropriate nav items and is blocked from admin pages", async ({
    page,
  }) => {
    await mockCatchAll(page);
    await loginAs(page, "student");
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Quizzes" })).toBeVisible();

    // Instructor/admin-only items must not render for a student
    await expect(page.getByRole("link", { name: "Students" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Database Management" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Roles & Permissions" })).toHaveCount(0);

    // Direct navigation to an admin-only route redirects away
    await page.goto("/admin/database-management");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("instructor sees teaching nav items but not admin-only items", async ({ page }) => {
    await mockCatchAll(page);
    await loginAs(page, "instructor");
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Grades" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Database Management" })).toHaveCount(0);

    await page.goto("/admin/database-management");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("admin sees the Database Management item and can reach the page", async ({ page }) => {
    await mockCatchAll(page);
    await loginAs(page, "admin");
    await page.goto("/dashboard");

    const dbLink = page.getByRole("link", { name: "Database Management" });
    await expect(dbLink).toBeVisible();
    await dbLink.click();
    await expect(page).toHaveURL(/\/admin\/database-management$/);
  });
});

test.describe("Sidebar — responsive behavior", () => {
  test("mobile: hamburger opens the drawer, backdrop click closes it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCatchAll(page);
    await loginAs(page, "student");
    await page.goto("/dashboard");

    // Persistent desktop sidebar is hidden at this width
    await expect(page.locator("aside.hidden.lg\\:flex")).not.toBeVisible();

    await page.getByLabel("Open navigation menu").click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer).toBeVisible();

    // Clicking the backdrop closes the drawer
    await page.locator('[aria-hidden="true"].fixed.inset-0').click({ force: true });
    await expect(drawer).not.toBeVisible();
  });

  test("desktop: collapse toggle persists across reload", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockCatchAll(page);
    await loginAs(page, "instructor");
    await page.goto("/dashboard");

    const collapseButton = page.getByLabel("Collapse sidebar");
    await collapseButton.click();
    await expect(page.getByLabel("Expand sidebar")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Expand sidebar")).toBeVisible();
  });
});
