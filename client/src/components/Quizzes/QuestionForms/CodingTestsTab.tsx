import React, { useState } from "react";
import type { CodingData } from "../../../types/quiz.types";
import { AITestCaseGenerator } from "../AITestCaseGenerator";
import { TestCaseItem } from "../TestCaseItem";
import { UnifiedTestCaseToolbar } from "../UnifiedTestCaseToolbar";
import { WebTestCaseBuilder } from "./WebTestCaseBuilder";
import {
  Sparkles,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  FileCode2,
  TestTube2,
  FlaskConical,
} from "lucide-react";
import { toast } from "react-toastify";

interface CodingTestsTabProps {
  codingData: CodingData;
  onChange: (data: CodingData) => void;
}

const LANG_WITH_BUILDER = [
  "javascript",
  "typescript",
  "react",
  "nodejs",
  "css",
  "html",
  "vue",
  "python",
  "java",
  "c",
  "cpp",
  "php",
  "angular",
];

function makeEmptyTestCase(count: number) {
  return {
    id: (count + 1).toString(),
    input: "",
    expected_output: "",
    is_hidden: false,
    points: 10,
    time_limit: 5000,
  };
}

export const CodingTestsTab: React.FC<CodingTestsTabProps> = ({
  codingData,
  onChange,
}) => {
  const testCases = codingData.test_cases ?? [];
  const totalWeight = testCases.reduce(
    (sum, tc) => sum + Number(tc.points || 0),
    0,
  );
  const hiddenCount = testCases.filter((tc) => tc.is_hidden).length;
  const visibleCount = testCases.length - hiddenCount;

  const [newTestCase, setNewTestCase] = useState(() =>
    makeEmptyTestCase(testCases.length),
  );

  const isWebLang = [
    "html",
    "css",
    "javascript",
    "typescript",
    "react",
    "vue",
    "angular",
    "nodejs",
  ].includes(codingData.language.toLowerCase());

  const addTestCase = () => {
    onChange({
      ...codingData,
      test_cases: [
        ...testCases,
        { ...newTestCase, id: (testCases.length + 1).toString() },
      ],
    });
    setNewTestCase(makeEmptyTestCase(testCases.length + 1)); // Reset form for next test case
    toast.success("Test Case added!", { autoClose: 2000 });
  };

  const updateTestCase = (index: number, updated: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    const next = [...testCases];
    next[index] = updated;
    onChange({ ...codingData, test_cases: next });
  };

  const removeTestCase = (index: number) => {
    onChange({
      ...codingData,
      test_cases: testCases.filter((_, i) => i !== index),
    });
    toast.success(`Test Case #${index + 1} deleted!`, { autoClose: 2000 });
  };

  const hasBuilder = LANG_WITH_BUILDER.includes(codingData.language);

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

      {/* Stats + Add button bar */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                Test Cases
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Define inputs and expected outputs
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Total", value: testCases.length, color: "green" },
              { label: "Visible", value: visibleCount, color: "blue" },
              { label: "Hidden", value: hiddenCount, color: "purple" },
            ].map((s) => (
              <div
                key={s.label}
                className={`bg-white dark:bg-gray-800 rounded-xl px-3 py-1.5 border border-${s.color}-200 dark:border-${s.color}-700 text-center min-w-[60px]`}
              >
                <div className={`text-xs text-${s.color}-500`}>{s.label}</div>
                <div
                  className={`text-lg font-bold text-${s.color}-600 dark:text-${s.color}-400`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The original "Add Test Case" button is removed here as it's replaced by the manual form's button or WebTestCaseBuilder */}
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
          {/* Language-specific tools (UnifiedTestCaseToolbar for non-web languages) */}
          {hasBuilder && (
            <UnifiedTestCaseToolbar
              language={codingData.language}
              onTestCaseGenerated={(tc) =>
                onChange({ ...codingData, test_cases: [...testCases, tc] })
              }
            />
          )}

          {/* Tips */}
          {testCases.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-1">
                    Quick Tips
                  </h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5">
                    <li>
                      • <strong>Visible</strong> tests help students understand
                      the problem
                    </li>
                    <li>
                      • <strong>Hidden</strong> tests prevent hardcoding and
                      ensure thorough solutions
                    </li>
                    <li>
                      • Include edge cases like empty inputs, large numbers, or
                      special characters
                    </li>
                    <li>• Distribute points based on test difficulty</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Test Case List */}
          {testCases.length > 0 && (
            <div className="space-y-4">
              {testCases.map((tc, idx) => (
                <TestCaseItem
                  key={tc.id ?? idx}
                  testCase={tc}
                  index={idx}
                  language={codingData.language}
                  onUpdate={(upd) => updateTestCase(idx, upd)}
                  onDelete={() => removeTestCase(idx)}
                  canDelete={testCases.length > 1}
                />
              ))}
            </div>
          )}

          {/* Add Manual Form */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Plus size={16} /> Add Custom Test Case
            </h5>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <textarea
                  placeholder="Input Data (e.g. 5\n10 20 30 40 50)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-mono h-24 resize-none"
                  value={newTestCase.input}
                  onChange={(e) =>
                    setNewTestCase({ ...newTestCase, input: e.target.value })
                  }
                />
                <textarea
                  placeholder="Expected Output (e.g. 150)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-mono h-24 resize-none"
                  value={newTestCase.expected_output}
                  onChange={(e) =>
                    setNewTestCase({
                      ...newTestCase,
                      expected_output: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                      checked={newTestCase.is_hidden}
                      onChange={(e) =>
                        setNewTestCase({
                          ...newTestCase,
                          is_hidden: e.target.checked,
                        })
                      }
                    />
                    Hide from students (Private test)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    Points:
                    <input
                      type="number"
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                      value={newTestCase.points}
                      onChange={(e) =>
                        setNewTestCase({
                          ...newTestCase,
                          points: parseInt(e.target.value) || 0,
                        })
                      }
                      min="1"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addTestCase}
                  disabled={!newTestCase.input || !newTestCase.expected_output}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Save Test Case
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State for non-web languages */}
      {testCases.length === 0 && !isWebLang && (
        <div className="text-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl">
          <div className="text-5xl mb-3">🧪</div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">
            No Test Cases Yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Use the AI generator above, the language builder, or add manually.
          </p>
          <button
            type="button"
            onClick={() => {
              onChange({
                ...codingData,
                test_cases: [...testCases, makeEmptyTestCase(testCases.length)],
              });
            }}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-all inline-flex items-center gap-2"
          >
            <Plus size={15} /> Create First Test Case
          </button>
        </div>
      )}
    </div>
  );
};
