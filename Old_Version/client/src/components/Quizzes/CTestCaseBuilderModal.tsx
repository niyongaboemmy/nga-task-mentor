import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedCTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface CTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedCTestCase) => void;
}

export const CTestCaseBuilderModal: React.FC<CTestCaseBuilderModalProps> = ({
  isOpen,
  onClose,
  onTestCaseGenerated,
}) => {
  const [functionName, setFunctionName] = useState("");
  const [returnType, setReturnType] = useState("int");
  const [inputExample, setInputExample] = useState("");
  const [outputExample, setOutputExample] = useState("");
  const [validationRules, setValidationRules] = useState<string[]>([]);

  const handleValidationToggle = (rule: string) => {
    setValidationRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const generateTestCase = () => {
    if (!functionName.trim()) {
      toast.error("Please enter a function name");
      return;
    }

    // Validate C function name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
      toast.error(
        "Function name must be a valid C identifier (letters, numbers, underscores, cannot start with number)"
      );
      return;
    }

    const rules = [`function:${functionName}`];
    if (returnType !== "void") rules.push(`output-type:${returnType}`);
    rules.push(...validationRules);

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("Test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedCTestCase = {
        id: Date.now().toString(),
        input:
          inputExample.trim() ||
          `// TODO: Provide input for ${functionName} based on: ${testCaseDescriptor}`,
        expected_output: outputExample.trim() || "C validation passed",
        is_hidden: false,
        points: 10,
        time_limit: 5000,
      };

      onTestCaseGenerated(generated);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔵 C Test Case Builder"
      subtitle="Create comprehensive test cases for C functions"
      size="xl"
    >
      <div className="space-y-6">
        {/* Function Details */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔧</span>
            Function Details
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Function Name
                <span
                  className="text-xs text-blue-600 dark:text-blue-400 ml-2"
                  title="Enter the C function name you want to test"
                >
                  💡
                </span>
              </label>
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="e.g., calculateSum, fibonacci, swapValues"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                title="Function name should follow C naming conventions"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Return Type
              </label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="void">void</option>
                <option value="int">int</option>
                <option value="float">float</option>
                <option value="double">double</option>
                <option value="char">char</option>
                <option value="int*">int*</option>
                <option value="char*">char*</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Input Example
              </label>
              <input
                type="text"
                value={inputExample}
                onChange={(e) => setInputExample(e.target.value)}
                placeholder="e.g., int arr[] = {1, 2, 3}; int n = 3;"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Output Example
              </label>
              <input
                type="text"
                value={outputExample}
                onChange={(e) => setOutputExample(e.target.value)}
                placeholder="e.g., 6 or 1 2 3 4 5"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            Validation Requirements
          </h5>

          <div className="grid gap-3">
            {[
              {
                key: "input-validation:type-check",
                label: "Type Check Input Parameters",
                desc: "Ensure inputs are correct types",
              },
              {
                key: "input-validation:range-check",
                label: "Input Range Validation",
                desc: "Validate input value ranges",
              },
              {
                key: "input-validation:null-check",
                label: "Handle NULL Pointers",
                desc: "Check for NULL pointer inputs",
              },
              {
                key: "edge-case:empty-array",
                label: "Handle Empty Arrays",
                desc: "Test with empty array inputs",
              },
              {
                key: "edge-case:negative-numbers",
                label: "Handle Negative Numbers",
                desc: "Test with negative number inputs",
              },
              {
                key: "edge-case:large-numbers",
                label: "Handle Large Numbers",
                desc: "Test with very large number inputs",
              },
              {
                key: "uses:for-loop",
                label: "Use For Loop",
                desc: "Require for loop implementation",
              },
              {
                key: "uses:while-loop",
                label: "Use While Loop",
                desc: "Require while loop implementation",
              },
              {
                key: "uses:pointers",
                label: "Use Pointers",
                desc: "Require pointer usage",
              },
              {
                key: "uses:arrays",
                label: "Use Arrays",
                desc: "Require array manipulation",
              },
              {
                key: "uses:strings",
                label: "Use String Functions",
                desc: "Require string manipulation",
              },
              {
                key: "uses:recursion",
                label: "Use Recursion",
                desc: "Require recursive implementation",
              },
              {
                key: "uses:malloc",
                label: "Use Dynamic Memory",
                desc: "Require malloc/free usage",
              },
              {
                key: "uses:stdio",
                label: "Use Standard I/O",
                desc: "Require printf/scanf usage",
              },
              {
                key: "algorithm:sorting",
                label: "Sorting Algorithm",
                desc: "Require sorting algorithm implementation",
              },
              {
                key: "algorithm:searching",
                label: "Searching Algorithm",
                desc: "Require searching algorithm implementation",
              },
              {
                key: "complexity:o-n",
                label: "O(n) Complexity",
                desc: "Require linear time complexity",
              },
              {
                key: "complexity:o-n2",
                label: "O(n²) Complexity",
                desc: "Require quadratic time complexity",
              },
              {
                key: "complexity:o-log-n",
                label: "O(log n) Complexity",
                desc: "Require logarithmic time complexity",
              },
              {
                key: "best-practice:descriptive-names",
                label: "Descriptive Variable Names",
                desc: "Require meaningful variable names",
              },
              {
                key: "best-practice:error-handling",
                label: "Error Handling",
                desc: "Require proper error handling",
              },
              {
                key: "best-practice:memory-management",
                label: "Proper Memory Management",
                desc: "Require correct malloc/free usage",
              },
              {
                key: "performance:efficient-loops",
                label: "Efficient Loop Patterns",
                desc: "Require optimized loop implementations",
              },
              {
                key: "avoids:global-variables",
                label: "Avoid Global Variables",
                desc: "Prevent global variable pollution",
              },
              {
                key: "avoids:memory-leaks",
                label: "Avoid Memory Leaks",
                desc: "Require proper memory deallocation",
              },
              {
                key: "valid-c",
                label: "Valid C Syntax",
                desc: "Require syntactically correct C code",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {rule.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Generated Test Case */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Generated Test Case
          </h5>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            {functionName ? (
              <div className="space-y-2">
                <div>
                  <strong className="text-green-700 dark:text-green-300">
                    Test Case:
                  </strong>{" "}
                  <code className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                    {[
                      `function:${functionName}`,
                      `output-type:${returnType}`,
                      ...validationRules,
                    ].join(";")}
                  </code>
                </div>
                {inputExample && outputExample && (
                  <div>
                    <strong className="text-green-700 dark:text-green-300">
                      Example:
                    </strong>{" "}
                    Input:{" "}
                    <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                      {inputExample}
                    </code>{" "}
                    → Output:{" "}
                    <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">
                      {outputExample}
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-500">
                Enter function details to generate test case...
              </span>
            )}
          </div>

          <button
            onClick={generateTestCase}
            disabled={!functionName.trim()}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed"
          >
            📋 Copy Test Case to Clipboard
          </button>
        </div>

        {/* Quick Help */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            Quick Tips for C Test Cases
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • <strong>Function naming:</strong> Use snake_case or camelCase
              (e.g., calculate_sum)
            </li>
            <li>
              • <strong>Pointers:</strong> Test for proper pointer usage and
              NULL checks
            </li>
            <li>
              • <strong>Memory management:</strong> Include validation for
              malloc/free usage
            </li>
            <li>
              • <strong>Arrays:</strong> Always test with different array sizes
              and edge cases
            </li>
            <li>
              • <strong>Error handling:</strong> Include return value checks and
              error conditions
            </li>
            <li>
              • <strong>Performance:</strong> Consider time and space complexity
              requirements
            </li>
            <li>
              • <strong>Memory leaks:</strong> Require proper memory
              deallocation
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
