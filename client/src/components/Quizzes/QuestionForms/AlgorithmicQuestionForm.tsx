import React, { useMemo } from "react";
import type { AlgorithmicData } from "../../../types/quiz.types";

interface AlgorithmicQuestionFormProps {
  data: AlgorithmicData;
  onChange: (data: any) => void;
}

export const AlgorithmicQuestionForm: React.FC<
  AlgorithmicQuestionFormProps
> = ({ data, onChange }) => {
  // Ensure default data
  const safeData = {
    algorithm_description: data.algorithm_description || "",
    input_format: data.input_format || "",
    output_format: data.output_format || "",
    constraints: data.constraints || "",
    test_cases: data.test_cases || [],
  };

  // Validation
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!safeData.algorithm_description.trim()) errs.push("Algorithm description is required");
    if (!safeData.input_format.trim()) errs.push("Input format is required");
    if (!safeData.output_format.trim()) errs.push("Output format is required");
    
    if (safeData.test_cases.length === 0) {
      errs.push("At least one test case is required");
    } else {
      safeData.test_cases.forEach((tc, i) => {
        if (!tc.input.trim()) errs.push(`Test Case ${i + 1}: Input is required`);
        if (!tc.expected_output.trim()) errs.push(`Test Case ${i + 1}: Expected output is required`);
      });
    }
    return errs;
  }, [safeData]);

  const updateData = (newData: AlgorithmicData) => {
    // Include test cases as the "correct answer" for grading purposes
    onChange({
      ...newData,
      correct_answer: newData.test_cases,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Algorithm Description *
        </label>
        <textarea
          value={safeData.algorithm_description}
          onChange={(e) =>
            updateData({
              ...safeData,
              algorithm_description: e.target.value,
            })
          }
          placeholder="Describe the algorithm problem statement..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Input Format *
          </label>
          <input
            type="text"
            value={safeData.input_format}
            onChange={(e) =>
              updateData({
                ...safeData,
                input_format: e.target.value,
              })
            }
            placeholder="e.g., A single integer N"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Output Format *
          </label>
          <input
            type="text"
            value={safeData.output_format}
            onChange={(e) =>
              updateData({
                ...safeData,
                output_format: e.target.value,
              })
            }
            placeholder="e.g., Determine if N is prime"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Constraints (Optional)
        </label>
        <textarea
           value={safeData.constraints}
           onChange={(e) => 
             updateData({
               ...safeData,
               constraints: e.target.value
             })
           }
           placeholder="e.g., 1 <= N <= 10^5"
           rows={2}
           className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Test Cases *
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
             {safeData.test_cases.length} added
          </span>
        </div>
        
        <div className="space-y-4">
          {safeData.test_cases.map((testCase, index) => (
            <div
              key={testCase.id || index}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Test Case {index + 1}
                </span>
                {safeData.test_cases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTestCases = safeData.test_cases.filter(
                        (_, i) => i !== index
                      );
                      updateData({
                        ...safeData,
                        test_cases: newTestCases,
                      });
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Input
                  </label>
                  <textarea
                    value={testCase.input}
                    onChange={(e) => {
                      const newTestCases = [...safeData.test_cases];
                      newTestCases[index] = {
                        ...testCase,
                        input: e.target.value,
                      };
                      updateData({
                        ...safeData,
                        test_cases: newTestCases,
                      });
                    }}
                    placeholder="Input data"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Expected Output
                  </label>
                  <textarea
                    value={testCase.expected_output}
                    onChange={(e) => {
                      const newTestCases = [...safeData.test_cases];
                      newTestCases[index] = {
                        ...testCase,
                        expected_output: e.target.value,
                      };
                      updateData({
                        ...safeData,
                        test_cases: newTestCases,
                      });
                    }}
                    placeholder="Expected output"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testCase.is_hidden}
                    onChange={(e) => {
                      const newTestCases = [...safeData.test_cases];
                      newTestCases[index] = {
                        ...testCase,
                        is_hidden: e.target.checked,
                      };
                      updateData({
                        ...safeData,
                        test_cases: newTestCases,
                      });
                    }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Hidden from students</span>
                </label>
                <div className="flex items-center gap-2">
                   <label className="text-xs text-gray-600 dark:text-gray-400">Points:</label>
                   <input
                     type="number"
                     value={testCase.points}
                     onChange={(e) => {
                        const newTestCases = [...safeData.test_cases];
                        newTestCases[index] = {
                          ...testCase,
                          points: parseInt(e.target.value) || 0
                        };
                        updateData({ ...safeData, test_cases: newTestCases });
                     }}
                     className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                   />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newTestCase = {
                id: (safeData.test_cases.length + 1).toString(),
                input: "",
                expected_output: "",
                is_hidden: false,
                points: 10,
              };
              updateData({
                ...safeData,
                test_cases: [...safeData.test_cases, newTestCase],
              });
            }}
            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors"
          >
            + Add Test Case
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl">
           <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Errors</h4>
           <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
             {errors.map((err, i) => <li key={i}>{err}</li>)}
           </ul>
        </div>
      )}
    </div>
  );
};
