import React from "react";
import { Check } from "lucide-react";

/**
 * Numbered steps with true circles (fixed square box + rounded-full, border
 * instead of a ring so nothing gets clipped). On small screens only the
 * current step keeps its label.
 */
const StepIndicator: React.FC<{ steps: string[]; current: number }> = ({ steps, current }) => (
  <ol className="flex items-center gap-2 mt-1.5 py-0.5" aria-label="Progress">
    {steps.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <li key={label} className="flex items-center gap-2 min-w-0" aria-current={active ? "step" : undefined}>
          <span
            className={`inline-flex shrink-0 items-center justify-center w-6 h-6 aspect-square rounded-full border-2 text-[11px] font-bold leading-none transition-colors ${
              done
                ? "border-blue-600 bg-blue-600 text-white"
                : active
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-500"
            }`}
          >
            {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span
            className={`text-xs whitespace-nowrap ${
              active
                ? "font-semibold text-text-primary-light dark:text-text-primary-dark"
                : `hidden sm:inline ${done ? "text-blue-700 dark:text-blue-300" : "text-gray-400"}`
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <span className={`w-5 sm:w-8 h-0.5 rounded-full shrink-0 ${done ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} aria-hidden />
          )}
        </li>
      );
    })}
  </ol>
);

export default StepIndicator;
