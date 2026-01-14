import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  DropdownData,
  DropdownAnswer,
  AnswerDataType,
} from "../../../types/quiz.types";
import { ChevronDown, CheckCircle, XCircle, AlertCircle } from "lucide-react";

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

  const [selections, setSelections] = useState<Record<number, string>>(
    (answer as DropdownAnswer)?.selections?.reduce((acc, sel) => {
      acc[sel.dropdown_index] = sel.selected_option;
      return acc;
    }, {} as Record<number, string>) || {}
  );
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (answer) {
      const dropdownAnswer = answer as DropdownAnswerWithState;
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

  const validateAnswer = () => {
    if (!dropdownData?.dropdown_options) return;

    const newFeedback: Record<number, boolean> = {};
    let correctCount = 0;
    let totalCount = 0;

    dropdownData.dropdown_options.forEach((dropdownOption) => {
      totalCount++;
      const userAnswer = selections[dropdownOption.dropdown_index];

      // For dropdown questions, we need to determine the correct answer
      // This would typically come from a separate correct_answers field
      // For now, we'll assume the first option is correct for demonstration
      const correctAnswer = dropdownOption.options[0];

      const isCorrect = userAnswer === correctAnswer;
      newFeedback[dropdownOption.dropdown_index] = isCorrect;
      if (isCorrect) correctCount++;
    });

    const calculatedScore =
      totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    setFeedback(newFeedback);
    setSubmitted(true);
    setScore(calculatedScore);

    const dropdownAnswer: DropdownAnswerWithState = {
      selections: Object.entries(selections).map(([index, option]) => ({
        dropdown_index: parseInt(index),
        selected_option: option,
      })),
      feedback: newFeedback,
      score: calculatedScore,
      submitted: true,
    };

    onAnswerChange(dropdownAnswer as AnswerDataType);
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
      selections[option.dropdown_index]?.trim()
    ) || false;

  const allCorrect = Object.values(feedback).every((v) => v === true);

  const getDropdownStatus = (dropdownIndex: number) => {
    if (!submitted) return null;
    return feedback[dropdownIndex];
  };

  return (
    <div className="space-y-6">
      {/* Question Prompt */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">
          Complete the Statement
        </h3>
        <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
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
                (opt) => opt.dropdown_index === segment.dropdownIndex
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
                          e.target.value
                        )
                      }
                      disabled={disabled || submitted}
                      className={`appearance-none w-full px-4 py-2 pr-10 border-2 rounded-lg text-sm font-medium transition-all ${
                        disabled || submitted
                          ? "cursor-not-allowed bg-gray-50"
                          : "cursor-pointer bg-white hover:border-blue-400"
                      } ${
                        status === true
                          ? "border-green-400 bg-green-50 text-green-900"
                          : status === false
                          ? "border-red-400 bg-red-50 text-red-900"
                          : selectedValue
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      <option value="" disabled>
                        Select an option
                      </option>
                      {dropdownOption.options.map((option, optIndex) => (
                        <option key={optIndex} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                      {status === true && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {status === false && (
                        <XCircle className="w-4 h-4 text-red-600" />
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
            onClick={validateAnswer}
            disabled={disabled || !allDropdownsFilled}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Submit Answer
          </button>

          <button
            onClick={resetAnswer}
            disabled={disabled || Object.keys(selections).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {/* Feedback */}
      {submitted && (
        <div
          className={`border rounded-lg p-4 ${
            allCorrect
              ? "border-green-200 bg-green-50"
              : "border-yellow-200 bg-yellow-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {allCorrect ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">
                {allCorrect ? "Perfect!" : "Review Your Answer"}
              </h3>
              <p className="text-sm text-gray-700 mb-2">
                Score: {score.toFixed(0)}% (
                {Object.values(feedback).filter((v) => v).length}/
                {Object.values(feedback).length} correct)
              </p>

              {!allCorrect && dropdownData?.dropdown_options && (
                <div className="mt-3 space-y-2">
                  {dropdownData.dropdown_options
                    .filter((option) => !feedback[option.dropdown_index])
                    .map((option) => (
                      <div
                        key={option.dropdown_index}
                        className="bg-white border border-yellow-300 rounded p-3"
                      >
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              Your answer:{" "}
                              <span className="text-red-700">
                                {selections[option.dropdown_index]}
                              </span>
                            </div>
                            {showCorrectAnswer && (
                              <div className="text-gray-700 mt-1">
                                Correct answer:{" "}
                                <span className="text-green-700 font-medium">
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

              <button
                onClick={resetAnswer}
                disabled={disabled}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correct Answer Display (Review Mode) */}
      {showCorrectAnswer && !submitted && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-900">
            Correct Answer
          </h3>
          <div className="text-gray-700 leading-relaxed">
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
                  (opt) => opt.dropdown_index === segment.dropdownIndex
                );

                if (dropdownOption) {
                  return (
                    <span
                      key={index}
                      className="inline-block mx-1 px-3 py-1 bg-green-100 text-green-800 font-medium rounded border border-green-300"
                    >
                      {dropdownOption.options[0]}
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Please fill in all dropdown selections before submitting your
              answer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownQuestion;
