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

  // Defensive check for question data
  if (!questionData) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-500">⚠️</span>
          <span className="font-semibold">Data Error</span>
        </div>
        <p className="text-sm">
          Question data is missing for this multiple choice question.
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

  if (
    !questionData.correct_option_indices ||
    !Array.isArray(questionData.correct_option_indices)
  ) {
    return (
      <div className="text-orange-600 dark:text-orange-400 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-orange-500">⚠️</span>
          <span className="font-semibold">Incomplete Question</span>
        </div>
        <p className="text-sm">
          This question is missing correct answer configuration.
        </p>
        <p className="text-xs text-orange-500 mt-1">
          Question ID: {question.id}
        </p>
      </div>
    );
  }

  const [selectedOptions, setSelectedOptions] = useState<number[]>(
    currentAnswer?.selected_option_indices ?? [],
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
      // Check max selections if specified
      if (
        questionData.max_selections &&
        selectedOptions.length >= questionData.max_selections
      ) {
        // If generic single select behavior (max=1), just switch
        if (questionData.max_selections === 1) {
          newSelectedOptions = [optionIndex];
        } else {
          // Otherwise prevent
          return;
        }
      } else {
        newSelectedOptions = [...selectedOptions, optionIndex];
      }
    }

    setSelectedOptions(newSelectedOptions);
    onAnswerChange({
      selected_option_indices: newSelectedOptions,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, optionIndex: number) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOptionToggle(optionIndex);
    }
  };

  const correctAnswerIndices = questionData.correct_option_indices;
  const minSelections = questionData.min_selections || 1;

  // Check if minimum selections are met
  const hasMinimumSelections = selectedOptions.length >= minSelections;

  return (
    <div
      className="space-y-4"
      role="group"
      aria-label="Multiple choice options"
    >
      {/* Selection info */}
      <div className="mb-4 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 p-1 rounded">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <span className="text-gray-700 dark:text-gray-300 font-medium">
            Select{" "}
            {minSelections === questionData.max_selections ? (
              <span className="font-bold text-gray-900 dark:text-white">
                {minSelections} {minSelections !== 1 ? "options" : "option"}
              </span>
            ) : (
              <span>
                at least <span className="font-bold">{minSelections}</span>
                {questionData.max_selections ? (
                  <span>
                    {" "}
                    and at most{" "}
                    <span className="font-bold">
                      {questionData.max_selections}
                    </span>
                  </span>
                ) : (
                  ""
                )}{" "}
                option{minSelections !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          {selectedOptions.length > 0 && (
            <span className="ml-auto px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full animate-scaleIn shadow-sm">
              {selectedOptions.length} selected
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {questionData.options.map((option, index) => {
          const isSelected = selectedOptions.includes(index);
          const isCorrect =
            showCorrectAnswer && correctAnswerIndices.includes(index);
          const isIncorrectSelection =
            showCorrectAnswer &&
            isSelected &&
            !correctAnswerIndices.includes(index);

          let optionClassName =
            "group flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/20 ";

          if (disabled || showCorrectAnswer) {
            optionClassName += "cursor-default ";
            if (isCorrect) {
              optionClassName +=
                "border-green-500 bg-green-50/50 dark:bg-green-900/10 shadow-sm";
            } else if (isIncorrectSelection) {
              optionClassName +=
                "border-red-500 bg-red-50/50 dark:bg-red-900/10 shadow-sm";
            } else {
              optionClassName +=
                "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60";
            }
          } else {
            if (isSelected) {
              optionClassName +=
                "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md ring-1 ring-blue-500/50 z-10 scale-[1.01]";
            } else {
              optionClassName +=
                "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-sm";
            }
          }

          return (
            <div
              key={index}
              role={questionData.max_selections === 1 ? "radio" : "checkbox"}
              aria-checked={isSelected}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`${optionClassName} animate-fadeIn`}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleOptionToggle(index)}
            >
              <div className="flex items-start w-full gap-4">
                <div
                  className={`mt-0.5 w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
                    isSelected
                      ? "border-blue-500 bg-blue-500 text-white shadow-sm scale-110"
                      : "border-gray-300 dark:border-gray-600 group-hover:border-blue-400 text-transparent"
                  } ${questionData.max_selections === 1 ? "rounded-full" : "rounded-md"}`}
                >
                  {questionData.max_selections === 1 ? (
                    <div
                      className={`w-2 h-2 rounded-full bg-white transition-transform duration-200 ${isSelected ? "scale-100" : "scale-0"}`}
                    />
                  ) : (
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isSelected ? "scale-100" : "scale-0"}`}
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

                <div className="flex-1 flex flex-col">
                  <span
                    className={`text-base leading-relaxed transition-colors duration-200 ${
                      showCorrectAnswer && isCorrect
                        ? "text-green-800 dark:text-green-200 font-medium"
                        : showCorrectAnswer && isIncorrectSelection
                          ? "text-red-800 dark:text-red-200 font-medium"
                          : isSelected
                            ? "text-blue-900 dark:text-blue-100 font-medium"
                            : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {option}
                  </span>

                  {showCorrectAnswer && isCorrect && (
                    <span className="mt-1 text-green-600 dark:text-green-400 text-xs font-bold flex items-center gap-1 animate-slideInRight">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Correct Option
                    </span>
                  )}

                  {showCorrectAnswer && isIncorrectSelection && (
                    <span className="mt-1 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1 animate-slideInRight">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Your incorrect selection
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation warning */}
      {!disabled && !hasMinimumSelections && selectedOptions.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg shadow-sm animate-slideInLeft">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-800 rounded-full text-amber-600 dark:text-amber-300">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <span className="text-amber-900 dark:text-amber-100 font-medium">
            Please select at least{" "}
            <span className="font-bold">{minSelections}</span> option
            {minSelections !== 1 ? "s" : ""}
          </span>
        </div>
      )}

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

export default MultipleChoiceQuestion;
