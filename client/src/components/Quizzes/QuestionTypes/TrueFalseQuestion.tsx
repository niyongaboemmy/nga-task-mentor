import React, { useState, useEffect } from "react";
import type {
  TrueFalseData,
  TrueFalseAnswer,
  QuestionComponentProps,
} from "../../../types/quiz.types";

export const TrueFalseQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
}) => {
  const questionData = question.question_data as TrueFalseData;
  const currentAnswer = answer as TrueFalseAnswer | undefined;

  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(
    currentAnswer?.selected_answer ?? null,
  );

  useEffect(() => {
    if (currentAnswer?.selected_answer !== undefined) {
      setSelectedAnswer(currentAnswer.selected_answer);
    }
  }, [currentAnswer]);

  const handleAnswerSelect = (answer: boolean) => {
    if (disabled) return;

    setSelectedAnswer(answer);
    onAnswerChange({
      selected_answer: answer,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, answer: boolean) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAnswerSelect(answer);
    }
  };

  const correctAnswer = questionData.correct_answer;

  return (
    <div className="space-y-6 w-full">
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full"
        role="radiogroup"
        aria-label="True or False options"
      >
        {/* True option */}
        <div
          role="radio"
          aria-checked={selectedAnswer === true}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => handleKeyDown(e, true)}
          className={`group flex flex-row sm:flex-col items-center justify-start sm:justify-center p-4 sm:p-8 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform active:scale-[0.98] outline-none focus:ring-4 focus:ring-green-500/30 ${
            selectedAnswer === true
              ? "border-green-500 bg-green-50/50 dark:bg-green-900/20 shadow-lg scale-[1.02] sm:scale-105 z-10"
              : showCorrectAnswer && correctAnswer === true
                ? "border-green-500 bg-green-50/30 dark:bg-green-900/10 shadow-md"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-300 dark:hover:border-green-600 hover:bg-green-50/30 dark:hover:bg-green-900/10 hover:shadow-md"
          } ${
            disabled
              ? "cursor-not-allowed opacity-75 hover:scale-100 hover:shadow-none"
              : ""
          } animate-fadeIn`}
          onClick={() => handleAnswerSelect(true)}
        >
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <div
              className={`w-12 h-12 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                selectedAnswer === true
                  ? "border-green-500 bg-green-500 text-white scale-110 shadow-md"
                  : "border-gray-300 dark:border-gray-600 group-hover:border-green-400 text-transparent"
              }`}
            >
              <svg
                className={`w-6 h-6 transition-transform duration-300 ${selectedAnswer === true ? "scale-100" : "scale-0"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div className="flex flex-col">
              <span
                className={`font-bold text-lg sm:text-2xl transition-colors duration-200 ${
                  showCorrectAnswer && correctAnswer === true
                    ? "text-green-700 dark:text-green-400"
                    : selectedAnswer === true
                      ? "text-green-700 dark:text-green-400"
                      : "text-gray-700 dark:text-gray-300 group-hover:text-green-700 dark:group-hover:text-green-400"
                }`}
              >
                True
              </span>
              {showCorrectAnswer && correctAnswer === true && (
                <span className="text-green-600 dark:text-green-400 text-xs font-bold flex items-center gap-1 animate-slideInRight">
                  ✓ Correct Answer
                </span>
              )}
            </div>
          </div>
        </div>

        {/* False option */}
        <div
          role="radio"
          aria-checked={selectedAnswer === false}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => handleKeyDown(e, false)}
          className={`group flex flex-row sm:flex-col items-center justify-start sm:justify-center p-4 sm:p-8 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform active:scale-[0.98] outline-none focus:ring-4 focus:ring-red-500/30 ${
            selectedAnswer === false
              ? "border-red-500 bg-red-50/50 dark:bg-red-900/20 shadow-lg scale-[1.02] sm:scale-105 z-10"
              : showCorrectAnswer && correctAnswer === false
                ? "border-green-500 bg-green-50/30 dark:bg-green-900/10 shadow-md"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-red-300 dark:hover:border-red-600 hover:bg-red-50/30 dark:hover:bg-red-900/10 hover:shadow-md"
          } ${
            disabled
              ? "cursor-not-allowed opacity-75 hover:scale-100 hover:shadow-none"
              : ""
          } animate-fadeIn`}
          style={{ animationDelay: "100ms" }}
          onClick={() => handleAnswerSelect(false)}
        >
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <div
              className={`w-12 h-12 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                selectedAnswer === false
                  ? "border-red-500 bg-red-500 text-white scale-110 shadow-md"
                  : showCorrectAnswer && correctAnswer === false
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-gray-300 dark:border-gray-600 group-hover:border-red-400 text-transparent"
              }`}
            >
              {/* Checkmark for correct answer display, otherwise X for selected false */}
              {showCorrectAnswer && correctAnswer === false ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className={`w-6 h-6 transition-transform duration-300 ${selectedAnswer === false ? "scale-100" : "scale-0"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>

            <div className="flex flex-col">
              <span
                className={`font-bold text-lg sm:text-2xl transition-colors duration-200 ${
                  showCorrectAnswer && correctAnswer === false
                    ? "text-green-700 dark:text-green-400"
                    : selectedAnswer === false
                      ? "text-red-700 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-300 group-hover:text-red-700 dark:group-hover:text-red-400"
                }`}
              >
                False
              </span>

              {showCorrectAnswer && correctAnswer === false && (
                <span className="text-green-600 dark:text-green-400 text-xs font-bold flex items-center gap-1 animate-slideInRight">
                  ✓ Correct Answer
                </span>
              )}
              {showCorrectAnswer &&
                selectedAnswer === true &&
                correctAnswer === false && (
                  <span className="text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1 animate-slideInRight">
                    ✗ Your Answer
                  </span>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Timer warning */}
      {timeRemaining !== undefined &&
        timeRemaining <= 30 &&
        timeRemaining > 0 && (
          <div className="flex items-center justify-center p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800 animate-pulse">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium text-sm">
              Time remaining: {timeRemaining} seconds
            </span>
          </div>
        )}
    </div>
  );
};

export default TrueFalseQuestion;
