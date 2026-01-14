import React from "react";
import type { QuestionType } from "../../types/quiz.types";
import { Clock, AlertCircle } from "lucide-react";

interface BaseQuestionProps {
  questionId: number;
  questionType: QuestionType;
  questionText: string;
  points: number;
  timeLimit?: number;
  isRequired?: boolean;
  explanation?: string;
  showCorrectAnswer?: boolean;
  className?: string;
  children: React.ReactNode;
}

const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  true_false: "True/False",
  matching: "Matching",
  fill_blank: "Fill in the Blanks",
  dropdown: "Dropdown",
  numerical: "Numerical",
  algorithmic: "Algorithmic",
  short_answer: "Short Answer",
  coding: "Coding",
  logical_expression: "Logical Expression",
  drag_drop: "Drag & Drop",
  ordering: "Ordering",
};

export const BaseQuestion: React.FC<BaseQuestionProps> = ({
  questionType,
  questionText,
  points,
  timeLimit,
  isRequired = true,
  explanation,
  showCorrectAnswer = false,
  className = "",
  children,
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/70 overflow-hidden transition-all duration-300 animate-fadeInUp ${className}`}
    >
      {/* Question Header */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700/50">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 uppercase tracking-wide transition-colors duration-200 hover:bg-blue-200 dark:hover:bg-blue-800">
                {questionTypeLabels[questionType] ||
                  questionType.replace("_", " ")}
              </span>
              {isRequired && (
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Required
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words">
              {questionText}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium transition-all duration-200 hover:bg-blue-200 dark:hover:bg-blue-800 hover:scale-105">
              <span className="font-bold">{points}</span>
              <span className="ml-1">point{points !== 1 ? "s" : ""}</span>
            </span>
            {timeLimit && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 font-medium transition-all duration-200 hover:bg-yellow-200 dark:hover:bg-yellow-800 hover:scale-105">
                <Clock className="w-4 h-4" />
                <span>{timeLimit}s</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Question Content - Rendered by specific question types */}
      <div className="p-4 sm:p-6 transition-all duration-300">{children}</div>

      {/* Explanation (shown after answering if available) */}
      {showCorrectAnswer && explanation && (
        <div className="mx-4 sm:mx-6 mb-4 sm:mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 border-l-4 border-green-500 rounded-r-lg transition-all duration-300 animate-slideInLeft">
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="text-green-900 dark:text-green-100 font-semibold text-sm sm:text-base">
              Explanation
            </span>
          </div>
          <p className="text-green-800 dark:text-green-200 text-sm sm:text-base leading-relaxed ml-8">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
};

export default BaseQuestion;
