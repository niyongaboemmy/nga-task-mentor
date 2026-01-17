import React, { useMemo } from "react";
import { 
  FileText, 
  List, 
  Cpu, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  BookOpen
} from "lucide-react";
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
          <Cpu className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Algorithmic Problem Setup
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Define algorithm challenges with specific input/output formats and test cases.
          </p>
        </div>
      </div>

      {/* Algorithm Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Problem Description {safeData.algorithm_description ? <CheckCircle className="inline w-4 h-4 text-green-500 ml-2" /> : <span className="text-red-500">*</span>}
          </h4>
        </div>
        <textarea
          value={safeData.algorithm_description}
          onChange={(e) =>
            updateData({
              ...safeData,
              algorithm_description: e.target.value,
            })
          }
          placeholder="Describe the algorithm problem statement, edge cases, and requirements..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm resize-none"
        />
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          <span>Markdown formatting is supported</span>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <List className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Input Format {safeData.input_format ? <CheckCircle className="inline w-4 h-4 text-green-500 ml-2" /> : <span className="text-red-500">*</span>}
            </h4>
          </div>
          <input
            type="text"
            value={safeData.input_format}
            onChange={(e) =>
              updateData({
                ...safeData,
                input_format: e.target.value,
              })
            }
            placeholder="e.g., A single integer N followed by Array A"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Output Format {safeData.output_format ? <CheckCircle className="inline w-4 h-4 text-green-500 ml-2" /> : <span className="text-red-500">*</span>}
            </h4>
          </div>
          <input
            type="text"
            value={safeData.output_format}
            onChange={(e) =>
              updateData({
                ...safeData,
                output_format: e.target.value,
              })
            }
            placeholder="e.g., Print 'YES' if prime, 'NO' otherwise"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <BookOpen className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white">
            Constraints & Limits
          </label>
        </div>
        <textarea
           value={safeData.constraints}
           onChange={(e) => 
             updateData({
               ...safeData,
               constraints: e.target.value
             })
           }
           placeholder="e.g., 1 <= N <= 10^5, Time Limit: 2s, Memory Limit: 256MB"
           rows={2}
           className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all text-sm resize-none"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
               <List className="w-5 h-5 text-blue-600 dark:text-blue-400" />
             </div>
             <div>
               <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                 Test Cases
               </label>
               <p className="text-xs text-gray-500 dark:text-gray-400">
                 Define inputs and expected outputs
               </p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
               {safeData.test_cases.length} Total
            </span>
            <span className="text-xs font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-green-600 dark:text-green-400">
               {safeData.test_cases.filter(tc => !tc.is_hidden).length} Visible
            </span>
          </div>
        </div>
        
        <div className="space-y-4">
          {safeData.test_cases.map((testCase, index) => (
            <div
              key={testCase.id || index}
              className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-xs font-bold text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Test Case #{index + 1}
                  </span>
                </div>
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
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono resize-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                <label className="flex items-center gap-2 cursor-pointer group/toggle">
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${testCase.is_hidden ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${testCase.is_hidden ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
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
                    className="hidden"
                  />
                  <div className="flex items-center gap-1.5">
                    {testCase.is_hidden ? <EyeOff className="w-3.5 h-3.5 text-purple-500" /> : <Eye className="w-3.5 h-3.5 text-gray-500" />}
                    <span className={`text-xs ${testCase.is_hidden ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                      {testCase.is_hidden ? 'Hidden' : 'Visible'}
                    </span>
                  </div>
                </label>
                <div className="flex items-center gap-2">
                   <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Points:</label>
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
                     className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-center focus:ring-1 focus:ring-blue-500 outline-none"
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
            className="w-full py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2 group"
          >
            <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
               <Plus className="w-4 h-4" />
            </div>
            <span className="font-medium">Add New Test Case</span>
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
           <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
           <div>
             <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
               Please fix the following errors:
             </h4>
             <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
               {errors.map((err, i) => <li key={i}>{err}</li>)}
             </ul>
           </div>
        </div>
      )}
    </div>
  );
};
