import React from "react";
import type { TrueFalseData } from "../../../types/quiz.types";

interface TrueFalseQuestionFormProps {
  data: TrueFalseData;
  onChange: (data: TrueFalseData) => void;
}

export const TrueFalseQuestionForm: React.FC<TrueFalseQuestionFormProps> = ({
  data,
  onChange,
}) => {
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
              checked={data.correct_answer === true}
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
              checked={data.correct_answer === false}
              onChange={(e) =>
                onChange({
                  correct_answer: e.target.value === "true",
                })
              }
              className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-gray-900 dark:text-white font-medium">
              False
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
