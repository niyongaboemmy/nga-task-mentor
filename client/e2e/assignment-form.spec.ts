import { test, expect, type Page, type Route } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Assignment create form in a real browser (Chromium + WebKit, the engine of
 * NGA Desktop on macOS): attachments, image paste in the description editor,
 * AI rubric and the upload progress. The API is mocked.
 */

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const SHOTS = process.env.E2E_SHOTS_DIR;

// loginAs's mocked session doesn't take in WebKit yet (every spec using it
// lands on the sign-in page there), so this runs on Chromium for now.
test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function mockApi(page: Page) {
  const created: { body: Buffer | null; contentType: string } = { body: null, contentType: "" };
  // catch-all first — later routes take precedence
  await page.route("**/api/**", (r) => json(r, { success: true, data: [] }));
  await loginAs(page, "instructor");
  // keep the "install the app" card out of the way
  await page.addInitScript(() => sessionStorage.setItem("nga.installDismissedThisSession", "1"));
  await page.route("**/api/courses", (r) =>
    r.request().method() === "GET"
      ? json(r, { success: true, data: [{ id: "12", title: "Web User Interface", code: "SOD-L5" }] })
      : r.fallback(),
  );
  let n = 0;
  await page.route("**/api/media/editor-images", (r) =>
    json(r, { success: true, data: { url: `/uploads/editor-images/img-${++n}.png`, type: "image/png", size: 68 } }, 201),
  );
  await page.route("**/uploads/editor-images/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.route("**/api/assignments/ai/rubric", async (r) => {
    const body = r.request().postDataJSON();
    await new Promise((res) => setTimeout(res, 400));
    return json(r, {
      success: true,
      data: {
        source: "description",
        total: body.max_score,
        note: "Taken from the marking guide in the description.",
        provider_used: "gemini",
        criteria: [
          { criteria: "Layout & structure", description: "Page structure matches the chosen design.", max_score: body.max_score * 0.4 },
          { criteria: "Visual styling", description: "Colours, typography and spacing.", max_score: body.max_score * 0.3 },
          { criteria: "Responsiveness", description: "Works on phone and desktop widths.", max_score: body.max_score * 0.3 },
        ],
      },
    });
  });
  await page.route("**/api/courses/12/assignments", async (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    created.body = r.request().postDataBuffer();
    created.contentType = (await r.request().allHeaders())["content-type"] || "";
    await new Promise((res) => setTimeout(res, 1200));
    return json(r, { success: true, data: { id: 99 } }, 201);
  });
  return created;
}

async function pasteImage(page: Page) {
  // A screenshot on the clipboard: a PNG file and no HTML.
  await page.locator(".ProseMirror").first().evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "Screenshot.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG.toString("base64"));
}

test("teacher builds an assignment with attachments, a pasted image and an AI rubric", async ({ page }, info) => {
  const created = await mockApi(page);
  await page.goto("/taskmentor/assignments/create?courseId=12");

  await expect(page.getByRole("heading", { name: "Create assignment" })).toBeVisible();
  await page.getByLabel("Title").fill("Practical Task: UI Design Implementation Using HTML & CSS");
  await page.getByRole("button", { name: "In a week" }).click();
  await page.getByLabel("Max score").fill("10");
  await page.getByRole("radio", { name: /File only/ }).click();
  // student submissions: zip only
  const chips = page.getByTestId("file-type-chips");
  for (const t of ["pdf", "docx", "jpg", "png"]) await chips.getByRole("button", { name: `Remove ${t}` }).click();
  await expect(chips).toContainText(".zip");

  // --- Description: type + paste a screenshot
  await page.getByText(/Describe the task/).click();
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.keyboard.type("Task: select one design and implement it using HTML and CSS. Marking: Layout 40%, Styling 30%, Responsiveness 30%.");
  await pasteImage(page);
  await expect(editor.locator('img[src*="/uploads/editor-images/img-1.png"]')).toBeVisible();
  await expect(editor.locator('img[src^="blob:"]')).toHaveCount(0);

  // the image button can upload from the device too
  await page.getByTitle(/^Image/).click();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Upload from device" }).click()]);
  await chooser.setFiles({ name: "design-2.png", mimeType: "image/png", buffer: PNG });
  await expect(editor.locator('img[src*="img-2.png"]')).toBeVisible();
  // inserting a second image must not replace the selected first one
  await expect(editor.locator('img[src*="img-1.png"]')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-editor.png` });
  await page.getByRole("button", { name: "Save and Continue" }).click();

  // --- Attachments: images are fine even though students submit .zip only
  const input = page.getByTestId("file-dropzone-input");
  expect(await input.getAttribute("accept")).toMatch(/^\.[a-z0-9]+(,\.[a-z0-9]+)*$/);
  await input.setInputFiles([
    { name: "design-1.png", mimeType: "image/png", buffer: PNG },
    { name: "starter.zip", mimeType: "application/zip", buffer: Buffer.from("PK\u0003\u0004") },
  ]);
  await input.setInputFiles([{ name: "notes.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") }]);
  await expect(page.getByRole("alert").filter({ hasText: "notes.exe" })).toContainText(".exe files aren't allowed");
  await expect(page.getByText("design-1.png")).toBeVisible();
  await expect(page.getByText("starter.zip")).toBeVisible();

  // --- AI rubric
  await page.getByRole("button", { name: "Generate with AI" }).first().click();
  const panel = page.getByTestId("rubric-ai-panel");
  await expect(panel).toContainText("will read your description");
  await panel.getByLabel("Marks to distribute").fill("20");
  await panel.getByRole("button", { name: "Generate rubric" }).click();
  await expect(panel.getByLabel("Generating rubric")).toBeVisible();
  await expect(page.getByTestId("rubric-ai-preview")).toContainText("Found in your description");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-rubric.png`, fullPage: true });
  await page.getByRole("button", { name: "Use this rubric" }).click();
  await expect(page.getByTestId("rubric-total")).toContainText("20 / 20");
  await expect(page.getByLabel("Max score")).toHaveValue("20");

  // --- Save: progress overlay, then the request carries everything
  await page.getByRole("button", { name: "Create assignment" }).click();
  await expect(page.getByTestId("upload-progress")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-progress.png` });
  await expect(page).toHaveURL(/\/courses\/12$/, { timeout: 10_000 });

  const body = created.body!.toString("latin1");
  expect(created.contentType).toContain("multipart/form-data");
  expect(body).toContain('filename="design-1.png"');
  expect(body).toContain('filename="starter.zip"');
  expect(body).not.toContain("notes.exe");
  expect(body).toContain("/uploads/editor-images/img-1.png");
  expect(body).toContain("/uploads/editor-images/img-2.png");
  expect(body).not.toContain("blob:");
  expect(body).toContain("Layout & structure");
  expect(body).toMatch(/name="max_score"\r\n\r\n20\r\n/);
  expect(body).toMatch(/name="allowed_file_types"\r\n\r\n\["zip"\]\r\n/);
});
