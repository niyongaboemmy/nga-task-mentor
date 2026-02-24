import React from "react";
import type { NumericalData } from "../../../types/quiz.types";

interface NumericalQuestionFormProps {
  data: NumericalData;
  onChange: (data: NumericalData) => void;
}

export const NumericalQuestionForm: React.FC<NumericalQuestionFormProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Correct Answer
        </label>
        <input
          type="number"
          step="0.01"
          value={data.correct_answer || ""}
          onChange={(e) =>
            onChange({
              ...data,
              correct_answer: parseFloat(e.target.value),
            })
          }
          placeholder="0"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Tolerance (optional)
        </label>
        <input
          type="number"
          step="0.01"
          value={data.tolerance || ""}
          onChange={(e) =>
            onChange({
              ...data,
              tolerance: parseFloat(e.target.value) || undefined,
            })
          }
          placeholder="0"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Units (optional)
        </label>
        <input
          type="text"
          value={data.units || ""}
          onChange={(e) =>
            onChange({
              ...data,
              units: e.target.value,
            })
          }
          placeholder="e.g., meters, kg, etc."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
    </div>
  );
};
