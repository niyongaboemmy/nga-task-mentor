/**
 * E2E: Question Bank questions are edited on their own page, not in a pop-up
 * (CODE_RUNNER_PLAN.md §7.3). Mocked API.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");
test.beforeEach(({}, info) => test.skip(info.project.name === "mobile", "desktop layout"));

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const QUESTION = {
  id: 12,
  course_id: 5,
  question_type: "coding",
  question_text: "<p>Add two numbers</p>",
  difficulty_level: "easy",
  tags: [],
  question_data: { language: "python", starter_code: "print(0)", test_cases: [{ id: "t1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 }] },
};

test("edit a question on its page, save, and return to where you were", async ({ page }) => {
  const puts: unknown[] = [];
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  await loginAs(page, "instructor");
  await page.route("**/api/courses/5/question-bank/12", (r) => {
    if (r.request().method() === "PUT") {
      puts.push(r.request().postDataJSON());
      return json(r, { success: true, data: QUESTION });
    }
    return json(r, { success: true, data: QUESTION });
  });
  await page.route("**/api/courses/5", (r) => json(r, { success: true, data: { id: 5, title: "Programming", class_group_id: 1, academic_term_id: 1 } }));

  await page.goto(`/taskmentor/courses/5/question-bank/12/edit?back=${encodeURIComponent("/courses/5/question-bank?type=coding")}`);
  await expect(page.getByTestId("question-editor-page")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Edit question" })).toBeVisible();
  // A page, not an overlay.
  await expect(page.locator(".fixed.inset-0.bg-black\\/60")).toHaveCount(0);
  await shot(page, "question-edit-page");

  for (let i = 0; i < 3; i++) {
    const save = page.getByRole("button", { name: /Update Question/ });
    if (await save.isVisible().catch(() => false)) break;
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: /Update Question/ }).click();
  await expect.poll(() => puts.length).toBe(1);
  await expect(page).toHaveURL(/\/taskmentor\/courses\/5\/question-bank\?type=coding$/);
});

test("a back address outside the app is ignored", async ({ page }) => {
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  await loginAs(page, "instructor");
  await page.goto(`/taskmentor/courses/5/question-bank/new?back=${encodeURIComponent("//evil.example/x")}`);
  await expect(page.getByTestId("question-editor-page")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/taskmentor\/courses\/5\/question-bank$/);
});
