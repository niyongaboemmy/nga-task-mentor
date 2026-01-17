import React from "react";
import type { FillBlankData } from "../../../types/quiz.types";

interface FillBlankQuestionFormProps {
  data: FillBlankData;
  onChange: (data: FillBlankData) => void;
}

export const FillBlankQuestionForm: React.FC<FillBlankQuestionFormProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Text with Blanks (use __ for blanks)
        </label>
        <input
          type="text"
          value={data?.text_with_blanks || ""}
          onChange={(e) =>
            onChange({
              ...data,
              text_with_blanks: e.target.value,
            })
          }
          placeholder="Enter text with __ for blanks"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};
