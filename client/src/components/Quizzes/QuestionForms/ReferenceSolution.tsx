import React, { useState } from "react";
import { CheckCircle2, Loader2, Wand2, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import type { CodingData } from "../../../types/quiz.types";
import { QuizApiService } from "../../../services/quizApi";
import { runErrorMessage } from "../../../utils/runErrors";

/**
 * The teacher's reference solution (CODE_RUNNER_PLAN.md §7.3): it fills in
 * the expected outputs, and every test must pass against it — a broken test
 * is caught before students see it. Never sent to students (the server
 * strips reference_solution from what they get).
 */
const ReferenceSolution: React.FC<{ codingData: CodingData; onChange: (d: CodingData) => void }> = ({ codingData, onChange }) => {
  const [busy, setBusy] = useState<"fill" | "check" | null>(null);
  const [checked, setChecked] = useState<{ passed: number; total: number; failing: string[] } | null>(null);
  const solution = codingData.reference_solution ?? "";
  const tests = codingData.test_cases ?? [];

  const run = async (mode: "fill" | "check") => {
    if (!solution.trim()) return toast.info("Write the reference solution first.");
    if (!tests.length) return toast.info("Add at least one test (its input) first.");
    setBusy(mode);
    try {
      const res = await QuizApiService.previewRunTests({
        code: solution,
        language: codingData.language,
        test_cases: tests.map((t) => ({ id: t.id, input: t.input ?? "", expected_output: t.expected_output ?? "", is_hidden: t.is_hidden, points: t.points })),
      });
      const results = res.data.results;
      if (res.data.web_preview) {
        toast.info("Web questions are checked in the preview, not by running tests.");
        return;
      }
      if (mode === "fill") {
        const byId = new Map(results.map((r) => [String(r.testCaseId), r]));
        let filled = 0;
        const next = tests.map((t) => {
          const r = byId.get(String(t.id));
          if (!r || r.actual == null || r.error) return t;
          filled++;
          return { ...t, expected_output: r.actual.replace(/\s+$/, "") };
        });
        onChange({ ...codingData, test_cases: next });
        const broken = results.filter((r) => r.error && r.status !== "Accepted").length;
        toast.success(`Filled ${filled} expected output${filled === 1 ? "" : "s"} from your solution.${broken ? ` ${broken} test(s) made it crash — check their input.` : ""}`);
        setChecked(null);
      } else {
        const failing = results.filter((r) => !r.passed).map((r) => String(r.testCaseId));
        setChecked({ passed: results.length - failing.length, total: results.length, failing });
      }
    } catch (e) {
      toast.error(runErrorMessage(e, "Couldn't run your solution."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800" data-testid="reference-solution">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Reference solution</p>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Your own working answer. Students never see it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void run("fill")}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            {busy === "fill" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />} Fill expected outputs
          </button>
          <button
            type="button"
            onClick={() => void run("check")}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="check-tests"
          >
            {busy === "check" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />} Check the tests
          </button>
        </div>
      </div>
      <textarea
        value={solution}
        onChange={(e) => {
          onChange({ ...codingData, reference_solution: e.target.value });
          setChecked(null);
        }}
        rows={8}
        spellCheck={false}
        placeholder={`Your ${codingData.language || "code"} solution: it reads the test input and prints the expected output.`}
        className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900"
        aria-label="Reference solution"
      />
      {checked && (
        <p
          className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${checked.failing.length ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}
          role="status"
          data-testid="tests-check-result"
        >
          {checked.failing.length ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {checked.failing.length
            ? `${checked.passed} of ${checked.total} tests pass against your solution. Fix test${checked.failing.length === 1 ? "" : "s"} ${checked.failing.join(", ")}.`
            : `All ${checked.total} tests pass against your solution.`}
        </p>
      )}
    </div>
  );
};

export default ReferenceSolution;
