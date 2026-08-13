import React from "react";
import type { SingleChoiceData } from "../../../types/quiz.types";
import { X } from "lucide-react";
import { RichOptionEditor } from "./RichOptionEditor";

interface SingleChoiceQuestionFormProps {
  data: SingleChoiceData;
  onChange: (data: SingleChoiceData) => void;
}

export const SingleChoiceQuestionForm: React.FC<
  SingleChoiceQuestionFormProps
> = ({ data, onChange }) => {
  // Ensure options is always an array to prevent undefined errors
  const options = data?.options || [];
  const correctOptionIndex = data?.correct_option_index ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-3">
          Options
        </label>
        <div className="space-y-3">
          {options.map((option: string, index: number) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={(option || "").replace(/<[^>]*>/g, "")}
                  onChange={(e) => {
                    const newOptions = [...options];
                    // If it was already HTML, maybe we should be careful.
                    // But for simple text input, we just update it.
                    newOptions[index] = e.target.value;
                    onChange({
                      ...data,
                      options: newOptions,
                    });
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-text-primary-light dark:text-text-primary-dark placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                />

                <RichOptionEditor
                  value={option}
                  onChange={(val) => {
                    const newOptions = [...options];
                    newOptions[index] = val;
                    onChange({ ...data, options: newOptions });
                  }}
                  label={`Option ${index + 1}`}
                />

                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = options.filter((_, i) => i !== index);
                      let newCorrectIndex = correctOptionIndex;
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
                    className="w-10 h-10 shrink-0 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center transition-all duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              const newOptions = [...options, ""];
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
        <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-3">
          Correct Answer
        </label>
        <select
          value={correctOptionIndex}
          onChange={(e) =>
            onChange({
              ...data,
              correct_option_index: parseInt(e.target.value),
            })
          }
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        >
          {options.map((_: string, index: number) => (
            <option key={index} value={index}>
              Option {index + 1}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
