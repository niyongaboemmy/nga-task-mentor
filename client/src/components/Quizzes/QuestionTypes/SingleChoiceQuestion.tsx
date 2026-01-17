import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  SingleChoiceAnswer,
  SingleChoiceData,
} from "../../../types/quiz.types";

export const SingleChoiceQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
}) => {
  const questionData = question.question_data as SingleChoiceData;
  const currentAnswer = answer as SingleChoiceAnswer | undefined;

  // Defensive check for question data
  if (!questionData) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-500">⚠️</span>
          <span className="font-semibold">Data Error</span>
        </div>
        <p className="text-sm">
          Question data is missing for this single choice question.
        </p>
        <p className="text-xs text-red-500 mt-1">Question ID: {question.id}</p>
      </div>
    );
  }

  if (
    !questionData.options ||
    !Array.isArray(questionData.options) ||
    questionData.options.length === 0
  ) {
    return (
      <div className="text-orange-600 dark:text-orange-400 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-orange-500">⚠️</span>
          <span className="font-semibold">Incomplete Question</span>
        </div>
        <p className="text-sm">This question is missing answer options.</p>
        <p className="text-xs text-orange-500 mt-1">
          Question ID: {question.id}
        </p>
      </div>
    );
  }

  const [selectedOption, setSelectedOption] = useState<number | null>(
    currentAnswer?.selected_option_index ?? null
  );

  useEffect(() => {
    if (currentAnswer?.selected_option_index !== undefined) {
      setSelectedOption(currentAnswer.selected_option_index);
    }
  }, [currentAnswer]);

  const handleOptionSelect = (optionIndex: number) => {
    if (disabled) return;

    setSelectedOption(optionIndex);
    onAnswerChange({
      selected_option_index: optionIndex,
    });
  };

  const correctAnswerIndex = questionData.correct_option_index;

  return (
    <div className="space-y-3">
      {questionData.options.map((option, index) => {
        const isSelected = selectedOption === index;
        const isCorrect = showCorrectAnswer && index === correctAnswerIndex;
        const isIncorrect =
          showCorrectAnswer && isSelected && index !== correctAnswerIndex;

        let optionClassName =
          "flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] ";

        if (disabled || showCorrectAnswer) {
          optionClassName += "cursor-default hover:scale-100 active:scale-100 ";
          if (isCorrect) {
            optionClassName +=
              "border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 shadow-sm";
          } else if (isIncorrect) {
            optionClassName +=
              "border-red-500 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900 dark:to-pink-900 shadow-sm";
          } else {
            optionClassName +=
              "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60";
          }
        } else {
          if (isSelected) {
            optionClassName +=
              "border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 shadow-md ring-2 ring-blue-200 dark:ring-blue-800";
          } else {
            optionClassName +=
              "border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-sm";
          }
        }

        return (
          <div
            key={index}
            className={`${optionClassName} animate-fadeIn`}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => handleOptionSelect(index)}
          >
            <div className="flex items-center w-full">
              <div
                className={`w-5 h-5 rounded-full border-2 mr-3 sm:mr-4 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isSelected
                    ? "border-blue-600 bg-blue-600 scale-110 shadow-md"
                    : "border-gray-400 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-scaleIn"></div>
                )}
              </div>
              <span
                className={`flex-1 text-sm sm:text-base break-words transition-colors duration-200 ${
                  showCorrectAnswer && index === correctAnswerIndex
                    ? "text-green-900 dark:text-green-100 font-semibold"
                    : showCorrectAnswer && isIncorrect
                    ? "text-red-900 dark:text-red-100 font-medium"
                    : isSelected
                    ? "text-blue-900 dark:text-blue-100 font-medium"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {option}
              </span>
              {showCorrectAnswer && index === correctAnswerIndex && (
                <span className="ml-2 sm:ml-3 text-green-600 dark:text-green-400 text-xs sm:text-sm font-bold flex items-center gap-1 animate-slideInRight flex-shrink-0">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="hidden sm:inline">Correct</span>
                </span>
              )}
              {showCorrectAnswer && isIncorrect && (
                <span className="ml-2 sm:ml-3 text-red-600 dark:text-red-400 text-xs sm:text-sm font-bold flex items-center gap-1 animate-slideInRight flex-shrink-0">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="hidden sm:inline">Incorrect</span>
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Timer warning */}
      {timeRemaining !== undefined &&
        timeRemaining <= 30 &&
        timeRemaining > 0 && (
          <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900 dark:to-amber-900 border-l-4 border-yellow-500 dark:border-yellow-600 rounded-r-2xl shadow-sm animate-pulse">
            <div className="flex items-center gap-2">
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

export default SingleChoiceQuestion;
