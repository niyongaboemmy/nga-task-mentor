import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedPythonTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface PythonTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedPythonTestCase) => void;
}

export const PythonTestCaseBuilderModal: React.FC<
  PythonTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [functionName, setFunctionName] = useState("");
  const [returnType, setReturnType] = useState("any");
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

    // Validate Python function name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
      toast.error(
        "Function name must be a valid Python identifier (letters, numbers, underscores, cannot start with number)"
      );
      return;
    }

    const rules = [`function:${functionName}`];
    if (returnType !== "any") rules.push(`output-type:${returnType}`);
    rules.push(...validationRules);

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("Test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedPythonTestCase = {
        id: Date.now().toString(),
        input:
          inputExample.trim() ||
          `# TODO: Provide input for ${functionName} based on: ${testCaseDescriptor}`,
        expected_output: outputExample.trim() || "Python validation passed",
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
      title="🐍 Python Test Case Builder"
      subtitle="Create comprehensive test cases for Python functions"
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
                  title="Enter the Python function name you want to test"
                >
                  💡
                </span>
              </label>
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="e.g., calculate_sum, is_palindrome, sort_array"
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                title="Function name should follow Python naming conventions (snake_case)"
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
                <option value="any">Any Type</option>
                <option value="int">Integer</option>
                <option value="float">Float</option>
                <option value="str">String</option>
                <option value="bool">Boolean</option>
                <option value="list">List</option>
                <option value="dict">Dictionary</option>
                <option value="tuple">Tuple</option>
                <option value="set">Set</option>
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
                placeholder='e.g., [1, 2, 3] or "hello"'
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
                placeholder="e.g., 6 or True"
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
                key: "input-validation:null-undefined",
                label: "Handle None/Empty Inputs",
                desc: "Check for None and empty inputs",
              },
              {
                key: "edge-case:empty-list",
                label: "Handle Empty Lists",
                desc: "Test with empty list inputs",
              },
              {
                key: "edge-case:empty-string",
                label: "Handle Empty Strings",
                desc: "Test with empty string inputs",
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
                key: "edge-case:special-characters",
                label: "Handle Special Characters",
                desc: "Test with special characters in strings",
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
                key: "uses:list-comprehension",
                label: "Use List Comprehension",
                desc: "Require list comprehension usage",
              },
              {
                key: "uses:dict-comprehension",
                label: "Use Dictionary Comprehension",
                desc: "Require dictionary comprehension usage",
              },
              {
                key: "uses:lambda",
                label: "Use Lambda Functions",
                desc: "Require lambda function usage",
              },
              {
                key: "uses:recursion",
                label: "Use Recursion",
                desc: "Require recursive implementation",
              },
              {
                key: "uses:try-except",
                label: "Error Handling",
                desc: "Require try-except blocks",
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
                key: "algorithm:two-pointers",
                label: "Two Pointers Technique",
                desc: "Require two pointers algorithm pattern",
              },
              {
                key: "algorithm:sliding-window",
                label: "Sliding Window Technique",
                desc: "Require sliding window algorithm pattern",
              },
              {
                key: "algorithm:hash-table",
                label: "Hash Table Usage",
                desc: "Require dictionary (hash table) usage",
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
                key: "best-practice:docstrings",
                label: "Use Docstrings",
                desc: "Require function documentation",
              },
              {
                key: "performance:efficient-loops",
                label: "Efficient Loop Patterns",
                desc: "Require optimized loop implementations",
              },
              {
                key: "performance:early-return",
                label: "Early Return Optimization",
                desc: "Use early returns for performance",
              },
              {
                key: "avoids:eval",
                label: "Avoid eval()",
                desc: "Prohibit use of eval() function",
              },
              {
                key: "avoids:global-variables",
                label: "Avoid Global Variables",
                desc: "Prevent global variable pollution",
              },
              {
                key: "output-format:sorted-list",
                label: "Return Sorted List",
                desc: "Require sorted list output",
              },
              {
                key: "output-format:unique-list",
                label: "Return Unique Elements",
                desc: "Require list with unique elements",
              },
              {
                key: "output-format:dict-properties",
                label: "Return Dictionary with Keys",
                desc: "Require dictionary output with specific keys",
              },
              {
                key: "valid-python",
                label: "Valid Python Syntax",
                desc: "Require syntactically correct Python",
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
            Quick Tips for Python Test Cases
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              • <strong>Function naming:</strong> Use snake_case (e.g.,
              calculate_sum, not calculateSum)
            </li>
            <li>
              • <strong>Type hints:</strong> Consider requiring type hints for
              better code quality
            </li>
            <li>
              • <strong>List comprehensions:</strong> Test for Pythonic
              list/dict comprehensions
            </li>
            <li>
              • <strong>Edge cases:</strong> Always test with empty lists, None
              values, and large inputs
            </li>
            <li>
              • <strong>Error handling:</strong> Include try-except validation
              for robust code
            </li>
            <li>
              • <strong>Performance:</strong> Consider time complexity
              requirements for algorithms
            </li>
            <li>
              • <strong>Docstrings:</strong> Require proper documentation for
              functions
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
