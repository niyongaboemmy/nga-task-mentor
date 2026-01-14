import React from "react";
import type { ShortAnswerData } from "../../../types/quiz.types";

interface ShortAnswerQuestionFormProps {
  data: ShortAnswerData;
  onChange: (data: ShortAnswerData) => void;
}

export const ShortAnswerQuestionForm: React.FC<ShortAnswerQuestionFormProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Maximum Length (optional)
        </label>
        <input
          type="number"
          value={data?.max_length || 500}
          onChange={(e) =>
            onChange({
              ...data,
              max_length: parseInt(e.target.value) || 500,
            })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};
