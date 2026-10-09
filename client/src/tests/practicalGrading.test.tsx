import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { pickOption } from "./helpers/select";

/** TMCode practicals: the grading workspace, the quiz question, and starting one from New project. */

const practicals = {
  roster: vi.fn(),
  saveGrade: vi.fn(),
  preview: vi.fn(),
  startQuizPractical: vi.fn(),
};
const projects = {
  list: vi.fn(),
  revisions: vi.fn(),
  submit: vi.fn(),
  withdraw: vi.fn(),
  linkable: vi.fn(),
  create: vi.fn(),
  manifest: vi.fn(),
  openLink: vi.fn(),
};
vi.mock("../services/practicalsApi", async (orig) => ({
  ...(await orig<typeof import("../services/practicalsApi")>()),
  practicalsApi: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (practicals as any)[k](...a) }),
}));
vi.mock("../services/projectsApi", async (orig) => ({
  ...(await orig<typeof import("../services/projectsApi")>()),
  projectsApi: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (projects as any)[k](...a) }),
}));
vi.mock("../components/Projects/FilesTab", () => ({
  default: ({ projectId, revisionId }: { projectId: number; revisionId: number | null }) => (
    <div data-testid="files-tab">
      files of {projectId} at {String(revisionId)}
    </div>
  ),
}));
vi.mock("../components/Projects/OpenProjectInTmcode", () => ({
  default: () => <button type="button">Open in TMCode</button>,
  TmcodeDeepLinkButton: ({ label, onOpened }: { label?: string; onOpened?: () => void }) => (
    <button type="button" onClick={onOpened}>
      {label ?? "Open in TMCode"}
    </button>
  ),
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import PracticalGradingPage from "../pages/PracticalGradingPage";
import TmcodePracticalQuestion from "../components/Quizzes/QuestionTypes/TmcodePracticalQuestion";
import NewProjectDialog from "../components/Projects/NewProjectDialog";

// Node 25's own (non-functional) localStorage shadows jsdom's: use a real one.
const memoryStorage = (() => {
  let data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => void (data[k] = String(v)),
    removeItem: (k: string) => void delete data[k],
    clear: () => void (data = {}),
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });

beforeEach(() => {
  [...Object.values(practicals), ...Object.values(projects)].forEach((f) => f.mockReset());
  projects.revisions.mockResolvedValue([]);
  projects.manifest.mockResolvedValue({ revision: null, files: [{ path: "index.html", sha256: "a", size: 10 }] });
  // Drafts, quick comments and "opened in TMCode" live in localStorage.
  window.localStorage.clear();
});

const row = (id: number, name: string, over: Record<string, unknown> = {}) => ({
  student: { id, name },
  state: "submitted",
  project: { id: 100 + id, name: `${name}'s site`, status: "submitted", kind: "tm", language: "html", repo_url: null },
  link: { id: 200 + id, status: "submitted", submitted_at: "2026-10-07T08:00:00Z", revision_id: 300 + id, revision_number: 4, git_commit: null },
  grade: null,
  submitted_at: "2026-10-07T08:00:00Z",
  late: false,
  ...over,
});

const roster = (over: Record<string, unknown> = {}) => ({
  activity: {
    type: "assignment",
    id: 7,
    title: "Landing page",
    course_id: 1,
    due_date: null,
    max_points: 10,
    rubric: [
      { criteria: "Layout", description: "Semantic HTML", max_score: 6 },
      { criteria: "Styling", max_score: 4 },
    ],
    question: null,
    can_grade: true,
    ...over,
  },
  counts: { total: 2, to_grade: 2, graded: 0 },
  rows: [row(1, "Ama"), row(2, "Bo")],
});

const Where = () => {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
};

const workspace = (path = "/grading/practical/assignment/7") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/grading/practical/:type/:id" element={<><PracticalGradingPage /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );

describe("PracticalGradingPage", () => {
  it("scores each criterion, totals it, and saves then moves to the next student", async () => {
    practicals.roster.mockResolvedValue(roster());
    practicals.saveGrade.mockResolvedValue({ score: 8, max_points: 10 });
    workspace();

    // The first student to grade opens, with their code at the submitted revision.
    expect(await screen.findByTestId("files-tab")).toHaveTextContent("files of 101 at 301");
    expect(screen.getByTestId("current-student")).toHaveTextContent("Ama");
    // The class list is a dropdown: name, status and score per student.
    await userEvent.click(screen.getByTestId("student-switcher"));
    const rows = screen.getAllByTestId("roster-row");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("Bo");
    expect(rows[1]).toHaveTextContent("To grade");
    expect(within(rows[1]!).getByTestId("roster-score")).toHaveTextContent("—/10");
    await userEvent.click(screen.getByTestId("student-switcher"));

    const [layout, styling] = screen.getAllByTestId("criterion");
    // Up to 6 marks: one button per mark.
    await userEvent.click(within(layout!).getByRole("button", { name: "6" }));
    const stylingInput = within(styling!).getByLabelText(/Styling score/);
    await userEvent.type(stylingInput, "2");
    expect(screen.getByTestId("grade-total")).toHaveTextContent(/^8\s*\/\s*10$/);

    await userEvent.click(within(styling!).getByRole("button", { name: /Comment on Styling/ }));
    await userEvent.type(within(styling!).getByRole("textbox"), "Tidy CSS");
    await userEvent.type(screen.getByPlaceholderText(/What went well/), "Nice work");

    await userEvent.click(screen.getByTestId("save-next"));
    await waitFor(() =>
      expect(practicals.saveGrade).toHaveBeenCalledWith("assignment", 7, 1, {
        question_id: null,
        rubric_scores: [
          { index: 0, score: 6, comment: null },
          { index: 1, score: 2, comment: "Tidy CSS" },
        ],
        score: null,
        feedback: "Nice work",
      }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("student=2"));
  });

  it("refuses a score above the criterion's maximum and an unscored criterion", async () => {
    practicals.roster.mockResolvedValue(roster());
    workspace();
    const [layout] = await screen.findAllByTestId("criterion");
    await userEvent.type(within(layout!).getByLabelText(/Layout score/), "9");
    await userEvent.click(screen.getByTestId("save-next"));
    expect(await screen.findByRole("alert")).toHaveTextContent('"Layout" must be between 0 and 6.');

    await userEvent.clear(within(layout!).getByLabelText(/Layout score/));
    await userEvent.type(within(layout!).getByLabelText(/Layout score/), "3");
    await userEvent.click(screen.getByTestId("save-next"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Score every criterion");
    expect(practicals.saveGrade).not.toHaveBeenCalled();
  });

  it("runs the submitted revision in a sandboxed preview", async () => {
    practicals.roster.mockResolvedValue(roster());
    practicals.preview.mockResolvedValue({ url: "http://api.test/api/tmcode/preview/tok/index.html", entry: "index.html" });
    workspace("/grading/practical/assignment/7?student=2");
    await userEvent.click(await screen.findByRole("tab", { name: /Preview/ }));
    const frame = await screen.findByTestId("practical-preview");
    expect(practicals.preview).toHaveBeenCalledWith(102, 302);
    expect(frame).toHaveAttribute("src", "http://api.test/api/tmcode/preview/tok/index.html");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-modals allow-popups");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
  });

  it("grades a quiz practical question with its question id, and prefills an earlier grade", async () => {
    practicals.roster.mockResolvedValue({
      ...roster({
        type: "quiz",
        id: 9,
        title: "Web quiz",
        max_points: 10,
        question: { id: 55, text: "Build it", instructions: "" },
        questions: [
          { question_id: 55, title: "Build it", points: 10 },
          { question_id: 56, title: "Fix it", points: 5 },
        ],
      }),
      rows: [
        row(1, "Ama", {
          state: "graded",
          grade: { score: 7, rubric_scores: [{ index: 0, score: 5 }, { index: 1, score: 2 }], feedback: "Good\n\nCriteria notes:\n• Layout: ok", graded_at: "2026-10-07T09:00:00Z", ref_id: 1 },
        }),
      ],
      counts: { total: 1, to_grade: 0, graded: 1 },
    });
    practicals.saveGrade.mockResolvedValue({ score: 7, max_points: 10 });
    workspace("/grading/practical/quiz/9?question=55");
    expect(await screen.findByTestId("grade-total")).toHaveTextContent(/^7\s*\/\s*10$/);
    expect(screen.getByPlaceholderText(/What went well/)).toHaveValue("Good");
    expect(practicals.roster).toHaveBeenCalledWith("quiz", 9, 55);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(practicals.saveGrade).toHaveBeenCalledWith("quiz", 9, 1, expect.objectContaining({ question_id: 55 })),
    );
  });

  it("keeps the per-criterion notes on a re-save (comments from the server, or read back from the feedback)", async () => {
    practicals.roster.mockResolvedValue({
      ...roster(),
      rows: [
        row(1, "Ama", {
          state: "graded",
          grade: {
            score: 7,
            // An older server: index→score map, notes only in the feedback.
            rubric_scores: { 0: 5, 1: 2 } as any,
            feedback: "Good\n\nCriteria notes:\n• Layout: Header is off\nand the footer",
            graded_at: "2026-10-07T09:00:00Z",
            ref_id: 1,
          },
        }),
        row(2, "Kofi", {
          state: "graded",
          grade: {
            score: 6,
            rubric_scores: [
              { index: 0, score: 4, comment: null },
              { index: 1, score: 2, comment: "Tidy CSS" },
            ],
            feedback: "Fine\n\nCriteria notes:\n• Styling: Tidy CSS",
            graded_at: "2026-10-07T09:00:00Z",
            ref_id: 2,
          },
        }),
      ],
      counts: { total: 2, to_grade: 0, graded: 2 },
    });
    practicals.saveGrade.mockResolvedValue({ score: 7, max_points: 10 });
    workspace("/grading/practical/assignment/7?student=1");
    expect(await screen.findByTestId("grade-total")).toHaveTextContent(/^7\s*\/\s*10$/);
    expect(screen.getByPlaceholderText(/What went well/)).toHaveValue("Good");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(practicals.saveGrade).toHaveBeenCalledWith("assignment", 7, 1, {
        question_id: null,
        rubric_scores: [
          { index: 0, score: 5, comment: "Header is off\nand the footer" },
          { index: 1, score: 2, comment: null },
        ],
        score: null,
        feedback: "Good",
      }),
    );
  });

  it("moves between students with Alt+↓ / Alt+↑", async () => {
    practicals.roster.mockResolvedValue(roster());
    workspace();
    await screen.findByTestId("files-tab");
    expect(screen.getByRole("button", { name: "Next student" })).toBeEnabled();
    // The listener attaches in an effect: press until it lands (two students, so no overshoot).
    const press = (key: string, want: string) =>
      waitFor(() => {
        fireEvent.keyDown(window, { key, altKey: true });
        expect(screen.getByTestId("where")).toHaveTextContent(want);
      });
    await press("ArrowDown", "student=2");
    await press("ArrowUp", "student=1");
  });

  it("keeps unsaved scores as a draft when switching students, and restores them", async () => {
    practicals.roster.mockResolvedValue(roster());
    workspace();
    const [layout] = await screen.findAllByTestId("criterion");
    await userEvent.click(within(layout!).getByRole("button", { name: "4" }));
    // the draft is written shortly after the change
    await new Promise((r) => setTimeout(r, 450));
    await userEvent.click(screen.getByRole("button", { name: "Next student" }));
    await waitFor(() => expect(screen.getByTestId("current-student")).toHaveTextContent("Bo"));
    expect(screen.getByTestId("grade-total")).toHaveTextContent(/^0\s*\/\s*10$/);
    await userEvent.click(screen.getByRole("button", { name: "Previous student" }));
    expect(await screen.findByTestId("draft-restored")).toBeInTheDocument();
    expect(screen.getByTestId("grade-total")).toHaveTextContent(/^4\s*\/\s*10$/);
    // Discard goes back to the saved state.
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByTestId("grade-total")).toHaveTextContent(/^0\s*\/\s*10$/);
  });

  it("adds quick comments to the feedback and remembers what the teacher opened in TMCode", async () => {
    practicals.roster.mockResolvedValue(roster());
    workspace();
    await userEvent.click(await screen.findByRole("button", { name: "Great attention to detail!" }));
    expect(screen.getByPlaceholderText(/What went well/)).toHaveValue("Great attention to detail!");

    expect(screen.queryByTestId("opened-in-tmcode")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open in TMCode" }));
    expect(await screen.findByTestId("opened-in-tmcode")).toHaveTextContent("rev #4");
  });

  it("warns that a package.json project needs TMCode to run", async () => {
    practicals.roster.mockResolvedValue(roster());
    practicals.preview.mockResolvedValue({ url: "http://api.test/p/index.html", entry: "index.html" });
    projects.manifest.mockResolvedValue({ revision: null, files: [{ path: "index.html", sha256: "a", size: 1 }, { path: "package.json", sha256: "b", size: 1 }] });
    workspace();
    await userEvent.click(await screen.findByRole("tab", { name: /Preview/ }));
    expect(await screen.findByTestId("preview-needs-build")).toHaveTextContent("Open in TMCode");
  });

  it("can't grade a student who hasn't submitted", async () => {
    practicals.roster.mockResolvedValue({
      ...roster(),
      rows: [row(1, "Ama", { state: "in_progress", link: { id: 201, status: "linked", submitted_at: null, revision_id: null, revision_number: null, git_commit: null } })],
      counts: { total: 1, to_grade: 0, graded: 0 },
    });
    workspace();
    expect(await screen.findByText(/hasn't submitted a project/)).toBeInTheDocument();
    expect(screen.getByTestId("save-next")).toBeDisabled();
  });
});

const question = (over: Record<string, unknown> = {}) =>
  ({
    id: 55,
    quiz_id: 9,
    question_type: "tmcode_practical",
    question_text: "Build it",
    points: 10,
    question_data: {
      kind: "practical",
      instructions: "<p>Make a landing page</p>",
      starter_project_id: 3,
      rubric: [{ criteria: "Layout", max_score: 6 }, { criteria: "Styling", max_score: 4 }],
    },
    ...over,
  }) as any;

const projectWith = (status: string, head: number | null) => ({
  id: 101,
  name: "Build it",
  status,
  head: head ? { id: 300 + head, number: head } : null,
  links: { items: [{ id: 201, activity_type: "quiz", activity_id: 9, question_id: 55, status: status === "submitted" ? "submitted" : "linked" }] },
});

describe("TmcodePracticalQuestion", () => {
  const mount = (props: Record<string, unknown> = {}) => {
    const onAnswerChange = vi.fn();
    render(
      <MemoryRouter>
        <TmcodePracticalQuestion question={question()} answer={undefined} onAnswerChange={onAnswerChange} {...props} />
      </MemoryRouter>,
    );
    return { onAnswerChange };
  };

  it("starts the practical, then submits the saved project as the answer", async () => {
    projects.list.mockResolvedValueOnce({ projects: [] });
    practicals.startQuizPractical.mockResolvedValue({ project: { id: 101 }, link_id: 201, created: true });
    projects.list.mockResolvedValue({ projects: [projectWith("draft", 2)] });
    projects.submit.mockResolvedValue({ id: 201, revision_id: 302, revision_number: 2 });
    const { onAnswerChange } = mount();

    expect(await screen.findByText(/How it's graded/)).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId("practical-start"));
    expect(practicals.startQuizPractical).toHaveBeenCalledWith(9, 55);

    expect(await screen.findByText("Saved · revision #2")).toBeInTheDocument();
    projects.list.mockResolvedValue({ projects: [projectWith("submitted", 2)] });
    await userEvent.click(screen.getByTestId("practical-submit"));
    await waitFor(() => expect(projects.submit).toHaveBeenCalledWith(101, 201));
    expect(onAnswerChange).toHaveBeenCalledWith({ project_id: 101, link_id: 201, revision_id: 302, revision_number: 2 }, true);
    expect(await screen.findByTestId("practical-withdraw")).toBeInTheDocument();
  });

  it("says to open the quiz when the server has no open attempt to record the answer (409 QUIZ_NOT_OPEN)", async () => {
    projects.list.mockResolvedValue({ projects: [projectWith("draft", 2)] });
    projects.submit.mockRejectedValue({
      response: {
        status: 409,
        data: { error_code: "QUIZ_NOT_OPEN", code: "QUIZ_NOT_OPEN", message: "Open the quiz in Task Mentor, then submit again." },
      },
    });
    const { onAnswerChange } = mount();
    await userEvent.click(await screen.findByTestId("practical-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Open the quiz in Task Mentor, then submit again.");
    expect(onAnswerChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("practical-submit")).toBeInTheDocument();
  });

  it("won't submit before anything was saved from TMCode", async () => {
    projects.list.mockResolvedValue({ projects: [projectWith("draft", null)] });
    mount();
    expect(await screen.findByTestId("practical-submit")).toBeDisabled();
  });

  it("is a static preview outside a quiz attempt", () => {
    mount({ question: question({ quiz_id: undefined }) });
    expect(screen.getByTestId("practical-preview-note")).toHaveTextContent("with your starter files");
    expect(screen.queryByTestId("practical-start")).toBeNull();
    expect(projects.list).not.toHaveBeenCalled();
  });

  it("is a static preview for the instructor", () => {
    mount({ showCorrectAnswer: true });
    expect(screen.getByTestId("practical-preview-note")).toBeInTheDocument();
    expect(projects.list).not.toHaveBeenCalled();
  });

  it("shows the submitted revision in review", () => {
    mount({ readOnlyReview: true, answer: { project_id: 101, link_id: 201, revision_id: 302, revision_number: 2 } });
    expect(screen.getByRole("link", { name: "View the code" })).toHaveAttribute("href", "/projects/101?tab=files&rev=302");
    expect(projects.list).not.toHaveBeenCalled();
  });
});

describe("NewProjectDialog — quiz practicals", () => {
  it("lists quiz practical questions next to assignments and starts one", async () => {
    projects.linkable.mockResolvedValue([
      { activity_type: "assignment", activity_id: 31, title: "Calculator", submission_type: "project" },
      { activity_type: "quiz", activity_id: 9, title: "Web quiz", practical_questions: [{ question_id: 55, title: "Build it", points: 10 }] },
    ]);
    practicals.startQuizPractical.mockResolvedValue({ project: { id: 101, name: "Build it" }, link_id: 201, created: true });
    const onCreated = vi.fn();
    render(<NewProjectDialog open onClose={() => {}} onCreated={onCreated} />);
    pickOption(await screen.findByLabelText(/For an assignment or quiz/), "q:9:55");
    await userEvent.click(screen.getByRole("button", { name: "Start the practical" }));
    await waitFor(() => expect(practicals.startQuizPractical).toHaveBeenCalledWith(9, 55));
    expect(onCreated).toHaveBeenCalledWith({ id: 101, name: "Build it" });
    expect(projects.create).not.toHaveBeenCalled();
  });
});

import PracticalGradeSummary from "../components/Quizzes/PracticalGradeSummary";

describe("PracticalGradeSummary", () => {
  const qd = { rubric: [{ criteria: "Layout", max_score: 6 }, { criteria: "Styling", max_score: 4 }] };

  it("lists each criterion's score with comments and the overall feedback", () => {
    render(
      <PracticalGradeSummary
        questionData={qd}
        details={{ manual: { rubric_scores: [{ index: 0, score: 5, comment: "Neat" }, { index: 1, score: 2 }], feedback: "Good work\n\nCriteria notes:\n• Layout: Neat" } }}
      />,
    );
    const box = screen.getByTestId("practical-grade-summary");
    expect(box).toHaveTextContent("Layout5 / 6");
    expect(box).toHaveTextContent("Neat");
    expect(box).toHaveTextContent("Styling2 / 4");
    expect(box).toHaveTextContent("Teacher's feedback: Good work");
    expect(box).not.toHaveTextContent("Criteria notes");
  });

  it("renders nothing before grading", () => {
    const { container } = render(<PracticalGradeSummary questionData={qd} details={{ grade_status: "pending" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
