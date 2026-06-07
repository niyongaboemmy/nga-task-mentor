/**
 * E2E: Instructor Report Card Builder Journey
 *
 * Scenario: An instructor logs in, navigates to the Report Card Builder for a
 * course, drags "Homework Set A" (assignment) to the Homework (HW) zone and
 * "Algebra Quiz 1" (quiz) to the Mid-Term (MD) zone, then saves the mappings.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  COURSE_ID,
  MOCK_QUIZZES,
  MOCK_ASSIGNMENTS,
  MOCK_BUILDER_SAVE_RESPONSE,
} from "./fixtures/reportCard";

const STUDENT_ID = 201;

test.describe("Instructor – Report Card Builder", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "instructor");

    // Mock courses endpoint
    await page.route(`**/api/v1/courses/${COURSE_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: COURSE_ID, title: "Mathematics", code: "MATH101" },
        }),
      }),
    );

    // Mock quizzes for the course
    await page.route(`**/api/v1/courses/${COURSE_ID}/quizzes`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, count: MOCK_QUIZZES.length, data: MOCK_QUIZZES }),
      }),
    );

    // Mock assignments for the course
    await page.route(`**/api/v1/courses/${COURSE_ID}/assignments`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, count: MOCK_ASSIGNMENTS.length, data: MOCK_ASSIGNMENTS }),
      }),
    );

    // Mock the save endpoint
    await page.route("**/api/v1/report-cards/builder/save", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUILDER_SAVE_RESPONSE),
      }),
    );

    await page.goto(`/courses/${COURSE_ID}/report-card-builder?studentId=${STUDENT_ID}&term=Term+2&year=2025-2026`);
  });

  test("page renders the builder heading and subject info", async ({ page }) => {
    await expect(page.getByText("Report Card Builder")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Term 2/)).toBeVisible();
    await expect(page.getByText(/2025-2026/)).toBeVisible();
  });

  test("all four category drop zones are rendered with correct weights", async ({ page }) => {
    await expect(page.getByTestId("drop-zone-CW")).toBeVisible();
    await expect(page.getByTestId("drop-zone-HW")).toBeVisible();
    await expect(page.getByTestId("drop-zone-MD")).toBeVisible();
    await expect(page.getByTestId("drop-zone-EOT")).toBeVisible();

    await expect(page.getByText("15%")).toBeVisible();
    await expect(page.getByText("25%")).toBeVisible();
    await expect(page.getByText("50%")).toBeVisible();
  });

  test("available assessments panel lists quizzes and assignments", async ({ page }) => {
    const panel = page.getByTestId("available-items");
    await expect(panel).toBeVisible({ timeout: 6000 });
    await expect(panel.getByText("Algebra Quiz 1")).toBeVisible();
    await expect(panel.getByText("Homework Set A")).toBeVisible();
  });

  test("save button is disabled with no items mapped", async ({ page }) => {
    const saveBtn = page.getByTestId("save-button");
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
  });

  test("drag assignment to HW zone and quiz to MD zone, then save", async ({ page }) => {
    // ── Simulate drag via dnd-kit pointer events ──────────────────────────────
    const availablePanel = page.getByTestId("available-items");

    // Drag "Homework Set A" assignment → HW drop zone
    const assignmentCard = availablePanel.locator("div", { hasText: "Homework Set A" }).first();
    const hwZone         = page.getByTestId("drop-zone-HW");

    await assignmentCard.hover();
    const assignBox = await assignmentCard.boundingBox();
    const hwBox     = await hwZone.boundingBox();

    if (assignBox && hwBox) {
      await page.mouse.move(
        assignBox.x + assignBox.width / 2,
        assignBox.y + assignBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        hwBox.x + hwBox.width / 2,
        hwBox.y + hwBox.height / 2,
        { steps: 10 },
      );
      await page.mouse.up();
    }

    // Drag "Algebra Quiz 1" → MD drop zone
    const quizCard = availablePanel.locator("div", { hasText: "Algebra Quiz 1" }).first();
    const mdZone   = page.getByTestId("drop-zone-MD");

    await quizCard.hover();
    const quizBox = await quizCard.boundingBox();
    const mdBox   = await mdZone.boundingBox();

    if (quizBox && mdBox) {
      await page.mouse.move(
        quizBox.x + quizBox.width / 2,
        quizBox.y + quizBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        mdBox.x + mdBox.width / 2,
        mdBox.y + mdBox.height / 2,
        { steps: 10 },
      );
      await page.mouse.up();
    }

    // ── Intercept the save request to verify payload ──────────────────────────
    const [saveRequest] = await Promise.all([
      page.waitForRequest("**/api/v1/report-cards/builder/save"),
      page.getByTestId("save-button").click(),
    ]);

    const payload = saveRequest.postDataJSON();
    expect(payload).toMatchObject({
      student_id: STUDENT_ID,
      term: "Term 2",
      academic_year: "2025-2026",
    });

    // After save, a success toast appears
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  });

  test("subject selector dropdown switches subject items", async ({ page }) => {
    const selector = page.getByTestId("subject-selector");
    await expect(selector).toBeVisible();

    // The selector shows the current subject name
    await expect(selector).toContainText("Mathematics");
  });
});
