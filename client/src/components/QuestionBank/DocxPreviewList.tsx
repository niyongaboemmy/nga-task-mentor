import React from "react";
import {
  Check,
  X,
  AlertTriangle,
  Info,
  Brain,
  Tag,
  BarChart2,
  Loader2,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import RichTextDisplay from "../Common/RichTextDisplay";
import { QuestionServiceFactory } from "../../services/questions/QuestionServiceFactory";
import QuizQuestion from "../Quizzes/QuizQuestion";
import type {
  QuizQuestion as QuizQuestionType,
  QuestionType,
} from "../../types/quiz.types";

interface DocxPreviewListProps {
  questions: any[];
  onConfirm: (questions: any[]) => void;
  onCancel: () => void;
  onRemove: (index: number) => void;
  loading: boolean;
}

const DocxPreviewList: React.FC<DocxPreviewListProps> = ({
  questions,
  onConfirm,
  onCancel,
  onRemove,
  loading,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-sm font-medium">
          <Info className="w-4 h-4" />
          Review {questions.length} questions before importing
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
          >
            Change File
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-950/20">
        {questions.map((q, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold font-mono">
                  {idx + 1}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark text-[10px] uppercase font-bold tracking-wider">
                  {q.question_type.replace("_", " ")}
                </span>
                {q.difficulty_level && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      q.difficulty_level === "EASY"
                        ? "bg-green-100 text-green-700"
                        : q.difficulty_level === "MEDIUM"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {q.difficulty_level}
                  </span>
                )}
              </div>
              <button
                onClick={() => onRemove(idx)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                title="Remove question"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Validation Status */}
              {(() => {
                const validation = QuestionServiceFactory.validate(
                  q.question_type as QuestionType,
                  q.question_data,
                );
                if (
                  validation.errors.length === 0 &&
                  validation.warnings.length === 0
                )
                  return null;
                return (
                  <div className="space-y-2 mb-4">
                    {validation.errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-900/30"
                      >
                        <X className="w-3 h-3" /> {err}
                      </div>
                    ))}
                    {validation.warnings.map((warn, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30"
                      >
                        <AlertTriangle className="w-3 h-3" /> {warn}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <QuizQuestion
                question={
                  {
                    id: idx,
                    question_type: q.question_type as QuestionType,
                    question_text: q.question_text,
                    question_data: q.question_data,
                    explanation: q.explanation,
                    difficulty_level: q.difficulty_level,
                    points: q.points || 1,
                    tags: q.tags || [],
                  } as QuizQuestionType
                }
                answer={q.correct_answer}
                onAnswerChange={() => {}}
                disabled={true}
                showCorrectAnswer={true}
                showQuestionNumber={true}
                questionNumber={idx + 1}
              />

              {/* metadata highlights */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                {q.blooms_level_name && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[10px] font-bold uppercase border border-violet-100 dark:border-violet-800">
                    <Brain className="w-3 h-3" /> {q.blooms_level_name}
                  </div>
                )}
                {q.tags &&
                  q.tags.map((tag: string) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase border border-blue-100 dark:border-blue-800"
                    >
                      <Tag className="w-3 h-3" /> {tag}
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-950">
        <p className="text-sm text-gray-500">
          Make sure everything looks correct.
        </p>
        <button
          onClick={() => onConfirm(questions)}
          disabled={loading}
          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Confirm & Import All
        </button>
      </div>
    </div>
  );
};

export default DocxPreviewList;
