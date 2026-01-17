import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface GeneratedPhpTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface PhpTestCaseBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCaseGenerated?: (testCase: GeneratedPhpTestCase) => void;
}

export const PhpTestCaseBuilderModal: React.FC<
  PhpTestCaseBuilderModalProps
> = ({ isOpen, onClose, onTestCaseGenerated }) => {
  const [functionName, setFunctionName] = useState("");
  const [returnType, setReturnType] = useState("mixed");
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

    // Validate PHP function name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
      toast.error(
        "Function name must be a valid PHP identifier (letters, numbers, underscores, cannot start with number)"
      );
      return;
    }

    const rules = [`function:${functionName}`];
    if (returnType !== "mixed") rules.push(`output-type:${returnType}`);
    rules.push(...validationRules);

    const testCaseDescriptor = rules.join(";");

    navigator.clipboard.writeText(testCaseDescriptor);
    toast.success("Test case copied to clipboard!", { autoClose: 2000 });

    if (onTestCaseGenerated) {
      const generated: GeneratedPhpTestCase = {
        id: Date.now().toString(),
        input:
          inputExample.trim() ||
          `// TODO: Provide input for ${functionName} based on: ${testCaseDescriptor}`,
        expected_output: outputExample.trim() || "PHP validation passed",
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
      title="🐘 PHP Test Case Builder"
      subtitle="Create comprehensive test cases for PHP functions"
      size="xl"
    >
      <div className="space-y-6">
        {/* Function Details */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔧</span>
            Function Details
          </h5>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                Function Name
                <span
                  className="text-xs text-purple-600 dark:text-purple-400 ml-2"
                  title="Enter the PHP function name you want to test"
                >
                  💡
                </span>
              </label>
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="e.g., calculateSum, validateEmail, processForm"
                className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                title="Function name should follow PHP naming conventions"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                Return Type
              </label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="mixed">Mixed</option>
                <option value="int">Integer</option>
                <option value="float">Float</option>
                <option value="string">String</option>
                <option value="bool">Boolean</option>
                <option value="array">Array</option>
                <option value="object">Object</option>
                <option value="null">Null</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                Input Example
              </label>
              <input
                type="text"
                value={inputExample}
                onChange={(e) => setInputExample(e.target.value)}
                placeholder='e.g., $numbers = [1, 2, 3]; $email = "test@example.com";'
                className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                Output Example
              </label>
              <input
                type="text"
                value={outputExample}
                onChange={(e) => setOutputExample(e.target.value)}
                placeholder="e.g., 6 or true"
                className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Validation Requirements */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
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
                key: "input-validation:sanitization",
                label: "Input Sanitization",
                desc: "Require input sanitization for security",
              },
              {
                key: "input-validation:validation",
                label: "Input Validation",
                desc: "Require proper input validation",
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
                key: "edge-case:null-values",
                label: "Handle Null Values",
                desc: "Test with null input values",
              },
              {
                key: "uses:for-loop",
                label: "Use For Loop",
                desc: "Require for loop implementation",
              },
              {
                key: "uses:foreach-loop",
                label: "Use Foreach Loop",
                desc: "Require foreach loop implementation",
              },
              {
                key: "uses:array-functions",
                label: "Use Array Functions",
                desc: "Require array function usage (array_push, in_array, etc.)",
              },
              {
                key: "uses:string-functions",
                label: "Use String Functions",
                desc: "Require string function usage (strlen, strpos, etc.)",
              },
              {
                key: "uses: superglobals",
                label: "Use Superglobals",
                desc: "Require $_GET, $_POST, $_SESSION usage",
              },
              {
                key: "uses:database",
                label: "Use Database Functions",
                desc: "Require mysqli or PDO usage",
              },
              {
                key: "uses:file-functions",
                label: "Use File Functions",
                desc: "Require file operation functions",
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
                key: "best-practice:security",
                label: "Security Best Practices",
                desc: "Require SQL injection prevention, XSS protection",
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
                key: "avoids:sql-injection",
                label: "Prevent SQL Injection",
                desc: "Require prepared statements or escaping",
              },
              {
                key: "output-format:json",
                label: "Return JSON Output",
                desc: "Require JSON encoded output",
              },
              {
                key: "output-format:html",
                label: "Return HTML Output",
                desc: "Require HTML formatted output",
              },
              {
                key: "valid-php",
                label: "Valid PHP Syntax",
                desc: "Require syntactically correct PHP",
              },
            ].map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={validationRules.includes(rule.key)}
                  onChange={() => handleValidationToggle(rule.key)}
                  className="mt-1 text-purple-600 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-purple-900 dark:text-purple-100">
                    {rule.label}
                  </div>
                  <div className="text-sm text-purple-700 dark:text-purple-300">
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
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
            <span className="text-sm">💡</span>
            Quick Tips for PHP Test Cases
          </h6>
          <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
            <li>
              • <strong>Function naming:</strong> Use camelCase or snake_case
              (e.g., calculateSum)
            </li>
            <li>
              • <strong>Security:</strong> Always include input sanitization and
              validation
            </li>
            <li>
              • <strong>Superglobals:</strong> Test with $_GET, $_POST,
              $_SESSION for web applications
            </li>
            <li>
              • <strong>Database:</strong> Include mysqli_prepare() or PDO for
              secure database operations
            </li>
            <li>
              • <strong>Arrays:</strong> Test with different array operations
              and edge cases
            </li>
            <li>
              • <strong>Error handling:</strong> Include try-catch and proper
              error responses
            </li>
            <li>
              • <strong>Output:</strong> Consider JSON vs HTML output formats
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
