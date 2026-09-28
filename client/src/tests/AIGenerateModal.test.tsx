import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import type { AISourcesResponse } from "../services/aiQuestionGenerationApi";

// The real question renderer pulls in every question-type component; the
// review list only needs something to show.
vi.mock("../components/Quizzes/QuizQuestion", () => ({
  default: ({ question }: { question: { question_text: string } }) => <div data-testid="rendered-question">{question.question_text}</div>,
}));

const { toast, bulk, api } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  bulk: vi.fn(),
  api: {
    providers: vi.fn(),
    sources: vi.fn(),
    prepareDocument: vi.fn(),
    prepareResources: vi.fn(),
    generate: vi.fn(),
  },
}));
vi.mock("react-toastify", () => ({ toast }));

vi.mock("../services/quizApi", () => ({
  QuestionBankApiService: { bulkCreateCourseQuestions: (...a: unknown[]) => bulk(...a) },
}));

vi.mock("../services/aiQuestionGenerationApi", async (orig) => ({
  ...(await orig<typeof import("../services/aiQuestionGenerationApi")>()),
  AIQuestionGenerationApi: api,
}));

import AIGenerateModal from "../components/QuestionBank/AIGenerateModal";

const SOURCES: AISourcesResponse = {
  scope: { subject_name: "Web UI", class_group_id: 7, academic_term_id: 3, class_groups: [{ id: 7, name: "L5 SOD" }] },
  groups: [
    { key: "curriculum", label: "Curriculum outcomes", status: "ok", items: [{ kind: "competency", id: "11", title: "Describe web fundamentals", supported: true, chars_estimate: 400 }] },
    {
      key: "weeks",
      label: "Scheme of work weeks",
      status: "ok",
      items: [{ kind: "sow_entry", id: "5001", title: "Internet vs the Web", week: "3", supported: true, chars_estimate: 600 }],
    },
    {
      key: "lesson_plans",
      label: "Lesson plans",
      status: "ok",
      items: [
        { kind: "lesson_plan", id: "5001:77", title: "What happens when you type a URL?", week: "3", supported: true, chars_estimate: 900 },
        { kind: "lesson_plan", id: "5001:78", title: "Reading HTTP status codes", week: "3", supported: true, chars_estimate: 700 },
      ],
    },
    { key: "notes", label: "My lesson notes", status: "unavailable", message: "You don't have access to these in the MIS.", items: [] },
    { key: "materials", label: "Shared materials", status: "ok", items: [{ kind: "material", id: "400", title: "slides.pptx", supported: false, reason: "Only PDF and DOCX can be read" }] },
    { key: "elearning", label: "E-learning content", status: "ok", items: [] },
  ],
};

const q = (text: string, difficulty: "EASY" | "MEDIUM" | "DIFFICULT") => ({
  question_type: "single_choice",
  question_text: text,
  question_data: { options: ["a", "b", "c", "d"], correct_option_index: 0 },
  correct_answer: { selected_option_index: 0 },
  explanation: "Because.",
  difficulty_level: difficulty,
  tags: ["web"],
  time_limit_seconds: 45,
});

const onSuccess = vi.fn();
const renderModal = () => render(<AIGenerateModal isOpen onClose={vi.fn()} courseId={9} onSuccess={onSuccess} />);

beforeEach(() => {
  vi.clearAllMocks();
  try {
    window.localStorage.removeItem("tm.aiGenerator.prefs.v1");
  } catch {
    /* storage unavailable in this environment — the modal copes */
  }
  api.providers.mockResolvedValue({
    providers: [
      { name: "gemini", label: "Google Gemini", model: "gemini-2.5-flash", configured: true, cooling_down: false, order: 0 },
      { name: "groq", label: "Groq", model: "openai/gpt-oss-20b", configured: true, cooling_down: false, order: 1 },
      { name: "openai", label: "OpenAI", model: "gpt-4o", configured: false, cooling_down: false, order: null },
    ],
    any_available: true,
  });
  api.sources.mockResolvedValue(SOURCES);
});

describe("AIGenerateModal", () => {
  it("offers both sources as tabs and loads the subject's MIS resources", async () => {
    renderModal();
    expect(screen.getByRole("tab", { name: /From course resources/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Internet vs the Web")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to these in the MIS.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /slides\.pptx/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Generate/ })).toBeDisabled();
    expect(screen.getByText("Pick at least one resource")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Upload a document/ }));
    expect(screen.getByText(/Drag & drop, or click to choose a file/)).toBeInTheDocument();
    const input = screen.getByTestId("ai-doc-input");
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(toast.error).toHaveBeenCalledWith("Only PDF and DOCX files are supported.");
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "chapter.pdf", { type: "application/pdf" })] } });
    expect(screen.getAllByText("chapter.pdf").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Generate 4 questions/ })).toBeEnabled();
  });

  it("builds a multi-difficulty plan and adds suggested prompts", async () => {
    renderModal();
    await screen.findByText("Internet vs the Web");
    fireEvent.click(screen.getByRole("button", { name: /Select all 2/ })); // week 3 lesson plans
    expect(screen.getByText("2 resources selected")).toBeInTheDocument();

    // Defaults: single + multiple choice × (1 easy, 1 medium) = 4
    expect(screen.getByRole("button", { name: /Generate 4 questions/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "More Difficult questions per type" }));
    fireEvent.click(screen.getByRole("button", { name: "More Difficult questions per type" }));
    expect(screen.getByRole("button", { name: /Generate 8 questions/ })).toBeEnabled();

    // Per-type matrix: drop multiple choice's easy question only
    fireEvent.click(screen.getByRole("radio", { name: "Per type" }));
    fireEvent.click(screen.getByRole("button", { name: "Fewer Easy multiple_choice" }));
    expect(screen.getByRole("button", { name: /Generate 7 questions/ })).toBeEnabled();

    // Context-aware prompt suggestion for the selected week
    const chip = screen.getByRole("button", { name: /Only week 3/ });
    fireEvent.click(chip);
    expect(screen.getByLabelText(/Instructions for the AI/)).toHaveValue("Only ask about what is taught in week 3.");
    fireEvent.click(chip);
    expect(screen.getByLabelText(/Instructions for the AI/)).toHaveValue("");
  });

  it("generates from resources, reviews, and saves the selection linked to its topic", async () => {
    api.prepareResources.mockResolvedValue({
      context_id: "11111111-1111-4111-8111-111111111111",
      origin: "resources",
      label: "Web UI: 1 scheme-of-work topic",
      char_count: 600,
      truncated: false,
      parts: [{ kind: "sow_entry", id: "5001", title: "Week 3 · Internet vs the Web", chars: 600 }],
      preview: "SCHEME OF WORK — Week 3",
      expires_in_seconds: 2700,
      missing: [],
    });
    const levels = [1, 2, 3, 4, 5, 6].map((o) => ({ id: 100 + o, name: ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"][o - 1], level_order: o }));
    api.generate.mockResolvedValue({
      data: [
        { ...q("What sends the HTTP request?", "EASY"), blooms_level: 1, blooms_taxonomy_level_id: 101, blooms_level_name: "Remembering" },
        { ...q("Why is DNS needed first?", "MEDIUM"), blooms_level: 3, blooms_taxonomy_level_id: 103, blooms_level_name: "Applying" },
      ],
      meta: { requested: 2, returned: 2, skipped: [], provider_used: "groq", provider_requested: "groq", fell_back: false, duration_ms: 900, context_id: "c", blooms_levels: levels },
    });
    bulk.mockResolvedValue({ success: true, data: [] });

    renderModal();
    await screen.findByText("Internet vs the Web");
    fireEvent.click(screen.getByRole("button", { name: /Internet vs the Web/ }));
    fireEvent.click(screen.getByRole("button", { name: /Multiple Choice/ })); // leave single choice only
    fireEvent.click(await screen.findByRole("radio", { name: /Groq/ }));
    fireEvent.change(screen.getByLabelText(/Instructions for the AI/), { target: { value: "Focus on HTTP." } });
    fireEvent.click(screen.getByRole("button", { name: /Generate 2 questions/ }));

    expect(await screen.findByText("Review 2 questions")).toBeInTheDocument();
    expect(api.prepareResources).toHaveBeenCalledWith(9, { sources: [{ kind: "sow_entry", id: "5001" }], class_group_id: 7 }, expect.anything());
    expect(api.generate).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        context_id: "11111111-1111-4111-8111-111111111111",
        plan: [{ question_type: "single_choice", EASY: 1, MEDIUM: 1, DIFFICULT: 0 }],
        additional_context: "Focus on HTTP.",
        provider: "groq",
      }),
      expect.anything(),
    );
    expect(toast.success).toHaveBeenCalledWith("2 questions ready for review");

    // Exclude the second, bump the first to Difficult, keep the topic link
    const cards = within(screen.getByRole("list", { name: "Generated questions" })).getAllByRole("listitem");
    fireEvent.click(within(cards[1]).getByRole("button", { name: "Exclude question" }));
    expect(screen.getByLabelText("Bloom's taxonomy spread")).toHaveTextContent("L1 Remember 1");
    expect(within(cards[0]).getByLabelText("Bloom's level")).toHaveValue("1");
    // Moving to Difficult pulls the Bloom's level into L4–L6 so the pair stays consistent.
    fireEvent.change(within(cards[0]).getByLabelText("Difficulty"), { target: { value: "DIFFICULT" } });
    expect(within(cards[0]).getByLabelText("Bloom's level")).toHaveValue("4");
    // A hand-picked level outside the band is allowed but flagged.
    fireEvent.change(within(cards[0]).getByLabelText("Bloom's level"), { target: { value: "2" } });
    expect(within(cards[0]).getByText(/L2 is unusual for difficult/)).toBeInTheDocument();
    fireEvent.change(within(cards[0]).getByLabelText("Bloom's level"), { target: { value: "5" } });
    expect(screen.getByLabelText(/Link to scheme-of-work topic/)).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /Save 1 to question bank/ }));

    await waitFor(() => expect(bulk).toHaveBeenCalledTimes(1));
    const [courseId, saved] = bulk.mock.calls[0];
    expect(courseId).toBe(9);
    expect(saved).toEqual([
      expect.objectContaining({
        question_text: "What sends the HTTP request?",
        difficulty_level: "DIFFICULT",
        blooms_taxonomy_level_id: 105,
        scheme_of_work_entry_id: 5001,
        scheme_of_work_entry_title: "Internet vs the Web",
      }),
    ]);
    expect(saved[0]).not.toHaveProperty("uid");
    expect(await screen.findByText("1 question added to the bank")).toBeInTheDocument();
    expect(screen.getByText(/1 unselected question is still waiting/)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("keeps the teacher on setup with a clear message when nothing comes back", { timeout: 15000 }, async () => {
    api.prepareResources.mockResolvedValue({
      context_id: "c", origin: "resources", label: "x", char_count: 600, truncated: false, parts: [], preview: "", expires_in_seconds: 1,
    });
    api.generate.mockRejectedValue(Object.assign(new Error("x"), { response: { status: 429, data: { message: "The AI is temporarily rate-limited. Please try again in a few minutes." } } }));

    renderModal();
    await screen.findByText("Internet vs the Web");
    fireEvent.click(screen.getByRole("button", { name: /Internet vs the Web/ }));
    fireEvent.click(screen.getByRole("button", { name: /Generate 4 questions/ }));

    // 429 is retried once after a short pause before giving up.
    expect(await screen.findByRole("alert", {}, { timeout: 8000 })).toHaveTextContent("temporarily rate-limited");
    expect(api.generate).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("tab", { name: /From course resources/ })).toBeInTheDocument();
  });
});
