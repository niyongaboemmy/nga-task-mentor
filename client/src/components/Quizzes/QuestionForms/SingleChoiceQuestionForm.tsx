import React from "react";
import type { SingleChoiceData } from "../../../types/quiz.types";

interface SingleChoiceQuestionFormProps {
  data: SingleChoiceData & { correct_answer?: number };
  onChange: (data: SingleChoiceData & { correct_answer?: number }) => void;
}

export const SingleChoiceQuestionForm: React.FC<
  SingleChoiceQuestionFormProps
> = ({ data, onChange }) => {
  // Ensure data has required properties with defaults
  const options = data?.options || [];
  const rawCorrectIndex = data?.correct_option_index ?? 0;
  const correct_option_index =
    typeof rawCorrectIndex === "number" &&
    rawCorrectIndex >= 0 &&
    rawCorrectIndex < options.length
      ? rawCorrectIndex
      : 0;

  // Validate correct answer before allowing submission
  const isValidCorrectAnswer =
    correct_option_index >= 0 && correct_option_index < options.length;

  // Validate that no options are empty
  const hasEmptyOptions = options.some((option) => !option.trim());

  // Set correct_answer for payload - only if valid
  const correct_answer = isValidCorrectAnswer ? correct_option_index : undefined;

  const safeData: SingleChoiceData & { correct_answer?: number } = {
    options,
    correct_option_index,
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
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...safeData.options];
                  newOptions[index] = e.target.value;
                  // Revalidate correct_answer after options change
                  const isValid = safeData.correct_option_index >= 0 && safeData.correct_option_index < newOptions.length;
                  onChange({
                    ...safeData,
                    options: newOptions,
                    correct_answer: isValid ? safeData.correct_option_index : undefined,
                  });
                }}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
              />
              {safeData.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = safeData.options.filter(
                      (_, i) => i !== index
                    );
                    // Adjust correct_option_index if necessary
                    let newCorrectIndex = safeData.correct_option_index;
                    if (newCorrectIndex >= index && newCorrectIndex > 0) {
                      newCorrectIndex--;
                    } else if (newCorrectIndex === index) {
                      newCorrectIndex = 0;
                    }
                    // Validate correct_answer after deletion
                    const isValid = newCorrectIndex >= 0 && newCorrectIndex < newOptions.length;
                    onChange({
                      ...safeData,
                      options: newOptions,
                      correct_option_index: newCorrectIndex,
                      correct_answer: isValid ? newCorrectIndex : undefined,
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newOptions = [...safeData.options, ""];
              // Revalidate correct_answer after adding new option
              const isValid = safeData.correct_option_index >= 0 && safeData.correct_option_index < newOptions.length;
              onChange({
                ...safeData,
                options: newOptions,
                correct_answer: isValid ? safeData.correct_option_index : undefined,
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
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Correct Answer
        </label>
        <select
          value={safeData.correct_option_index || 0}
          onChange={(e) => {
            const newIndex = parseInt(e.target.value);
            const isValid = newIndex >= 0 && newIndex < safeData.options.length;
            onChange({
              ...safeData,
              correct_option_index: newIndex,
              correct_answer: isValid ? newIndex : undefined,
            });
          }}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        >
          {safeData.options.map((optionText: string, index: number) => (
            <option key={index} value={index}>
              Option {index + 1}:{" "}
              {optionText.length > 50
                ? `${optionText.substring(0, 50)}...`
                : optionText}
            </option>
          ))}
        </select>
        {!isValidCorrectAnswer && options.length > 0 && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Please select a valid correct answer option.
          </p>
        )}
      </div>
    </div>
  );
};
