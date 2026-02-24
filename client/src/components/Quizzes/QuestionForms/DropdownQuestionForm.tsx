import React from "react";
import type { DropdownData } from "../../../types/quiz.types";

interface DropdownQuestionFormProps {
  data: DropdownData;
  onChange: (data: DropdownData) => void;
}

export const DropdownQuestionForm: React.FC<DropdownQuestionFormProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Text with Dropdowns (use ___ for dropdowns)
        </label>
        <input
          type="text"
          value={data.text_with_dropdowns}
          onChange={(e) =>
            onChange({
              ...data,
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
          {data.dropdown_options.map((dropdown, index) => (
            <div
              key={dropdown.dropdown_index}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dropdown {index + 1}
                </span>
                {data.dropdown_options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = data.dropdown_options.filter(
                        (_, i) => i !== index
                      );
                      onChange({
                        ...data,
                        dropdown_options: newOptions,
                      });
                    }}
                    className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {dropdown.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...dropdown.options];
                        newOptions[optionIndex] = e.target.value;
                        const newDropdowns = [...data.dropdown_options];
                        newDropdowns[index] = {
                          ...dropdown,
                          options: newOptions,
                        };
                        onChange({
                          ...data,
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
                          const newDropdowns = [...data.dropdown_options];
                          newDropdowns[index] = {
                            ...dropdown,
                            options: newOptions,
                          };
                          onChange({
                            ...data,
                            dropdown_options: newDropdowns,
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
                    const newDropdowns = [...data.dropdown_options];
                    newDropdowns[index] = { ...dropdown, options: newOptions };
                    onChange({
                      ...data,
                      dropdown_options: newDropdowns,
                    });
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm rounded-full transition-colors duration-200"
                >
                  + Add Option
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newDropdownIndex = data.dropdown_options.length;
              const newDropdowns = [
                ...data.dropdown_options,
                { dropdown_index: newDropdownIndex, options: ["", ""] },
              ];
              onChange({
                ...data,
                dropdown_options: newDropdowns,
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Dropdown
          </button>
        </div>
      </div>
    </div>
  );
};
