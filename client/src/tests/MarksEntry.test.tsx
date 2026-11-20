import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { toast } from "react-toastify";
import ManualScoreEntry from "../components/ReportCard/ManualScoreEntry";
import { changedIds, parseCell, parsePaste, readDraft, savePayload, writeDraft } from "../components/ReportCard/marksEntry";
import { suggestCategory } from "../components/Grades/mappingSuggestions";
import { ManualAssessmentApiService, type ManualAssessment } from "../services/manualAssessmentApi";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../services/manualAssessmentApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/manualAssessmentApi")>();
  return { ...orig, ManualAssessmentApiService: { ...orig.ManualAssessmentApiService, getScores: vi.fn(), upsertScores: vi.fn() } };
});

// An in-memory localStorage (the test runner's one isn't usable here).
const store = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});

describe("marks entry rules", () => {
  it("reads typed and pasted cells: marks (clamped, comma decimals), absent and exempt", () => {
    expect(parseCell("18", 20)).toEqual({ score: "18", status: "scored" });
    expect(parseCell("18,5", 20)).toEqual({ score: "18.5", status: "scored" });
    expect(parseCell("25", 20)).toEqual({ score: "20", status: "scored" });
    expect(parseCell("ABS", 20)).toEqual({ score: "", status: "absent" });
    expect(parseCell("ex", 20)).toEqual({ score: "", status: "exempt" });
    expect(parseCell("n/a", 20)).toBeNull();
    expect(parsePaste("12\n15\nabs\n\n", 20)).toEqual([
      { score: "12", status: "scored" },
      { score: "15", status: "scored" },
      { score: "", status: "absent" },
    ]);
    expect(parsePaste("Aline\t14\nBosco\t?", 20)).toEqual([{ score: "14", status: "scored" }, null]);
  });

  it("saves only what changed, keeps saved marks that were emptied, and refuses out-of-range marks", () => {
    const saved = { 1: { score: "10", status: "scored" as const }, 2: { score: "", status: "exempt" as const }, 3: { score: "8", status: "scored" as const } };
    const book = { ...saved, 1: { score: "10.0", status: "scored" as const }, 2: { score: "", status: "absent" as const }, 3: { score: "", status: "scored" as const }, 4: { score: "7", status: "scored" as const }, 5: { score: "99", status: "scored" as const } };
    expect(changedIds(book, saved).sort()).toEqual([2, 3, 4, 5]);
    expect(savePayload(book, saved, 20)).toEqual({
      scores: [
        { student_id: 2, score: 0, status: "absent" },
        { student_id: 4, score: 7, status: "scored" },
      ],
      kept: [3],
      invalid: [5],
    });
  });

  it("keeps unsaved rows as a draft on this device", () => {
    writeDraft(77, { 1: { score: "9", status: "scored" } });
    expect(readDraft(77)?.entries).toEqual({ 1: { score: "9", status: "scored" } });
    writeDraft(77, {});
    expect(readDraft(77)).toBeNull();
  });

  it("suggests a category from the assessment type, in the school's builder", () => {
    expect(suggestCategory({ kind: "manual", manualType: "midterm" }, "normal")).toBe("MD");
    expect(suggestCategory({ kind: "manual", manualType: "midterm" }, "tvet")).toBe("FA");
    expect(suggestCategory({ kind: "manual", manualType: "ca_end_of_term" }, "tvet")).toBe("CA");
    expect(suggestCategory({ kind: "quiz" }, "normal")).toBe("CW");
    expect(suggestCategory({ kind: "assignment" }, "normal")).toBe("HW");
    expect(suggestCategory({ kind: "manual", manualType: null }, "normal")).toBeNull();
  });
});

const ASSESSMENT = { id: 5, course_id: 9, title: "Midterm 1", max_score: 20 } as unknown as ManualAssessment;
const STUDENTS = [
  { student_id: 1, name: "Aline Uwase" },
  { student_id: 2, name: "Bosco Nkurunziza" },
  { student_id: 3, name: "Claire Mutoni" },
  { student_id: 4, name: "David Habimana" },
];

describe("ManualScoreEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(ManualAssessmentApiService.getScores).mockResolvedValue({
      success: true,
      data: [
        { id: 1, manual_assessment_id: 5, student_id: 1, score: 15, status: "scored" },
        { id: 2, manual_assessment_id: 5, student_id: 2, score: 0, status: "exempt" },
      ],
    });
    vi.mocked(ManualAssessmentApiService.upsertScores).mockResolvedValue({ success: true, message: "ok", data: { saved: 1 } });
  });

  it("shows a saved exemption as Exempt, not 0, and saves nothing until something changes", async () => {
    render(<ManualScoreEntry assessment={ASSESSMENT} students={STUDENTS} />);
    expect(await screen.findByTestId("status-pill-2")).toHaveTextContent("Exempt");
    expect(screen.getByLabelText("Mark for Aline Uwase, out of 20")).toHaveValue("15");
    expect(screen.getByTestId("save-marks")).toBeDisabled();
    expect(screen.getByTestId("save-status")).toHaveTextContent("All changes saved");
  });

  it("records absent with the A key and a mark by typing, then saves only those rows with their status", async () => {
    render(<ManualScoreEntry assessment={ASSESSMENT} students={STUDENTS} />);
    const claire = await screen.findByLabelText("Mark for Claire Mutoni, out of 20");
    fireEvent.keyDown(claire, { key: "a" });
    expect(screen.getByTestId("status-pill-3")).toHaveTextContent("Absent");
    fireEvent.change(screen.getByLabelText("Mark for David Habimana, out of 20"), { target: { value: "30" } });
    expect(screen.getByLabelText("Mark for David Habimana, out of 20")).toHaveValue("20"); // capped at the max
    expect(screen.getByTestId("unsaved-dot-4")).toBeInTheDocument();
    expect(screen.getByTestId("save-marks")).toHaveTextContent("Save 2 changes");
    fireEvent.click(screen.getByTestId("save-marks"));
    await waitFor(() =>
      expect(ManualAssessmentApiService.upsertScores).toHaveBeenCalledWith(5, {
        scores: [
          { student_id: 3, score: 0, status: "absent" },
          { student_id: 4, score: 20, status: "scored" },
        ],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Saved 1 mark, 1 absent.");
    expect(await screen.findByText("All changes saved")).toBeInTheDocument();
  });

  it("fills the rows below from a column pasted from a spreadsheet", async () => {
    render(<ManualScoreEntry assessment={ASSESSMENT} students={STUDENTS} />);
    const bosco = await screen.findByTestId("mark-row-1");
    const input = within(bosco).getByLabelText("Mark for Aline Uwase, out of 20");
    fireEvent.paste(input, { clipboardData: { getData: () => "12\nex\n18,5\n9\n11" } });
    expect(screen.getByLabelText("Mark for Aline Uwase, out of 20")).toHaveValue("12");
    expect(screen.getByTestId("status-pill-2")).toHaveTextContent("Exempt");
    expect(screen.getByLabelText("Mark for Claire Mutoni, out of 20")).toHaveValue("18.5");
    expect(screen.getByLabelText("Mark for David Habimana, out of 20")).toHaveValue("9");
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Pasted 4 marks"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 more than there are students below"));
  });

  it("opens on the students still to mark, and offers to restore last visit's unsaved marks", async () => {
    writeDraft(5, { 4: { score: "13", status: "scored" } });
    render(<ManualScoreEntry assessment={ASSESSMENT} students={STUDENTS} initialFilter="todo" />);
    expect(await screen.findByTestId("draft-banner")).toHaveTextContent("1 unsaved mark");
    expect(screen.queryByTestId("mark-row-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("mark-row-3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByLabelText("Mark for David Habimana, out of 20")).toHaveValue("13");
    expect(screen.getByTestId("save-marks")).toHaveTextContent("Save 1 change");
  });

  it("asks before cancelling with unsaved marks", async () => {
    const onCancel = vi.fn();
    render(<ManualScoreEntry assessment={ASSESSMENT} students={STUDENTS} onCancel={onCancel} />);
    fireEvent.change(await screen.findByLabelText("Mark for Claire Mutoni, out of 20"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByText("Leave without saving?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
