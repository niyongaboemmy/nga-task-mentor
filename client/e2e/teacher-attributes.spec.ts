/**
 * E2E: Class Teacher – General Attributes Journey
 *
 * Scenario: An instructor (acting as class teacher) logs in, navigates to the
 * General Attributes page for a course, rates Punctuality as "Excellent" for
 * the first student, types a comment, and clicks "Save All".
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  COURSE_ID,
  MOCK_STUDENTS,
  MOCK_ATTRIBUTES_SAVE_RESPONSE,
} from "./fixtures/reportCard";

test.describe("Class Teacher – General Attributes Form", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "instructor");

    // Mock students enrolled in the course
    await page.route(`**/api/v1/courses/${COURSE_ID}/students`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, count: MOCK_STUDENTS.length, data: MOCK_STUDENTS }),
      }),
    );

    // Mock the attributes save endpoint
    await page.route("**/api/v1/report-cards/attributes/save", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ATTRIBUTES_SAVE_RESPONSE),
      }),
    );

    await page.goto(
      `/courses/${COURSE_ID}/report-card-attributes?term=Term+2&year=2025-2026`,
    );
  });

  test("page renders heading and student rows", async ({ page }) => {
    await expect(page.getByText("General Attributes")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(page.getByText("Jane Smith")).toBeVisible();
  });

  test("attribute columns are present for all general attributes", async ({ page }) => {
    const table = page.getByTestId("attributes-table");
    await expect(table).toBeVisible({ timeout: 6000 });

    for (const attr of [
      "Punctuality",
      "Obedience",
      "Neatness",
      "Participation",
      "Cooperation",
      "Responsibility",
    ]) {
      await expect(page.getByRole("columnheader", { name: attr })).toBeVisible();
    }
  });

  test("attendance radio buttons default to Present and can be changed", async ({ page }) => {
    // Default is Present for all students
    const presentRadio = page.getByRole("radio", { name: "Present" }).first();
    await expect(presentRadio).toBeChecked({ timeout: 5000 });

    // Change first student to Absent
    const absentRadio = page.getByRole("radio", { name: "Absent" }).first();
    await absentRadio.click();
    await expect(absentRadio).toBeChecked();
  });

  test("rating a student attribute enables save and API receives correct payload", async ({
    page,
  }) => {
    // Rate Punctuality as "Excellent" for the first student (John Doe)
    const excellentRadios = page.getByRole("radio", { name: "Excellent" });
    await excellentRadios.first().click();

    // Type a comment for the first student
    const commentAreas = page.getByRole("textbox", { name: /Comment for John Doe/i });
    await commentAreas.fill("Excellent progress this term.");

    // Intercept the save request and click Save All
    const [saveRequest] = await Promise.all([
      page.waitForRequest("**/api/v1/report-cards/attributes/save"),
      page.getByTestId("save-all-button").click(),
    ]);

    const payload = saveRequest.postDataJSON();
    expect(payload).toMatchObject({
      student_id: MOCK_STUDENTS[0].id,
      term: "Term 2",
      academic_year: "2025-2026",
      class_teacher_comment: "Excellent progress this term.",
      attendance_present: 1,
      attributes: expect.arrayContaining([
        expect.objectContaining({ attribute_name: "Punctuality", rating: "Excellent" }),
      ]),
    });
  });

  test("saved checkmarks appear after successful save", async ({ page }) => {
    // Rate at least one attribute for every student
    const excellentRadios = page.getByRole("radio", { name: "Excellent" });
    const radiosCount = await excellentRadios.count();

    // Click first attribute "Excellent" per student row
    // Students × attributes × ratings = 2 × 6 × 3, so step by 18 for each student row
    const perStudent = 6; // 6 attributes
    for (let i = 0; i < MOCK_STUDENTS.length; i++) {
      await excellentRadios.nth(i * perStudent).click();
    }

    await page.getByTestId("save-all-button").click();

    // After both students are saved, progress badge should show 2/2
    await expect(page.getByText(/2\/2 saved/i)).toBeVisible({ timeout: 10000 });
  });

  test("validation error shown when saving with no attributes rated", async ({ page }) => {
    // Don't rate any attributes, just click save
    await page.getByTestId("save-all-button").click();

    await expect(
      page.getByText(/Please rate at least one attribute/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("save-all button shows spinner while saving", async ({ page }) => {
    // Delay the mock response to observe the loading state
    await page.route("**/api/v1/report-cards/attributes/save", async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ATTRIBUTES_SAVE_RESPONSE),
      });
    });

    const excellentRadios = page.getByRole("radio", { name: "Excellent" });
    const perStudent = 6;
    for (let i = 0; i < MOCK_STUDENTS.length; i++) {
      await excellentRadios.nth(i * perStudent).click();
    }

    const saveBtn = page.getByTestId("save-all-button");
    await saveBtn.click();

    // Spinner or "Saving…" text visible during save
    await expect(page.getByText(/Saving…/i)).toBeVisible({ timeout: 3000 });
  });
});
