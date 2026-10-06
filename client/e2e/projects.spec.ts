/**
 * E2E: TMCode Projects in the Task Mentor web client (PROJECTS_PLAN.md §5),
 * against the Vite dev server with the mocked /api/tmcode API and a
 * scriptable EventSource (e2e/fixtures/projectsMock.ts).
 *
 * Screenshots go to $PROJECTS_SHOTS (default: test-results/projects-shots).
 */
import { test, expect, type Page } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";
import { installFakeEventSource, installProjectsMock, mockCourses, monitorSeed } from "./fixtures/projectsMock";
import { makePresence, makeRevisions } from "../src/tests/fixtures/projects";

const SHOTS = process.env.PROJECTS_SHOTS || "test-results/projects-shots";
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });

/** The dev server lives under /taskmentor/ (vite base); an absolute page.goto("/x") would drop it. */
const go = (page: Page, path: string) => page.goto(`/taskmentor${path}`);

async function mockCatchAll(page: Page) {
  await page.route("**/api/**", (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: CORS_HEADERS })
      : route.fulfill({ status: 200, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify({ success: true, data: [] }) }),
  );
}

/** Every /projects/:id/live stream opens with `hello`, as on the server. */
const projectHello = () => ({
  "/projects/1/live": [{ event: "hello", data: { project_id: 1, head: makeRevisions()[0], git: null, presence: [makePresence()] } }],
});

async function setup(page: Page, role: "student" | "instructor" | "admin", seed: Record<string, { event: string; data: unknown }[]> = {}) {
  await mockCatchAll(page);
  await mockCourses(page);
  await installFakeEventSource(page, { ...projectHello(), ...seed });
  // Keep the "Install Task Mentor as an app" prompt out of the way.
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  const state = await installProjectsMock(page);
  await loginAs(page, role);
  return state;
}

const sse = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as unknown as { __sse: Record<string, (...x: unknown[]) => unknown> }).__sse[f as string](...(a as unknown[])), [fn, args] as const);

test.describe("Projects dashboard", () => {
  test("lists projects with live dot, badges and stats; filters, table view and empty states", async ({ page }) => {
    await setup(page, "student");
    await go(page, "/projects");

    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
    if ((page.viewportSize()?.width ?? 1280) >= 1024) await expect(page.getByRole("link", { name: "Projects" }).first()).toBeVisible();
    const cards = page.getByRole("list", { name: "Projects" }).getByRole("listitem");
    await expect(cards).toHaveCount(2); // the archived one is hidden
    await expect(page.getByTestId("stat-total")).toHaveText("3");
    await expect(page.getByTestId("stat-live_now")).toHaveText("1");
    await expect(page.getByTestId("stat-submissions")).toHaveText("1");
    await expect(page.getByRole("link", { name: /Sorting algorithms, open in TMCode now/ })).toBeVisible();
    await expect(cards.first()).toContainText("Open in TMCode · editing main.cpp · 2 unsaved");
    await expect(page.getByRole("main").getByRole("link", { name: /Get TMCode/ })).toHaveAttribute("href", /\/tmcode$/);
    await shot(page, "projects-dashboard-cards");

    await page.getByRole("searchbox", { name: "Search projects" }).fill("portfolio");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Portfolio site");
    await expect(page).toHaveURL(/q=portfolio/);
    await page.getByRole("searchbox", { name: "Search projects" }).fill("");

    await page.getByRole("button", { name: "Archived (1)" }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Python games");
    await page.getByRole("button", { name: "Archived (1)" }).click();

    await page.getByRole("button", { name: "Table" }).click();
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(3);
    await expect(table).toContainText("Task Mentor");
    await expect(table).toContainText("1/1 submitted");
    await shot(page, "projects-dashboard-table");
    // The layout choice survives a reload.
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("tab", { name: "Shared with me" }).click();
    await expect(page.getByTestId("projects-empty")).toContainText("Nothing shared with you yet");
  });

  test("New project: validates the GitHub URL, creates and opens the project", async ({ page }) => {
    const state = await setup(page, "student");
    await go(page, "/projects");
    await page.getByRole("button", { name: "New project" }).first().click();
    const dialog = page.getByRole("form", { name: "New project" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("radio", { name: /GitHub/ }).click();
    await dialog.getByLabel("Repository URL").fill("not a url");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog.getByText(/https:\/\/github.com\/owner\/repo/)).toBeVisible();
    await dialog.getByLabel("Repository URL").fill("https://github.com/johndoe/robot-arm");
    await expect(dialog.getByLabel("Name")).toHaveAttribute("placeholder", "robot-arm");
    await shot(page, "projects-new-dialog", false);
    await dialog.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/projects\/\d+/);
    await expect(page.getByRole("heading", { name: "robot-arm" })).toBeVisible();
    const create = state.calls.find((c) => c.method === "POST" && c.path === "/projects");
    expect(create?.body).toMatchObject({ name: "robot-arm", kind: "github", repo_url: "https://github.com/johndoe/robot-arm" });
  });
});

test.describe("Project page", () => {
  test("live panel follows SSE presence and survives a dropped stream", async ({ page }) => {
    await setup(page, "student");
    await go(page, "/projects/1");

    const panel = page.getByTestId("live-panel");
    await expect(panel.getByTestId("presence-line")).toHaveText("Open in TMCode on MacBook · editing src/main.cpp · 2 unsaved");
    await expect(panel.getByTestId("live-indicator")).toContainText("Live");

    await sse(page, "emit", "/projects/1/live", "presence", {
      project_id: 1,
      user_id: 201,
      user_name: "John Doe",
      device_id: "dev-mac",
      app_version: "0.4.0",
      state: { open: true, file: "src/sort.hpp", dirty: 0, sync: "synced", device_name: "MacBook" },
      last_seen_at: new Date().toISOString(),
      online: true,
    });
    await expect(panel.getByTestId("presence-line")).toHaveText("Open in TMCode on MacBook · editing src/sort.hpp");
    await expect(panel.getByTestId("sync-badge")).toHaveText("Synced");

    // The server ends the stream: "Reconnecting…", then a new stream after the backoff.
    await sse(page, "drop", "/projects/1/live");
    await expect(panel.getByTestId("live-indicator")).toContainText("Reconnecting…");
    await expect(panel.getByTestId("live-indicator")).toContainText("Live", { timeout: 5000 });
    expect(await sse(page, "count", "/projects/1/live")).toBe(2);

    // A new revision arrives live.
    await sse(page, "emit", "/projects/1/live", "revision", {
      id: 9004, project_id: 1, number: 4, parent_id: 9003, author_id: 201, author_name: "John Doe", message: "Quick sort",
      file_count: 5, size_bytes: 7000, source: "save", git_commit: null, created_at: new Date().toISOString(),
    });
    await expect(page.getByText(/Revision #4 · 5 files/)).toBeVisible();

    // TMCode closes (the server sends the device once with online:false).
    await sse(page, "emit", "/projects/1/live", "presence", {
      project_id: 1, user_id: 201, user_name: "John Doe", device_id: "dev-mac", app_version: "0.4.0",
      state: { open: false }, last_seen_at: new Date().toISOString(), online: false,
    });
    await expect(panel).toContainText("Not open in TMCode");
  });

  test("Files tab: tree, read-only viewer and revision picker; Revisions and Activity tabs", async ({ page }) => {
    await setup(page, "student");
    await go(page, "/projects/1");

    const tree = page.getByRole("tree", { name: "Project files" });
    await expect(tree.getByRole("treeitem", { name: "README.md" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("viewer-path")).toHaveText("README.md");
    await expect(page.getByTestId("file-viewer")).toContainText("Sorting algorithms", { timeout: 20_000 });

    // Keyboard: open src/ and pick main.cpp.
    await tree.getByRole("treeitem", { name: "src" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tree.getByRole("treeitem", { name: "main.cpp" })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("viewer-path")).toHaveText("src/main.cpp");
    await expect(page.getByTestId("file-viewer")).toContainText("merge_sort", { timeout: 20_000 });
    await shot(page, "project-files");

    await page.getByLabel("Revision").click();
    await page.locator('[role="option"][data-value="9001"]').click();
    await expect(page).toHaveURL(/rev=9001/);
    await expect(page.getByText("Viewing revision #1, not the latest")).toBeVisible();
    await expect(tree.getByRole("treeitem")).toHaveCount(3); // README.md, src, src/main.cpp

    await page.getByRole("tab", { name: /Revisions/ }).click();
    await expect(page.getByRole("list", { name: "Revisions" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("Auto-save", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(page.getByText("saved revision #3 (4 files)")).toBeVisible();
    await shot(page, "project-activity");
  });

  test("Links: link an activity and submit with confirmation", async ({ page }) => {
    const state = await setup(page, "student");
    await go(page, "/projects/1?tab=links");

    await expect(page.getByTestId("link-row-501")).toContainText("Sorting lab");
    await page.getByRole("button", { name: "Link to an activity" }).click();
    const options = page.getByRole("radiogroup", { name: "Activities" });
    await expect(options.getByRole("radio")).toHaveCount(3);
    await options.getByRole("radio", { name: /C\+\+ practical quiz/ }).click();
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await expect(page.getByText("C++ practical quiz")).toBeVisible();

    const row = page.getByTestId("link-row-501");
    await row.getByRole("button", { name: "Submit" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("This submits revision #3 to “Sorting lab”");
    await shot(page, "project-links-confirm", false);
    await confirm.getByRole("button", { name: "Submit" }).click();
    await expect(row.getByTestId("link-status")).toHaveText("Submitted · rev 3");
    expect(state.calls.some((c) => c.method === "POST" && c.path === "/projects/1/links/501/submit")).toBe(true);
    await shot(page, "project-links");
  });

  test("Open in TMCode asks for the deep link and falls back to the download", async ({ page }) => {
    const state = await setup(page, "student");
    await go(page, "/projects/1");
    await page.getByRole("button", { name: "Open in TMCode" }).click();
    await expect(page.getByTestId("tmcode-fallback")).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole("link", { name: /Don't have TMCode\? Download/ })).toHaveAttribute("href", /\/tmcode$/);
    expect(state.calls.some((c) => c.path === "/projects/1/open-link")).toBe(true);
  });

  test("GitHub project: Git tab, members and settings", async ({ page }) => {
    const state = await setup(page, "student");
    await go(page, "/projects/2");

    await expect(page.getByRole("tab", { name: "Files" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Git" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("3f2a9c1").first()).toBeVisible();
    await expect(page.getByText("Contact form")).toBeVisible();
    await shot(page, "project-git");

    await page.getByRole("tab", { name: /Members/ }).click();
    const form = page.getByRole("form", { name: "Add a member" });
    await form.getByLabel("Email or user id").fill("eric.mugisha@student.com");
    await form.getByLabel("GitHub username").fill("eric-m");
    await form.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("list", { name: "Members" })).toContainText("@eric-m");
    await expect(page.getByRole("list", { name: "Members" })).toContainText("Eric Mugisha");
    expect(state.calls.find((c) => c.path === "/projects/2/members")?.body).toEqual({
      email: "eric.mugisha@student.com",
      github_username: "eric-m",
      role: "collaborator",
    });

    await page.getByRole("tab", { name: "Settings" }).click();
    const settings = page.getByRole("form", { name: "Project settings" });
    await expect(settings).toBeVisible();
    await settings.getByLabel("Name").fill("Portfolio 2026");
    await expect(settings.getByLabel("Name")).toHaveValue("Portfolio 2026");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Portfolio 2026" })).toBeVisible();

    // Submitted to an activity: it can't be deleted, only archived.
    await expect(page.getByRole("button", { name: "Delete project" })).toBeDisabled();
    await expect(page.getByText(/can't be deleted\. Archive it instead/)).toBeVisible();
    await shot(page, "project-settings");
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
  });

  test("mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, "student");
    await go(page, "/projects");
    await expect(page.getByRole("list", { name: "Projects" }).getByRole("listitem")).toHaveCount(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, "projects-mobile");
    await go(page, "/projects/1");
    await expect(page.getByTestId("live-panel")).toBeVisible();
    await shot(page, "project-mobile");
  });
});

test.describe("Teacher views", () => {
  test("monitor groups live students by course, with filters", async ({ page }) => {
    await setup(page, "instructor", monitorSeed());
    await go(page, "/projects/monitor");

    await expect(page.getByRole("heading", { name: "Project monitor" })).toBeVisible();
    if ((page.viewportSize()?.width ?? 1280) >= 1024)
      await expect(page.getByRole("link", { name: "Project Monitor" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("live-indicator")).toContainText("Live");
    await expect(page.getByRole("region", { name: "CS5 — Computer Science S5" }).getByTestId("monitor-card")).toHaveCount(2);
    await expect(page.getByRole("region", { name: "WEB — Web Development" }).getByTestId("monitor-card")).toHaveCount(1);
    await shot(page, "projects-monitor");

    // A heartbeat for a closed project brings the student back online.
    await sse(page, "emit", "/monitor/live", "presence", {
      project: { id: 6, name: "Calculator", kind: "tm", language: "python", owner: { id: 204, name: "Aline Keza", avatar_url: null } },
      course_ids: [11],
      presence: {
        project_id: 6, user_id: 204, user_name: "Aline Keza", device_id: "dev-204-6", app_version: "0.4.0",
        state: { open: true, file: "calc.py", dirty: 1 }, last_seen_at: new Date().toISOString(), online: true,
      },
    });
    await expect(page.getByRole("region", { name: "CS5 — Computer Science S5" }).getByTestId("monitor-card")).toHaveCount(3);
    await expect(page.getByText("Aline Keza")).toBeVisible();

    // …and a stale-device notice takes her offline again.
    await sse(page, "emit", "/monitor/live", "presence", {
      project: { id: 6, name: "Calculator", kind: "tm", language: "python", owner: { id: 204, name: "Aline Keza", avatar_url: null } },
      course_ids: [11],
      presence: {
        project_id: 6, user_id: 204, user_name: "Aline Keza", device_id: "dev-204-6", app_version: "0.4.0",
        state: { open: true, file: "calc.py", dirty: 1 }, last_seen_at: new Date().toISOString(), online: false,
      },
    });
    await expect(page.getByRole("region", { name: "CS5 — Computer Science S5" }).getByTestId("monitor-card")).toHaveCount(2);

    await page.getByRole("radio", { name: "Attention" }).click();
    await expect(page.getByTestId("monitor-card")).toHaveCount(1);
    await expect(page.getByTestId("monitor-card")).toContainText("Eric Mugisha");
    await page.getByRole("radio", { name: "Open now" }).click();
    await page.getByLabel("Course").click();
    await page.getByRole("option", { name: "WEB — Web Development" }).click();
    await expect(page.getByTestId("monitor-card")).toHaveCount(1);
    await expect(page.getByTestId("monitor-card")).toContainText("Portfolio site");
  });

  test("assignment page shows the Linked projects panel", async ({ page }) => {
    await setup(page, "instructor");
    await page.route("**/api/assignments/77", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          data: {
            id: "77", title: "Sorting lab", description: "<p>Implement three sorts.</p>", due_date: new Date(Date.now() + 2 * 86400_000).toISOString(),
            max_score: "20", submission_type: "project", allowed_file_types: "", rubric: null, course_id: "11", created_by: "101",
            can_manage: true, can_grade: true, attachments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            course: { id: "11", code: "CS5", title: "Computer Science S5" }, submissions: [], status: "published",
          },
        }),
      }),
    );
    await go(page, "/assignments/77");
    const panel = page.getByTestId("linked-projects-panel");
    await expect(panel).toContainText("2 submitted · 1 linked, not submitted");
    await expect(panel.getByRole("link", { name: "Open John Doe's project Sorting algorithms" })).toHaveAttribute("href", /\/projects\/1\?tab=files&rev=9003$/);
    await panel.scrollIntoViewIfNeeded();
    await shot(page, "assignment-linked-projects");
    await panel.getByRole("link", { name: "Open John Doe's project Sorting algorithms" }).click();
    await expect(page).toHaveURL(/\/projects\/1\?tab=files&rev=9001|\/projects\/1\?tab=files&rev=9003/);
    await expect(page.getByLabel("Revision")).toHaveAttribute("data-value", "9003");
  });
});
