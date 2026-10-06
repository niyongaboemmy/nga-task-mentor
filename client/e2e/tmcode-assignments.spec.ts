/**
 * E2E: TMCode practicals on the Task Mentor web (ASSIGNMENTS_PLAN.md "Task
 * Mentor web") against the Vite dev server with a mocked API: the teacher's
 * "TMCode practical" form section, the student's Open in TMCode panel, the
 * teacher's Workspaces panel with grading, and a workspace project's Share
 * live status lock and read-only banner.
 *
 * Screenshots go to $TMCODE_SHOTS (default: test-results/tmcode-shots).
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";
import { installFakeEventSource } from "./fixtures/projectsMock";
import { makeProjectDetails, makeRevisions, MANIFESTS } from "../src/tests/fixtures/projects";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string, fullPage = true) =>
  page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage });
const go = (page: Page, path: string) => page.goto(`/taskmentor${path}`);

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

type Json = Record<string, unknown>;
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const dueIn = (ms: number) => new Date(Date.now() + ms).toISOString();

const ASSIGNMENT = {
  id: 77,
  title: "Sorting lab",
  description: "<p>Implement <b>merge sort</b> and time it against bubble sort.</p>",
  due_date: dueIn(2 * 86_400_000 + 3 * 3600_000),
  max_score: 20,
  submission_type: "project",
  allowed_file_types: [],
  rubric: [{ criteria: "Correctness", max_score: 12 }, { criteria: "Style", max_score: 8 }],
  course_id: "12",
  created_by: "101",
  status: "published",
  attachments: [],
  createdAt: iso(86_400_000),
  updatedAt: iso(3600_000),
  can_manage: true,
  can_grade: true,
  tmcode: { kind: "practical", language: "cpp", starter_project_id: 1, starter_revision_id: null, instructions: "Run make, then ./sort." },
};

const myWork = (state: string, extra: Json = {}) => ({
  project_id: state === "not_started" ? null : 5,
  link_id: state === "not_started" ? null : 8,
  state,
  submitted_at: null,
  revision_number: null,
  grade: null,
  max_points: 20,
  feedback: null,
  ...extra,
});

const detail = (my: Json, extra: Json = {}) => ({
  assignment: {
    id: 77,
    title: "Sorting lab",
    kind: "practical",
    course_id: 12,
    course_name: "Computer Science S5",
    status: "published",
    due_date: ASSIGNMENT.due_date,
    points: 20,
    language: "cpp",
    read_only: false,
    late: false,
    my,
    description_html: ASSIGNMENT.description,
    instructions: "Run make, then ./sort.",
    attachments: [],
    rubric: ASSIGNMENT.rubric,
    starter: { project_id: 1, revision_id: 9003, file_count: 4, size_bytes: 6144 },
    ...extra,
  },
});

const WORKSPACES = {
  assignment: { id: 77, title: "Sorting lab", status: "published", kind: "practical", course_id: 12, due_date: ASSIGNMENT.due_date, points: 20, read_only: false },
  counts: { students: 5, started: 4, submitted: 2, graded: 1, live: 1 },
  workspaces: [
    {
      user: { id: 201, mis_user_id: 3201, name: "John Doe", email: "john.doe@student.com", avatar_url: null },
      project_id: 5, link_id: 8, submission_id: null, state: "in_progress", last_activity_at: iso(20_000),
      presence: { shared: true, online: true, devices_online: 1, last_seen_at: iso(5000), file: "src/merge.cpp", dirty: 2 },
      revision_id: null, revision_number: null, submitted_at: null, grade: null, max_points: 20,
    },
    {
      user: { id: 202, mis_user_id: 3202, name: "Grace Uwase", email: "grace@student.com", avatar_url: null },
      project_id: 6, link_id: 9, submission_id: 70, state: "submitted", last_activity_at: iso(3600_000),
      presence: { shared: false, online: false, devices_online: 0, last_seen_at: null, file: null, dirty: 0 },
      revision_id: 9003, revision_number: 3, submitted_at: iso(3600_000), grade: null, max_points: 20,
    },
    {
      user: { id: 203, mis_user_id: 3203, name: "Eric Mugisha", email: "eric@student.com", avatar_url: null },
      project_id: 7, link_id: 10, submission_id: 71, state: "graded", last_activity_at: iso(86_400_000),
      presence: { shared: true, online: false, devices_online: 0, last_seen_at: iso(86_400_000), file: null, dirty: 0 },
      revision_id: 9002, revision_number: 2, submitted_at: iso(90_000_000), grade: 17, max_points: 20,
    },
    {
      user: { id: 204, mis_user_id: 3204, name: "Aline Ishimwe", email: "aline@student.com", avatar_url: null },
      project_id: 12, link_id: 11, submission_id: null, state: "in_progress", last_activity_at: iso(7200_000),
      presence: { shared: true, online: false, devices_online: 0, last_seen_at: iso(7200_000), file: null, dirty: 0 },
      revision_id: null, revision_number: null, submitted_at: null, grade: null, max_points: 20,
    },
    {
      user: { id: null, mis_user_id: 3205, name: "Patrick Nshuti", email: "patrick@student.com", avatar_url: null },
      project_id: null, link_id: null, submission_id: null, state: "not_started", last_activity_at: null,
      presence: null, revision_id: null, revision_number: null, submitted_at: null, grade: null, max_points: 20,
    },
  ],
};

const SUBMISSIONS = [
  {
    id: 70, assignment_id: 77, student_id: 202, status: "submitted", submitted_at: iso(3600_000),
    text_submission: 'TMCode project "Sorting lab", revision #3', file_submissions: null, grade: null, feedback: null,
    student: { id: 202, first_name: "Grace", last_name: "Uwase", email: "grace@student.com" },
  },
  {
    id: 71, assignment_id: 77, student_id: 203, status: "graded", submitted_at: iso(90_000_000),
    text_submission: 'TMCode project "Sorting lab", revision #2', file_submissions: null, grade: "17", feedback: "Good.",
    student: { id: 203, first_name: "Eric", last_name: "Mugisha", email: "eric@student.com" },
  },
];

interface Calls {
  puts: Json[];
  created: boolean;
  patches: Json[];
}

async function setup(page: Page, role: "student" | "instructor", opts: { my?: Json; readOnly?: boolean } = {}): Promise<Calls> {
  const calls: Calls = { puts: [], created: false, patches: [] };
  await page.route("**/api/**", (r) =>
    r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] }),
  );
  await installFakeEventSource(page, {});
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  await loginAs(page, role);
  await page.route("**/api/courses", (r) =>
    r.request().method() === "GET" ? json(r, { success: true, data: [{ id: "12", title: "Computer Science S5", code: "CS5" }] }) : r.fallback(),
  );
  await page.route("**/api/courses/12/assignments", (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    calls.created = true;
    return json(r, { success: true, data: { id: 99 } }, 201);
  });
  await page.route("**/api/assignments/77", (r) =>
    json(r, { success: true, data: { ...ASSIGNMENT, status: opts.readOnly ? "completed" : "published" } }),
  );
  await page.route("**/api/assignments/77/submissions", (r) =>
    json(r, { success: true, data: role === "instructor" ? SUBMISSIONS : [] }),
  );

  const now = Date.now();
  const starter = { ...(makeProjectDetails(1, now).project as unknown as Json) };
  const workspace = {
    ...(makeProjectDetails(1, now).project as unknown as Json),
    id: 5,
    name: "Sorting lab",
    slug: "sorting-lab",
    visibility: "course",
    assignment: { id: 77, title: "Sorting lab", status: opts.readOnly ? "completed" : "published", kind: "practical" },
    read_only: !!opts.readOnly,
    share_presence: true,
    links: [],
    can: { edit: true, save: !opts.readOnly, report_git: false, read_all_revisions: true, share_presence: !!opts.readOnly },
  };
  await page.route("**/api/tmcode/**", async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/tmcode/, "");
    const method = req.method();
    if (method === "OPTIONS") return r.fulfill({ status: 204, headers: CORS_HEADERS });
    if (method === "GET" && path === "/projects") {
      return json(r, {
        projects: [
          { ...starter, presence: starter.presence_summary, links: { total: 0, submitted: 0, items: [] } },
          { ...starter, id: 2, name: "Bubble sort demo", slug: "bubble", file_count: 1, size_bytes: 412, head: { ...(makeRevisions(now)[2] as Json) }, presence: starter.presence_summary, links: { total: 0, submitted: 0, items: [] } },
          { ...workspace, presence: workspace.presence_summary, links: { total: 1, submitted: 0, items: [] } },
        ],
        stats: { total: 3, online: 1, active_this_week: 2, revisions: 7, submissions: 0 },
      });
    }
    let m = path.match(/^\/projects\/(\d+)\/revisions\/(\w+)\/manifest$/);
    if (m) {
      const rev = m[2] === "head" ? 9003 : Number(m[2]);
      return json(r, { revision: makeRevisions(now).find((x) => x.id === rev) ?? null, files: MANIFESTS[rev] ?? MANIFESTS[9003] });
    }
    if (path.match(/^\/projects\/\d+\/revisions$/)) return json(r, { head_revision_id: 9003, revisions: makeRevisions(now) });
    m = path.match(/^\/projects\/(\d+)$/);
    if (m && method === "GET") return json(r, { project: Number(m[1]) === 5 ? workspace : starter });
    if (m && method === "PATCH") {
      calls.patches.push(req.postDataJSON());
      return json(r, { project: { ...workspace, ...req.postDataJSON() } });
    }
    if (path === "/assignments/99/tmcode" || path === "/assignments/77/tmcode") {
      calls.puts.push(req.postDataJSON());
      return json(r, detail(null));
    }
    if (path === "/assignments/77/open-link") return json(r, { deeplink: "tmcode://assignment?id=77&api=http%3A%2F%2Flocalhost%3A5002" });
    if (path === "/assignments/77/workspaces") return json(r, WORKSPACES);
    if (path === "/assignments/77") return json(r, detail(opts.my ?? myWork("not_started"), opts.readOnly ? { status: "completed", read_only: true } : {}));
    return json(r, { error_code: "NOT_FOUND", message: `Unmocked ${method} ${path}` }, 404);
  });
  return calls;
}

test.describe("Teacher: TMCode practical in the assignment form", () => {
  test("turns it on, picks a starter and a revision, and saves the settings after creating", async ({ page }) => {
    const calls = await setup(page, "instructor");
    await go(page, "/assignments/create?courseId=12");
    await expect(page.getByRole("heading", { name: "Create assignment" })).toBeVisible();
    await page.getByLabel("Title").fill("Sorting lab");
    await page.getByRole("button", { name: "In a week" }).click();
    await page.getByLabel("Max score").fill("20");
    await page.getByText(/Describe the task/).click();
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.type("Implement merge sort and time it.");
    await page.getByRole("button", { name: "Save and Continue" }).click();

    const section = page.getByTestId("tmcode-section");
    await section.scrollIntoViewIfNeeded();
    await shot(page, "form-tmcode-off", false);
    await section.getByRole("radio", { name: /Practical/ }).click();
    await expect(page.getByRole("radio", { name: /TMCode project/ })).toHaveAttribute("aria-checked", "true");

    const starter = section.getByTestId("starter-1");
    await expect(starter).toContainText("Sorting algorithms");
    await expect(starter).toContainText("4 files");
    await expect(section.getByTestId("starter-5")).toHaveCount(0); // a student workspace is never a starter
    await starter.click();
    await expect(section.getByTestId("starter-preview")).toContainText("src/main.cpp");
    await section.getByRole("combobox", { name: "Version students start from" }).click();
    await page.getByRole("option", { name: /Revision #2/ }).click();
    await section.getByLabel("Instructions in TMCode").fill("Run make, then ./sort.");
    await section.scrollIntoViewIfNeeded();
    await shot(page, "form-tmcode-on", false);

    await page.getByRole("button", { name: /Create assignment/ }).click();
    await expect.poll(() => calls.puts.length).toBe(1);
    expect(calls.created).toBe(true);
    expect(calls.puts[0]).toMatchObject({
      kind: "practical",
      language: "cpp",
      starter_project_id: 1,
      starter_revision_id: 9002,
      instructions: "Run make, then ./sort.",
    });
  });
});

test.describe("Student: TMCode panel", () => {
  test("Open in TMCode hands over the deep link, then falls back to the download page", async ({ page }) => {
    await setup(page, "student");
    await go(page, "/assignments/77");
    const panel = page.getByTestId("tmcode-student-panel");
    await expect(panel.getByTestId("work-state")).toHaveText("Not started");
    await expect(panel).toContainText("Start copies 4 starter files");
    await expect(panel).toContainText("Due in 2 days");
    await shot(page, "student-not-started");

    // location.href can't be stubbed in a real browser: the link request is
    // checked here and the hand-over itself in the vitest suite. No TMCode is
    // installed, so after ~2 s the page goes to the download page.
    const linkRequest = page.waitForRequest((r) => r.url().endsWith("/api/tmcode/assignments/77/open-link"));
    await panel.getByTestId("open-assignment-in-tmcode").click();
    await linkRequest;
    await expect(page).toHaveURL(/\/taskmentor\/tmcode$/, { timeout: 6000 });
  });

  test("graded: the grade, the feedback and the submitted code", async ({ page }) => {
    await setup(page, "student", {
      my: myWork("graded", { submitted_at: iso(3600_000), revision_number: 3, grade: 18, feedback: "Clean merge step; add comments." }),
    });
    await go(page, "/assignments/77");
    const panel = page.getByTestId("tmcode-student-panel");
    await expect(panel.getByTestId("tmcode-grade")).toContainText("18 / 20");
    await expect(panel.getByTestId("open-assignment-in-tmcode")).toHaveText(/Continue in TMCode/);
    await panel.getByRole("button", { name: /What you submitted · revision #3/ }).click();
    await expect(panel.getByTestId("submitted-code")).toContainText("src");
    await shot(page, "student-graded");
  });

  test("completed: read-only", async ({ page }) => {
    await setup(page, "student", { my: myWork("in_progress"), readOnly: true });
    await go(page, "/assignments/77");
    const panel = page.getByTestId("tmcode-student-panel");
    await expect(panel).toContainText("marked this assignment completed");
    await expect(panel.getByTestId("open-assignment-in-tmcode")).toHaveText(/View in TMCode/);
    await shot(page, "student-read-only", false);
  });
});

test.describe("Teacher: Workspaces", () => {
  test("states, live status, code links and grading through the existing dialog", async ({ page }) => {
    await setup(page, "instructor");
    await go(page, "/assignments/77");
    const panel = page.getByTestId("tmcode-workspaces");
    const rows = panel.getByTestId("workspace-row");
    await expect(rows).toHaveCount(5);
    await expect(panel.getByTestId("ws-count-students")).toHaveText("5");
    await expect(rows.filter({ hasText: "John Doe" })).toContainText("editing src/merge.cpp");
    await expect(rows.filter({ hasText: "Grace Uwase" })).toContainText("Live status not shared");
    await expect(rows.filter({ hasText: "Grace Uwase" }).getByRole("link", { name: /Code at rev 3/ })).toHaveAttribute(
      "href",
      "/taskmentor/projects/6?tab=files&rev=9003",
    );
    await expect(rows.filter({ hasText: "Patrick Nshuti" })).toContainText("hasn't signed in");
    await shot(page, "teacher-workspaces");

    await rows.filter({ hasText: "Grace Uwase" }).getByRole("button", { name: "Grade" }).click();
    await expect(page.getByRole("dialog").or(page.locator("[role=dialog], .fixed.inset-0")).first()).toBeVisible();
    await expect(page.getByText(/revision #3/).first()).toBeVisible();
    await shot(page, "teacher-grade-dialog", false);

    await page.keyboard.press("Escape");
    await panel.getByRole("radio", { name: /To grade/ }).click();
    await expect(rows).toHaveCount(1);
  });
});

test.describe("Workspace project", () => {
  test("Share live status is locked on while the assignment is open", async ({ page }) => {
    const calls = await setup(page, "student");
    await go(page, "/projects/5?tab=settings");
    await expect(page.getByTestId("assignment-badge")).toContainText("Practical");
    const sw = page.getByRole("switch", { name: "Share live status" });
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(sw).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText(/Locked on while “Sorting lab” is open/)).toBeVisible();
    await sw.click({ force: true });
    expect(calls.patches).toHaveLength(0);
    await shot(page, "workspace-settings-locked");
  });

  test("completed: read-only banner, and sharing can be turned off", async ({ page }) => {
    const calls = await setup(page, "student", { readOnly: true });
    await go(page, "/projects/5?tab=settings");
    await expect(page.getByTestId("read-only-banner")).toBeVisible();
    const sw = page.getByRole("switch", { name: "Share live status" });
    await sw.click();
    await expect.poll(() => calls.patches[0]).toEqual({ share_presence: false });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Not shared with teachers")).toBeVisible();
    await shot(page, "workspace-read-only");
  });
});
