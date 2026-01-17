import React, { useMemo } from "react";
import {
  Binary,
  Scale,
  Baseline,
  AlertCircle,
  HelpCircle,
  Activity,
} from "lucide-react";
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

  // Validation - memoize for performance
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (
      typeof safeData.correct_answer !== "number" ||
      isNaN(safeData.correct_answer)
    ) {
      errs.push("Please enter a valid numerical correct answer");
    }
    if (safeData.tolerance !== undefined && safeData.tolerance < 0) {
      errs.push("Tolerance must be a positive number if provided");
    }
    return errs;
  }, [safeData]);

  const updateData = (newData: NumericalData) => {
    // Ensure correct_answer is always a valid number
    const sanitized: NumericalData = {
      ...newData,
      correct_answer:
        typeof newData.correct_answer === "number" &&
        !isNaN(newData.correct_answer)
          ? newData.correct_answer
          : 0,
    };

    onChange(sanitized);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
          <Binary className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Numerical Question
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Set up a question that requires a specific numeric value.
          </p>
        </div>
      </div>

      {/* Answer Configuration Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Value Setup
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Correct Answer */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <Binary className="w-3.5 h-3.5" />
              Target Answer
            </label>
            <input
              type="number"
              step="any"
              value={safeData.correct_answer || ""}
              onChange={(e) => {
                const val =
                  e.target.value === "" ? 0 : parseFloat(e.target.value);
                updateData({ ...safeData, correct_answer: val });
              }}
              placeholder="e.g., 42.5"
              className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
            />
          </div>

          {/* Tolerance */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" />
              Allowed Tolerance (±)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={safeData.tolerance ?? ""}
              onChange={(e) => {
                const val =
                  e.target.value === ""
                    ? undefined
                    : parseFloat(e.target.value);
                updateData({ ...safeData, tolerance: val });
              }}
              placeholder="Optional range"
              className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
            />
          </div>

          {/* Units */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <Baseline className="w-3.5 h-3.5" />
              Expected Units
            </label>
            <input
              type="text"
              value={safeData.units || ""}
              onChange={(e) =>
                updateData({ ...safeData, units: e.target.value })
              }
              placeholder="e.g., meters, kg"
              className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>

        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2 border border-blue-100 dark:border-blue-800/50">
          <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            If you provide a <strong>tolerance</strong>, answers within that
            range (Target ± Tolerance) will be marked as correct.
          </p>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
              Configuration Errors
            </h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
