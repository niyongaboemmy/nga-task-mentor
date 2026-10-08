// Paper answer sheets page: print list, scan → review (flags, fixing a bubble),
// rescans replace, wrong quiz / stale sheets refused, save sends the reviewed picks.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ScanResult } from "../paper/omr";

const getPaperSheet = vi.fn();
const getQuizStudents = vi.fn();
const savePaperResults = vi.fn();
vi.mock("../services/quizApi", () => ({
  QuizApiService: {
    getPaperSheet: (...a: unknown[]) => getPaperSheet(...a),
    getQuizStudents: (...a: unknown[]) => getQuizStudents(...a),
    savePaperResults: (...a: unknown[]) => savePaperResults(...a),
  },
}));
// One queued scan result per file; the OMR itself is tested in paperOmr.test.ts.
const scans: ScanResult[] = [];
vi.mock("../paper/omr", async (orig) => ({
  ...(await orig<typeof import("../paper/omr")>()),
  scanSheet: () => scans.shift()!,
}));

import PaperSheetsPage from "../pages/PaperSheetsPage";

const SPEC = {
  quizId: 77, title: "Networks quiz", key: "ab12cd34ef", manual: [3], maxScore: 6,
  questions: [
    { id: 501, number: 1, type: "single_choice", options: 4, points: 2 },
    { id: 502, number: 2, type: "true_false", options: 2, points: 1 },
  ],
};
const read = (studentId: number, q1: number[], s1: "ok" | "blank" | "multiple" | "unsure" = "ok", quizId = 77, key = SPEC.key): ScanResult => ({
  ok: true, quizId, studentId, key,
  answers: [
    { id: 501, number: 1, selected: q1, status: s1, fills: [] },
    { id: 502, number: 2, selected: [1], status: "ok", fills: [] },
  ],
});
const addPhotos = (n: number) =>
  fireEvent.change(screen.getByTestId("paper-files"), { target: { files: Array.from({ length: n }, (_, i) => new File(["x"], `sheet${i}.jpg`, { type: "image/jpeg" })) } });

beforeEach(() => {
  scans.length = 0;
  getPaperSheet.mockResolvedValue({ data: SPEC });
  getQuizStudents.mockResolvedValue({ data: [{ id: 11, name: "Aline Uwase" }, { id: 12, name: "Eric Mugisha" }] });
  savePaperResults.mockReset();
  // jsdom has no image decoding or canvas pixels.
  (globalThis as any).createImageBitmap = vi.fn(async () => ({ width: 100, height: 140 }));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  })) as any;
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/quizzes/77/paper-sheets"]}>
      <Routes><Route path="/quizzes/:quizId/paper-sheets" element={<PaperSheetsPage />} /></Routes>
    </MemoryRouter>,
  );

describe("PaperSheetsPage", () => {
  it("prints one sheet per chosen student and says which questions are marked by hand", async () => {
    renderPage();
    expect(await screen.findByText(/questions 3 are marked by hand/)).toBeTruthy();
    expect(screen.getAllByTestId("paper-sheet").map((s) => s.getAttribute("data-student"))).toEqual(["11", "12"]);
    expect(screen.getByText("2 of 2 students")).toBeTruthy();
  });

  it("scans, flags what needs a look, lets the teacher fix it, and saves the reviewed answers", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Paper answer sheets" });
    fireEvent.click(screen.getByRole("tab", { name: /scan/i }));
    scans.push(read(11, [2]), read(12, [0, 3], "multiple"), read(13, [1], "ok", 99), read(12, [0], "ok", 77, "0000000000"));
    addPhotos(4);
    await waitFor(() => expect(screen.getByTestId("paper-summary").textContent).toMatch(/2 sheets read, 1 answer to check.*2 couldn't be used/));
    expect(screen.getByText("This sheet belongs to another quiz.")).toBeTruthy();
    expect(screen.getByText(/Printed before the quiz's questions changed/)).toBeTruthy();

    // Eric's double mark: the teacher decides it was D.
    const eric = screen.getAllByTestId("paper-review").find((r) => within(r).queryByText("Eric Mugisha"))!;
    expect(eric.querySelector('[data-q="501"]')!.getAttribute("data-status")).toBe("multiple");
    fireEvent.click(within(eric).getByRole("button", { name: "Question 1 D" }));
    expect(within(eric).getByRole("button", { name: "Question 1 D" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(eric).getByRole("button", { name: "Question 1 A" }).getAttribute("aria-pressed")).toBe("false");

    savePaperResults.mockResolvedValue({ data: [
      { ok: true, studentId: 11, submissionId: 1, score: 2, maxScore: 6, percentage: 33.33, updated: false },
      { ok: true, studentId: 12, submissionId: 2, score: 3, maxScore: 6, percentage: 50, updated: true },
    ] });
    fireEvent.click(screen.getByRole("button", { name: /Save 2 results/ }));
    await waitFor(() => expect(screen.getByTestId("paper-saved")).toBeTruthy());
    expect(savePaperResults).toHaveBeenCalledWith(77, "ab12cd34ef", [
      { studentId: 11, answers: { 501: [2], 502: [1] } },
      { studentId: 12, answers: { 501: [3], 502: [1] } },
    ]);
    expect(screen.getByTestId("paper-saved").textContent).toMatch(/Aline Uwase: 2 \/ 6 \(33.33%\).*Eric Mugisha: 3 \/ 6 \(50%\), updated/);
  });

  it("a rescan of the same student replaces the earlier read", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Paper answer sheets" });
    fireEvent.click(screen.getByRole("tab", { name: /scan/i }));
    scans.push(read(11, [], "blank"));
    addPhotos(1);
    await waitFor(() => expect(screen.getByTestId("paper-summary").textContent).toMatch(/1 sheet read, 1 answer to check/));
    scans.push(read(11, [1]));
    addPhotos(1);
    await waitFor(() => expect(screen.getByTestId("paper-summary").textContent).toBe("1 sheet read."));
    expect(screen.getAllByTestId("paper-review")).toHaveLength(1);
  });
});
