import React from "react";
import { toast } from "react-toastify";
import Modal from "../ui/Modal";

interface PythonValidationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonValidationGuideModal: React.FC<
  PythonValidationGuideModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📚 Python Validation Keywords Guide"
      subtitle="Complete reference for creating comprehensive Python test cases"
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
                    Does the code follow Python conventions? Is it readable and
                    maintainable? Does it use appropriate data structures and
                    Pythonic patterns?
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
                    String Reversal Function
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> "hello" → "olleh"
                    </div>
                    <div>
                      <strong>⚠️ Edge Cases:</strong> "" → "", "a" → "a", "123"
                      → "321"
                    </div>
                    <div>
                      <strong>🚫 Error Handling:</strong> None → raise/catch,
                      123 → raise/catch
                    </div>
                    <div>
                      <strong>📊 Performance:</strong> Very long strings (1000+
                      chars)
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                  <strong className="text-blue-800 dark:text-blue-200">
                    List Sorting Function
                  </strong>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <strong>✅ Correctness:</strong> [3,1,4,1,5] → [1,1,3,4,5]
                    </div>
                    <div>
                      <strong>⚠️ Edge Cases:</strong> [], [5], [1,1,1,1]
                    </div>
                    <div>
                      <strong>🚫 Error Handling:</strong> [1,"a",3] →
                      raise/catch
                    </div>
                    <div>
                      <strong>📊 Performance:</strong> Lists with 10,000+
                      elements
                    </div>
                    <div>
                      <strong>✨ Quality:</strong> In-place vs new list,
                      stability
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
                    <strong>❌ Ignoring edge cases:</strong> Empty lists, None
                    values, very large numbers cause crashes
                  </li>
                  <li>
                    <strong>❌ No error handling tests:</strong> Invalid inputs
                    cause unhandled exceptions
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
                    <strong>❌ Magic numbers:</strong> Hardcoded values that
                    fail with different inputs
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
                      <strong>Function:</strong> <code>def add(a, b):</code> →
                      returns sum of two numbers
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
                          <strong>Input:</strong> <code>[0.1, 0.2]</code>
                          <br />
                          <strong>Output:</strong> <code>0.3</code> ✓
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
                          coercion)
                        </div>
                        <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded text-xs">
                          <strong>Input:</strong> <code>[None, 5]</code>
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
                          • <strong>Normal cases:</strong> Basic addition that
                          should work
                        </li>
                        <li>
                          • <strong>Edge cases:</strong> Zero, negatives, floats
                        </li>
                        <li>
                          • <strong>Error cases:</strong> Invalid inputs, wrong
                          types
                        </li>
                        <li>
                          • <strong>Boundary cases:</strong> Large numbers,
                          precision issues
                        </li>
                        <li>
                          • <strong>Validation:</strong> What happens with bad
                          input?
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Test Case Categories */}
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <strong className="text-blue-800 dark:text-blue-200 flex items-center gap-1">
                      ✅ Correctness Tests
                    </strong>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Verify the function produces correct results for valid
                      inputs
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <strong className="text-orange-800 dark:text-orange-200 flex items-center gap-1">
                      ⚠️ Edge Cases
                    </strong>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Test boundary conditions, empty inputs, special values
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <strong className="text-red-800 dark:text-red-200 flex items-center gap-1">
                      🚫 Error Handling
                    </strong>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Check how function handles invalid inputs and errors
                    </p>
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
                    example: "function:calculate_sum",
                  },
                  {
                    keyword: "variable:name",
                    desc: "Check for variable declaration",
                    example: "variable:result",
                  },
                  {
                    keyword: "uses:def",
                    desc: "Require function definition",
                    example: "uses:def",
                  },
                  {
                    keyword: "uses:lambda",
                    desc: "Require lambda function usage",
                    example: "uses:lambda",
                  },
                  {
                    keyword: "uses:global",
                    desc: "Check for global variable usage",
                    example: "uses:global",
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
                    keyword: "uses:try-except",
                    desc: "Require error handling",
                    example: "uses:try-except",
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

            {/* Python-Specific Features */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                🐍 Python-Specific Features
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "uses:list-comprehension",
                    desc: "Require list comprehension usage",
                    example: "uses:list-comprehension",
                  },
                  {
                    keyword: "uses:dict-comprehension",
                    desc: "Require dictionary comprehension usage",
                    example: "uses:dict-comprehension",
                  },
                  {
                    keyword: "uses:generator",
                    desc: "Require generator usage",
                    example: "uses:generator",
                  },
                  {
                    keyword: "uses:decorator",
                    desc: "Require decorator usage",
                    example: "uses:decorator",
                  },
                  {
                    keyword: "uses:context-manager",
                    desc: "Require context manager usage",
                    example: "uses:context-manager",
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

            {/* Algorithms & Complexity */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                🧮 Algorithms & Complexity
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "algorithm:sorting",
                    desc: "Require sorting algorithm",
                    example: "algorithm:sorting",
                  },
                  {
                    keyword: "algorithm:searching",
                    desc: "Require searching algorithm",
                    example: "algorithm:searching",
                  },
                  {
                    keyword: "complexity:o-n",
                    desc: "Require O(n) complexity",
                    example: "complexity:o-n",
                  },
                  {
                    keyword: "complexity:o-n2",
                    desc: "Require O(n²) complexity",
                    example: "complexity:o-n2",
                  },
                  {
                    keyword: "complexity:o-log-n",
                    desc: "Require O(log n) complexity",
                    example: "complexity:o-log-n",
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
                    keyword: "best-practice:docstrings",
                    desc: "Require function documentation",
                    example: "best-practice:docstrings",
                  },
                  {
                    keyword: "best-practice:error-handling",
                    desc: "Require error handling",
                    example: "best-practice:error-handling",
                  },
                  {
                    keyword: "avoids:eval",
                    desc: "Avoid using eval()",
                    example: "avoids:eval",
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
                    keyword: "output-type:int",
                    desc: "Require integer return type",
                    example: "output-type:int",
                  },
                  {
                    keyword: "output-type:str",
                    desc: "Require string return type",
                    example: "output-type:str",
                  },
                  {
                    keyword: "output-type:bool",
                    desc: "Require boolean return type",
                    example: "output-type:bool",
                  },
                  {
                    keyword: "output-type:list",
                    desc: "Require list return type",
                    example: "output-type:list",
                  },
                  {
                    keyword: "output-format:sorted-list",
                    desc: "Require sorted list output",
                    example: "output-format:sorted-list",
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

            {/* Edge Cases & Error Handling */}
            <details className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4">
              <summary className="font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer flex items-center gap-2">
                ⚠️ Edge Cases & Error Handling
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    keyword: "edge-case:empty-list",
                    desc: "Handle empty list inputs",
                    example: "edge-case:empty-list",
                  },
                  {
                    keyword: "edge-case:negative-numbers",
                    desc: "Handle negative number inputs",
                    example: "edge-case:negative-numbers",
                  },
                  {
                    keyword: "edge-case:large-numbers",
                    desc: "Handle very large number inputs",
                    example: "edge-case:large-numbers",
                  },
                  {
                    keyword: "edge-case:null-undefined",
                    desc: "Handle None inputs",
                    example: "edge-case:null-undefined",
                  },
                  {
                    keyword: "performance:efficient-loops",
                    desc: "Require efficient loop patterns",
                    example: "performance:efficient-loops",
                  },
                  {
                    keyword: "valid-python",
                    desc: "Require valid Python syntax",
                    example: "valid-python",
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
            Complete Guide to Python Test Case Validation
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
                  <code>function:calculate_sum</code>
                </li>
                <li>
                  • <strong>Multiple validations:</strong>{" "}
                  <code>
                    function:calculate_sum;uses:for-loop;input-validation:type-check
                  </code>
                </li>
                <li>
                  • <strong>Expected output:</strong>{" "}
                  <code>Python validation passed</code>
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
                  functions, variables, and Python syntax
                </li>
                <li>
                  • <strong>Control Flow:</strong> Validate loops, conditionals,
                  and recursion usage
                </li>
                <li>
                  • <strong>Input/Output:</strong> Ensure proper input
                  validation and output formatting
                </li>
                <li>
                  • <strong>Python Features:</strong> Check list comprehensions,
                  generators, decorators
                </li>
                <li>
                  • <strong>Algorithms:</strong> Validate algorithmic approaches
                  and time complexity
                </li>
                <li>
                  • <strong>Best Practices:</strong> Enforce PEP 8, docstrings,
                  error handling
                </li>
                <li>
                  • <strong>Edge Cases:</strong> Test handling of empty inputs,
                  None values, large data
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
                  • <strong>Layer complexity:</strong> Add input validation,
                  then algorithmic requirements
                </li>
                <li>
                  • <strong>Test edge cases:</strong> Always include empty
                  lists, None values, large inputs
                </li>
                <li>
                  • <strong>Performance matters:</strong> Specify complexity
                  requirements for efficiency
                </li>
                <li>
                  • <strong>Pythonic code:</strong> Include validations for list
                  comprehensions, generators
                </li>
                <li>
                  • <strong>Best practices:</strong> Require docstrings and
                  proper error handling
                </li>
                <li>
                  • <strong>Combine validations:</strong> Use multiple keywords
                  for comprehensive testing
                </li>
              </ul>
            </div>

            <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <strong>Note:</strong> Python validation keywords only work when
              Python language is selected. For execution-based testing, use the
              standard input/output format without validation keywords.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
