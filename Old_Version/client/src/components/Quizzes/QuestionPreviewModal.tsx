import React, { useState } from "react";
import Modal from "../ui/Modal";
import QuizQuestion from "./QuizQuestion";
import type { QuizQuestion as QuizQuestionType } from "../../types/quiz.types";
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Monitor,
  Eye,
} from "lucide-react";
import { CodePreviewModal } from "./CodePreviewModal";

interface QuestionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuizQuestionType;
  questionNumber: number;
  allQuestions?: QuizQuestionType[];
  onNavigate?: (questionIndex: number) => void;
}

export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({
  isOpen,
  onClose,
  question,
  questionNumber,
  allQuestions = [],
  onNavigate,
}) => {
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);

  const currentIndex = allQuestions.findIndex((q) => q.id === question.id);
  const hasNavigation = allQuestions.length > 1 && onNavigate;

  const handlePrevious = () => {
    if (hasNavigation && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (hasNavigation && currentIndex < allQuestions.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  const getQuestionTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      single_choice: "Single Choice",
      multiple_choice: "Multiple Choice",
      true_false: "True/False",
      numerical: "Numerical",
      fill_blank: "Fill in the Blank",
      matching: "Matching",
      dropdown: "Dropdown",
      algorithmic: "Algorithmic",
      short_answer: "Short Answer",
      coding: "Coding",
      logical_expression: "Logical Expression",
      drag_drop: "Drag & Drop",
      ordering: "Ordering",
    };
    return typeMap[type] || type.replace("_", " ").toUpperCase();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Question Preview"
      subtitle="This is exactly how students will see this question"
      size="xl"
      className="max-w-6xl"
    >
      <div className="space-y-3">
        {/* Preview Controls */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-2">
          <div className="flex items-center gap-4">
            {/* Device Preview Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-1">
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    previewMode === "desktop"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  Desktop
                </button>
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    previewMode === "mobile"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  Mobile
                </button>
              </div>
            </div>

            {/* Question Navigation */}
            {hasNavigation && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === allQuestions.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Show All Questions Toggle */}
          {allQuestions.length > 1 && (
            <button
              onClick={() => setShowAllQuestions(!showAllQuestions)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              {showAllQuestions ? "Hide" : "Show"} All Questions
            </button>
          )}
        </div>

        {/* Question Thumbnails */}
        {showAllQuestions && allQuestions.length > 1 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              All Questions
            </h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {allQuestions.map((q, index) => (
                <button
                  key={q.id}
                  onClick={() => onNavigate?.(index)}
                  className={`aspect-square rounded-lg border-2 text-xs font-medium transition-all ${
                    index === currentIndex
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Question Preview */}
        <div
          className={`overflow-hidden ${
            previewMode === "mobile" ? "max-w-sm mx-auto" : ""
          }`}
        >
          {/* Mobile Header Simulation */}
          {previewMode === "mobile" && (
            <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600/40 px-4 py-3 mb-2">
              <div className="flex items-center justify-between">
                <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Question {questionNumber}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {question.points} pts
                </div>
              </div>
            </div>
          )}

          <div className={`${previewMode === "mobile" ? "pb-20" : ""}`}>
            <QuizQuestion
              question={question}
              answer={undefined}
              onAnswerChange={() => {}}
              disabled={false}
              showCorrectAnswer={false}
              showQuestionNumber={previewMode === "desktop"}
              questionNumber={questionNumber}
            />
          </div>

          {/* Mobile Navigation Simulation */}
          {previewMode === "mobile" && (
            <div className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700/50 px-4 py-3 mt-2">
              <div className="flex items-center justify-between">
                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-2xl text-sm font-medium">
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {questionNumber} of {allQuestions.length || 1}
                  </span>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-2xl text-sm font-medium">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Question Details */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Question Details
            </h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 px-4 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                Type
              </div>
              <div className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                {getQuestionTypeDisplay(question.question_type)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 px-4 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                Points
              </div>
              <div className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                {question.points}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 px-4 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                Required
              </div>
              <div className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                {question.is_required ? "Yes" : "No"}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 px-4 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                Time Limit
              </div>
              <div className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                {question.time_limit ? `${question.time_limit}s` : "None"}
              </div>
            </div>
          </div>

          {/* Additional Info */}
          {question.explanation && (
            <div className="mt-4 bg-white dark:bg-gray-900 rounded-2xl p-3 px-4 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-1">
                Explanation
              </div>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {question.explanation}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default QuestionPreviewModal;
