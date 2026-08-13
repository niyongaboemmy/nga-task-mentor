import React from "react";
import { Info, HelpCircle } from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";
import { ConstraintChips } from "./ConstraintChips";

interface CodingConstraintsTabProps {
  codingData: CodingData;
  /** The original (non-memoized) data — used for stale-state-safe reads */
  rawData: CodingData;
  onChange: (data: CodingData) => void;
}

export const CodingConstraintsTab: React.FC<CodingConstraintsTabProps> = ({
  codingData,
  rawData,
  onChange,
}) => (
  <div className="space-y-6">
    {/* Constraints text */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📋</span>
        <label className="font-semibold text-text-secondary-light dark:text-text-secondary-dark text-sm">
          Guidelines & Instructions (Optional)
        </label>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Click on the chips below to quickly append common requirements, or type
        your own instructions.
      </p>
      <textarea
        value={rawData.constraints || ""}
        onChange={(e) =>
          onChange({ ...codingData, constraints: e.target.value })
        }
        placeholder="e.g. O(n) time complexity, mobile-first design, do not use external libraries..."
        rows={6}
        className="w-full px-4 py-3 mb-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all text-sm"
      />
      <ConstraintChips
        language={codingData.language.toLowerCase()}
        currentText={rawData.constraints || ""}
        onChange={(newText) =>
          onChange({ ...codingData, constraints: newText })
        }
      />
    </div>

    {/* Optional Advanced Limits */}
    <details className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 open:pb-5">
      <summary className="cursor-pointer font-semibold text-sm text-text-secondary-light dark:text-text-secondary-dark p-5 select-none hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl list-none flex justify-between items-center group-open:rounded-b-none group-open:bg-gray-50 dark:group-open:bg-gray-700/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          Advanced Execution Limits (Optional)
        </div>
        <span className="text-gray-400 group-open:rotate-180 transition-transform">
          ▼
        </span>
      </summary>

      <div className="px-5 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block font-semibold text-text-secondary-light dark:text-text-secondary-dark text-sm mb-2">
            Time Limit (s)
          </label>
          <input
            type="number"
            value={rawData.time_limit ?? 2}
            onChange={(e) =>
              onChange({
                ...codingData,
                time_limit: parseFloat(e.target.value) || 2,
              })
            }
            step="0.1"
            min="0.1"
            max="30"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-gray-400">Default: 2s · Max: 30s</p>
        </div>

        <div>
          <label className="block font-semibold text-text-secondary-light dark:text-text-secondary-dark text-sm mb-2">
            Memory Limit (KB)
          </label>
          <input
            type="number"
            value={rawData.memory_limit ?? 256000}
            onChange={(e) =>
              onChange({
                ...codingData,
                memory_limit: parseInt(e.target.value) || 256000,
              })
            }
            step="1000"
            min="1000"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Default: 256 MB (256 000 KB)
          </p>
        </div>
      </div>
    </details>
  </div>
);
