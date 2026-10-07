/**
 * E2E: the TMCode practical grading workspace against the Vite dev server
 * with a mocked API: roster, the submitted code, the sandboxed live preview,
 * criteria scoring with Save & next.
 *
 * Screenshots go to $TMCODE_SHOTS (default: test-results/tmcode-shots).
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";
import { installFakeEventSource } from "./fixtures/projectsMock";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const PREVIEW = "http://preview.test/p/tok/index.html";
const SITE = `<!doctype html><html><head><link rel="stylesheet" href="style.css"></head>
<body><header><h1>Kigali Coffee</h1><nav>Menu · About · Contact</nav></header>
<main><p id="msg">Fresh roasts every morning.</p><button onclick="document.getElementById('msg').textContent='Order placed!'">Order</button></main></body></html>`;
const CSS = `body{font-family:system-ui;margin:0;background:#fdf6ec}header{background:#6b3e26;color:#fff;padding:24px}main{padding:24px}button{background:#6b3e26;color:#fff;border:0;padding:8px 16px;border-radius:8px}`;

const row = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  student: { id, name },
  state: "submitted",
  project: { id: 100 + id, name: "Coffee shop site", status: "submitted", kind: "tm", language: "html", repo_url: null },
  link: { id: 200 + id, status: "submitted", submitted_at: new Date(Date.now() - id * 3600_000).toISOString(), revision_id: 9000 + id, revision_number: 3, git_commit: null },
  grade: null,
  submitted_at: new Date(Date.now() - id * 3600_000).toISOString(),
  late: id === 2,
  ...extra,
});

async function setup(page: Page) {
  const saves: unknown[] = [];
  await page.route("**/api/**", (r) =>
    r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] }),
  );
  await installFakeEventSource(page, {});
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  await loginAs(page, "instructor");
  await page.route("http://preview.test/**", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith("style.css")) return r.fulfill({ status: 200, contentType: "text/css", body: CSS });
    return r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: SITE });
  });
  await page.route("**/api/tmcode/**", async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/tmcode/, "");
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS_HEADERS });
    if (path === "/grading/assignment/77" && req.method() === "GET") {
      return json(r, {
        activity: {
          type: "assignment",
          id: 77,
          title: "Coffee shop landing page",
          course_id: 12,
          due_date: null,
          max_points: 20,
          rubric: [
            { criteria: "Semantic HTML", description: "header, nav, main used correctly", max_score: 6 },
            { criteria: "Styling", description: "Consistent colours and spacing", max_score: 8 },
            { criteria: "Interactivity", description: "The Order button responds", max_score: 6 },
          ],
          question: null,
          can_grade: true,
        },
        counts: { total: 4, to_grade: 3, graded: 1 },
        rows: [
          row(1, "Aline Uwase"),
          row(2, "Brian Mugisha"),
          row(3, "Claire Ishimwe"),
          row(4, "David Nkurunziza", { state: "graded", grade: { score: 17, rubric_scores: [{ index: 0, score: 5 }, { index: 1, score: 7 }, { index: 2, score: 5 }], feedback: "Great job", graded_at: new Date().toISOString(), ref_id: 1 } }),
        ],
      });
    }
    if (path.startsWith("/grading/assignment/77/students/")) {
      saves.push(req.postDataJSON());
      return json(r, { score: 16, max_points: 20 });
    }
    if (/^\/projects\/\d+\/revisions$/.test(path)) {
      return json(r, { revisions: [{ id: 9001, number: 3, file_count: 2, size_bytes: 900, source: "submit", created_at: new Date().toISOString() }] });
    }
    if (/\/revisions\/\w+\/manifest$/.test(path)) {
      return json(r, { revision: null, files: [{ path: "index.html", sha256: "a", size: SITE.length }, { path: "style.css", sha256: "b", size: CSS.length }] });
    }
    const f = path.match(/^\/projects\/\d+\/files\/(.+)$/);
    if (f) return r.fulfill({ status: 200, contentType: "text/plain", headers: CORS_HEADERS, body: f[1] === "style.css" ? CSS : SITE });
    if (/^\/projects\/\d+\/preview$/.test(path)) return json(r, { url: PREVIEW, entry: "index.html", expires_in: 1800 });
    return json(r, { success: true, data: [] });
  });
  return { saves };
}

test("grades a practical against its criteria with the code and a live preview", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "the workspace is a desktop tool; checked separately below");
  await page.setViewportSize({ width: 1440, height: 900 });
  const { saves } = await setup(page);
  await page.goto("/taskmentor/grading/practical/assignment/77");

  await expect(page.getByTestId("roster-row")).toHaveCount(3); // "To grade" filter
  await expect(page.getByTestId("file-viewer")).toBeVisible({ timeout: 15_000 });
  await shot(page, "grading-code");

  await page.getByRole("tab", { name: /Preview/ }).click();
  const frame = page.frameLocator('[data-testid="practical-preview"]');
  await expect(frame.getByRole("heading", { name: "Kigali Coffee" })).toBeVisible();
  await frame.getByRole("button", { name: "Order" }).click();
  await expect(frame.locator("#msg")).toHaveText("Order placed!");

  const criteria = page.getByTestId("criterion");
  await criteria.nth(0).getByRole("button", { name: "Full" }).click();
  await criteria.nth(1).getByLabel(/Styling score/).fill("6");
  await criteria.nth(2).getByRole("button", { name: "½" }).click();
  await criteria.nth(1).getByRole("button", { name: /Comment on Styling/ }).click();
  await criteria.nth(1).getByRole("textbox").fill("Good palette; tighten the spacing.");
  await page.getByPlaceholder(/What went well/).fill("A clean, working page.");
  await expect(page.getByTestId("grade-total")).toHaveText(/15\s*\/\s*20/);
  await shot(page, "grading-preview");

  await page.getByTestId("save-next").click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toEqual({
    question_id: null,
    rubric_scores: [
      { index: 0, score: 6, comment: null },
      { index: 1, score: 6, comment: "Good palette; tighten the spacing." },
      { index: 2, score: 3, comment: null },
    ],
    score: null,
    feedback: "A clean, working page.",
  });
  await expect(page).toHaveURL(/student=2/);
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.locator("dd", { hasText: "Late" })).toBeVisible();
  await shot(page, "grading-details");
});

test("stacks the panes on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await setup(page);
  await page.goto("/taskmentor/grading/practical/assignment/77?student=1");
  await expect(page.getByTestId("criteria-scorer")).toBeVisible({ timeout: 15_000 });
  await shot(page, "grading-mobile");
});
