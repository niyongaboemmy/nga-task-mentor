import React from "react";
import type { CodingData } from "../../../types/quiz.types";

interface CodingProgressIndicatorProps {
  codingData: CodingData;
}

export const CodingProgressIndicator: React.FC<
  CodingProgressIndicatorProps
> = ({ codingData }) => {
  const progress = (() => {
    const validTestCases =
      codingData.test_cases?.filter(
        (tc) =>
          tc.input &&
          tc.expected_output &&
          !tc.input.includes("Enter test input") &&
          !tc.input.includes("Test your") &&
          !tc.expected_output.includes("Enter expected output") &&
          !tc.expected_output.includes("Valid HTML") &&
          !tc.expected_output.includes("result")
      ).length || 0;

    return Math.round(
      (((codingData.language ? 1 : 0) +
        (codingData.starter_code ? 1 : 0) +
        (validTestCases > 0 ? 1 : 0) +
        (codingData.constraints ? 1 : 0)) /
        4) *
        100
    );
  })();

  const barWidth = `${progress}%`;

  const validTestCases =
    codingData.test_cases?.filter(
      (tc) =>
        tc.input &&
        tc.expected_output &&
        !tc.input.includes("Enter test input") &&
        !tc.input.includes("Test your") &&
        !tc.expected_output.includes("Enter expected output") &&
        !tc.expected_output.includes("Valid HTML") &&
        !tc.expected_output.includes("result")
    ).length || 0;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
        <span>Setup Progress</span>
        <span>{progress}% Complete</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
          style={{ width: barWidth }}
        ></div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span
          className={codingData.language ? "text-green-600 font-medium" : ""}
        >
          {codingData.language ? "✅" : "⭕"} Language
        </span>
        <span
          className={
            codingData.starter_code ? "text-green-600 font-medium" : ""
          }
        >
          {codingData.starter_code ? "✅" : "⭕"} Template/Code
        </span>
        <span
          className={validTestCases > 0 ? "text-green-600 font-medium" : ""}
        >
          {validTestCases > 0 ? "✅" : "⭕"} Test Cases ({validTestCases}/
          {codingData.test_cases?.length || 0})
        </span>
        <span
          className={codingData.constraints ? "text-green-600 font-medium" : ""}
        >
          {codingData.constraints ? "✅" : "⭕"} Constraints
        </span>
      </div>
    </div>
  );
};
