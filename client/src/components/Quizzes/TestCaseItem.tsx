import React from "react";
import { toast } from "react-toastify";

interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface TestCaseItemProps {
  testCase: TestCase;
  index: number;
  language: string;
  onUpdate: (updatedCase: TestCase) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export const TestCaseItem: React.FC<TestCaseItemProps> = ({
  testCase,
  index,
  language,
  onUpdate,
  onDelete,
  canDelete,
}) => {
  const isExample =
    testCase.input.includes("Enter test input") ||
    testCase.input.includes("Test your") ||
    testCase.expected_output.includes("Enter expected output") ||
    testCase.expected_output.includes("Valid HTML") ||
    testCase.expected_output.includes("result");

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium">
            Test {index + 1}
          </span>
          <span className="text-xs text-gray-500">ID: {testCase.id}</span>
          {testCase.is_hidden && (
            <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-full text-xs font-medium">
              🔒 Hidden
            </span>
          )}
          {isExample && (
            <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full text-xs font-medium">
              📝 Example
            </span>
          )}
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
          >
            ✕
          </button>
        )}
      </div>

      {/* Input/Output Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Input Data
          </label>
          <textarea
            value={testCase.input}
            onChange={(e) => onUpdate({ ...testCase, input: e.target.value })}
            placeholder={
              language === "html"
                ? "Use HTML validation keywords like: contains:h1;semantic-html;accessibility-basics"
                : `Replace with your ${language} input...`
            }
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
          />
          {language === "html" && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 Use keywords from the HTML Keywords Guide above (e.g.,
              semantic-html, contains:h1, accessibility-basics)
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Expected Output
          </label>
          <textarea
            value={testCase.expected_output}
            onChange={(e) =>
              onUpdate({ ...testCase, expected_output: e.target.value })
            }
            placeholder={
              language === "html"
                ? "HTML validation passed"
                : `Replace with your ${language} expected output...`
            }
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
          />
          {language === "html" && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 For HTML validation, use: "HTML validation passed"
            </div>
          )}
        </div>
      </div>

      {/* Settings Row */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={testCase.is_hidden}
            onChange={(e) =>
              onUpdate({ ...testCase, is_hidden: e.target.checked })
            }
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-gray-700 dark:text-gray-300">
            🔒 Hidden from students
          </span>
        </label>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Points:
          </label>
          <input
            type="number"
            value={testCase.points}
            onChange={(e) =>
              onUpdate({ ...testCase, points: parseInt(e.target.value) || 0 })
            }
            min="0"
            className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Time Limit (ms):
          </label>
          <input
            type="number"
            value={testCase.time_limit || 5000}
            onChange={(e) =>
              onUpdate({
                ...testCase,
                time_limit: parseInt(e.target.value) || 5000,
              })
            }
            placeholder="5000"
            className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
