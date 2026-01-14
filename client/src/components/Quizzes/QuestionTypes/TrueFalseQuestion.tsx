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
    currentAnswer?.selected_answer ?? null
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

  const correctAnswer = questionData.correct_answer;

  return (
    <div className="space-y-4 px-2 sm:px-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
        {/* True option */}
        <div
          className={`flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            selectedAnswer === true
              ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 shadow-lg ring-2 ring-green-200 dark:ring-green-800"
              : showCorrectAnswer && correctAnswer === true
              ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 shadow-md"
              : "border-gray-300 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:shadow-md"
          } ${
            disabled ? "cursor-not-allowed opacity-75 hover:scale-100" : ""
          } animate-fadeIn`}
          onClick={() => handleAnswerSelect(true)}
        >
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-3 flex items-center justify-center transition-all duration-300 ${
                selectedAnswer === true
                  ? "border-green-600 bg-green-600 scale-110 shadow-lg"
                  : "border-gray-400 dark:border-gray-500 hover:border-green-500"
              }`}
            >
              {selectedAnswer === true && (
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white animate-scaleIn"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span
              className={`font-bold text-lg sm:text-xl md:text-2xl transition-colors duration-200 ${
                showCorrectAnswer && correctAnswer === true
                  ? "text-green-900 dark:text-green-100"
                  : selectedAnswer === true
                  ? "text-green-900 dark:text-green-100"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              True
            </span>
            {showCorrectAnswer && correctAnswer === true && (
              <span className="px-2 py-1 sm:px-3 sm:py-1 bg-green-600 text-white text-xs sm:text-sm font-bold rounded-full animate-slideInLeft">
                ✓ Correct Answer
              </span>
            )}
          </div>
        </div>

        {/* False option */}
        <div
          className={`flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            selectedAnswer === false
              ? "border-red-500 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900 dark:to-pink-900 shadow-lg ring-2 ring-red-200 dark:ring-red-800"
              : showCorrectAnswer && correctAnswer === false
              ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 shadow-md"
              : "border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:shadow-md"
          } ${
            disabled ? "cursor-not-allowed opacity-75 hover:scale-100" : ""
          } animate-fadeIn`}
          style={{ animationDelay: "100ms" }}
          onClick={() => handleAnswerSelect(false)}
        >
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-3 flex items-center justify-center transition-all duration-300 ${
                selectedAnswer === false
                  ? "border-red-600 bg-red-600 scale-110 shadow-lg"
                  : showCorrectAnswer && correctAnswer === false
                  ? "border-green-600 bg-green-600"
                  : "border-gray-400 dark:border-gray-500 hover:border-red-500"
              }`}
            >
              {selectedAnswer === false && !showCorrectAnswer && (
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white animate-scaleIn"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {showCorrectAnswer && correctAnswer === false && (
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span
              className={`font-bold text-lg sm:text-xl md:text-2xl transition-colors duration-200 ${
                showCorrectAnswer && correctAnswer === false
                  ? "text-green-900 dark:text-green-100"
                  : selectedAnswer === false
                  ? "text-red-900 dark:text-red-100"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              False
            </span>
            {showCorrectAnswer && correctAnswer === false && (
              <span className="px-2 py-1 sm:px-3 sm:py-1 bg-green-600 text-white text-xs sm:text-sm font-bold rounded-full animate-slideInRight">
                ✓ Correct Answer
              </span>
            )}
            {showCorrectAnswer &&
              selectedAnswer === true &&
              correctAnswer === false && (
                <span className="px-2 py-1 sm:px-3 sm:py-1 bg-red-600 text-white text-xs sm:text-sm font-bold rounded-full animate-slideInRight">
                  ✗ Your Answer
                </span>
              )}
          </div>
        </div>
      </div>

      {/* Timer warning */}
      {timeRemaining !== undefined &&
        timeRemaining <= 30 &&
        timeRemaining > 0 && (
          <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900 dark:to-amber-900 border-l-4 border-yellow-500 dark:border-yellow-600 rounded-r-2xl shadow-sm animate-pulse mx-2 sm:mx-0">
            <div className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-700 dark:text-yellow-300 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-yellow-900 dark:text-yellow-100 font-semibold text-sm sm:text-base">
                Time remaining: {timeRemaining} seconds
              </span>
            </div>
          </div>
        )}
    </div>
  );
};

export default TrueFalseQuestion;
