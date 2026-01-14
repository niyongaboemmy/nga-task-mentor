import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedJavaScriptTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface JavaScriptTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedJavaScriptTestCase) => void;
}

export const JavaScriptTestCaseBuilderModal: React.FC<
  JavaScriptTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [functionName, setFunctionName] = useState("");
  const [returnType, setReturnType] = useState("number");
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

    const rules = [`function:${functionName}`];
    if (returnType) rules.push(`output-type:${returnType}`);
    rules.push(...validationRules);

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("Test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedJavaScriptTestCase = {
        id: Date.now().toString(),
        input:
          inputExample.trim() ||
          `// TODO: Provide input for ${functionName} based on: ${testCaseDescriptor}`,
        expected_output: outputExample.trim() || "JavaScript validation passed",
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
      title="🛠️ JavaScript Test Case Builder"
      subtitle="Create comprehensive test cases for JavaScript functions"
      size="xl"
    >
      <div className="space-y-6">
        {/* Function Details */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔧</span>
            Function Details
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Function Name
              </label>
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="e.g., isEven, sumArray, reverseString"
                className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Return Type
              </label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="number">Number</option>
                <option value="string">String</option>
                <option value="boolean">Boolean</option>
                <option value="array">Array</option>
                <option value="object">Object</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Input Example
              </label>
              <input
                type="text"
                value={inputExample}
                onChange={(e) => setInputExample(e.target.value)}
                placeholder='e.g., [1, 2, 3] or "hello"'
                className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Output Example
              </label>
              <input
                type="text"
                value={outputExample}
                onChange={(e) => setOutputExample(e.target.value)}
                placeholder="e.g., 6 or true"
                className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-4 flex items-center gap-2">
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
                label: "Handle Null/Undefined",
                desc: "Check for null and undefined inputs",
              },
              {
                key: "edge-case:empty-array",
                label: "Handle Empty Arrays",
                desc: "Test with empty array inputs",
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
                key: "uses:array-method",
                label: "Use Array Methods",
                desc: "Require array method usage (map, filter, etc.)",
              },
              {
                key: "uses:string-method",
                label: "Use String Methods",
                desc: "Require string method usage",
              },
              {
                key: "uses:math-functions",
                label: "Use Math Library",
                desc: "Require Math object methods",
              },
              {
                key: "uses:recursion",
                label: "Use Recursion",
                desc: "Require recursive implementation",
              },
              {
                key: "uses:try-catch",
                label: "Error Handling",
                desc: "Require try-catch blocks",
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
                desc: "Require hash table (object/Map) usage",
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
                key: "best-practice:const-over-var",
                label: "Use const over var",
                desc: "Enforce modern variable declarations",
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
                key: "output-format:sorted-array",
                label: "Return Sorted Array",
                desc: "Require sorted array output",
              },
              {
                key: "output-format:unique-array",
                label: "Return Unique Elements",
                desc: "Require array with unique elements",
              },
              {
                key: "output-format:object-properties",
                label: "Return Object with Properties",
                desc: "Require object output with specific properties",
              },
              {
                key: "valid-js",
                label: "Valid JavaScript Syntax",
                desc: "Require syntactically correct JavaScript",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-yellow-200 dark:border-yellow-700 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-yellow-600 focus:ring-yellow-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-yellow-900 dark:text-yellow-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
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
            Quick Tips
          </h6>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Start with basic function validation, then add complexity</li>
            <li>• Always include edge cases for robust testing</li>
            <li>
              • Combine multiple validation rules for comprehensive testing
            </li>
            <li>• Test both expected behavior and error handling</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
