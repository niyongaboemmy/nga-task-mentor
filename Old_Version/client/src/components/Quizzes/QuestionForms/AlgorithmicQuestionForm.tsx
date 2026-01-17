import React from "react";
import type { AlgorithmicData } from "../../../types/quiz.types";

interface AlgorithmicQuestionFormProps {
  data: AlgorithmicData;
  onChange: (data: AlgorithmicData) => void;
}

export const AlgorithmicQuestionForm: React.FC<
  AlgorithmicQuestionFormProps
> = ({ data, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Algorithm Description
        </label>
        <textarea
          value={data.algorithm_description}
          onChange={(e) =>
            onChange({
              ...data,
              algorithm_description: e.target.value,
            })
          }
          placeholder="Describe the algorithm..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Input Format
        </label>
        <input
          type="text"
          value={data.input_format}
          onChange={(e) =>
            onChange({
              ...data,
              input_format: e.target.value,
            })
          }
          placeholder="e.g., 'n' or 'array of integers'"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Output Format
        </label>
        <input
          type="text"
          value={data.output_format}
          onChange={(e) =>
            onChange({
              ...data,
              output_format: e.target.value,
            })
          }
          placeholder="e.g., 'integer' or 'sorted array'"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Test Cases
        </label>
        <div className="space-y-4">
          {data.test_cases.map((testCase, index) => (
            <div
              key={testCase.id}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Test Case {index + 1}
                </span>
                {data.test_cases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTestCases = data.test_cases.filter(
                        (_, i) => i !== index
                      );
                      onChange({
                        ...data,
                        test_cases: newTestCases,
                      });
                    }}
                    className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Input
                  </label>
                  <input
                    type="text"
                    value={testCase.input}
                    onChange={(e) => {
                      const newTestCases = [...data.test_cases];
                      newTestCases[index] = {
                        ...testCase,
                        input: e.target.value,
                      };
                      onChange({
                        ...data,
                        test_cases: newTestCases,
                      });
                    }}
                    placeholder="Input data"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expected Output
                  </label>
                  <input
                    type="text"
                    value={testCase.expected_output}
                    onChange={(e) => {
                      const newTestCases = [...data.test_cases];
                      newTestCases[index] = {
                        ...testCase,
                        expected_output: e.target.value,
                      };
                      onChange({
                        ...data,
                        test_cases: newTestCases,
                      });
                    }}
                    placeholder="Expected output"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={testCase.is_hidden}
                    onChange={(e) => {
                      const newTestCases = [...data.test_cases];
                      newTestCases[index] = {
                        ...testCase,
                        is_hidden: e.target.checked,
                      };
                      onChange({
                        ...data,
                        test_cases: newTestCases,
                      });
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mr-3"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Hidden from students
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Points:
                  </label>
                  <input
                    type="number"
                    value={testCase.points}
                    onChange={(e) => {
                      const newTestCases = [...data.test_cases];
                      newTestCases[index] = {
                        ...testCase,
                        points: parseInt(e.target.value) || 0,
                      };
                      onChange({
                        ...data,
                        test_cases: newTestCases,
                      });
                    }}
                    min="0"
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newTestCase = {
                id: (data.test_cases.length + 1).toString(),
                input: "",
                expected_output: "",
                is_hidden: false,
                points: 10,
              };
              onChange({
                ...data,
                test_cases: [...data.test_cases, newTestCase],
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Test Case
          </button>
        </div>
      </div>
    </div>
  );
};
