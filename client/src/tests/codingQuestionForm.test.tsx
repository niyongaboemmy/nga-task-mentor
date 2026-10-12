import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import React, { useState } from "react";
import type { CodingData } from "../types/quiz.types";

/** Coding question setup (CODE_RUNNER_PLAN.md §7.3): starter picker and reference solution. */

const STARTER = {
  id: "python-io-calculator",
  language: "python",
  kind: "python/single",
  title: "Python – input/output calculator",
  purpose: "io-exercise",
  level: "beginner",
  entry: "main.py",
  file_count: 1,
  paths: ["main.py", ".nga/tests.json", "README.md"],
  has_io_tests: true,
  has_unit_tests: false,
  files: [
    { path: "main.py", content: "a, b = map(int, input().split())\nprint(a + b)\n" },
    { path: "README.md", content: "# Calculator" },
    { path: ".nga/tests.json", content: JSON.stringify({ entry: "main.py", tests: [{ id: "t1", input: "1 2\n", expected_output: "3\n" }, { id: "t2", input: "5 5\n", expected_output: "10\n" }] }) },
  ],
};

const catalog = { catalog: vi.fn(), starters: vi.fn(), starter: vi.fn() };
vi.mock("../services/catalogApi", async (orig) => ({
  ...(await orig<typeof import("../services/catalogApi")>()),
  catalogApi: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (catalog as Record<string, (...x: unknown[]) => unknown>)[k](...a) }),
}));
const preview = vi.fn();
vi.mock("../services/quizApi", async (orig) => {
  const mod = await orig<typeof import("../services/quizApi")>();
  return { ...mod, QuizApiService: { ...mod.QuizApiService, previewRunTests: (...a: unknown[]) => preview(...a) } };
});
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
// The setup tab (language, files) has its own concerns: a stub keeps this test about the new parts.
vi.mock("../components/Quizzes/QuestionForms/CodingSetupTab", () => ({ CodingSetupTab: ({ codingData }: { codingData: CodingData }) => <pre data-testid="setup">{codingData.starter_code}</pre> }));

import { CodingQuestionForm } from "../components/Quizzes/QuestionForms/CodingQuestionForm";

let latest: CodingData;
const Harness: React.FC<{ initial: CodingData }> = ({ initial }) => {
  const [data, setData] = useState(initial);
  latest = data;
  return (
    <MemoryRouter>
      <CodingQuestionForm data={data} onChange={setData} />
    </MemoryRouter>
  );
};

beforeEach(() => {
  Object.values(catalog).forEach((f) => f.mockReset());
  preview.mockReset();
  catalog.catalog.mockResolvedValue({ version: "x", languages: [{ key: "python", label: "Python", enabled: true, runnable: true, kinds: [], family: "", wave: "A", extensions: ["py"] }] });
  catalog.starters.mockResolvedValue([STARTER]);
  catalog.starter.mockResolvedValue(STARTER);
});

describe("CodingQuestionForm", () => {
  it("is one page: setup, tests and limits, with no overlay to open", () => {
    render(<Harness initial={{ language: "python", test_cases: [] }} />);
    const nav = screen.getByRole("navigation", { name: "Coding question sections" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent?.trim())).toEqual(["Code setup", "Tests", "Limits & guidelines"]);
    expect(screen.queryByText(/Open code setup/)).toBeNull();
    expect(screen.getByTestId("reference-solution")).toBeInTheDocument();
  });

  it("a starter fills the code and its tests", async () => {
    render(<Harness initial={{ language: "python", test_cases: [] }} />);
    await userEvent.click(screen.getByTestId("choose-starter"));
    await userEvent.click(await screen.findByTestId("starter-use"));
    await waitFor(() => expect(latest.starter_id).toBe("python-io-calculator"));
    expect(latest.project_mode).toBe(false);
    expect(latest.starter_code).toContain("input().split()");
    expect(latest.test_cases.map((t) => [t.input, t.expected_output, t.is_hidden])).toEqual([
      ["1 2\n", "3\n", false],
      ["5 5\n", "10\n", false],
    ]);
  });

  it("the reference solution fills expected outputs, and flags a test that fails against it", async () => {
    render(<Harness initial={{ language: "python", test_cases: [{ id: "a", input: "2 3", expected_output: "", is_hidden: false, points: 1 }, { id: "b", input: "4 4", expected_output: "9", is_hidden: true, points: 1 }], reference_solution: "print(sum(map(int, input().split())))" }} />);
    preview.mockResolvedValueOnce({ data: { results: [{ testCaseId: "a", passed: false, actual: "5\n", error: null, status: "Wrong Answer" }, { testCaseId: "b", passed: false, actual: "8\n", error: null, status: "Wrong Answer" }], passed: 0, total: 2 } });
    await userEvent.click(screen.getByRole("button", { name: /Fill expected outputs/ }));
    await waitFor(() => expect(latest.test_cases.map((t) => t.expected_output)).toEqual(["5", "8"]));
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ code: "print(sum(map(int, input().split())))", language: "python" }));

    preview.mockResolvedValueOnce({ data: { results: [{ testCaseId: "a", passed: true }, { testCaseId: "b", passed: false }], passed: 1, total: 2 } });
    await userEvent.click(screen.getByTestId("check-tests"));
    expect(await screen.findByTestId("tests-check-result")).toHaveTextContent("1 of 2 tests pass against your solution. Fix test b.");
  });
});
