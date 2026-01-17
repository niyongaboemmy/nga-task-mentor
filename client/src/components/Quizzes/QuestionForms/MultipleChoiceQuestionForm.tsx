import React from "react";
import type { MultipleChoiceData } from "../../../types/quiz.types";

interface MultipleChoiceQuestionFormProps {
  data: MultipleChoiceData & { correct_answer?: number[] };
  onChange: (data: MultipleChoiceData & { correct_answer?: number[] }) => void;
}

export const MultipleChoiceQuestionForm: React.FC<
  MultipleChoiceQuestionFormProps
> = ({ data, onChange }) => {
  // Ensure data has required properties with defaults
  const options = data?.options || [];
  const rawCorrectIndices = data?.correct_option_indices || [];
  const correct_option_indices = rawCorrectIndices.filter(
    (index) => typeof index === "number" && index >= 0 && index < options.length
  );

  // Validate correct answers
  const isValidCorrectAnswers =
    correct_option_indices.length > 0 &&
    correct_option_indices.every(
      (index) => index >= 0 && index < options.length
    );

  // Validate that no options are empty
  const hasEmptyOptions = options.some((option) => !option.trim());

  // Set correct_answer for payload - only if valid
  const correct_answer = isValidCorrectAnswers ? correct_option_indices : undefined;

  const safeData: MultipleChoiceData & { correct_answer?: number[] } = {
    options,
    correct_option_indices,
    min_selections: data?.min_selections,
    max_selections: data?.max_selections,
    correct_answer,
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Options
        </label>
        <div className="space-y-3">
          {safeData.options.map((option: string, index: number) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={
                  safeData.correct_option_indices?.includes(index) || false
                }
                onChange={(e) => {
                  const currentIndices = safeData.correct_option_indices || [];
                  let newIndices;
                  if (e.target.checked) {
                    newIndices = [...currentIndices, index];
                  } else {
                    newIndices = currentIndices.filter(
                      (i: number) => i !== index
                    );
                  }
                  // Validate correct_answer after selection change
                  const isValid = newIndices.length > 0 && newIndices.every(
                    (idx) => idx >= 0 && idx < safeData.options.length
                  );
                  onChange({
                    ...safeData,
                    correct_option_indices: newIndices,
                    correct_answer: isValid ? newIndices : undefined,
                  });
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <input
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...safeData.options];
                  newOptions[index] = e.target.value;
                  // Revalidate correct_answer after options change
                  const isValid = safeData.correct_option_indices.length > 0 && 
                    safeData.correct_option_indices.every(
                      (idx) => idx >= 0 && idx < newOptions.length
                    );
                  onChange({
                    ...safeData,
                    options: newOptions,
                    correct_answer: isValid ? safeData.correct_option_indices : undefined,
                  });
                }}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newOptions = [...safeData.options, ""];
              // Revalidate correct_answer after adding new option
              const isValid = safeData.correct_option_indices.length > 0 && 
                safeData.correct_option_indices.every(
                  (idx) => idx >= 0 && idx < newOptions.length
                );
              onChange({
                ...safeData,
                options: newOptions,
                correct_answer: isValid ? safeData.correct_option_indices : undefined,
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Option
          </button>
        </div>
        {hasEmptyOptions && options.length > 0 && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            All options must have text. Please fill in empty options.
          </p>
        )}
        {!isValidCorrectAnswers && options.length > 0 && !hasEmptyOptions && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Please select at least one correct answer option.
          </p>
        )}
      </div>
    </div>
  );
};
