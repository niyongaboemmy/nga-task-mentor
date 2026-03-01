import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  DropdownData,
  DropdownAnswer,
  AnswerDataType,
} from "../../../types/quiz.types";
import {
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

// Extended answer type for component state management
interface DropdownAnswerWithState extends DropdownAnswer {
  feedback?: Record<number, boolean>;
  score?: number;
  submitted?: boolean;
}

export const DropdownQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining: _, // Timer functionality for future implementation
}) => {
  const dropdownData: DropdownData = question.question_data as DropdownData;

  // Parse the text_with_dropdowns to create segments
  const createSegments = () => {
    // Validate question data
    if (!dropdownData) {
      return [
        {
          type: "text" as const,
          content:
            "Error: Question data is missing. Please contact your instructor.",
        },
      ];
    }

    if (!dropdownData.text_with_dropdowns) {
      return [
        {
          type: "text" as const,
          content:
            "Error: Question text is missing. Please contact your instructor.",
        },
      ];
    }

    if (
      !dropdownData.dropdown_options ||
      !Array.isArray(dropdownData.dropdown_options)
    ) {
      return [
        {
          type: "text" as const,
          content:
            "Error: Dropdown options are missing. Please contact your instructor.",
        },
      ];
    }

    const segments: Array<{
      type: "text" | "dropdown";
      content?: string;
      dropdownIndex?: number;
    }> = [];
    const text = dropdownData.text_with_dropdowns;

    // Split by {{dropdown}} placeholder
    const parts = text.split(/\{\{dropdown\}\}/);

    parts.forEach((part, index) => {
      if (part.trim()) {
        segments.push({ type: "text", content: part });
      }

      // Add dropdown if not the last part
      if (index < parts.length - 1) {
        const dropdownOption = dropdownData.dropdown_options[index];
        if (dropdownOption) {
          segments.push({
            type: "dropdown",
            dropdownIndex: dropdownOption.dropdown_index,
          });
        }
      }
    });

    return segments;
  };

  const segments = createSegments();

  // Helper to safely parse answer data
  const parseAnswerData = (ans: any): DropdownAnswer | null => {
    if (!ans) return null;
    if (typeof ans === "string") {
      try {
        return JSON.parse(ans) as DropdownAnswer;
      } catch (e) {
        console.error("Failed to parse dropdown answer:", e);
        return null;
      }
    }
    return ans as DropdownAnswer;
  };

  const initialAnswer = parseAnswerData(answer);

  const [selections, setSelections] = useState<Record<number, string>>(
    initialAnswer?.selections?.reduce(
      (acc, sel) => {
        acc[sel.dropdown_index] = sel.selected_option;
        return acc;
      },
      {} as Record<number, string>,
    ) || {},
  );
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dropdownAnswer = parseAnswerData(answer) as DropdownAnswerWithState;
    if (dropdownAnswer?.selections) {
      const newSelections: Record<number, string> = {};
      dropdownAnswer.selections.forEach((sel) => {
        newSelections[sel.dropdown_index] = sel.selected_option;
      });
      setSelections(newSelections);
      setSubmitted(dropdownAnswer.submitted || false);
      setFeedback(dropdownAnswer.feedback || {});
      setScore(dropdownAnswer.score || 0);
    }
  }, [answer]);

  const handleSelectionChange = (dropdownIndex: number, value: string) => {
    const newSelections = { ...selections, [dropdownIndex]: value };
    setSelections(newSelections);

    if (!submitted) {
      const dropdownAnswer: DropdownAnswer = {
        selections: Object.entries(newSelections).map(([index, option]) => ({
          dropdown_index: parseInt(index),
          selected_option: option,
        })),
      };

      onAnswerChange(dropdownAnswer as AnswerDataType);
    }
  };

  const handleSaveAnswer = async () => {
    if (!dropdownData?.dropdown_options) return;
    setIsSaving(true);
    try {
      const dropdownAnswer: DropdownAnswerWithState = {
        selections: Object.entries(selections).map(([index, option]) => ({
          dropdown_index: parseInt(index),
          selected_option: option,
        })),
        submitted: true,
      };

      setSubmitted(true);
      await onAnswerChange(dropdownAnswer as AnswerDataType, true);
    } finally {
      setIsSaving(false);
    }
  };

  const resetAnswer = () => {
    setSelections({});
    setSubmitted(false);
    setFeedback({});
    setScore(0);

    const dropdownAnswer: DropdownAnswer = {
      selections: [],
    };

    onAnswerChange(dropdownAnswer as AnswerDataType);
  };

  const allDropdownsFilled =
    dropdownData?.dropdown_options?.every((option) =>
      selections[option.dropdown_index]?.trim(),
    ) || false;

  const allCorrect = Object.values(feedback).every((v) => v === true);

  const getDropdownStatus = (dropdownIndex: number) => {
    if (!submitted) return null;
    return feedback[dropdownIndex];
  };

  return (
    <div className="space-y-6">
      {/* Question Prompt */}
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-3xl p-8 shadow-sm">
        <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-blue-500" />
          Complete the Statement
        </h3>
        <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg">
          {segments.map((segment, index) => {
            if (segment.type === "text") {
              return (
                <span key={index} className="inline">
                  {segment.content}
                </span>
              );
            }

            if (
              segment.type === "dropdown" &&
              segment.dropdownIndex !== undefined &&
              dropdownData?.dropdown_options
            ) {
              const dropdownOption = dropdownData.dropdown_options.find(
                (opt) => opt.dropdown_index === segment.dropdownIndex,
              );
              const status = getDropdownStatus(segment.dropdownIndex);
              const selectedValue = selections[segment.dropdownIndex] || "";

              if (!dropdownOption) return null;

              return (
                <span key={index} className="inline-block mx-1 align-middle">
                  <div className="relative inline-block min-w-[200px]">
                    <select
                      value={selectedValue}
                      onChange={(e) =>
                        handleSelectionChange(
                          segment.dropdownIndex!,
                          e.target.value,
                        )
                      }
                      disabled={disabled || submitted}
                      className={`appearance-none w-full px-4 py-2 pr-10 border-2 rounded-lg text-sm font-medium transition-all ${
                        disabled || submitted
                          ? "cursor-not-allowed bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400"
                          : "cursor-pointer bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500"
                      } ${
                        status === true && showCorrectAnswer
                          ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-300"
                          : status === false && showCorrectAnswer
                            ? "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-300"
                            : selectedValue
                              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300"
                              : "border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      <option value="" disabled>
                        Select an option
                      </option>
                      {dropdownOption.options.map((option, optIndex) => (
                        <option
                          key={optIndex}
                          value={
                            typeof option === "object" && option !== null
                              ? (option as any).text
                              : option
                          }
                        >
                          {typeof option === "object" && option !== null
                            ? (option as any).text
                            : option}
                        </option>
                      ))}
                    </select>

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                      {status === true && showCorrectAnswer && (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                      {status === false && showCorrectAnswer && (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                      {!submitted && (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </span>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Action Buttons */}
      {!submitted && (
        <div className="flex gap-3">
          <button
            onClick={handleSaveAnswer}
            disabled={disabled || isSaving || !allDropdownsFilled}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
          >
            {isSaving ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Answer
              </>
            )}
          </button>

          <button
            onClick={resetAnswer}
            disabled={disabled || Object.keys(selections).length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-2xl hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-sm font-medium"
          >
            <XCircle className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {/* Feedback */}
      {submitted && (
        <div
          className={`border-2 rounded-2xl p-6 ${
            allCorrect
              ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
              : "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10"
          }`}
        >
          <div className="flex items-start gap-4">
            {allCorrect ? (
              <div className="bg-green-500 text-white rounded-full p-2">
                <CheckCircle className="w-6 h-6" />
              </div>
            ) : (
              <div className="bg-yellow-500 text-white rounded-full p-2">
                <AlertCircle className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-xl mb-1 text-gray-900 dark:text-gray-100">
                {showCorrectAnswer
                  ? allCorrect
                    ? "Perfect Score!"
                    : "Review Your Answer"
                  : "Answer Saved"}
              </h3>
              {showCorrectAnswer && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Score:{" "}
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {score.toFixed(0)}%
                  </span>{" "}
                  ({Object.values(feedback).filter((v) => v).length}/
                  {Object.values(feedback).length} correct)
                </p>
              )}

              {!allCorrect && dropdownData?.dropdown_options && (
                <div className="mt-3 space-y-2">
                  {dropdownData.dropdown_options
                    .filter((option) => !feedback[option.dropdown_index])
                    .map((option) => (
                      <div
                        key={option.dropdown_index}
                        className="bg-white dark:bg-gray-800 border border-yellow-300 dark:border-yellow-800 rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <div className="font-bold text-gray-900 dark:text-gray-100">
                              Your answer:{" "}
                              <span className="text-red-700 dark:text-red-400">
                                {selections[option.dropdown_index] || "(empty)"}
                              </span>
                            </div>
                            {showCorrectAnswer && (
                              <div className="text-gray-700 dark:text-gray-300 mt-1 flex items-center gap-2">
                                <span className="font-bold">
                                  Correct answer:
                                </span>
                                <span className="text-green-700 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/40 px-2 py-0.5 rounded">
                                  {option.options[0]}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Correct Answer Display (Review Mode) */}
      {showCorrectAnswer && !submitted && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-800 rounded-3xl p-8 shadow-sm animate-fadeIn">
          <h3 className="font-bold text-xl mb-4 text-blue-900 dark:text-blue-300 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Correct Sequence
          </h3>
          <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg">
            {segments.map((segment, index) => {
              if (segment.type === "text") {
                return (
                  <span key={index} className="inline">
                    {segment.content}
                  </span>
                );
              }

              if (
                segment.type === "dropdown" &&
                segment.dropdownIndex !== undefined &&
                dropdownData?.dropdown_options
              ) {
                const dropdownOption = dropdownData.dropdown_options.find(
                  (opt) => opt.dropdown_index === segment.dropdownIndex,
                );

                if (dropdownOption) {
                  const correctSelections =
                    (question.correct_answer as any)?.selections || [];
                  const correctSel = correctSelections.find(
                    (s: any) => s.dropdown_index === segment.dropdownIndex,
                  );
                  const correctAnswer = correctSel
                    ? correctSel.selected_option
                    : dropdownOption.options[0];

                  return (
                    <span
                      key={index}
                      className="inline-block mx-2 px-4 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-bold rounded-xl border-2 border-green-200 dark:border-green-800 shadow-sm"
                    >
                      {correctAnswer}
                    </span>
                  );
                }
              }

              return null;
            })}
          </div>
        </div>
      )}

      {/* Hint for empty dropdowns */}
      {!submitted && !allDropdownsFilled && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
              Please complete all dropdown selections before submitting your
              answer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownQuestion;
