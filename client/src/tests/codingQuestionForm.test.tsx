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
const caps = vi.fn();
vi.mock("../services/codeApi", async (orig) => {
  const mod = await orig<typeof import("../services/codeApi")>();
  return { ...mod, codeApi: { ...mod.codeApi, capabilities: () => caps() } };
});
const PYTEST_STARTER = {
  ...STARTER,
  id: "python-pytest",
  kind: "python/project",
  title: "Python – pytest project",
  purpose: "project",
  entry: "src/shop/cart.py",
  has_io_tests: false,
  has_unit_tests: true,
  files: [
    { path: "src/shop/cart.py", content: "def total(prices):\n    return 0\n" },
    { path: "tests/test_cart.py", content: "from shop.cart import total\n\ndef test_total():\n    assert total([1, 2]) == 3\n" },
    { path: "pyproject.toml", content: "[project]\nname = 'shop'\n" },
  ],
};
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
  caps.mockReset();
  caps.mockResolvedValue({ interactive: false, unit_tests: true, unit_test_languages: ["python"] });
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

  it("checks answers with unit tests: a starter's tests become the hidden tests", async () => {
    catalog.starters.mockResolvedValue([PYTEST_STARTER]);
    catalog.starter.mockResolvedValue(PYTEST_STARTER);
    render(<Harness initial={{ language: "python", test_cases: [] }} />);
    await waitFor(() => expect(screen.getByTestId("check-with-unit")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("choose-starter"));
    await userEvent.click(await screen.findByTestId("starter-use"));
    await waitFor(() => expect(latest.check_with).toBe("unit"));
    expect(latest.unit_test_files?.map((f) => f.path)).toEqual(["tests/test_cart.py"]);
    // The student starts from the project without the tests.
    expect(latest.project_files?.map((f) => f.name).sort()).toEqual(["pyproject.toml", "src/shop/cart.py"]);
    expect(screen.getByTestId("check-with-unit")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("unit-test-files")).toBeInTheDocument();
    expect(screen.queryByTestId("reference-solution")).toBeNull();
  });

  it("switching to unit tests offers an example test file for the language", async () => {
    render(<Harness initial={{ language: "python", test_cases: [] }} />);
    await userEvent.click(await screen.findByTestId("check-with-unit"));
    await userEvent.click(screen.getByTestId("add-unit-test-file"));
    expect(latest.unit_test_files?.[0]?.path).toBe("tests/test_main.py");
    expect(screen.getByTestId("unit-test-content")).toHaveValue(latest.unit_test_files![0]!.content);
  });

  it("doesn't offer unit tests when the runner can't run them for the language", async () => {
    caps.mockResolvedValue({ interactive: false, unit_tests: false, unit_test_languages: [] });
    render(<Harness initial={{ language: "python", test_cases: [] }} />);
    await waitFor(() => expect(caps).toHaveBeenCalled());
    expect(screen.queryByTestId("check-with-unit")).toBeNull();
  });
});
