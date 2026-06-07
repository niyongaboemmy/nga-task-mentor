/**
 * E2E: Student – Report Card Dashboard & Preview Journey
 *
 * Scenario: A student logs in, sees the "My Report Cards" section on their
 * dashboard, clicks "View", and verifies that the preview shows the correct
 * grade data (81.5/100 → Grade B, Merit) fetched from the API.
 *
 * Also verifies:
 *  - "Download PDF" triggers the generate-pdf endpoint
 *  - The QR code is rendered in the preview
 *  - Mobile layout renders the section without overflow
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { MOCK_REPORT_CARD_DATA, MOCK_PDF_BYTES } from "./fixtures/reportCard";

async function setupStudentMocks(page: Page) {
  await loginAs(page, "student");

  // Report card data
  await page.route("**/api/v1/report-cards/student/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_REPORT_CARD_DATA),
    }),
  );

  // PDF generation – return minimal PDF blob
  await page.route("**/api/v1/report-cards/generate-pdf", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: MOCK_PDF_BYTES,
      headers: {
        "Content-Disposition": 'attachment; filename="ReportCard.pdf"',
      },
    }),
  );
}

test.describe("Student – Report Card on Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await setupStudentMocks(page);
    await page.goto("/dashboard");
  });

  test("My Report Cards section is visible on the student dashboard", async ({ page }) => {
    await expect(page.getByText("My Report Cards")).toBeVisible({ timeout: 10000 });
  });

  test("section shows current term and academic year", async ({ page }) => {
    await expect(page.getByText(/Term 2/)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/2025-2026/)).toBeVisible();
  });

  test("section shows the student's full name", async ({ page }) => {
    await expect(page.getByText("John Doe")).toBeVisible({ timeout: 8000 });
  });

  test("View button is present and clickable", async ({ page }) => {
    const viewBtn = page.getByRole("button", { name: /View/i }).first();
    await expect(viewBtn).toBeVisible({ timeout: 8000 });
    await expect(viewBtn).toBeEnabled();
  });

  test("Download PDF button is present", async ({ page }) => {
    const downloadBtn = page.getByRole("button", { name: /Download PDF/i });
    await expect(downloadBtn).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Student – Report Card Preview", () => {
  test.beforeEach(async ({ page }) => {
    await setupStudentMocks(page);
    await page.goto("/dashboard");

    // Open the preview
    const viewBtn = page.getByRole("button", { name: /View/i }).first();
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    await viewBtn.click();
  });

  test("preview modal opens and shows the report card heading", async ({ page }) => {
    await expect(page.getByText("Report Card Preview")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("National Grammar Academy")).toBeVisible();
    await expect(page.getByText("ACADEMIC REPORT CARD")).toBeVisible();
  });

  test("preview shows correct student name", async ({ page }) => {
    await expect(page.getByText("John Doe")).toBeVisible({ timeout: 6000 });
  });

  test("preview shows term and academic year", async ({ page }) => {
    await expect(page.getByText("Term 2")).toBeVisible({ timeout: 6000 });
    await expect(page.getByText("2025-2026")).toBeVisible();
  });

  test("grades table renders with correct total score (81.5)", async ({ page }) => {
    // The Overall Average row in the grades table
    await expect(page.getByText("81.50")).toBeVisible({ timeout: 6000 });
  });

  test("grade B (Merit) is shown for 81.5 score", async ({ page }) => {
    await expect(page.getByText("Merit")).toBeVisible({ timeout: 6000 });
  });

  test("attributes are displayed in the preview", async ({ page }) => {
    await expect(page.getByText("Punctuality")).toBeVisible({ timeout: 6000 });
    await expect(page.getByText("Excellent")).toBeVisible();
  });

  test("attendance figures are shown correctly", async ({ page }) => {
    // Present: 40, Absent: 2, Late: 1, Total: 43
    await expect(page.getByText("40")).toBeVisible({ timeout: 6000 });
    await expect(page.getByText("93%")).toBeVisible(); // 40/43 ≈ 93%
  });

  test("teacher comment is displayed", async ({ page }) => {
    await expect(
      page.getByText("Excellent progress this term."),
    ).toBeVisible({ timeout: 6000 });
  });

  test("QR code SVG element is rendered", async ({ page }) => {
    // QR code is rendered as an SVG
    const qrSvg = page.locator("svg").filter({ hasText: "" }).last();
    await expect(page.locator("#report-card-document svg").first()).toBeVisible({
      timeout: 6000,
    });
  });

  test("Download PDF button triggers the generate-pdf API", async ({ page }) => {
    const [pdfRequest] = await Promise.all([
      page.waitForRequest("**/api/v1/report-cards/generate-pdf"),
      page.getByRole("button", { name: /Download PDF/i }).click(),
    ]);

    const payload = pdfRequest.postDataJSON();
    expect(payload).toEqual({ report_card_id: 7 });
  });

  test("Close button dismisses the preview", async ({ page }) => {
    const closeBtn = page.getByRole("button", { name: /Close preview/i });
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();

    await expect(page.getByText("National Grammar Academy")).not.toBeVisible({ timeout: 3000 });
  });

  test("grade key legend is shown with all grades", async ({ page }) => {
    await expect(page.getByText(/A – Distinction/)).toBeVisible({ timeout: 6000 });
    await expect(page.getByText(/F – Fail/)).toBeVisible();
  });
});

test.describe("Student – Mobile responsiveness", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test("My Report Cards section renders without overflow on mobile", async ({ page }) => {
    await setupStudentMocks(page);
    await page.goto("/dashboard");

    const section = page.getByText("My Report Cards");
    await expect(section).toBeVisible({ timeout: 10000 });

    // The viewport should not be wider than 390px
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(400);
  });

  test("View and Download buttons are accessible on mobile", async ({ page }) => {
    await setupStudentMocks(page);
    await page.goto("/dashboard");

    await expect(page.getByRole("button", { name: /View/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Download PDF/i })).toBeVisible();
  });
});

test.describe("Student – Report Card error handling", () => {
  test("shows error state when report card not found", async ({ page }) => {
    await loginAs(page, "student");

    // Override with 404
    await page.route("**/api/v1/report-cards/student/**", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Report card not found" }),
      }),
    );

    await page.route("**/api/v1/report-cards/generate-pdf", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );

    await page.goto("/dashboard");

    const viewBtn = page.getByRole("button", { name: /View/i }).first();
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    await viewBtn.click();

    // Error message appears in the preview modal
    await expect(
      page.getByText(/not found|failed to load/i),
    ).toBeVisible({ timeout: 8000 });

    // Retry button is shown
    await expect(page.getByRole("button", { name: /Retry/i })).toBeVisible();
  });
});
