import React, { useState } from "react";
import { Sparkles, Loader2, CheckCircle, XCircle } from "lucide-react";
import { QuizApiService } from "../../services/quizApi";

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
      const response = await QuizApiService.generateTestCases({
        problemDescription,
        language,
        starterCode,
      });

      if (response.success) {
        setGeneratedCases(response.data);
        setShowPreview(true);
      } else {
        throw new Error("Failed to generate test cases");
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      setError(
        err.response?.data?.message ||
          "Failed to generate test cases. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
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
                className="px-3 py-1 text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
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
                  <div className="flex items-center gap-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">
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
                    <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1 block">
                      Input
                    </label>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-sm">
                      {testCase.input}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1 block">
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
