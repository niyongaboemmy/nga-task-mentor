import React from "react";
import type { MultipleChoiceData } from "../../../types/quiz.types";

interface MultipleChoiceQuestionFormProps {
  data: MultipleChoiceData;
  onChange: (data: MultipleChoiceData) => void;
}

export const MultipleChoiceQuestionForm: React.FC<
  MultipleChoiceQuestionFormProps
> = ({ data, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Options
        </label>
        <div className="space-y-3">
          {data.options.map((option: string, index: number) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={data.correct_option_indices?.includes(index) || false}
                onChange={(e) => {
                  const currentIndices = data.correct_option_indices || [];
                  let newIndices;
                  if (e.target.checked) {
                    newIndices = [...currentIndices, index];
                  } else {
                    newIndices = currentIndices.filter(
                      (i: number) => i !== index
                    );
                  }
                  onChange({
                    ...data,
                    correct_option_indices: newIndices,
                  });
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <input
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...data.options];
                  newOptions[index] = e.target.value;
                  onChange({
                    ...data,
                    options: newOptions,
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
              const newOptions = [...data.options, ""];
              onChange({
                ...data,
                options: newOptions,
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Option
          </button>
        </div>
      </div>
    </div>
  );
};
