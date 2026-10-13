import React from "react";
import type { CodingData } from "../../../types/quiz.types";

interface CodingProgressIndicatorProps {
  codingData: CodingData;
}

const PLACEHOLDER = /Enter test input|Test your|Enter expected output|Valid HTML|result/;

/** Input/output tests that are filled in (not the form's placeholders). */
const readyIoTests = (d: CodingData) =>
  d.test_cases?.filter((tc) => tc.input && tc.expected_output && !PLACEHOLDER.test(tc.input) && !PLACEHOLDER.test(tc.expected_output)).length || 0;

export const CodingProgressIndicator: React.FC<CodingProgressIndicatorProps> = ({ codingData }) => {
  const unit = codingData.check_with === "unit";
  const testsReady = unit ? codingData.unit_test_files?.filter((f) => f.path.trim() && f.content.trim()).length || 0 : readyIoTests(codingData);
  const testsTotal = unit ? codingData.unit_test_files?.length || 0 : codingData.test_cases?.length || 0;
  const hasCode = !!codingData.starter_code || !!codingData.project_files?.some((f) => f.content.trim());
  const steps = [
    { done: !!codingData.language, label: "Language" },
    { done: hasCode, label: "Template/Code" },
    { done: testsReady > 0, label: `${unit ? "Unit tests" : "Test Cases"} (${testsReady}/${testsTotal})` },
    { done: !!codingData.constraints, label: "Constraints" },
  ];
  const progress = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between text-sm text-text-secondary-light dark:text-text-secondary-dark">
        <span>Setup Progress</span>
        <span>{progress}% Complete</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
        {steps.map((s) => (
          <span key={s.label} className={s.done ? "font-medium text-green-600" : ""}>
            {s.done ? "✅" : "⭕"} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};
