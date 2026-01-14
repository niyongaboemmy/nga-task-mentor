import React from "react";
import type { SingleChoiceData } from "../../../types/quiz.types";

interface SingleChoiceQuestionFormProps {
  data: SingleChoiceData;
  onChange: (data: SingleChoiceData) => void;
}

export const SingleChoiceQuestionForm: React.FC<
  SingleChoiceQuestionFormProps
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
              {data.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = data.options.filter(
                      (_, i) => i !== index
                    );
                    // Adjust correct_option_index if necessary
                    let newCorrectIndex = data.correct_option_index;
                    if (newCorrectIndex >= index && newCorrectIndex > 0) {
                      newCorrectIndex--;
                    } else if (newCorrectIndex === index) {
                      newCorrectIndex = 0;
                    }
                    onChange({
                      ...data,
                      options: newOptions,
                      correct_option_index: newCorrectIndex,
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Correct Answer
        </label>
        <select
          value={data.correct_option_index || 0}
          onChange={(e) =>
            onChange({
              ...data,
              correct_option_index: parseInt(e.target.value),
            })
          }
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        >
          {data.options.map((_: string, index: number) => (
            <option key={index} value={index}>
              Option {index + 1}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
