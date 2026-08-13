import React, { useState, useEffect } from "react";
import { Edit3 } from "lucide-react";
import type {
  FillBlankData,
  FillBlankAnswer,
  QuestionComponentProps,
} from "../../../types/quiz.types";
import RichTextDisplay from "../../Common/RichTextDisplay";
import InlineRichTextModal from "../../Common/InlineRichTextModal";

export const FillBlankQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
}) => {
  const questionData = question.question_data as FillBlankData;

  // Helper to safely parse answer data
  const parseAnswerData = (ans: any): FillBlankAnswer | null => {
    if (!ans) return null;
    if (typeof ans === "string") {
      try {
        return JSON.parse(ans) as FillBlankAnswer;
      } catch (e) {
        console.error("Failed to parse fill-blank answer:", e);
        return null;
      }
    }
    return ans as FillBlankAnswer;
  };

  const initialAnswer = parseAnswerData(answer);

  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>(
    initialAnswer?.answers?.reduce(
      (acc, blank: any) => {
        acc[blank.blank_index] = blank.answer;
        return acc;
      },
      {} as Record<number, string>,
    ) ?? {},
  );

  const [activeModalBlank, setActiveModalBlank] = useState<number | null>(null);

  useEffect(() => {
    const fillBlankAnswer = parseAnswerData(answer);
    if (fillBlankAnswer?.answers) {
      const newAnswers: Record<number, string> = {};
      fillBlankAnswer.answers.forEach((blank) => {
        newAnswers[blank.blank_index] = blank.answer;
      });
      setBlankAnswers(newAnswers);
    }
  }, [answer]);

  const handleBlankChange = (blankIndex: number, value: string) => {
    if (disabled) return;

    const newAnswers = { ...blankAnswers, [blankIndex]: value };
    setBlankAnswers(newAnswers);

    // Convert to answer format
    const answers = Object.entries(newAnswers).map(
      ([index, ans]: [string, string]) => ({
        blank_index: parseInt(index),
        answer: ans,
      }),
    );

    onAnswerChange({ answers });
  };

  // Parse the text to find blanks and split into parts
  const renderTextWithBlanks = () => {
    // Handle case where text_with_blanks is missing or undefined
    if (!questionData.text_with_blanks) {
      return (
        <span className="text-red-600 dark:text-red-400">
          Error: Question text is missing. Please contact your instructor.
        </span>
      );
    }

    // Standardize placeholders to a unique separator
    const standardizedText = questionData.text_with_blanks.replace(
      /\[blank\]/g,
      "{{blank}}",
    );

    const parts = standardizedText.split(/(\{\{blank\}\})/);
    let blankIndex = 0;

    return parts.map((part: string, index: number) => {
      if (part === "{{blank}}") {
        const currentBlankIndex = blankIndex++;
        const blankData = questionData.acceptable_answers?.find(
          (b: any) => b.blank_index === currentBlankIndex,
        );
        const currentAnswerState = blankAnswers[currentBlankIndex] || "";
        const isCorrect =
          showCorrectAnswer &&
          blankData?.answers.some(
            (ans: string) =>
              ans.toLowerCase() === currentAnswerState.toLowerCase(),
          );

        // Determine if the answer contains HTML tags indicating rich text
        const isRichText = /<[a-z][\s\S]*>/i.test(currentAnswerState);

        return (
          <span
            key={index}
            className={`inline-flex items-center gap-1 mx-1 border-b-2 transition-all duration-200 min-w-[80px] group ${
              disabled
                ? "border-gray-300 text-gray-400 cursor-not-allowed"
                : showCorrectAnswer
                  ? isCorrect
                    ? "border-green-500 text-green-700 bg-green-50/50"
                    : "border-red-500 text-red-700 bg-red-50/50"
                  : currentAnswerState
                    ? "border-blue-500 text-blue-700 dark:text-blue-400"
                    : "border-gray-400 text-text-primary-light dark:text-text-primary-dark"
            }`}
          >
            {isRichText ? (
              <div
                className="px-2 py-0.5 min-w-[60px] cursor-pointer"
                onClick={() =>
                  !disabled && setActiveModalBlank(currentBlankIndex)
                }
              >
                <RichTextDisplay
                  content={currentAnswerState}
                  className="prose-p:my-0 !text-inherit"
                />
              </div>
            ) : (
              <input
                type="text"
                value={currentAnswerState}
                onChange={(e) =>
                  handleBlankChange(currentBlankIndex, e.target.value)
                }
                onBlur={(e) => {
                  handleBlankChange(currentBlankIndex, e.target.value);
                }}
                disabled={disabled}
                placeholder={`...`}
                className="px-2 py-0.5 bg-transparent focus:outline-none focus:bg-blue-50/30 text-center w-full min-w-[60px] text-inherit font-inherit"
                style={{
                  width: `${Math.max(3, currentAnswerState.length) + 1}ch`,
                }}
              />
            )}

            {!disabled && (
              <button
                type="button"
                onClick={() => setActiveModalBlank(currentBlankIndex)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-all rounded hover:bg-auto shrink-0 focus:opacity-100"
                title="Open Rich Editor (for formulas & special formatting)"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        );
      }

      return (
        <RichTextDisplay
          key={index}
          content={part}
          className="!inline text-text-primary-light dark:text-text-primary-dark bg-transparent [&_p]:!inline [&_p]:!m-0 [&_div]:!inline"
        />
      );
    });
  };

  // Check if all required blanks are filled
  const allBlanksFilled =
    questionData.acceptable_answers?.every(
      (blank) => blankAnswers[blank.blank_index]?.trim() !== "",
    ) ?? false;

  return (
    <div className="space-y-4">
      <div className="max-w-4xl mx-auto">
        {/* Question text with blanks */}
        <div className="text-lg leading-loose py-6 font-serif">
          {renderTextWithBlanks()}
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-4">
          <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Blanks completed:{" "}
            {
              Object.values(blankAnswers).filter(
                (a: string) => a?.trim() !== "",
              ).length
            }{" "}
            / {questionData.acceptable_answers?.length || 0}
          </div>
        </div>

        {/* Case sensitivity info */}
        {questionData.acceptable_answers?.some(
          (blank) => blank.case_sensitive,
        ) && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl">
            <div className="text-sm text-blue-800 dark:text-blue-200 text-center">
              <strong>Note:</strong> Some blanks are case-sensitive
            </div>
          </div>
        )}

        {/* Acceptable answers preview (for instructors) */}
        {showCorrectAnswer && questionData.acceptable_answers && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
              Acceptable answers:
            </div>
            {questionData.acceptable_answers.map(
              (blank: any, index: number) => (
                <div
                  key={index}
                  className="text-sm text-text-secondary-light dark:text-text-secondary-dark bg-gray-50 dark:bg-gray-800 p-2 rounded-2xl"
                >
                  <span className="font-medium">Blank {index + 1}:</span>{" "}
                  {blank.answers.join(", ")}
                  {blank.case_sensitive && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                      (case-sensitive)
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
        )}

        {/* Validation warning */}
        {!disabled &&
          !allBlanksFilled &&
          Object.keys(blankAnswers).length > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-2xl">
              <div className="flex items-center justify-center">
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                  ⚠️ Please fill in all blanks before submitting
                </span>
              </div>
            </div>
          )}

        {/* Timer warning */}
        {timeRemaining !== undefined &&
          timeRemaining <= 30 &&
          timeRemaining > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-2xl">
              <div className="flex items-center justify-center">
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                  ⏰ Time remaining: {timeRemaining} seconds
                </span>
              </div>
            </div>
          )}
      </div>

      <InlineRichTextModal
        isOpen={activeModalBlank !== null}
        onClose={() => setActiveModalBlank(null)}
        initialContent={
          activeModalBlank !== null ? blankAnswers[activeModalBlank] || "" : ""
        }
        onSave={(content) => {
          if (activeModalBlank !== null) {
            handleBlankChange(activeModalBlank, content);
          }
        }}
        title={`Edit Blank ${activeModalBlank !== null ? activeModalBlank + 1 : ""}`}
      />
    </div>
  );
};

export default FillBlankQuestion;
