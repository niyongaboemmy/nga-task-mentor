/**
 * E2E: the code workspace (CODE_RUNNER_PLAN.md phase 2d) — Playground and
 * editing a project in the browser — against the Vite dev server with a
 * mocked API. Screenshots go to $TMCODE_SHOTS.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

/** A fake judge: sums the two numbers it is given, like the starters. */
function judge(body: { tests: { id: string; input: string; expected_output?: string | null }[]; files: { path: string; content: string }[] }) {
  const main = body.files.find((f) => /^main\./.test(f.path))?.content ?? "";
  if (main.includes("SYNTAX ERROR")) {
    return { engine: "tmjudge", language: "python", entry: "main.py", files_sent: ["main.py"], compile: { ok: false, output: "main.py:1: SyntaxError: invalid syntax" }, tests: body.tests.map((t) => ({ id: t.id, verdict: "compile-error", passed: false, stdout: null, stderr: null, time_ms: null, memory_kb: null })) };
  }
  return {
    engine: "tmjudge",
    language: "python",
    entry: "main.py",
    files_sent: ["main.py"],
    compile: null,
    tests: body.tests.map((t) => {
      const n = t.input.trim().split(/\s+/).filter(Boolean).map(Number);
      const stdout = n.length >= 2 ? `Sum: ${n[0] + n[1]}\n` : "";
      const expected = t.expected_output;
      const verdict = expected == null ? (n.length >= 2 ? "ok" : "runtime-error") : stdout.trim() === expected.trim() ? "accepted" : "wrong-answer";
      return { id: t.id, verdict, passed: expected == null ? null : verdict === "accepted", stdout, stderr: n.length >= 2 ? null : "ValueError: not enough values", exit_code: n.length >= 2 ? 0 : 1, time_ms: 18, memory_kb: 9000 };
    }),
  };
}

async function setup(page: Page) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
    localStorage.removeItem("tm.playground.python");
  });
  await loginAs(page, "student");
  await page.route("**/api/code/languages", (r) => json(r, { success: true, data: [{ key: "python", label: "Python", engine: "tmjudge" }, { key: "java", label: "Java", engine: "tmjudge" }, { key: "c", label: "C", engine: "tmjudge" }] }));
  await page.route("**/api/code/run", (r) => {
    const body = r.request().postDataJSON();
    calls.push({ method: "POST", path: "/code/run", body });
    return json(r, { success: true, data: judge(body) });
  });
  // A student's project at revision 3.
  const files: Record<string, string> = {
    "main.py": 'a, b = map(int, input().split())\nprint(f"Sum: {a + b}")\n',
    ".nga/tests.json": JSON.stringify({ entry: "main.py", tests: [{ id: "t1", name: "two numbers", input: "4 8\n", expected_output: "Sum: 12\n" }] }),
  };
  await page.route("**/api/tmcode/**", (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/tmcode/, "");
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS_HEADERS });
    calls.push({ method: req.method(), path, body: req.method() === "POST" ? req.postDataJSON() : undefined });
    if (path === "/projects/5") {
      return json(r, {
        project: {
          id: 5, name: "Sum calculator", slug: "sum", kind: "tm", status: "draft", language: "python", visibility: "private",
          owner: { id: 201, name: "John Doe" }, my_role: "owner", size_bytes: 200, file_count: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          head: { id: 33, number: 3, file_count: 2, size_bytes: 200, source: "save", created_at: new Date().toISOString() }, head_revision_id: 33,
          presence: [], links: [], members: [], events: [], can: { edit: true, save: true, report_git: false, read_all_revisions: true, share_presence: true },
        },
      });
    }
    if (path === "/projects/5/revisions/head/manifest") {
      return json(r, { revision: { id: 33, number: 3, file_count: 2, size_bytes: 200, source: "save", created_at: new Date().toISOString() }, files: Object.keys(files).map((p, i) => ({ path: p, sha256: String(i).repeat(64), size: files[p]!.length })) });
    }
    const f = path.match(/^\/projects\/5\/files\/(.+)$/);
    if (f) return r.fulfill({ status: 200, contentType: "text/plain", headers: CORS_HEADERS, body: files[decodeURIComponent(f[1]!)] ?? "" });
    if (path === "/projects/5/blobs/missing") return json(r, { missing: (req.postDataJSON() as { sha256: string[] }).sha256 });
    if (/^\/projects\/5\/blobs\//.test(path)) return json(r, { sha256: "x", size: 1, stored: "db", existed: false }, 201);
    if (path === "/projects/5/revisions" && req.method() === "POST") return json(r, { revision: { id: 34, number: 4 } }, 201);
    return json(r, { success: true, data: [] });
  });
  return { calls };
}

test("practise in the Playground: run with your input, then the tests", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout; phone below");
  await page.setViewportSize({ width: 1440, height: 900 });
  const { calls } = await setup(page);
  await page.goto("/taskmentor/code/projects");
  await page.getByRole("link", { name: "Playground" }).click();
  await expect(page).toHaveURL(/\/code\/playground/);
  await expect(page.getByTestId("code-editor").locator(".view-lines")).toContainText("Sum", { timeout: 20_000 });

  await page.getByTestId("run-stdin").fill("2 3");
  await page.getByTestId("playground-run").click();
  await expect(page.getByTestId("run-output")).toHaveText("Sum: 5");
  await expect(page.getByTestId("verdict").first()).toHaveText("Ran");
  await shot(page, "playground");

  await page.getByRole("tab", { name: /Tests/ }).click();
  await page.getByRole("button", { name: "Run tests" }).click();
  await expect(page.getByText("2/2 tests passed")).toBeVisible();
  expect(calls.filter((c) => c.path === "/code/run")).toHaveLength(2);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(400);
  await shot(page, "playground-dark");
});

test("edit a project in the browser and save a new version", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  await page.setViewportSize({ width: 1440, height: 900 });
  const { calls } = await setup(page);
  await page.goto("/taskmentor/code/projects/5/edit");
  await expect(page.getByRole("heading", { name: "Sum calculator" })).toBeVisible();
  await expect(page.getByTestId("file-tree")).toContainText("main.py");
  await expect(page.getByTestId("file-tree")).not.toContainText("tests.json");

  // Type in the editor: a change marks the page unsaved.
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type("# checked\n");
  await expect(page.getByTestId("editor-unsaved")).toBeVisible();

  // Run the tests on the unsaved code.
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+Enter" : "Control+Shift+Enter");
  await expect(page.getByText("1/1 tests passed")).toBeVisible();

  // Save: blobs first, then a revision on top of #3.
  await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
  await expect(page.getByTestId("editor-saved")).toBeVisible();
  const commit = calls.find((c) => c.method === "POST" && c.path === "/projects/5/revisions");
  expect(commit?.body).toMatchObject({ base_revision_id: 33, source: "save" });
  expect((commit?.body as { files: { path: string }[] }).files.map((f) => f.path).sort()).toEqual([".nga/tests.json", "main.py"]);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(500);
  await shot(page, "project-editor");
});

test("a compile error is shown on its own", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  await setup(page);
  await page.addInitScript(() => localStorage.setItem("tm.playground.python", JSON.stringify([{ path: "main.py", content: "SYNTAX ERROR(" }])));
  await page.goto("/taskmentor/code/playground?language=python");
  await page.getByTestId("playground-run").click();
  await expect(page.getByTestId("compile-error")).toContainText("SyntaxError");
});

test("the Playground on a phone: Task, Code and Output tabs", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await setup(page);
  await page.goto("/taskmentor/code/playground?language=python");
  await page.getByRole("tab", { name: "Output" }).click();
  await page.getByTestId("run-stdin").fill("1 1");
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  await expect(page.getByTestId("run-output")).toHaveText("Sum: 2");
  await shot(page, "playground-mobile");
});
