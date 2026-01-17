import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface CValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CValidationGuideModal: React.FC<CValidationGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📚 C Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive C test cases"
      size="full"
    >
      <div className="space-y-6">
        {/* Comprehensive Test Case Design Guide */}
        <div className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-700 p-6">
          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            Comprehensive Test Case Design Principles
          </h5>

          <div className="space-y-4">
            {/* The 5 Pillars of Test Case Design */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🏗️ The 5 Pillars of Effective Test Cases
              </h6>
              <div className="grid gap-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    1. Correctness Testing
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Verify the function produces correct results for valid,
                    expected inputs. This is the foundation - your code must
                    work for normal cases.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    2. Edge Cases & Boundaries
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Test the "edges" of your function: empty inputs, zero
                    values, maximum/minimum values, boundary conditions that
                    might cause issues.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    3. Error Handling & Robustness
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    How does your function behave with invalid inputs? Does it
                    handle errors gracefully or crash? Good code anticipates and
                    handles unexpected inputs.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    4. Performance & Efficiency
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    For algorithms, test with large inputs. Does the solution
                    scale? Are there more efficient approaches available?
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    5. Code Quality & Best Practices
                  </strong>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Does the code follow C conventions? Is it readable and
                    maintainable? Does it use appropriate data structures and
                    memory management?
                  </p>
                </div>
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🌍 Real-World Test Case Examples
              </h6>
              <div className="space-y-3">
                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    Array Sum Function
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> [1,2,3,4,5] → 15
                    </div>
                    <div>
                      <strong>⚠️ Edge Cases:</strong> [] → 0, [0] → 0, NULL →
                      error
                    </div>
                    <div>
                      <strong>🚫 Error Handling:</strong> NULL pointer → return
                      -1
                    </div>
                    <div>
                      <strong>📊 Performance:</strong> Arrays with 10,000+
                      elements
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    String Copy Function
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> "hello" → "hello"
                    </div>
                    <div>
                      <strong>⚠️ Edge Cases:</strong> "" → "", NULL → error
                    </div>
                    <div>
                      <strong>🚫 Error Handling:</strong> Insufficient memory →
                      NULL
                    </div>
                    <div>
                      <strong>📊 Performance:</strong> Very long strings (1000+
                      chars)
                    </div>
                    <div>
                      <strong>✨ Quality:</strong> Proper NULL termination,
                      memory management
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Testing Mistakes */}
            <div>
              <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🚨 Common Test Case Mistakes to Avoid
              </h6>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <li>
                    <strong>❌ Only testing "happy path":</strong> Code works
                    for perfect inputs but fails with real-world data
                  </li>
                  <li>
                    <strong>❌ Ignoring NULL pointers:</strong> NULL inputs
                    cause segmentation faults
                  </li>
                  <li>
                    <strong>❌ No memory leak tests:</strong> Functions allocate
                    but don't free memory
                  </li>
                  <li>
                    <strong>❌ Performance not considered:</strong> Solution
                    works for small inputs but fails with large datasets
                  </li>
                  <li>
                    <strong>❌ Type assumptions:</strong> Function assumes
                    inputs are always correct type
                  </li>
                  <li>
                    <strong>❌ Buffer overflows:</strong> No bounds checking on
                    arrays and strings
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
                    📊 Example: Add Two Numbers Function
                  </strong>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <strong>Function:</strong>{" "}
                      <code>int add(int a, int b)</code> → returns sum of two
                      integers
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        ✅ CORRECT Test Cases:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[2, 3]</code>
                          <br />
                          <strong>Output:</strong> <code>5</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[0, 5]</code>
                          <br />
                          <strong>Output:</strong> <code>5</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[-2, 3]</code>
                          <br />
                          <strong>Output:</strong> <code>1</code> ✓
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[2147483647, 1]</code>
                          <br />
                          <strong>Output:</strong> <code>Integer overflow</code>{" "}
                          ✓
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        ❌ INCORRECT Test Cases (Common Mistakes):
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[2, 2]</code>
                          <br />
                          <strong>Output:</strong> <code>5</code> ✗ (should be
                          4)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>["2", 3]</code>
                          <br />
                          <strong>Output:</strong> <code>5</code> ✗ (type
                          mismatch)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[NULL, 5]</code>
                          <br />
                          <strong>Output:</strong> <code>5</code> ✗ (no
                          validation)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[]</code>
                          <br />
                          <strong>Output:</strong> <code>0</code> ✗ (missing
                          parameters)
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <strong className="text-blue-800 dark:text-blue-200">
                        🎯 Test Case Strategy:
                      </strong>
                      <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>
                          • <strong>Normal cases:</strong> Basic operations that
                          should work
                        </li>
                        <li>
                          • <strong>Edge cases:</strong> Zero, negatives,
                          maximum values
                        </li>
                        <li>
                          • <strong>Error cases:</strong> NULL pointers, invalid
                          inputs
                        </li>
                        <li>
                          • <strong>Boundary cases:</strong> INT_MAX, INT_MIN,
                          overflow conditions
                        </li>
                        <li>
                          • <strong>Memory cases:</strong> Allocation failures,
                          buffer overflows
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
                    example: "function:addNumbers",
                  },
                  {
                    keyword: "variable:name",
                    desc: "Check for variable declaration",
                    example: "variable:result",
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
                    keyword: "uses:while-loop",
                    desc: "Require while loop usage",
                    example: "uses:while-loop",
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

            {/* Memory Management & Pointers */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                🧠 Memory Management & Pointers
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:pointers",
                    desc: "Require pointer usage",
                    example: "uses:pointers",
                  },
                  {
                    keyword: "uses:malloc",
                    desc: "Require dynamic memory allocation",
                    example: "uses:malloc",
                  },
                  {
                    keyword: "uses:arrays",
                    desc: "Require array manipulation",
                    example: "uses:arrays",
                  },
                  {
                    keyword: "uses:strings",
                    desc: "Require string manipulation",
                    example: "uses:strings",
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
                ✨ Best Practices & Quality
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "best-practice:descriptive-names",
                    desc: "Require descriptive variable names",
                    example: "best-practice:descriptive-names",
                  },
                  {
                    keyword: "best-practice:memory-management",
                    desc: "Require proper memory management",
                    example: "best-practice:memory-management",
                  },
                  {
                    keyword: "best-practice:error-handling",
                    desc: "Require error handling",
                    example: "best-practice:error-handling",
                  },
                  {
                    keyword: "avoids:memory-leaks",
                    desc: "Avoid memory leaks",
                    example: "avoids:memory-leaks",
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
                    keyword: "input-validation:null-check",
                    desc: "Check for NULL pointer inputs",
                    example: "input-validation:null-check",
                  },
                  {
                    keyword: "output-type:int",
                    desc: "Require int return type",
                    example: "output-type:int",
                  },
                  {
                    keyword: "output-type:char*",
                    desc: "Require char* return type",
                    example: "output-type:char*",
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
            Complete Guide to C Test Case Validation
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
                    function:calculateSum;uses:for-loop;input-validation:null-check
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>C validation passed</code>
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
                  functions, variables, and C syntax
                </li>
                <li>
                  • <strong>Control Flow:</strong> Validate loops, conditionals,
                  and recursion usage
                </li>
                <li>
                  • <strong>Memory Management:</strong> Ensure proper
                  malloc/free, pointer usage, and NULL checks
                </li>
                <li>
                  • <strong>Data Structures:</strong> Check arrays, strings, and
                  pointer manipulation
                </li>
                <li>
                  • <strong>Algorithms:</strong> Validate algorithmic approaches
                  and time complexity
                </li>
                <li>
                  • <strong>Best Practices:</strong> Enforce C conventions,
                  memory safety, and error handling
                </li>
                <li>
                  • <strong>Edge Cases:</strong> Test handling of NULL pointers,
                  empty arrays, and boundary conditions
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
                  • <strong>Memory safety:</strong> Always include NULL pointer
                  and memory leak validations
                </li>
                <li>
                  • <strong>Edge cases:</strong> Test with empty arrays, NULL
                  inputs, and boundary values
                </li>
                <li>
                  • <strong>Performance matters:</strong> Specify complexity
                  requirements for efficiency
                </li>
                <li>
                  • <strong>Pointer arithmetic:</strong> Validate proper pointer
                  usage and array bounds
                </li>
                <li>
                  • <strong>Error handling:</strong> Require proper return
                  values for error conditions
                </li>
                <li>
                  • <strong>Combine validations:</strong> Use multiple keywords
                  for comprehensive testing
                </li>
              </ul>
            </div>

            <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <strong>Note:</strong> C validation keywords only work when C
              language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
