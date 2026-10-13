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

const WEB_TARGETS = {
  revision: { id: 9001, number: 3 },
  engine: "judge0",
  single_file: true,
  language: null,
  languages: [],
  runnable: false,
  entries: [],
  html_entry: "index.html",
  has_package_json: false,
};
const C_TARGETS = {
  ...WEB_TARGETS,
  language: "c",
  languages: [{ key: "c", label: "C", files: 1, runnable: true }],
  runnable: true,
  entries: ["main.c"],
  html_entry: null,
};
const C_SOURCE = `#include <stdio.h>

int main(void) {
    int a, b;
    printf("Enter two numbers: ");
    scanf("%d %d", &a, &b);
    printf("Sum = %d\\n", a + b);
    return 0;
}
`;

async function setup(page: Page) {
  const saves: unknown[] = [];
  const runs: unknown[] = [];
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
          due_date: new Date(Date.now() - 3 * 3600_000 - 25 * 60_000).toISOString(),
          max_points: 20,
          rubric: [
            { criteria: "Semantic HTML", description: "Full marks are earned when semantic HTML5 elements are used appropriately (header, nav, main, section, article, footer), the markup is well-structured and free of stray tags. Partial marks when the structure is mostly correct.", max_score: 6 },
            { criteria: "Styling", description: "Consistent colours and spacing", max_score: 8 },
            { criteria: "Interactivity", description: "The Order button responds", max_score: 6 },
          ],
          question: null,
          brief: {
            description:
              "<h3>Coffee shop landing page</h3><p>Build a one-page site for <strong>Kigali Coffee</strong> from the design in the attachment.</p><ul><li>Use semantic HTML5 (header, nav, main, footer).</li><li>Match the colours and spacing of the design.</li><li>The <em>Order</em> button shows a confirmation.</li></ul>",
            instructions: "Start from the starter files. Keep everything in index.html and style.css.",
            language: "html",
            kind: "practical",
            submission_type: "project",
            attachments: [{ name: "coffee-design.pdf", url: "https://files.test/coffee-design.pdf", size: 482_000 }],
            starter: { project_id: 500, revision_id: null },
            status: "published",
            created_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
          },
          can_grade: true,
        },
        counts: { total: 4, to_grade: 3, graded: 1 },
        rows: [
          row(1, "Aline Uwase"),
          row(2, "Brian Mugisha"),
          row(3, "Claire Ishimwe", { project: { id: 103, name: "Sum of two numbers", status: "submitted", kind: "tm", language: "c", repo_url: null } }),
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
    if (/^\/projects\/103\/revisions\/\w+\/manifest$/.test(path)) {
      return json(r, { revision: null, files: [{ path: "main.c", sha256: "c", size: C_SOURCE.length }] });
    }
    if (/^\/projects\/103\/files\//.test(path)) return r.fulfill({ status: 200, contentType: "text/plain", headers: CORS_HEADERS, body: C_SOURCE });
    // The starter the students began from: a page without the Order button.
    if (/^\/projects\/500\/revisions\/\w+\/manifest$/.test(path)) {
      return json(r, { revision: null, files: [{ path: "index.html", sha256: "s", size: 50 }, { path: "notes.txt", sha256: "n", size: 5 }] });
    }
    if (/^\/projects\/500\/files\//.test(path)) {
      return r.fulfill({ status: 200, contentType: "text/plain", headers: CORS_HEADERS, body: path.endsWith("notes.txt") ? "todo" : "<!doctype html><h1>Kigali Coffee</h1>" });
    }
    if (/\/revisions\/\w+\/manifest$/.test(path)) {
      return json(r, { revision: null, files: [{ path: "index.html", sha256: "a", size: SITE.length }, { path: "style.css", sha256: "b", size: CSS.length }] });
    }
    const f = path.match(/^\/projects\/\d+\/files\/(.+)$/);
    if (f) return r.fulfill({ status: 200, contentType: "text/plain", headers: CORS_HEADERS, body: f[1] === "style.css" ? CSS : SITE });
    if (/^\/projects\/\d+\/preview$/.test(path)) return json(r, { url: PREVIEW, entry: "index.html", expires_in: 1800 });
    const targets = path.match(/^\/projects\/(\d+)\/run-targets$/);
    if (targets) return json(r, targets[1] === "103" ? C_TARGETS : WEB_TARGETS);
    if (/^\/projects\/103\/run$/.test(path)) {
      const body = req.postDataJSON() as { tests: { id: string; input: string; expected_output?: string | null }[] };
      runs.push(body);
      return json(r, {
        engine: "judge0",
        language: "c",
        entry: "main.c",
        revision: { id: 9003, number: 3 },
        files_sent: ["main.c"],
        files_skipped: 0,
        compile: null,
        tests: body.tests.map((t) => {
          const nums = t.input.split(/\s+/).filter(Boolean).map(Number);
          const stdout = nums.length ? `Enter two numbers: Sum = ${nums.reduce((a, b) => a + b, 0)}\n` : "Enter two numbers: ";
          const verdict = t.expected_output == null ? (nums.length ? "ok" : "runtime-error") : stdout.trim().endsWith(t.expected_output.trim()) ? "accepted" : "wrong-answer";
          return { id: t.id, verdict, passed: verdict === "ok" || verdict === "accepted", stdout, stderr: nums.length ? null : "Segmentation fault (core dumped)", exit_code: nums.length ? 0 : 139, time_ms: 4, memory_kb: 1180 };
        }),
      });
    }
    return json(r, { success: true, data: [] });
  });
  return { saves, runs };
}

test("grades a practical against its criteria with the code and a live preview", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "the workspace is a desktop tool; checked separately below");
  await page.setViewportSize({ width: 1512, height: 945 });
  const { saves } = await setup(page);
  // The old address (TMCode desktop opens it) leads to Grading.
  await page.goto("/taskmentor/grading/practical/assignment/77");
  await expect(page).toHaveURL(/\/grading\/assignment\/77$/);

  // Full screen, the first student to grade selected. A web page opens in the
  // Preview, with the guide saying how to check it.
  await expect(page.getByTestId("practical-grading")).toBeVisible();
  await expect(page.getByTestId("current-student")).toHaveText("Aline Uwase");
  await expect(page.getByTestId("assess-guide")).toHaveAttribute("data-profile", "web-page", { timeout: 15_000 });
  await expect(page.getByTestId("assess-kind")).toHaveText("Web page");
  await expect(page.getByTestId("pane-preview")).toHaveAttribute("aria-selected", "true");
  // The page keeps a real desktop size (1440×900), scaled to fit.
  await expect(page.getByTestId("preview-size")).toContainText("1440×900");
  await page.getByTestId("assess-code").click();
  await expect(page.getByTestId("file-viewer")).toBeVisible({ timeout: 15_000 });
  await shot(page, "grading-code");

  // The class list is a dropdown with each student's status and score.
  await page.getByTestId("student-switcher").click();
  await expect(page.getByTestId("roster-row")).toHaveCount(4);
  await expect(page.getByTestId("roster-row").nth(3)).toContainText("17/20");
  await shot(page, "grading-students");
  await page.getByTestId("student-switcher").click();

  await page.getByRole("tab", { name: /Preview/ }).click();
  const frame = page.frameLocator('[data-testid="practical-preview"]');
  await expect(frame.getByRole("heading", { name: "Kigali Coffee" })).toBeVisible();
  await frame.getByRole("button", { name: "Order" }).click();
  await expect(frame.locator("#msg")).toHaveText("Order placed!");

  // Phone size, then full screen (Esc closes it).
  await page.getByTestId("preview-device-phone").click();
  await expect(page.getByTestId("preview-size")).toContainText("390×844");
  await page.getByTestId("preview-full-screen").click();
  await expect(page.getByTestId("preview-full")).toBeVisible();
  await expect(page.frameLocator('[data-testid="preview-full"] [data-testid="practical-preview"]').getByRole("heading", { name: "Kigali Coffee" })).toBeVisible();
  await shot(page, "grading-preview-full");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("preview-full")).toHaveCount(0);
  await page.getByTestId("preview-device-desktop").click();

  const criteria = page.getByTestId("criterion");
  await criteria.nth(0).getByRole("button", { name: "6", exact: true }).click();
  await criteria.nth(1).getByLabel(/Styling score/).fill("6");
  await criteria.nth(2).getByRole("button", { name: "3", exact: true }).click();
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
  await expect(page.getByTestId("details-checks")).toContainText(/Late by/);
  await expect(page.getByTestId("details-brief")).toContainText("Kigali Coffee");
  await page.waitForTimeout(300);
  await shot(page, "grading-details");

  // Dark theme, grading panel hidden: the project takes the whole width.
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.getByRole("tab", { name: /Code/ }).click();
  await page.waitForTimeout(500); // colour transitions settle
  await shot(page, "grading-dark");
  await page.keyboard.press("[");
  await expect(page.getByTestId("criteria-scorer")).toBeHidden();
  await page.waitForTimeout(300);
  await shot(page, "grading-wide");

  // Esc closes the workspace.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/assignments\/77$/);
});

test("runs a C program with the teacher's inputs", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop tool");
  await page.setViewportSize({ width: 1512, height: 945 });
  const { runs } = await setup(page);
  await page.goto("/taskmentor/grading/assignment/77?student=3");
  await expect(page.getByTestId("current-student")).toHaveText("Claire Ishimwe");
  // No web page: Run instead of Preview, and the guide says it's a program run with inputs.
  await expect(page.getByTestId("pane-run")).toBeVisible();
  await expect(page.getByTestId("pane-preview")).toHaveCount(0);
  await expect(page.getByTestId("assess-guide")).toHaveAttribute("data-profile", "program");
  await expect(page.getByTestId("assess-kind")).toHaveText("C program");
  await expect(page.getByTestId("pane-run")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("pane-run").click();
  await page.getByTestId("run-input").first().fill("2 3");
  await page.getByRole("button", { name: "Add an input" }).click();
  await page.getByTestId("run-input").nth(1).fill("10 -4");
  await page.getByRole("button", { name: /Compare with an expected output/ }).nth(1).click();
  await page.getByTestId("run-case").nth(1).getByRole("textbox").nth(2).fill("Sum = 7");
  await page.getByRole("button", { name: "Add an input" }).click();
  await page.getByTestId("run-program").click();
  await expect(page.getByTestId("run-stdout").first()).toContainText("Sum = 5");
  await expect(page.getByTestId("run-verdict").nth(1)).toHaveText(/Different output/);
  await expect(page.getByTestId("run-verdict").nth(2)).toHaveText(/Crashed/);
  expect(runs).toHaveLength(1);
  await shot(page, "grading-run");

  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.getByTestId("details-checks")).toContainText("Runnable C program");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(500);
  await shot(page, "grading-details-dark");
  // The results survive a trip to another tab.
  await page.getByTestId("pane-run").click();
  await expect(page.getByTestId("run-stdout").first()).toContainText("Sum = 5");
  expect(runs).toHaveLength(1);
  await page.waitForTimeout(300);
  await shot(page, "grading-run-dark");
});

test("changes since the starter: what the student added, changed and deleted", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop tool");
  await page.setViewportSize({ width: 1512, height: 945 });
  await setup(page);
  await page.goto("/taskmentor/grading/assignment/77?student=1");
  // The guide's "Changes since starter" opens the code on the diff.
  await page.getByTestId("assess-changes").click();
  const files = page.getByTestId("diff-file");
  await expect(files).toHaveCount(3);
  await expect(files.filter({ hasText: "index.html" })).toContainText("Changed");
  await expect(files.filter({ hasText: "style.css" })).toContainText("Added");
  await expect(files.filter({ hasText: "notes.txt" })).toContainText("Deleted");
  await page.waitForTimeout(1500);
  await shot(page, "grading-diff");
});

test("stacks the panes on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await setup(page);
  await page.goto("/taskmentor/grading/assignment/77?student=1");
  await expect(page.getByTestId("file-viewer").or(page.getByTestId("files-tab"))).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  await shot(page, "grading-mobile");
  await page.getByRole("tab", { name: "Grade" }).click();
  await expect(page.getByTestId("criteria-scorer")).toBeVisible();
  await shot(page, "grading-mobile-grade");
});

test("a project the runner knows (C Make project): runs whole, shows differing lines; a React app explains itself", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop tool");
  await page.setViewportSize({ width: 1512, height: 945 });
  const { runs } = await setup(page);
  // The runner's project view for the C student; a React app for the web students.
  await page.route("**/api/tmcode/projects/*/run-targets*", (r) => {
    const id = new URL(r.request().url()).pathname.match(/projects\/(\d+)\//)![1];
    const project =
      id === "103"
        ? { kind: "c/make", label: "C – Make project", language: "c", entry: "src/main.c", actions: ["build", "run", "test"], runs: true, tests: true, web_app: false, chooses_entry: false }
        : { kind: "js/vite", label: "JavaScript – Vite app (React, Vue, Svelte)", language: "javascript", entry: "src/main.tsx", actions: ["build", "test"], runs: false, tests: true, web_app: true, chooses_entry: false };
    return json(r, { revision: { id: 9003, number: 3 }, engine: "tmjudge", single_file: false, language: "c", languages: [{ key: "c", label: "C", files: 3, runnable: true }], runnable: true, entries: ["src/main.c"], html_entry: id === "103" ? null : "index.html", has_package_json: id !== "103", project });
  });
  await page.goto("/taskmentor/grading/assignment/77?student=3");
  await page.getByTestId("pane-run").click();
  await expect(page.getByTestId("run-project")).toHaveText("C – Make project");
  await expect(page.getByLabel("File to run")).toHaveCount(0);
  await page.getByTestId("run-input").first().fill("2 3");
  await page.getByRole("button", { name: /Compare with an expected output/ }).first().click();
  await page.getByTestId("run-case").first().getByRole("textbox").nth(2).fill("Enter two numbers: Sum = 6");
  await page.getByTestId("run-program").click();
  await expect(page.getByTestId("run-diff")).toBeVisible();
  await expect(page.getByTestId("run-summary")).toContainText("0 of 1 match");
  expect(runs.at(-1)).toMatchObject({ kind: "c/make", entry: null });
  await shot(page, "grading-run-project");

  // A React app: no input box, the right places to check it.
  await page.goto("/taskmentor/grading/assignment/77?student=1");
  await page.getByTestId("pane-run").click();
  await expect(page.getByTestId("run-web-app")).toContainText("runs in a browser");
  await expect(page.getByTestId("run-input")).toHaveCount(0);
  await shot(page, "grading-run-webapp");
});
