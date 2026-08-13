import React from "react";
import type { FillBlankData } from "../../../types/quiz.types";
import { Plus, X } from "lucide-react";

interface FillBlankQuestionFormProps {
  data: FillBlankData;
  onChange: (data: FillBlankData) => void;
}

export const FillBlankQuestionForm: React.FC<FillBlankQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Detect blanks in text
  const detectBlanks = (text: string) => {
    const blankRegex = /\[blank\]|\{\{blank\}\}/g;
    const matches = text.match(blankRegex);
    return matches ? matches.length : 0;
  };

  const blankCount = detectBlanks(data?.text_with_blanks || "");

  // Ensure acceptable_answers array has entries for all blanks
  const ensureAcceptableAnswers = (text: string) => {
    const count = detectBlanks(text);
    const currentAnswers = data?.acceptable_answers || [];

    if (currentAnswers.length < count) {
      const newAnswers = [...currentAnswers];
      for (let i = currentAnswers.length; i < count; i++) {
        newAnswers.push({ blank_index: i, answers: [""] });
      }
      return newAnswers;
    } else if (currentAnswers.length > count) {
      // Remove extra answers if blanks were removed
      return currentAnswers.slice(0, count);
    }
    return currentAnswers;
  };

  const handleTextChange = (text: string) => {
    const updatedAnswers = ensureAcceptableAnswers(text);
    onChange({
      ...data,
      text_with_blanks: text,
      acceptable_answers: updatedAnswers,
    });
  };

  const handleAnswerChange = (blankIndex: number, answers: string[]) => {
    const updatedAnswers = (data?.acceptable_answers || []).map((blank) =>
      blank.blank_index === blankIndex ? { ...blank, answers } : blank,
    );
    onChange({
      ...data,
      acceptable_answers: updatedAnswers,
    });
  };

  const handleCaseSensitiveChange = (
    blankIndex: number,
    caseSensitive: boolean,
  ) => {
    const updatedAnswers = (data?.acceptable_answers || []).map((blank) =>
      blank.blank_index === blankIndex
        ? { ...blank, case_sensitive: caseSensitive }
        : blank,
    );
    onChange({
      ...data,
      acceptable_answers: updatedAnswers,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Text with Blanks (use [blank] or {"{{blank}}"} for blanks)
        </label>
        <textarea
          value={data?.text_with_blanks || ""}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Enter text with [blank] or {{blank}} for blanks"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-800 dark:bg-gray-800/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
          rows={4}
        />
        {blankCount > 0 && (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Detected {blankCount} blank{blankCount !== 1 ? "s" : ""} in the text
          </p>
        )}
      </div>

      {blankCount > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
            Acceptable Answers for Each Blank
          </h4>

          {(data?.acceptable_answers || []).map((blank, index) => (
            <div
              key={blank.blank_index}
              className="border border-gray-200 dark:border-gray-800 rounded-2xl p-4 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                  Blank {blank.blank_index + 1}
                </h5>
                <label className="flex items-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  <input
                    type="checkbox"
                    checked={blank.case_sensitive || false}
                    onChange={(e) =>
                      handleCaseSensitiveChange(
                        blank.blank_index,
                        e.target.checked,
                      )
                    }
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-2xl"
                  />
                  Case sensitive
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                  Acceptable Answers (one per line, press Enter to add more)
                </label>
                <textarea
                  value={(blank.answers || []).join("\n")}
                  onChange={(e) => {
                    const answers = e.target.value
                      .split("\n")
                      .filter((ans) => ans.trim() !== "");
                    handleAnswerChange(blank.blank_index, answers);
                  }}
                  placeholder="Enter acceptable answers, one per line"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800/50 text-sm min-h-[80px] resize-y"
                  rows={3}
                />
                {(blank.answers || []).length === 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    At least one acceptable answer is required
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {blankCount === 0 && data?.text_with_blanks && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            No blanks detected. Use [blank] or {"{{blank}}"} in your text to
            create fill-in-the-blank questions.
          </p>
        </div>
      )}
    </div>
  );
};
