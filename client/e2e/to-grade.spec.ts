/**
 * E2E: To grade inbox, its menu badge, and the Code area's addresses
 * (CODE_RUNNER_PLAN.md phase 2a) against the Vite dev server with a mocked
 * API. Screenshots go to $TMCODE_SHOTS.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const day = 86_400_000;
const INBOX = {
  items: [
    { id: 77, kind: "assignment", title: "Linked lists in C", subject: { id: 12, name: "Programming", code: "S4 SOD" }, to_grade: 12, late: 3, due_at: new Date(Date.now() - 2 * day).toISOString(), waiting_days: 8, oldest_at: new Date(Date.now() - 8 * day).toISOString(), code: true, grade_url: "/grading/assignment/77" },
    { id: 31, kind: "quiz", title: "Python basics", subject: { id: 12, name: "Programming", code: "S4 SOD" }, to_grade: 25, late: 0, due_at: null, waiting_days: 1, oldest_at: new Date(Date.now() - day).toISOString(), code: true, grade_url: "/quizzes/31/submissions" },
    { id: 40, kind: "assignment", title: "Essay: the history of computing", subject: { id: 15, name: "ICT", code: "S3 ICT" }, to_grade: 4, late: 1, due_at: new Date(Date.now() - day).toISOString(), waiting_days: 0, oldest_at: new Date().toISOString(), code: false, grade_url: "/assignments/40" },
  ],
  total_to_grade: 41,
  generated_at: new Date().toISOString(),
};

async function setup(page: Page) {
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  await loginAs(page, "instructor");
  await page.route("**/api/dashboard/instructor/grading-inbox**", (r) => json(r, { success: true, data: INBOX }));
}

test("a teacher finds everything to grade in one list, with one button per activity", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop menu; phone layout below");
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto("/taskmentor/dashboard");
  const nav = page.getByRole("link", { name: /To grade/ });
  await expect(nav.getByTestId("nav-badge")).toHaveText("41");
  await nav.click();
  await expect(page).toHaveURL(/\/grading$/);
  await expect(page.getByTestId("to-grade-item")).toHaveCount(3);
  await expect(page.getByText(/41 submissions waiting in 3 activities/)).toBeVisible();
  await shot(page, "to-grade");

  // Filters live in the URL.
  await page.getByRole("button", { name: "Quizzes" }).click();
  await expect(page).toHaveURL(/type=quiz/);
  await expect(page.getByTestId("to-grade-item")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("to-grade-item")).toHaveCount(1);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByTestId("to-grade-item")).toHaveCount(3);

  // Code work opens Grading directly.
  await page.getByTestId("to-grade-item").first().getByTestId("to-grade-open").click();
  await expect(page).toHaveURL(/\/grading\/assignment\/77$/);
});

test("old project addresses lead to the Code area", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "checked on desktop");
  await setup(page);
  await page.goto("/taskmentor/projects?view=table");
  await expect(page).toHaveURL(/\/code\/projects\?view=table$/);
  await expect(page.getByRole("link", { name: "Code", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goto("/taskmentor/projects/monitor");
  await expect(page).toHaveURL(/\/code\/live$/);
  await expect(page.getByRole("link", { name: "Live coding" })).toHaveAttribute("aria-current", "page");
});

test("To grade on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await setup(page);
  await page.goto("/taskmentor/grading");
  await expect(page.getByTestId("to-grade-item")).toHaveCount(3);
  await shot(page, "to-grade-mobile");
});
