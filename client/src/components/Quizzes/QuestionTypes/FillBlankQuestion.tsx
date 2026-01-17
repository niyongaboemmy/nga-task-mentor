import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { ProgressIndicator } from "./shared";
import type {
  FillBlankData,
  FillBlankAnswer,
  QuestionComponentProps,
} from "../../../types/quiz.types";

export const FillBlankQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
}) => {
  const questionData = question.question_data as FillBlankData;
  const currentAnswer = answer as FillBlankAnswer | undefined;

  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>(
    currentAnswer?.answers?.reduce(
      (acc, blank) => {
        acc[blank.blank_index] = blank.answer;
        return acc;
      },
      {} as Record<number, string>,
    ) ?? {},
  );

  useEffect(() => {
    if (currentAnswer?.answers) {
      const newAnswers: Record<number, string> = {};
      currentAnswer.answers.forEach((blank) => {
        newAnswers[blank.blank_index] = blank.answer;
      });
      setBlankAnswers(newAnswers);
    }
  }, [currentAnswer]);

  const handleBlankChange = (blankIndex: number, value: string) => {
    if (disabled) return;

    const newAnswers = { ...blankAnswers, [blankIndex]: value };
    setBlankAnswers(newAnswers);

    // Convert to answer format
    const answers = Object.entries(newAnswers).map(([index, answer]) => ({
      blank_index: parseInt(index),
      answer,
    }));

    onAnswerChange({ answers });
  };

  // Parse the text to find blanks and split into parts
  const renderTextWithBlanks = () => {
    // Handle case where text_with_blanks is missing or undefined
    if (!questionData.text_with_blanks) {
      return (
        <span className="text-red-600 dark:text-red-400">
          Error: Question text is missing. Please contact your instructor.
        </span>
      );
    }

    const parts = questionData.text_with_blanks.split(/(\{\{blank\}\})/);
    let blankIndex = 0;

    return parts.map((part, index) => {
      if (part === "{{blank}}") {
        const currentBlankIndex = blankIndex++;
        const blankData = questionData.acceptable_answers?.find(
          (b) => b.blank_index === currentBlankIndex,
        );
        const currentAnswer = blankAnswers[currentBlankIndex] || "";
        const isCorrect =
          showCorrectAnswer &&
          blankData?.answers.some(
            (ans) => ans.toLowerCase() === currentAnswer.toLowerCase(),
          );

        return (
          <input
            key={index}
            type="text"
            value={currentAnswer}
            onChange={(e) =>
              handleBlankChange(currentBlankIndex, e.target.value)
            }
            disabled={disabled}
            placeholder={`Blank ${currentBlankIndex + 1}`}
            className={`inline-block mx-1 px-3 py-1 border-2 rounded focus:outline-none focus:ring-2 transition-all duration-200 min-w-[120px] ${
              disabled
                ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                : showCorrectAnswer
                  ? isCorrect
                    ? "border-green-500 bg-green-50 focus:border-green-500 focus:ring-green-200"
                    : "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200"
                  : currentAnswer
                    ? "border-blue-500 bg-blue-50 focus:border-blue-500 focus:ring-blue-200"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
            }`}
          />
        );
      }

      return (
        <span key={index} className="text-gray-700">
          {part}
        </span>
      );
    });
  };

  // Check if all required blanks are filled
  const allBlanksFilled =
    questionData.acceptable_answers?.every(
      (blank) => blankAnswers[blank.blank_index]?.trim() !== "",
    ) ?? false;

  return (
    <div className="space-y-4">
      <div className="max-w-4xl mx-auto">
        {/* Question text with blanks */}
        <div className="text-lg leading-loose p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm mb-6 text-gray-800 dark:text-gray-200">
          {renderTextWithBlanks()}
        </div>

        {/* Progress indicator */}
        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <ProgressIndicator
            completed={
              Object.values(blankAnswers).filter((a) => a.trim() !== "").length
            }
            total={questionData.acceptable_answers?.length || 0}
            label="Blanks Filled"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2"></div>{" "}
          {/* Spacer if needed or submit button here if moved */}
          {Object.values(blankAnswers).some((a) => a.trim() !== "") &&
            !disabled && (
              <button
                onClick={() => {
                  setBlankAnswers({});
                  onAnswerChange({ answers: [] });
                }}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              >
                <RefreshCw className="w-4 h-4" />
                Clear All
              </button>
            )}
        </div>

        {/* Case sensitivity info */}
        {questionData.acceptable_answers?.some(
          (blank) => blank.case_sensitive,
        ) && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl">
            <div className="text-sm text-blue-800 dark:text-blue-200 text-center">
              <strong>Note:</strong> Some blanks are case-sensitive
            </div>
          </div>
        )}

        {/* Acceptable answers preview (for instructors) */}
        {showCorrectAnswer && questionData.acceptable_answers && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Acceptable answers:
            </div>
            {questionData.acceptable_answers.map((blank, index) => (
              <div
                key={index}
                className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded-2xl"
              >
                <span className="font-medium">Blank {index + 1}:</span>{" "}
                {blank.answers.join(", ")}
                {blank.case_sensitive && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                    (case-sensitive)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Validation warning */}
        {!disabled &&
          !allBlanksFilled &&
          Object.keys(blankAnswers).length > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-2xl">
              <div className="flex items-center justify-center">
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                  ⚠️ Please fill in all blanks before submitting
                </span>
              </div>
            </div>
          )}

        {/* Timer warning */}
        {timeRemaining !== undefined &&
          timeRemaining <= 30 &&
          timeRemaining > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-2xl">
              <div className="flex items-center justify-center">
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                  ⏰ Time remaining: {timeRemaining} seconds
                </span>
              </div>
            </div>
          )}

        {/* Show explanation if available */}
        {showCorrectAnswer && question.explanation && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 dark:border-green-600 rounded-r-2xl">
            <div className="flex items-center justify-center mb-2">
              <span className="text-green-800 dark:text-green-200 font-medium">
                Explanation:
              </span>
            </div>
            <p className="text-green-700 dark:text-green-300 text-center">
              {question.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FillBlankQuestion;
