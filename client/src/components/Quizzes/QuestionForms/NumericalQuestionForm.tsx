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
  // Ensure data has required properties with defaults
  const safeData: NumericalData = {
    correct_answer: data?.correct_answer ?? 0,
    tolerance: data?.tolerance,
    precision: data?.precision,
    units: data?.units,
    acceptable_range: data?.acceptable_range,
  };

  // Validate correct answer
  const isValidCorrectAnswer =
    typeof safeData.correct_answer === "number" &&
    !isNaN(safeData.correct_answer);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Correct Answer
        </label>
        <input
          type="number"
          step="0.01"
          value={safeData.correct_answer || ""}
          onChange={(e) => {
            const value = e.target.value;
            const numValue = value === "" ? 0 : parseFloat(value);
            onChange({
              ...safeData,
              correct_answer: numValue || 0,
            });
          }}
          placeholder="0"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
        {!isValidCorrectAnswer && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Please enter a valid numerical answer.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Tolerance (optional)
        </label>
        <input
          type="number"
          step="0.01"
          value={data.tolerance || ""}
          onChange={(e) => {
            const newTolerance = parseFloat(e.target.value) || undefined;
            onChange({
              ...safeData,
              tolerance: newTolerance,
            });
          }}
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
          onChange={(e) => {
            onChange({
              ...safeData,
              units: e.target.value,
            });
          }}
          placeholder="e.g., meters, kg, etc."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
      </div>
    </div>
  );
};
