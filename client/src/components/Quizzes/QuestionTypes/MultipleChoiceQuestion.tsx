import React, { useState, useEffect } from "react";
import type {
  MultipleChoiceData,
  MultipleChoiceAnswer,
  QuestionComponentProps,
} from "../../../types/quiz.types";

export const MultipleChoiceQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
}) => {
  const questionData = question.question_data as MultipleChoiceData;
  const currentAnswer = answer as MultipleChoiceAnswer | undefined;

  const [selectedOptions, setSelectedOptions] = useState<number[]>(
    currentAnswer?.selected_option_indices ?? []
  );

  useEffect(() => {
    if (currentAnswer?.selected_option_indices) {
      setSelectedOptions(currentAnswer.selected_option_indices);
    }
  }, [currentAnswer]);

  const handleOptionToggle = (optionIndex: number) => {
    if (disabled) return;

    let newSelectedOptions: number[];

    if (selectedOptions.includes(optionIndex)) {
      newSelectedOptions = selectedOptions.filter((idx) => idx !== optionIndex);
    } else {
      newSelectedOptions = [...selectedOptions, optionIndex];

      // Check max selections if specified
      if (
        questionData.max_selections &&
        newSelectedOptions.length > questionData.max_selections
      ) {
        return; // Don't allow more selections than max
      }
    }

    setSelectedOptions(newSelectedOptions);
    onAnswerChange({
      selected_option_indices: newSelectedOptions,
    });
  };

  const correctAnswerIndices = questionData.correct_option_indices;
  const minSelections = questionData.min_selections || 1;

  // Check if minimum selections are met
  const hasMinimumSelections = selectedOptions.length >= minSelections;

  return (
    <div className="space-y-3">
      {/* Selection info */}
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border border-blue-200 dark:border-blue-700 rounded-2xl animate-fadeIn">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <svg
            className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            Select{" "}
            {minSelections === questionData.max_selections
              ? `${minSelections} option${minSelections !== 1 ? "s" : ""}`
              : `at least ${minSelections}${
                  questionData.max_selections
                    ? ` and at most ${questionData.max_selections}`
                    : ""
                } option${minSelections !== 1 ? "s" : ""}`}
          </span>
          {selectedOptions.length > 0 && (
            <span className="ml-auto px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full animate-scaleIn">
              {selectedOptions.length} selected
            </span>
          )}
        </div>
      </div>

      {questionData.options.map((option, index) => {
        const isSelected = selectedOptions.includes(index);
        const isCorrect =
          showCorrectAnswer && correctAnswerIndices.includes(index);
        const isIncorrectSelection =
          showCorrectAnswer &&
          isSelected &&
          !correctAnswerIndices.includes(index);

        let optionClassName =
          "flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] ";

        if (disabled || showCorrectAnswer) {
          optionClassName += "cursor-default hover:scale-100 active:scale-100 ";
          if (isCorrect) {
            optionClassName +=
              "border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 shadow-sm";
          } else if (isIncorrectSelection) {
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
            onClick={() => handleOptionToggle(index)}
          >
            <div className="flex items-center w-full">
              <div
                className={`w-5 h-5 rounded border-2 mr-3 sm:mr-4 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isSelected
                    ? "border-blue-600 bg-blue-600 scale-110 shadow-md"
                    : "border-gray-400 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3.5 h-3.5 text-white animate-scaleIn"
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
                className={`flex-1 text-sm sm:text-base break-words transition-colors duration-200 ${
                  showCorrectAnswer && isCorrect
                    ? "text-green-900 dark:text-green-100 font-semibold"
                    : showCorrectAnswer && isIncorrectSelection
                    ? "text-red-900 dark:text-red-100 font-medium"
                    : isSelected
                    ? "text-blue-900 dark:text-blue-100 font-medium"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {option}
              </span>
              {showCorrectAnswer && isCorrect && (
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
              {showCorrectAnswer && isIncorrectSelection && (
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

      {/* Validation warning */}
      {!disabled && !hasMinimumSelections && selectedOptions.length > 0 && (
        <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900 dark:to-amber-900 border-l-4 border-yellow-500 dark:border-yellow-600 rounded-r-2xl shadow-sm animate-slideInLeft">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-yellow-700 dark:text-yellow-300 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-yellow-900 dark:text-yellow-100 font-semibold text-sm sm:text-base">
              Please select at least {minSelections} option
              {minSelections !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

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

export default MultipleChoiceQuestion;
