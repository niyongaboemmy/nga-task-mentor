import React, { useState } from "react";
import type { CodingData } from "../../../types/quiz.types";
import { AITestCaseGenerator } from "../AITestCaseGenerator";
import { TestCaseItem } from "../TestCaseItem";
import { UnifiedTestCaseToolbar } from "../UnifiedTestCaseToolbar";
import { WebTestCaseBuilder } from "./WebTestCaseBuilder";
import {
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  Cpu,
} from "lucide-react";
import { toast } from "react-toastify";
import { QuizApiService } from "../../../services/quizApi";

interface CodingTestsTabProps {
  codingData: CodingData;
  onChange: (data: CodingData) => void;
}

interface TestPreviewResult {
  testCaseId: string;
  passed: boolean | null;
  input: string | null;
  expected: string | null;
  actual: string | null;
  error: string | null;
  executionTime: number;
  memoryUsed: number | null;
  status: string;
  is_hidden: boolean;
}

const LANG_WITH_BUILDER = [
  "javascript", "typescript", "react", "nodejs",
  "css", "html", "vue", "python", "java", "c", "cpp", "php", "angular",
];

function makeEmptyTestCase(count: number) {
  return {
    id: (count + 1).toString(),
    input: "",
    expected_output: "",
    is_hidden: false,
    points: 10,
    time_limit: 5000,
    explanation: "",
  };
}

export const CodingTestsTab: React.FC<CodingTestsTabProps> = ({
  codingData,
  onChange,
}) => {
  const testCases = codingData.test_cases ?? [];
  const totalWeight = testCases.reduce((sum, tc) => sum + Number(tc.points || 0), 0);
  const hiddenCount = testCases.filter((tc) => tc.is_hidden).length;
  const visibleCount = testCases.length - hiddenCount;

  const [newTestCase, setNewTestCase] = useState(() =>
    makeEmptyTestCase(testCases.length),
  );
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewResults, setPreviewResults] = useState<TestPreviewResult[] | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const isWebLang = [
    "html", "css", "javascript", "typescript", "react", "vue", "angular", "nodejs",
  ].includes(codingData.language.toLowerCase());

  const addTestCase = () => {
    onChange({
      ...codingData,
      test_cases: [
        ...testCases,
        { ...newTestCase, id: (testCases.length + 1).toString() },
      ],
    });
    setNewTestCase(makeEmptyTestCase(testCases.length + 1));
    toast.success("Test case added!", { autoClose: 2000 });
  };

  const updateTestCase = (index: number, updated: any) => {
    const next = [...testCases];
    next[index] = updated;
    onChange({ ...codingData, test_cases: next });
    // Clear stale preview result for this test case
    setPreviewResults((prev) =>
      prev ? prev.filter((r) => r.testCaseId !== String(testCases[index]?.id)) : prev,
    );
  };

  const removeTestCase = (index: number) => {
    onChange({ ...codingData, test_cases: testCases.filter((_, i) => i !== index) });
    toast.success(`Test case #${index + 1} deleted!`, { autoClose: 2000 });
    setPreviewResults(null);
  };

  const handleRunTests = async () => {
    if (!codingData.starter_code) {
      toast.warn("Add starter code first (Setup & Templates tab) before running tests.");
      return;
    }
    if (testCases.length === 0) {
      toast.warn("No test cases defined yet.");
      return;
    }
    setPreviewRunning(true);
    setPreviewResults(null);
    try {
      const res = await QuizApiService.previewRunTests({
        code: codingData.starter_code,
        language: codingData.language,
        test_cases: testCases.map((tc) => ({
          id: tc.id,
          input: tc.input ?? "",
          expected_output: tc.expected_output ?? "",
          is_hidden: tc.is_hidden ?? false,
          points: tc.points ?? 1,
        })),
      });
      setPreviewResults(res.data.results);
      const passed = res.data.passed;
      const total = res.data.total;
      if (passed === total) {
        toast.success(`All ${total} test cases passed! ✅`);
      } else {
        toast.warn(`${passed}/${total} test cases passed.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to run tests.");
    } finally {
      setPreviewRunning(false);
    }
  };

  const toggleResultExpand = (id: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPreviewResult = (id: string) =>
    previewResults?.find((r) => r.testCaseId === id) ?? null;

  const hasBuilder = LANG_WITH_BUILDER.includes(codingData.language);
  const passedCount = previewResults?.filter((r) => r.passed === true).length ?? 0;
  const failedCount = previewResults?.filter((r) => r.passed === false).length ?? 0;

  return (
    <div className="space-y-5">
      {/* AI Generator */}
      <AITestCaseGenerator
        language={codingData.language}
        problemDescription={codingData.constraints || ""}
        starterCode={codingData.starter_code}
        onTestCasesGenerated={(cases) =>
          onChange({ ...codingData, test_cases: cases })
        }
      />

      {/* Stats + Run Tests bar */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Test Cases</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Define inputs and expected outputs · Total weight: {totalWeight} pts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Stats */}
            {[
              { label: "Total", value: testCases.length, color: "green" },
              { label: "Visible", value: visibleCount, color: "blue" },
              { label: "Hidden", value: hiddenCount, color: "purple" },
            ].map((s) => (
              <div
                key={s.label}
                className={`bg-white dark:bg-gray-800 rounded-xl px-3 py-1.5 border border-${s.color}-200 dark:border-${s.color}-700 text-center min-w-[56px]`}
              >
                <div className={`text-[10px] text-${s.color}-500 uppercase font-bold`}>{s.label}</div>
                <div className={`text-lg font-black text-${s.color}-600 dark:text-${s.color}-400`}>{s.value}</div>
              </div>
            ))}

            {/* Run Tests button */}
            {!isWebLang && testCases.length > 0 && (
              <button
                type="button"
                onClick={handleRunTests}
                disabled={previewRunning || !codingData.starter_code}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-semibold text-sm transition-all shadow-sm"
                title={!codingData.starter_code ? "Add starter code first" : "Run starter code against all test cases"}
              >
                {previewRunning ? (
                  <><Loader2 size={14} className="animate-spin" /> Running…</>
                ) : (
                  <><Play size={14} fill="white" /> Run All Tests</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Preview run summary */}
        {previewResults && (
          <div className={`mt-4 pt-4 border-t ${
            failedCount === 0
              ? "border-green-200 dark:border-green-700"
              : "border-amber-200 dark:border-amber-700"
          }`}>
            <div className="flex items-center gap-3">
              {failedCount === 0 ? (
                <CheckCircle size={18} className="text-green-600 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              )}
              <span className={`text-sm font-bold ${failedCount === 0 ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}`}>
                Starter code: {passedCount}/{previewResults.length} tests passed
              </span>
              {failedCount > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  — Check failed tests below and fix expected outputs or starter code
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {isWebLang ? (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <WebTestCaseBuilder
            language={codingData.language.toLowerCase()}
            initialTestCases={testCases}
            onTestCasesChange={(cases) =>
              onChange({ ...codingData, test_cases: cases })
            }
          />
        </div>
      ) : (
        <>
          {hasBuilder && (
            <UnifiedTestCaseToolbar
              language={codingData.language}
              onTestCaseGenerated={(tc) =>
                onChange({ ...codingData, test_cases: [...testCases, tc] })
              }
            />
          )}

          {testCases.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-1">Quick Tips</h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5">
                    <li>• <strong>Visible</strong> tests help students understand the problem</li>
                    <li>• <strong>Hidden</strong> tests prevent hardcoding and ensure thorough solutions</li>
                    <li>• Include edge cases: empty inputs, large numbers, special characters</li>
                    <li>• Use "Run All Tests" to verify your expected outputs against starter code</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Test Case List with inline preview results */}
          {testCases.length > 0 && (
            <div className="space-y-3">
              {testCases.map((tc, idx) => {
                const pr = getPreviewResult(tc.id);
                const isExpanded = expandedResults.has(tc.id);

                return (
                  <div key={tc.id ?? idx} className={`rounded-2xl border-2 overflow-hidden transition-colors ${
                    pr === null
                      ? "border-gray-200 dark:border-gray-700"
                      : pr.passed
                      ? "border-emerald-300 dark:border-emerald-700"
                      : "border-red-300 dark:border-red-700"
                  }`}>
                    {/* Preview result header strip */}
                    {pr !== null && (
                      <button
                        type="button"
                        onClick={() => toggleResultExpand(tc.id)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-bold transition-colors ${
                          pr.passed
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {pr.passed ? (
                            <CheckCircle size={13} />
                          ) : (
                            <XCircle size={13} />
                          )}
                          <span>{pr.passed ? "PASSED" : "FAILED"}</span>
                          {pr.status && !pr.passed && (
                            <span className="opacity-70">— {pr.status}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 opacity-70">
                          {pr.executionTime > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} /> {Math.round(pr.executionTime)}ms
                            </span>
                          )}
                          {pr.memoryUsed != null && (
                            <span className="flex items-center gap-1">
                              <Cpu size={11} /> {Math.round(pr.memoryUsed / 1024)}MB
                            </span>
                          )}
                          <span>{isExpanded ? "▲ Hide" : "▼ Details"}</span>
                        </div>
                      </button>
                    )}

                    {/* Expanded diff panel */}
                    {pr !== null && !pr.passed && isExpanded && (
                      <div className="bg-gray-950 text-xs font-mono border-b border-gray-800 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-800">
                        {pr.input !== null && (
                          <div className="p-3">
                            <div className="text-gray-500 uppercase text-[10px] mb-1 font-sans font-bold">Input</div>
                            <pre className="text-gray-300 whitespace-pre-wrap break-all">{pr.input || "(empty)"}</pre>
                          </div>
                        )}
                        <div className="p-3">
                          <div className="text-emerald-500 uppercase text-[10px] mb-1 font-sans font-bold">Expected</div>
                          <pre className="text-emerald-300 whitespace-pre-wrap break-all">{pr.expected ?? "(hidden)"}</pre>
                        </div>
                        <div className="p-3">
                          <div className="text-red-400 uppercase text-[10px] mb-1 font-sans font-bold">Actual</div>
                          <pre className="text-red-300 whitespace-pre-wrap break-all">
                            {pr.error || pr.actual || "(no output)"}
                          </pre>
                        </div>
                      </div>
                    )}

                    <div className="bg-white dark:bg-gray-900">
                      <TestCaseItem
                        testCase={tc}
                        index={idx}
                        language={codingData.language}
                        onUpdate={(upd) => updateTestCase(idx, upd)}
                        onDelete={() => removeTestCase(idx)}
                        canDelete={testCases.length > 1}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Manual Test Case Form */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Plus size={16} /> Add Custom Test Case
            </h5>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Input Data (stdin)
                  </label>
                  <textarea
                    placeholder={"e.g. 5\n10 20 30 40 50"}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-mono h-24 resize-none"
                    value={newTestCase.input}
                    onChange={(e) => setNewTestCase({ ...newTestCase, input: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Expected Output (exact match)
                  </label>
                  <textarea
                    placeholder={"e.g. 150"}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-mono h-24 resize-none"
                    value={newTestCase.expected_output}
                    onChange={(e) => setNewTestCase({ ...newTestCase, expected_output: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Explanation (shown to students after completing the quiz)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sum all elements of the array"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                  value={newTestCase.explanation ?? ""}
                  onChange={(e) => setNewTestCase({ ...newTestCase, explanation: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                      checked={newTestCase.is_hidden}
                      onChange={(e) => setNewTestCase({ ...newTestCase, is_hidden: e.target.checked })}
                    />
                    {newTestCase.is_hidden ? (
                      <span className="flex items-center gap-1"><EyeOff size={13} /> Hidden (private)</span>
                    ) : (
                      <span className="flex items-center gap-1"><Eye size={13} /> Visible to students</span>
                    )}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    Points:
                    <input
                      type="number"
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                      value={newTestCase.points}
                      onChange={(e) =>
                        setNewTestCase({ ...newTestCase, points: parseInt(e.target.value) || 0 })
                      }
                      min="1"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addTestCase}
                  disabled={!newTestCase.input || !newTestCase.expected_output}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                >
                  <Plus size={14} /> Save Test Case
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {testCases.length === 0 && !isWebLang && (
        <div className="text-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl">
          <div className="text-5xl mb-3">🧪</div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">No Test Cases Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Use the AI generator above, the language builder, or add manually below.
          </p>
          <button
            type="button"
            onClick={() =>
              onChange({ ...codingData, test_cases: [...testCases, makeEmptyTestCase(testCases.length)] })
            }
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-all inline-flex items-center gap-2"
          >
            <Plus size={15} /> Create First Test Case
          </button>
        </div>
      )}
    </div>
  );
};
