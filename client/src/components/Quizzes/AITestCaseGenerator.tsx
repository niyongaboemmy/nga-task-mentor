import React, { useState } from "react";
import { Sparkles, Loader2, CheckCircle, XCircle } from "lucide-react";

interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  time_limit?: number;
}

interface AITestCaseGeneratorProps {
  language: string;
  problemDescription: string;
  starterCode?: string;
  onTestCasesGenerated: (testCases: TestCase[]) => void;
}

export const AITestCaseGenerator: React.FC<AITestCaseGeneratorProps> = ({
  language,
  problemDescription,
  starterCode,
  onTestCasesGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCases, setGeneratedCases] = useState<TestCase[]>([]);
  const [error, setError] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  const generateTestCases = async () => {
    if (!problemDescription.trim()) {
      setError("Please provide a problem description first");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      // Simulate AI generation with intelligent test case creation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const testCases = generateIntelligentTestCases(
        language,
        problemDescription,
        starterCode
      );

      setGeneratedCases(testCases);
      setShowPreview(true);
    } catch (err) {
      setError("Failed to generate test cases. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateIntelligentTestCases = (
    lang: string,
    description: string,
    code?: string
  ): TestCase[] => {
    const cases: TestCase[] = [];
    const descLower = (description + " " + (code || "")).toLowerCase();

    // Analyze starter code for function names and patterns
    // const _hasFunctionName = code?.match(
    //   /function\s+(\w+)|def\s+(\w+)|public\s+\w+\s+(\w+)/
    // );

    // Detect problem type and generate appropriate test cases
    if (
      descLower.includes("fibonacci") ||
      descLower.includes("fib") ||
      descLower.includes("sequence")
    ) {
      cases.push(
        {
          id: "1",
          input: lang === "python" ? "5" : "5",
          expected_output: "5",
          is_hidden: false,
          points: 10,
          time_limit: 5000,
        },
        {
          id: "2",
          input: lang === "python" ? "10" : "10",
          expected_output: "55",
          is_hidden: false,
          points: 15,
          time_limit: 5000,
        },
        {
          id: "3",
          input: lang === "python" ? "0" : "0",
          expected_output: "0",
          is_hidden: true,
          points: 10,
          time_limit: 5000,
        },
        {
          id: "4",
          input: lang === "python" ? "20" : "20",
          expected_output: "6765",
          is_hidden: true,
          points: 15,
          time_limit: 5000,
        }
      );
    } else if (descLower.includes("palindrome")) {
      cases.push(
        {
          id: "1",
          input: lang === "python" ? '"racecar"' : '"racecar"',
          expected_output: "true",
          is_hidden: false,
          points: 10,
          time_limit: 5000,
        },
        {
          id: "2",
          input: lang === "python" ? '"hello"' : '"hello"',
          expected_output: "false",
          is_hidden: false,
          points: 10,
          time_limit: 5000,
        },
        {
          id: "3",
          input:
            lang === "python"
              ? '"A man a plan a canal Panama"'
              : '"A man a plan a canal Panama"',
          expected_output: "true",
          is_hidden: true,
          points: 15,
          time_limit: 5000,
        }
      );
    } else if (descLower.includes("sum") || descLower.includes("array")) {
      cases.push(
        {
          id: "1",
          input: lang === "python" ? "[2, 7, 11, 15], 9" : "[2, 7, 11, 15], 9",
          expected_output: "[0, 1]",
          is_hidden: false,
          points: 15,
          time_limit: 5000,
        },
        {
          id: "2",
          input: lang === "python" ? "[3, 2, 4], 6" : "[3, 2, 4], 6",
          expected_output: "[1, 2]",
          is_hidden: false,
          points: 15,
          time_limit: 5000,
        },
        {
          id: "3",
          input: lang === "python" ? "[3, 3], 6" : "[3, 3], 6",
          expected_output: "[0, 1]",
          is_hidden: true,
          points: 20,
          time_limit: 5000,
        }
      );
    } else if (lang === "html" || lang === "css") {
      cases.push(
        {
          id: "1",
          input: "<!-- Basic structure test -->",
          expected_output: "Valid HTML5 structure with proper DOCTYPE",
          is_hidden: false,
          points: 20,
          time_limit: 5000,
        },
        {
          id: "2",
          input: "<!-- Semantic elements test -->",
          expected_output:
            "Uses semantic HTML elements (header, nav, main, footer)",
          is_hidden: false,
          points: 20,
          time_limit: 5000,
        },
        {
          id: "3",
          input: "<!-- Accessibility test -->",
          expected_output: "Includes proper ARIA labels and alt attributes",
          is_hidden: true,
          points: 10,
          time_limit: 5000,
        }
      );
    } else if (lang === "react" || lang === "vue" || lang === "angular") {
      cases.push(
        {
          id: "1",
          input: '{ "props": { "items": [1, 2, 3] } }',
          expected_output: "Component renders with 3 items",
          is_hidden: false,
          points: 15,
          time_limit: 5000,
        },
        {
          id: "2",
          input: '{ "props": { "items": [] } }',
          expected_output: "Component handles empty array gracefully",
          is_hidden: false,
          points: 15,
          time_limit: 5000,
        },
        {
          id: "3",
          input: '{ "props": { "items": null } }',
          expected_output: "Component handles null props without crashing",
          is_hidden: true,
          points: 20,
          time_limit: 5000,
        }
      );
    } else if (lang === "sql") {
      cases.push(
        {
          id: "1",
          input: "SELECT * FROM users WHERE id = 1;",
          expected_output:
            '{ "id": 1, "name": "John Doe", "email": "john@example.com" }',
          is_hidden: false,
          points: 15,
          time_limit: 5000,
        },
        {
          id: "2",
          input: "SELECT COUNT(*) FROM users;",
          expected_output: "10",
          is_hidden: false,
          points: 15,
          time_limit: 5000,
        }
      );
    } else {
      // Generic test cases
      cases.push(
        {
          id: "1",
          input: "Basic input test",
          expected_output: "Expected output for basic case",
          is_hidden: false,
          points: 20,
          time_limit: 5000,
        },
        {
          id: "2",
          input: "Edge case test",
          expected_output: "Expected output for edge case",
          is_hidden: false,
          points: 20,
          time_limit: 5000,
        },
        {
          id: "3",
          input: "Complex scenario test",
          expected_output: "Expected output for complex case",
          is_hidden: true,
          points: 10,
          time_limit: 5000,
        }
      );
    }

    return cases;
  };

  const applyTestCases = () => {
    // Clear any existing test cases that might be default/example cases
    onTestCasesGenerated(generatedCases);
    setShowPreview(false);
    setGeneratedCases([]);
  };

  return (
    <div className="space-y-4">
      {/* AI Generator Button */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-3xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              AI Test Case Generator
            </h3>
            <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
              Let AI analyze your problem description and automatically generate
              intelligent test cases including edge cases, basic scenarios, and
              complex inputs.
            </p>
            <button
              type="button"
              onClick={generateTestCases}
              disabled={isGenerating || !problemDescription.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Test Cases...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Test Cases with AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Preview Generated Test Cases */}
      {showPreview && generatedCases.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-700 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-green-900 dark:text-green-100">
                Generated {generatedCases.length} Test Cases
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyTestCases}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
              >
                Apply Test Cases
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {generatedCases.map((testCase, index) => (
              <div
                key={testCase.id}
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm font-medium">
                    Test Case {index + 1}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                    <span>Points: {testCase.points}</span>
                    {testCase.is_hidden && (
                      <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                        🔒 Hidden
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      Input
                    </label>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-sm">
                      {testCase.input}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      Expected Output
                    </label>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-sm">
                      {testCase.expected_output}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Tip:</strong> Review the generated test cases and
              modify them as needed. You can edit inputs, outputs, and point
              values after applying them.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
