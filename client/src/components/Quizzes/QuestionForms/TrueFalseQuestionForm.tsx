import React from "react";
import type { TrueFalseData } from "../../../types/quiz.types";

interface TrueFalseQuestionFormProps {
  data: TrueFalseData & { correct_answer?: boolean };
  onChange: (data: TrueFalseData & { correct_answer?: boolean }) => void;
}

export const TrueFalseQuestionForm: React.FC<TrueFalseQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Ensure data has required properties with defaults
  const rawCorrectAnswer = data?.correct_answer ?? null;

  // Validate correct answer
  const isValidCorrectAnswer = typeof rawCorrectAnswer === "boolean";

  const safeData: TrueFalseData & { correct_answer?: boolean } = {
    correct_answer: rawCorrectAnswer,
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Correct Answer
        </label>
        <div className="flex gap-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="correct_answer"
              value="true"
              checked={safeData.correct_answer === true}
              onChange={(e) =>
                onChange({
                  correct_answer: e.target.value === "true",
                })
              }
              className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-gray-900 dark:text-white font-medium">
              True
            </span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="correct_answer"
              value="false"
              checked={safeData.correct_answer === false}
              onChange={(e) =>
                onChange({
                  correct_answer: e.target.value !== "false",
                })
              }
              className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-gray-900 dark:text-white font-medium">
              False
            </span>
          </label>
        </div>
        {!isValidCorrectAnswer && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Please select either True or False as the correct answer.
          </p>
        )}
      </div>
    </div>
  );
};
