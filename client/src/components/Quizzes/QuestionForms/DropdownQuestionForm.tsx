import React, { useMemo } from "react";
import {
  ChevronDown,
  Type,
  ListPlus,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { DropdownData } from "../../../types/quiz.types";

interface DropdownQuestionFormProps {
  data: DropdownData & {
    correct_answer?: Array<{ dropdown_index: number; selected_option: string }>;
  };
  onChange: (
    data: DropdownData & {
      correct_answer?: Array<{
        dropdown_index: number;
        selected_option: string;
      }>;
    },
  ) => void;
}

export const DropdownQuestionForm: React.FC<DropdownQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Ensure data has default values with correct_answer
  const safeData = {
    text_with_dropdowns: data.text_with_dropdowns || "",
    dropdown_options: data.dropdown_options || [],
    correct_answer: data.correct_answer || [],
  };

  // Validation - memoize for performance
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!safeData.text_with_dropdowns.trim())
      errs.push("Question text required");

    if (safeData.dropdown_options.length === 0) {
      errs.push("At least one dropdown is required");
    } else {
      const allHaveAnswers = safeData.dropdown_options.every(
        (_: any, index: number) => {
          const correctItem = safeData.correct_answer.find(
            (item: any) => item.dropdown_index === index,
          );
          return (
            correctItem &&
            correctItem.selected_option &&
            correctItem.selected_option.trim()
          );
        },
      );
      if (!allHaveAnswers)
        errs.push("All dropdowns must have a correct answer selected");
    }
    return errs;
  }, [safeData]);

  const updateData = (newData: any) => {
    onChange(newData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-violet-50 dark:bg-violet-900/30 rounded-lg">
          <ChevronDown className="w-6 h-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Dropdown Question Setup
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create sentences with interactive dropdown choices.
          </p>
        </div>
      </div>

      {/* Text Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Question Text
          </h4>
        </div>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Type your sentence and use{" "}
            <code className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-mono text-xs font-bold mx-1">
              ___
            </code>{" "}
            (three underscores) where you want a dropdown to appear.
          </p>
        </div>

        <input
          type="text"
          value={safeData.text_with_dropdowns}
          onChange={(e) =>
            updateData({
              ...safeData,
              text_with_dropdowns: e.target.value,
            })
          }
          placeholder="e.g., The ___ of Japan is ___."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
        />
      </div>

      {/* Dropdowns Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Dropdown Options
            </h4>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
            {safeData.dropdown_options.length} Dropdowns
          </span>
        </div>

        <div className="space-y-6">
          {safeData.dropdown_options.map(
            (
              dropdown: { dropdown_index: number; options: string[] },
              index: number,
            ) => (
              <div
                key={dropdown.dropdown_index}
                className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:border-violet-300 dark:hover:border-violet-700 transition-all group"
              >
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      Dropdown Configuration
                    </span>
                  </div>
                  {safeData.dropdown_options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newOptions = safeData.dropdown_options.filter(
                          (_: any, i: number) => i !== index,
                        );
                        const newCorrectAnswer = safeData.correct_answer
                          .filter((item: any) => item.dropdown_index !== index)
                          .map((item: any) => ({
                            ...item,
                            dropdown_index:
                              item.dropdown_index > index
                                ? item.dropdown_index - 1
                                : item.dropdown_index,
                          }));
                        updateData({
                          ...safeData,
                          dropdown_options: newOptions,
                          correct_answer: newCorrectAnswer,
                        });
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                    Click the circle to select the correct answer:
                  </label>
                  {dropdown.options.map(
                    (option: string, optionIndex: number) => (
                      <div
                        key={optionIndex}
                        className="flex items-center gap-3 group/option"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const newCorrectAnswer = [
                              ...safeData.correct_answer,
                            ];
                            const existingIndex = newCorrectAnswer.findIndex(
                              (item: any) => item.dropdown_index === index,
                            );
                            const selectedOption =
                              dropdown.options[optionIndex];

                            if (existingIndex >= 0) {
                              newCorrectAnswer[existingIndex] = {
                                dropdown_index: index,
                                selected_option: selectedOption,
                              };
                            } else {
                              newCorrectAnswer.push({
                                dropdown_index: index,
                                selected_option: selectedOption,
                              });
                            }

                            updateData({
                              ...safeData,
                              correct_answer: newCorrectAnswer,
                            });
                          }}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            safeData.correct_answer.find(
                              (item: any) => item.dropdown_index === index,
                            )?.selected_option === dropdown.options[optionIndex]
                              ? "border-violet-500 bg-violet-500 text-white"
                              : "border-gray-300 dark:border-gray-600 hover:border-violet-400"
                          }`}
                        >
                          {safeData.correct_answer.find(
                            (item: any) => item.dropdown_index === index,
                          )?.selected_option ===
                            dropdown.options[optionIndex] && (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...dropdown.options];
                              newOptions[optionIndex] = e.target.value;
                              const newDropdowns = [
                                ...safeData.dropdown_options,
                              ];
                              newDropdowns[index] = {
                                ...dropdown,
                                options: newOptions,
                              };
                              updateData({
                                ...safeData,
                                dropdown_options: newDropdowns,
                              });
                            }}
                            placeholder={`Option ${optionIndex + 1}`}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                          />
                        </div>
                        {dropdown.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newOptions = dropdown.options.filter(
                                (_: any, i: number) => i !== optionIndex,
                              );
                              const newDropdowns = [
                                ...safeData.dropdown_options,
                              ];
                              newDropdowns[index] = {
                                ...dropdown,
                                options: newOptions,
                              };

                              // Update correct_answer if the removed option was selected
                              let newCorrectAnswer = [
                                ...safeData.correct_answer,
                              ];
                              const correctItem = newCorrectAnswer.find(
                                (item: any) => item.dropdown_index === index,
                              );
                              if (
                                correctItem &&
                                correctItem.selected_option ===
                                  dropdown.options[optionIndex]
                              ) {
                                // Reset to first option if the removed option was selected
                                const newItemIndex = newCorrectAnswer.findIndex(
                                  (item: any) => item.dropdown_index === index,
                                );
                                if (
                                  newItemIndex >= 0 &&
                                  newOptions.length > 0
                                ) {
                                  newCorrectAnswer[newItemIndex] = {
                                    dropdown_index: index,
                                    selected_option: newOptions[0],
                                  };
                                } else if (newItemIndex >= 0) {
                                  newCorrectAnswer.splice(newItemIndex, 1);
                                }
                              }

                              updateData({
                                ...safeData,
                                dropdown_options: newDropdowns,
                                correct_answer: newCorrectAnswer,
                              });
                            }}
                            className="p-1 px-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = [...dropdown.options, ""];
                      const newDropdowns = [...safeData.dropdown_options];
                      newDropdowns[index] = {
                        ...dropdown,
                        options: newOptions,
                      };
                      updateData({
                        ...safeData,
                        dropdown_options: newDropdowns,
                      });
                    }}
                    className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium flex items-center gap-1 py-1 px-2 rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 w-fit transition-colors mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Option
                  </button>
                </div>

                {!safeData.correct_answer.find(
                  (item: any) => item.dropdown_index === index,
                )?.selected_option && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded flex items-center gap-2 text-xs text-red-600 dark:text-red-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Select a correct answer
                  </div>
                )}
              </div>
            ),
          )}

          <button
            type="button"
            onClick={() => {
              const newDropdownIndex = safeData.dropdown_options.length;
              const newDropdowns = [
                ...safeData.dropdown_options,
                { dropdown_index: newDropdownIndex, options: ["", ""] },
              ];
              // Initialize correct_answer for the new dropdown with first option
              const newCorrectAnswer = [
                ...safeData.correct_answer,
                { dropdown_index: newDropdownIndex, selected_option: "" },
              ];
              updateData({
                ...safeData,
                dropdown_options: newDropdowns,
                correct_answer: newCorrectAnswer,
              });
            }}
            className="w-full py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all flex items-center justify-center gap-2 group"
          >
            <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/50 transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">Add Dropdown</span>
          </button>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
              Validation Errors
            </h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              {errors.map((err: string, i: number) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
