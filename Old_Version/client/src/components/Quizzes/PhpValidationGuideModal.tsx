import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface PhpValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhpValidationGuideModal: React.FC<
  PhpValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📚 PHP Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive PHP test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl border border-purple-200 dark:border-purple-700 p-6">
          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                🏗️ The 5 Pillars of Effective Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    1. Correctness Testing
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Verify the function produces correct results for valid,
                    expected inputs. This is the foundation - your code must
                    work for normal cases.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    2. Edge Cases & Boundaries
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Test the "edges" of your function: empty inputs, zero
                    values, maximum/minimum values, boundary conditions that
                    might cause issues.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    3. Security & Input Validation
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    PHP is web-facing, so security is critical. Test for SQL
                    injection, XSS, and proper input sanitization.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    4. Performance & Efficiency
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    For algorithms, test with large inputs. Does the solution
                    scale? Are there more efficient approaches available?
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    5. Code Quality & Best Practices
                  </strong>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Does the code follow PHP conventions? Is it readable and
                    maintainable? Does it use appropriate security practices?
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                🌍 Real-World Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    User Authentication Function
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Valid credentials → login
                      success
                    </div>
                    <div>
                      <strong>🛡️ Security:</strong> SQL injection attempts →
                      blocked
                    </div>
                    <div>
                      <strong>🚫 Error Handling:</strong> Invalid credentials →
                      proper error message
                    </div>
                    <div>
                      <strong>📊 Performance:</strong> Multiple login attempts →
                      rate limiting
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-purple-800 dark:text-purple-200">
                    Form Data Processor
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> Valid form data →
                      processed successfully
                    </div>
                    <div>
                      <strong>⚠️ Edge Cases:</strong> Empty fields, special
                      characters → handled gracefully
                    </div>
                    <div>
                      <strong>🛡️ Security:</strong> XSS attempts → sanitized
                    </div>
                    <div>
                      <strong>🚫 Error Handling:</strong> Database errors →
                      user-friendly messages
                    </div>
                    <div>
                      <strong>✨ Quality:</strong> Input validation, prepared
                      statements
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Testing Mistakes */}
            <div>
              <h6 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                🚨 Common Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Only testing "happy path":</strong> Code works
                    for perfect inputs but fails with real-world data
                  </li>
                  <li>
                    <strong>❌ Ignoring security:</strong> No protection against
                    SQL injection, XSS, CSRF
                  </li>
                  <li>
                    <strong>❌ No input validation:</strong> Malformed data
                    causes crashes or unexpected behavior
                  </li>
                  <li>
                    <strong>❌ Performance not considered:</strong> Solution
                    works for small datasets but fails with large inputs
                  </li>
                  <li>
                    <strong>❌ Type assumptions:</strong> Function assumes
                    inputs are always correct type
                  </li>
                  <li>
                    <strong>❌ Magic quotes:</strong> Relying on deprecated
                    magic quotes for security
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-4 flex items-center gap-2">
            <span className="text-lg">📋</span>
            Step-by-Step Guide to Creating Test Cases
          </h5>

          <div className="space-y-4">
            {/* Step 1: Understand Input/Output Format */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
              <h6 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Understand Input/Output Format & Test Case Design
              </h6>
              <div className="space-y-3 text-sm">
                {/* Basic Function Example */}
                <div className="bg-white/50 dark:bg-gray-700/50 p-3 rounded">
                  <strong className="text-green-800 dark:text-green-200 text-base mb-2 block">
                    📊 Example: Calculate Sum Function
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Function:</strong>{" "}
                      <code>function calculateSum($numbers)</code> → returns sum
                      of array elements
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[1, 2, 3, 4, 5]</code>
                          <br />
                          <strong>Output:</strong> <code>15</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[]</code>
                          <br />
                          <strong>Output:</strong> <code>0</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>["1", "2", "3"]</code>
                          <br />
                          <strong>Output:</strong> <code>6</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>null</code>
                          <br />
                          <strong>Output:</strong> <code>0</code> ✓
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        ❌ INCORRECT Test Cases (Common Mistakes):
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[1, 2, 3]</code>
                          <br />
                          <strong>Output:</strong> <code>6</code> ✗ (should be
                          6, but test expects wrong output)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>"not an array"</code>
                          <br />
                          <strong>Output:</strong> <code>0</code> ✗ (no input
                          validation)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[1, "a", 3]</code>
                          <br />
                          <strong>Output:</strong> <code>4</code> ✗ (type
                          coercion issues)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[]</code>
                          <br />
                          <strong>Output:</strong> <code>NULL</code> ✗ (should
                          handle empty arrays)
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <strong className="text-blue-800 dark:text-blue-200">
                        🎯 Test Case Strategy:
                      </strong>
                      <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>
                          • <strong>Normal cases:</strong> Valid arrays with
                          numbers
                        </li>
                        <li>
                          • <strong>Edge cases:</strong> Empty arrays, null
                          values, type coercion
                        </li>
                        <li>
                          • <strong>Security cases:</strong> Malformed input,
                          injection attempts
                        </li>
                        <li>
                          • <strong>Error cases:</strong> Invalid inputs,
                          unexpected types
                        </li>
                        <li>
                          • <strong>Boundary cases:</strong> Large arrays,
                          floating point precision
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Keywords Reference */}
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4">
          <h5 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-4 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            Complete Validation Keywords Reference
          </h5>

          <div className="space-y-4">
            {/* Functions & Variables */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                🔧 Functions & Variables
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "function:name",
                    desc: "Check for specific function name",
                    example: "function:calculateSum",
                  },
                  {
                    keyword: "variable:name",
                    desc: "Check for variable declaration",
                    example: "variable:$result",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-yellow-800 dark:text-yellow-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Control Flow & Loops */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                🔄 Control Flow & Loops
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:for-loop",
                    desc: "Require for loop usage",
                    example: "uses:for-loop",
                  },
                  {
                    keyword: "uses:foreach-loop",
                    desc: "Require foreach loop usage",
                    example: "uses:foreach-loop",
                  },
                  {
                    keyword: "uses:if-statement",
                    desc: "Require if statement",
                    example: "uses:if-statement",
                  },
                  {
                    keyword: "uses:recursion",
                    desc: "Require recursive implementation",
                    example: "uses:recursion",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-yellow-800 dark:text-yellow-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Web & Security Features */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                🌐 Web & Security Features
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:superglobals",
                    desc: "Require $_GET, $_POST, $_SESSION usage",
                    example: "uses:superglobals",
                  },
                  {
                    keyword: "uses:database",
                    desc: "Require mysqli or PDO usage",
                    example: "uses:database",
                  },
                  {
                    keyword: "uses:file-functions",
                    desc: "Require file operation functions",
                    example: "uses:file-functions",
                  },
                  {
                    keyword: "input-validation:sanitization",
                    desc: "Require input sanitization",
                    example: "input-validation:sanitization",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-yellow-800 dark:text-yellow-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Best Practices & Quality */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                ✨ Best Practices & Security
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "best-practice:descriptive-names",
                    desc: "Require descriptive variable names",
                    example: "best-practice:descriptive-names",
                  },
                  {
                    keyword: "best-practice:security",
                    desc: "Require security best practices",
                    example: "best-practice:security",
                  },
                  {
                    keyword: "best-practice:error-handling",
                    desc: "Require error handling",
                    example: "best-practice:error-handling",
                  },
                  {
                    keyword: "avoids:sql-injection",
                    desc: "Prevent SQL injection attacks",
                    example: "avoids:sql-injection",
                  },
                  {
                    keyword: "avoids:global-variables",
                    desc: "Avoid global variable pollution",
                    example: "avoids:global-variables",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-yellow-800 dark:text-yellow-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>

            {/* Input/Output Validation */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                🔍 Input/Output Validation
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "input-validation:type-check",
                    desc: "Validate input parameter types",
                    example: "input-validation:type-check",
                  },
                  {
                    keyword: "output-type:string",
                    desc: "Require string return type",
                    example: "output-type:string",
                  },
                  {
                    keyword: "output-type:array",
                    desc: "Require array return type",
                    example: "output-type:array",
                  },
                  {
                    keyword: "output-format:json",
                    desc: "Require JSON output format",
                    example: "output-format:json",
                  },
                ].map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-700/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <code className="font-mono text-sm bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-yellow-800 dark:text-yellow-200">
                        {item.keyword}
                      </code>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.keyword);
                        toast.success(`Copied: ${item.keyword}`, {
                          autoClose: 1000,
                        });
                      }}
                      className="ml-3 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="bg-yellow-100/50 dark:bg-yellow-900/30 rounded-xl border border-yellow-200 dark:border-yellow-700 p-4">
          <h5 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-3 flex items-center gap-2">
            <span className="text-sm">📖</span>
            Complete Guide to PHP Test Case Validation
          </h5>

          <div className="space-y-4">
            {/* Basic Usage */}
            <div>
              <h6 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                🔧 Basic Usage
              </h6>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 ml-4">
                <li>
                  • <strong>Single validation:</strong>{" "}
                  <code>function:calculateSum</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    function:calculateSum;uses:foreach-loop;input-validation:sanitization
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>PHP validation passed</code>
                </li>
              </ul>
            </div>

            {/* Validation Categories */}
            <div>
              <h6 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                📋 Validation Categories
              </h6>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 ml-4">
                <li>
                  • <strong>Functions & Variables:</strong> Check for specific
                  functions, variables, and PHP syntax
                </li>
                <li>
                  • <strong>Control Flow:</strong> Validate loops, conditionals,
                  and recursion usage
                </li>
                <li>
                  • <strong>Web Features:</strong> Ensure proper use of
                  superglobals, sessions, and form handling
                </li>
                <li>
                  • <strong>Database:</strong> Validate secure database
                  operations and query building
                </li>
                <li>
                  • <strong>Security:</strong> Check for input sanitization, SQL
                  injection prevention, XSS protection
                </li>
                <li>
                  • <strong>File Operations:</strong> Validate file
                  upload/download and directory operations
                </li>
                <li>
                  • <strong>Best Practices:</strong> Enforce PHP conventions,
                  error handling, and performance patterns
                </li>
              </ul>
            </div>

            {/* Tips for Instructors */}
            <div>
              <h6 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                💡 Tips for Creating Effective Test Cases
              </h6>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 ml-4">
                <li>
                  • <strong>Start simple:</strong> Begin with basic function and
                  variable validations
                </li>
                <li>
                  • <strong>Security first:</strong> Always include input
                  validation and sanitization checks
                </li>
                <li>
                  • <strong>Web context:</strong> Consider $_GET, $_POST, and
                  session handling
                </li>
                <li>
                  • <strong>Database safety:</strong> Require prepared
                  statements and proper escaping
                </li>
                <li>
                  • <strong>Error handling:</strong> Include proper exception
                  handling and user feedback
                </li>
                <li>
                  • <strong>Performance matters:</strong> Test with different
                  data sizes and loads
                </li>
                <li>
                  • <strong>Combine validations:</strong> Use multiple keywords
                  for comprehensive testing
                </li>
              </ul>
            </div>

            <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <strong>Note:</strong> PHP validation keywords only work when PHP
              language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
