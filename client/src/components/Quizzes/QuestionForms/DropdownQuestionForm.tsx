import React from "react";
import type { DropdownData } from "../../../types/quiz.types";

interface DropdownQuestionFormProps {
  data: DropdownData;
  onChange: (data: any) => void;
}

export const DropdownQuestionForm: React.FC<DropdownQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Ensure data has default values with correct_answer_indices
 const safeData = {
    text_with_dropdowns: data.text_with_dropdowns || "",
    dropdown_options: data.dropdown_options || [],
    correct_answer_indices: (data as any).correct_answer_indices || [],
  };

  // Validation - check all dropdowns have a correct answer selected
  const hasCorrectAnswers = safeData.dropdown_options.every((_, index) => {
    return safeData.correct_answer_indices[index] !== undefined &&
      safeData.correct_answer_indices[index] >= 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Text with Dropdowns (use ___ for dropdowns)
        </label>
        <input
          type="text"
          value={safeData.text_with_dropdowns}
          onChange={(e) =>
            onChange({
              ...safeData,
              text_with_dropdowns: e.target.value,
            })
          }
          placeholder="Enter text with ___ for dropdowns"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Dropdown Options
        </label>
        <div className="space-y-4">
          {safeData.dropdown_options.map((dropdown, index) => (
            <div
              key={dropdown.dropdown_index}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dropdown {index + 1}
                </span>
                {safeData.dropdown_options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = safeData.dropdown_options.filter(
                        (_, i) => i !== index
                      );
                      const newCorrectIndices = [...safeData.correct_answer_indices];
                      newCorrectIndices.splice(index, 1);
                      onChange({
                        ...safeData,
                        dropdown_options: newOptions,
                        correct_answer_indices: newCorrectIndices,
                      });
                    }}
                    className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {/* Dropdown options list */}
              <div className="space-y-2 mb-3">
                {dropdown.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${index}`}
                      checked={safeData.correct_answer_indices[index] === optionIndex}
                      onChange={() => {
                        const newCorrectIndices = [...safeData.correct_answer_indices];
                        newCorrectIndices[index] = optionIndex;
                        onChange({
                          ...safeData,
                          correct_answer_indices: newCorrectIndices,
                        });
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...dropdown.options];
                        newOptions[optionIndex] = e.target.value;
                        const newDropdowns = [...safeData.dropdown_options];
                        newDropdowns[index] = {
                          ...dropdown,
                          options: newOptions,
                        };
                        onChange({
                          ...safeData,
                          dropdown_options: newDropdowns,
                        });
                      }}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                    />
                    {dropdown.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = dropdown.options.filter(
                            (_, i) => i !== optionIndex
                          );
                          const newDropdowns = [...safeData.dropdown_options];
                          newDropdowns[index] = {
                            ...dropdown,
                            options: newOptions,
                          };
                          // Adjust correct answer if needed
                          const newCorrectIndices = [...safeData.correct_answer_indices];
                          if (newCorrectIndices[index] === optionIndex) {
                            newCorrectIndices[index] = 0;
                          } else if (newCorrectIndices[index] > optionIndex) {
                            newCorrectIndices[index]--;
                          }
                          onChange({
                            ...safeData,
                            dropdown_options: newDropdowns,
                            correct_answer_indices: newCorrectIndices,
                          });
                        }}
                        className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-xs font-medium transition-colors duration-200"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = [...dropdown.options, ""];
                    const newDropdowns = [...safeData.dropdown_options];
                    newDropdowns[index] = { ...dropdown, options: newOptions };
                    onChange({
                      ...safeData,
                      dropdown_options: newDropdowns,
                    });
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm rounded-full transition-colors duration-200"
                >
                  + Add Option
                </button>
              </div>

              {/* Validation message for this dropdown */}
              {safeData.correct_answer_indices[index] === undefined && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Please select the correct answer for this dropdown.
                </p>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newDropdownIndex = safeData.dropdown_options.length;
              const newDropdowns = [
                ...safeData.dropdown_options,
                { dropdown_index: newDropdownIndex, options: ["", ""] },
              ];
              onChange({
                ...safeData,
                dropdown_options: newDropdowns,
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Dropdown
          </button>
        </div>
        
        {/* Overall validation message */}
        {!hasCorrectAnswers && safeData.dropdown_options.length > 0 && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Please select correct answers for all dropdowns.
          </p>
        )}
      </div>
    </div>
  );
};
