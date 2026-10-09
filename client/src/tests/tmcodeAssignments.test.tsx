import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useState } from "react";

const axiosMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({
  default: axiosMock,
  API_BASE_URL: "http://api.test/api",
  isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Monaco is heavy and irrelevant here.
vi.mock("@monaco-editor/react", () => ({ default: ({ value }: { value: string }) => <pre data-testid="code">{value}</pre> }));
vi.mock("../components/Assignments/AssignmentDescriptionEditor", () => ({
  default: ({ description, onChange }: { description: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Description" value={description} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import TmcodePracticalSection, { starterCandidates } from "../components/Assignments/form/TmcodePracticalSection";
import AssignmentEditorForm, { type AssignmentFormValues } from "../components/Assignments/form/AssignmentEditorForm";
import TmcodeStudentPanel from "../components/Assignments/tmcode/TmcodeStudentPanel";
import TmcodeWorkspacesPanel, { workspaceCodeHref } from "../components/Assignments/tmcode/TmcodeWorkspacesPanel";
import { dueCountdown } from "../components/Assignments/tmcode/tmcodeFormat";
import { ShareLiveStatus } from "../components/Projects/ProjectAdminTabs";
import { OPEN_FALLBACK_MS } from "../components/Projects/OpenProjectInTmcode";
import { normalizeMonitorEntry, normalizeProject, normalizeProjectDetail } from "../services/projectsApi";
import { EMPTY_TMCODE, sameTmcode, type TmcodeSettings, type WorkspaceRow } from "../services/tmcodeAssignmentsApi";
import { pickOption } from "./helpers/select";

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

const project = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Starter ${id}`,
  slug: `starter-${id}`,
  kind: "tm",
  visibility: "private",
  language: "python",
  file_count: 3,
  size_bytes: 2048,
  my_role: "owner",
  owner: { id: 9, name: "Teacher" },
  head: { id: 100 + id, number: 4, file_count: 3, size_bytes: 2048, source: "save", created_at: iso(2 * 3600_000) },
  presence: { online: false, devices_online: 0, last_seen_at: null, file: null, dirty: 0 },
  links: { total: 0, submitted: 0, items: [] },
  created_at: iso(86_400_000),
  updated_at: iso(3600_000),
  ...extra,
});

/** Routes GET calls by URL. */
function routeGets(routes: Record<string, unknown>) {
  axiosMock.get.mockImplementation(async (url: string) => {
    for (const [prefix, body] of Object.entries(routes)) {
      if (url === prefix || url.startsWith(prefix)) return { data: typeof body === "function" ? (body as () => unknown)() : body };
    }
    throw Object.assign(new Error(`unexpected GET ${url}`), { response: { status: 404 } });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as never;
});

// ─── Pure helpers ────────────────────────────────────────────────────────────

describe("helpers", () => {
  it("compares settings the way the form decides to save them", () => {
    const a: TmcodeSettings = { kind: "practical", language: "python", starter_project_id: 1, starter_revision_id: null, instructions: "Go" };
    expect(sameTmcode(a, { ...a })).toBe(true);
    expect(sameTmcode(a, { ...a, instructions: " Go " })).toBe(true);
    expect(sameTmcode(a, { ...a, starter_revision_id: 7 })).toBe(false);
    expect(sameTmcode(EMPTY_TMCODE, { ...EMPTY_TMCODE, language: "go" })).toBe(true); // off ignores the rest
    expect(sameTmcode(EMPTY_TMCODE, a)).toBe(false);
  });

  it("only offers the teacher's own saved-able TM projects as starters", () => {
    const list = [
      normalizeProject(project(1)),
      normalizeProject(project(2, { kind: "github" })),
      normalizeProject(project(3, { archived_at: iso(1000) })),
      normalizeProject(project(4, { assignment: { id: 5, title: "Lab", status: "published", kind: "practical" } })),
      normalizeProject(project(5, { my_role: "collaborator" })),
    ];
    expect(starterCandidates(list).map((p) => p.id)).toEqual([1]);
  });

  it("formats the due countdown, red when late", () => {
    const now = Date.parse("2026-10-07T10:00:00Z");
    expect(dueCountdown("2026-10-09T13:00:00Z", now)).toMatchObject({ text: "Due in 2 days 3 h", late: false });
    expect(dueCountdown("2026-10-07T07:30:00Z", now)).toMatchObject({ text: "Late by 2 h 30 min", late: true });
    expect(dueCountdown("2026-10-07T07:30:00Z", now)!.tone).toContain("rose");
    expect(dueCountdown(null)).toBeNull();
  });

  it("reads the assignment, read_only and share_presence of a project, and withdrawn monitor rows", () => {
    const p = normalizeProjectDetail({
      ...project(1),
      assignment: { id: 9, title: "Lab", status: "completed", kind: "case_study" },
      read_only: true,
      share_presence: false,
      can: { edit: true, save: false, report_git: true, read_all_revisions: true, share_presence: true },
    });
    expect(p).toMatchObject({ assignment: { id: 9, kind: "case_study" }, read_only: true, share_presence: false });
    expect(p.can.share_presence).toBe(true);
    expect(normalizeProject(project(2)).share_presence).toBe(true);
    expect(normalizeMonitorEntry({ project: { id: 1 }, course_ids: [], presence: { project_id: 1, user_id: 2, device_id: "d", state: {}, last_seen_at: iso(0) }, withdrawn: true }).withdrawn).toBe(true);
  });

  it("links a workspace row to its submitted revision", () => {
    expect(workspaceCodeHref({ project_id: 4, revision_id: 77 })).toBe("/projects/4?tab=files&rev=77");
    expect(workspaceCodeHref({ project_id: 4, revision_id: null })).toBe("/projects/4?tab=files");
    expect(workspaceCodeHref({ project_id: null, revision_id: null })).toBeNull();
  });
});

// ─── Form section ────────────────────────────────────────────────────────────

function SectionHarness({ onChange }: { onChange: (v: TmcodeSettings) => void }) {
  const [value, setValue] = useState<TmcodeSettings>(EMPTY_TMCODE);
  return (
    <MemoryRouter>
      <TmcodePracticalSection
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    </MemoryRouter>
  );
}

describe("TMCode practical section", () => {
  it("is off until a kind is chosen, then lists starters with files, last save and a revision choice", async () => {
    routeGets({
      "/tmcode/projects/1/revisions/101/manifest": { revision: null, files: [{ path: "old.py", sha256: "x", size: 3 }] },
      "/tmcode/projects/1/revisions/head/manifest": {
        revision: null,
        files: [
          { path: "README.md", sha256: "a", size: 120 },
          { path: "main.py", sha256: "b", size: 900 },
        ],
      },
      "/tmcode/projects/1/revisions": {
        revisions: [
          { id: 104, number: 4, message: "final", file_count: 2, size_bytes: 1020, source: "save", created_at: iso(3600_000) },
          { id: 101, number: 1, message: "first", file_count: 1, size_bytes: 3, source: "save", created_at: iso(86_400_000) },
        ],
      },
      "/tmcode/projects": { projects: [project(1), project(2, { name: "Other", kind: "github" })] },
    });
    const onChange = vi.fn();
    render(<SectionHarness onChange={onChange} />);

    const group = screen.getByRole("radiogroup", { name: "Work in TMCode" });
    expect(within(group).getByRole("radio", { name: /Off/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Starter files")).toBeNull();
    expect(axiosMock.get).not.toHaveBeenCalled();

    fireEvent.click(within(group).getByRole("radio", { name: /Practical/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "practical" }));

    const starter = await screen.findByTestId("starter-1");
    expect(starter).toHaveTextContent("Starter 1");
    expect(starter).toHaveTextContent("3 files · 2.0 KB");
    expect(starter).toHaveTextContent("saved 2 h ago · rev 4");
    expect(screen.queryByText("Other")).toBeNull(); // github projects can't be starters

    fireEvent.click(starter);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "practical", starter_project_id: 1, starter_revision_id: null, language: "python" }),
    );
    const preview = await screen.findByTestId("starter-preview");
    await waitFor(() => expect(preview).toHaveTextContent("main.py"));
    expect(preview).toHaveTextContent("2 files");

    const rev = await screen.findByRole("combobox", { name: "Version students start from" });
    await waitFor(() => expect(rev).not.toBeDisabled());
    pickOption(rev, "101");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ starter_revision_id: 101 }));
    await waitFor(() => expect(screen.getByTestId("starter-preview")).toHaveTextContent("old.py"));

    fireEvent.change(screen.getByLabelText("Instructions in TMCode"), { target: { value: "Run main.py" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ instructions: "Run main.py" }));
  });

  it("says so when the teacher has no projects yet", async () => {
    routeGets({ "/tmcode/projects": { projects: [] } });
    render(<SectionHarness onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /Case study/ }));
    expect(await screen.findByText(/You have no Task Mentor projects yet/)).toBeInTheDocument();
    expect(screen.getByTestId("starter-none")).toHaveAttribute("aria-checked", "true");
  });
});

// ─── Form integration ───────────────────────────────────────────────────────

const future = () => {
  const d = new Date(Date.now() + 3 * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
};
const initial = (extra: Partial<AssignmentFormValues> = {}): AssignmentFormValues => ({
  title: "Sorting lab",
  description: "<p>Sort it.</p>",
  due_date: future(),
  max_score: 20,
  submission_type: "file",
  allowed_file_types: [],
  rubric: [],
  course_id: "12",
  status: "draft",
  ...extra,
});

describe("assignment form with a TMCode practical", () => {
  it("turns the submission type to project and hands the settings to submit", async () => {
    routeGets({ "/tmcode/projects": { projects: [] } });
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <AssignmentEditorForm mode="create" initial={initial()} courses={[{ id: "12", title: "Programming", code: "CS" }]} submit={submit} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Practical/ }));
    expect(screen.getByRole("radio", { name: /TMCode project/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.change(await screen.findByLabelText("Instructions in TMCode"), { target: { value: "Make the tests pass" } });

    fireEvent.click(screen.getByRole("button", { name: /Create assignment/ }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const [fd, , tmcode] = submit.mock.calls[0];
    expect((fd as FormData).get("submission_type")).toBe("project");
    expect(tmcode).toMatchObject({ kind: "practical", instructions: "Make the tests pass" });
  });

  it("passes null when the TMCode settings didn't change, and picking another type turns TMCode off", async () => {
    routeGets({ "/tmcode/projects": { projects: [] } });
    const submit = vi.fn().mockResolvedValue(undefined);
    const tm: TmcodeSettings = { kind: "case_study", language: "go", starter_project_id: null, starter_revision_id: null, instructions: null };
    const { unmount } = render(
      <MemoryRouter>
        <AssignmentEditorForm mode="edit" initial={initial({ submission_type: "project" })} initialTmcode={tm} submit={submit} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][2]).toBeNull();
    unmount();

    submit.mockClear();
    render(
      <MemoryRouter>
        <AssignmentEditorForm mode="edit" initial={initial({ submission_type: "project" })} initialTmcode={tm} submit={submit} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /File only/ }));
    expect(within(screen.getByRole("radiogroup", { name: "Work in TMCode" })).getByRole("radio", { name: /Off/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][2]).toMatchObject({ kind: null });
  });
});

// ─── Student panel ───────────────────────────────────────────────────────────

const detail = (my: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  assignment: {
    id: 77,
    title: "Sorting lab",
    kind: "practical",
    course_id: 12,
    course_name: "Programming",
    status: "published",
    due_date: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    points: 20,
    language: "python",
    read_only: false,
    late: false,
    description_html: "<p>Sort</p>",
    instructions: "Run main.py",
    attachments: [],
    rubric: [],
    starter: { project_id: 1, revision_id: 104, file_count: 2, size_bytes: 1020 },
    my,
    ...extra,
  },
});
const notStarted = { project_id: null, link_id: null, state: "not_started", submitted_at: null, revision_number: null, grade: null, max_points: 20, feedback: null };

describe("student TMCode panel", () => {
  const stubLocation = () => {
    const href = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, set href(v: string) { href(v); } },
    });
    return href;
  };

  it("opens the assignment deep link, then falls back to the download page", async () => {
    const href = stubLocation();
    routeGets({
      "/tmcode/assignments/77/open-link": { deeplink: "tmcode://assignment?id=77&api=https%3A%2F%2Fx" },
      "/tmcode/assignments/77": detail(notStarted),
    });
    render(
      <MemoryRouter initialEntries={["/assignments/77"]}>
        <Routes>
          <Route path="/assignments/77" element={<TmcodeStudentPanel assignmentId={77} />} />
          <Route path="/tmcode" element={<p>Download TMCode page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("work-state")).toHaveTextContent("Not started");
    expect(screen.getByTestId("tmcode-steps")).toHaveTextContent("Start copies 2 starter files");
    expect(screen.getByText("Run main.py")).toBeInTheDocument();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByTestId("open-assignment-in-tmcode"));
    await waitFor(() => expect(href).toHaveBeenCalledWith("tmcode://assignment?id=77&api=https%3A%2F%2Fx"));
    await act(async () => {
      vi.advanceTimersByTime(OPEN_FALLBACK_MS + 10);
    });
    expect(await screen.findByText("Download TMCode page")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows the grade, the feedback and the submitted code", async () => {
    routeGets({
      "/tmcode/projects/5/files/main.py": "print('sorted')",
      "/tmcode/projects/5/revisions/203/manifest": { revision: null, files: [{ path: "main.py", sha256: "c", size: 15 }] },
      "/tmcode/projects/5/revisions": {
        revisions: [
          { id: 204, number: 4, file_count: 1, size_bytes: 15, source: "save", created_at: iso(1000) },
          { id: 203, number: 3, file_count: 1, size_bytes: 15, source: "save", created_at: iso(5000) },
        ],
      },
      "/tmcode/assignments/77": detail({
        project_id: 5,
        link_id: 8,
        state: "graded",
        submitted_at: iso(3600_000),
        revision_number: 3,
        grade: 18,
        max_points: 20,
        feedback: "Neat recursion.",
      }),
    });
    render(
      <MemoryRouter>
        <TmcodeStudentPanel assignmentId={77} />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("tmcode-grade")).toHaveTextContent("18 / 20");
    expect(screen.getByTestId("tmcode-grade")).toHaveTextContent("Neat recursion.");
    expect(screen.getByTestId("work-state")).toHaveTextContent("Graded");
    expect(screen.getByTestId("open-assignment-in-tmcode")).toHaveTextContent("Continue in TMCode");

    fireEvent.click(screen.getByRole("button", { name: /What you submitted · revision #3/ }));
    await waitFor(() => expect(axiosMock.get).toHaveBeenCalledWith("/tmcode/projects/5/revisions/203/manifest"));
  });

  it("explains a completed (read-only) assignment", async () => {
    routeGets({ "/tmcode/assignments/77": detail({ ...notStarted, state: "in_progress", project_id: 5 }, { status: "completed", read_only: true }) });
    render(
      <MemoryRouter>
        <TmcodeStudentPanel assignmentId={77} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/marked this assignment completed/)).toBeInTheDocument();
    expect(screen.getByTestId("open-assignment-in-tmcode")).toHaveTextContent("View in TMCode");
  });

  it("past the due date, on-time work says so instead of a late countdown", async () => {
    const pastDue = { due_date: new Date(Date.now() - 3 * 3_600_000).toISOString(), late: true };
    routeGets({
      "/tmcode/assignments/77": detail(
        { ...notStarted, state: "submitted", project_id: 5, submitted_at: iso(86_400_000), revision_number: 2, is_late: false },
        pastDue,
      ),
    });
    const { unmount } = render(
      <MemoryRouter>
        <TmcodeStudentPanel assignmentId={77} />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("late-receipt")).toHaveTextContent("Handed in on time");
    expect(screen.queryByText(/Late by/)).not.toBeInTheDocument();
    unmount();

    routeGets({
      "/tmcode/assignments/77": detail(
        { ...notStarted, state: "submitted", project_id: 5, submitted_at: iso(1000), revision_number: 3, is_late: true },
        pastDue,
      ),
    });
    render(
      <MemoryRouter>
        <TmcodeStudentPanel assignmentId={77} />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("late-receipt")).toHaveTextContent("Handed in late");
  });

  it("shows the teacher's Return for changes, with the message", async () => {
    routeGets({
      "/tmcode/assignments/77": detail({
        ...notStarted,
        state: "in_progress",
        project_id: 5,
        is_late: null,
        returned_at: iso(600_000),
        returned_message: "Handle empty input",
      }),
    });
    render(
      <MemoryRouter>
        <TmcodeStudentPanel assignmentId={77} />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("returned-banner")).toHaveTextContent("Returned by your teacher: Handle empty input");
    expect(screen.queryByTestId("late-receipt")).not.toBeInTheDocument();
  });
});

// ─── Teacher workspaces ─────────────────────────────────────────────────────

const ws = (over: Partial<WorkspaceRow> & { name: string }): WorkspaceRow => ({
  user: { id: null, mis_user_id: null, name: over.name, email: null, avatar_url: null, ...(over.user ?? {}) },
  project_id: null,
  link_id: null,
  submission_id: null,
  state: "not_started",
  last_activity_at: null,
  presence: null,
  revision_id: null,
  revision_number: null,
  submitted_at: null,
  grade: null,
  max_points: 20,
  ...over,
});

describe("teacher Workspaces panel", () => {
  const view = {
    assignment: { id: 77, title: "Sorting lab", status: "published", kind: "practical", course_id: 12, due_date: null, points: 20, read_only: false },
    counts: { students: 4, started: 3, submitted: 2, graded: 1, live: 1 },
    workspaces: [
      ws({
        name: "Ama Live",
        user: { id: 1, mis_user_id: 101, name: "Ama Live", email: null, avatar_url: null },
        state: "in_progress",
        project_id: 11,
        presence: { shared: true, online: true, devices_online: 1, last_seen_at: iso(1000), file: "main.py", dirty: 0 },
      }),
      ws({
        name: "Bo Private",
        user: { id: 2, mis_user_id: 102, name: "Bo Private", email: null, avatar_url: null },
        state: "submitted",
        project_id: 12,
        submission_id: 900,
        revision_id: 77,
        revision_number: 3,
        submitted_at: iso(3600_000),
        presence: { shared: false, online: false, devices_online: 0, last_seen_at: null, file: null, dirty: 0 },
      }),
      ws({
        name: "Cy Graded",
        user: { id: 3, mis_user_id: 103, name: "Cy Graded", email: null, avatar_url: null },
        state: "graded",
        project_id: 13,
        submission_id: 901,
        revision_id: 80,
        revision_number: 2,
        grade: 17,
        presence: { shared: true, online: false, devices_online: 0, last_seen_at: iso(86_400_000), file: null, dirty: 0 },
      }),
      ws({ name: "Di Absent", user: { id: null, mis_user_id: 104, name: "Di Absent", email: null, avatar_url: null } }),
    ],
  };

  it("lists each student's state, live status and code link, and grades through the callback", async () => {
    routeGets({ "/tmcode/assignments/77/workspaces": view });
    const onGrade = vi.fn();
    render(
      <MemoryRouter>
        <TmcodeWorkspacesPanel assignmentId={77} onGrade={onGrade} />
      </MemoryRouter>,
    );
    const rows = await screen.findAllByTestId("workspace-row");
    expect(rows).toHaveLength(4);
    expect(screen.getByTestId("ws-count-students")).toHaveTextContent("4");

    const ama = rows.find((r) => r.textContent?.includes("Ama Live"))!;
    expect(within(ama).getByRole("img", { name: "Open in TMCode now" })).toBeInTheDocument();
    expect(ama).toHaveTextContent("editing main.py");
    expect(within(ama).getByTestId("workspace-state")).toHaveTextContent("Working");

    const bo = rows.find((r) => r.textContent?.includes("Bo Private"))!;
    expect(bo).toHaveTextContent("Live status not shared");
    expect(within(bo).queryByRole("img", { name: /TMCode/ })).toBeNull();
    expect(within(bo).getByRole("link", { name: /Code at rev 3/ })).toHaveAttribute("href", "/projects/12?tab=files&rev=77");
    // A submitted project is graded against the criteria in the grading workspace.
    expect(within(bo).getByRole("link", { name: "Grade" })).toHaveAttribute("href", "/grading/practical/assignment/77?student=2");
    expect(screen.getByTestId("open-grading-workspace")).toHaveAttribute("href", "/grading/practical/assignment/77");
    expect(onGrade).not.toHaveBeenCalled();

    const cy = rows.find((r) => r.textContent?.includes("Cy Graded"))!;
    expect(cy).toHaveTextContent("17 / 20");
    expect(within(cy).getByRole("link", { name: "Regrade" })).toHaveAttribute("href", "/grading/practical/assignment/77?student=3");

    const di = rows.find((r) => r.textContent?.includes("Di Absent"))!;
    expect(di).toHaveTextContent("hasn't signed in to Task Mentor yet");
    expect(within(di).queryByRole("link")).toBeNull();

    // Rows leave with an exit animation.
    fireEvent.click(screen.getByRole("radio", { name: /To grade/ }));
    await waitFor(() => expect(screen.getAllByTestId("workspace-row")).toHaveLength(1));
    expect(screen.getByTestId("workspace-row")).toHaveTextContent("Bo Private");
    fireEvent.click(screen.getByRole("radio", { name: /Live now/ }));
    await waitFor(() => expect(screen.getAllByTestId("workspace-row")).toHaveLength(1));
    expect(screen.getByTestId("workspace-row")).toHaveTextContent("Ama Live");
  });
});

// ─── Share live status ──────────────────────────────────────────────────────

describe("Share live status", () => {
  const base = (over: Record<string, unknown>) =>
    normalizeProjectDetail({
      ...project(5),
      assignment: { id: 77, title: "Sorting lab", status: "published", kind: "practical" },
      ...over,
    });

  it("is locked on, with the reason, while the assignment is open", () => {
    const onUpdated = vi.fn();
    render(<ShareLiveStatus project={base({ can: { edit: true, save: true, report_git: true, read_all_revisions: true, share_presence: false } })} onUpdated={onUpdated} />);
    const sw = screen.getByRole("switch", { name: "Share live status" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Locked on while “Sorting lab” is open/)).toBeInTheDocument();
    fireEvent.click(sw);
    expect(axiosMock.patch).not.toHaveBeenCalled();
  });

  it("turns sharing off (Remove from monitoring) when allowed", async () => {
    axiosMock.patch.mockResolvedValue({ data: { project: { ...project(5), share_presence: false } } });
    const onUpdated = vi.fn();
    render(
      <ShareLiveStatus
        project={base({ assignment: null, can: { edit: true, save: true, report_git: true, read_all_revisions: true, share_presence: true } })}
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Share live status" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ share_presence: false }));
    expect(axiosMock.patch).toHaveBeenCalledWith("/tmcode/projects/5", { share_presence: false });
  });
});
