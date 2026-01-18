import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  Eye,
  Edit3,
  Trash2,
  Plus,
  Clock,
  Users,
  BookOpen,
  CheckCircle,
  GripVertical,
  Shield,
  Settings,
  BarChart3,
  Play,
  ArrowLeft,
  FileText,
  Download,
} from "lucide-react";
import type { RootState, AppDispatch } from "../../store";
import {
  fetchQuiz,
  fetchQuizQuestions,
  updateQuiz,
  clearCurrentQuiz,
  deleteQuestion,
  reorderQuestions,
} from "../../store/slices/quizSlice";
import type { QuizStatus, QuizQuestion } from "../../types/quiz.types";
import QuestionPreviewModal from "./QuestionPreviewModal";

interface QuizViewProps {
  quizId: number;
}

// Fragment Components
const QuizHeader: React.FC<{
  quiz: any;
  questions: QuizQuestion[];
  editing: boolean;
  onNavigate: (path: string) => void;
}> = ({ quiz, questions, editing, onNavigate }) => {
  const navigate = useNavigate();
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-emerald-100 dark:bg-gray-800 dark:text-white text-emerald-700 border-emerald-200 dark:border-emerald-200/30";
      case "draft":
        return "bg-amber-100 dark:bg-gray-800 dark:text-white text-amber-700 border-amber-200 dark:border-amber-200/30";
      case "completed":
        return "bg-blue-100 dark:bg-gray-800 dark:text-white text-blue-700 border-blue-200 dark:border-blue-200/30";
      default:
        return "bg-gray-100 dark:bg-gray-800 dark:text-white text-gray-700 border-gray-200 dark:border-gray-200/20";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "exam":
        return "bg-red-100 dark:bg-gray-800 dark:text-white text-red-700 border-red-200 dark:border-red-200/30";
      case "graded":
        return "bg-indigo-100 dark:bg-gray-800 dark:text-white text-indigo-700 border-indigo-200 dark:border-indigo-200/30";
      case "practice":
        return "bg-orange-100 dark:bg-gray-800 dark:text-white text-orange-700 border-orange-200 dark:border-orange-200/30";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (editing) return null;

  return (
    <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50 rounded-3xl p-4 md:p-6 transition-all duration-300">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left Column - Quiz Info */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                <div>
                  <div className="flex flex-col sm:flex-row items-center gap-2 mb-3">
                    <div className="animate-fade-in">
                      <button
                        onClick={() => navigate(`/courses/${quiz.course_id}`)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <div className="truncate">Back</div>
                      </button>
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                      {quiz.title}
                    </h1>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-3">
                    {quiz.description}
                  </p>
                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-xl border ${getStatusColor(
                        quiz.status,
                      )} shadow-sm hover:shadow-md transition-all duration-200`}
                    >
                      <div className="flex items-center gap-1">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            quiz.status === "published"
                              ? "bg-emerald-500"
                              : quiz.status === "draft"
                                ? "bg-amber-500"
                                : "bg-blue-500"
                          }`}
                        ></div>
                        {quiz.status.charAt(0).toUpperCase() +
                          quiz.status.slice(1)}
                      </div>
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-xl border ${getTypeColor(
                        quiz.type,
                      )} shadow-sm hover:shadow-md transition-all duration-200`}
                    >
                      <div className="flex items-center gap-1">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            quiz.type === "exam"
                              ? "bg-red-500"
                              : quiz.type === "graded"
                                ? "bg-green-500"
                                : quiz.type === "practice"
                                  ? "bg-orange-500"
                                  : "bg-gray-500"
                          }`}
                        ></div>
                        {quiz.type.charAt(0).toUpperCase() + quiz.type.slice(1)}
                      </div>
                    </span>
                    {quiz.is_available && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-xl border bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          Available
                        </div>
                      </span>
                    )}
                    {quiz.is_public && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-xl border bg-orange-100 text-orange-700 border-orange-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Public
                        </div>
                      </span>
                    )}
                  </div>

                  {/* Quiz Attachments */}
                  {quiz.attachments && quiz.attachments.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Quiz Materials
                      </h4>
                      <div className="space-y-2">
                        {quiz.attachments.map(
                          (attachment: any, index: number) => (
                            <a
                              key={index}
                              href={attachment.url}
                              download={attachment.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors group"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {attachment.name}
                                </span>
                                {attachment.size && (
                                  <span className="text-xs text-gray-500 flex-shrink-0">
                                    ({(attachment.size / 1024).toFixed(1)} KB)
                                  </span>
                                )}
                              </div>
                              <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 ml-2" />
                            </a>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3 border border-blue-200 dark:border-blue-800 transition-all duration-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                        {questions.length}
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        Questions
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3 border border-green-200 dark:border-green-800 transition-all duration-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-900 dark:text-green-100">
                        {quiz.total_points || 0}
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300">
                        Points
                      </div>
                    </div>
                  </div>
                </div>

                {quiz.time_limit && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 border border-amber-200 dark:border-amber-800 transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
                        <Clock className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-900 dark:text-amber-100">
                          {quiz.time_limit}
                        </div>
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          Minutes
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {quiz.max_attempts && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-3 border border-orange-200 dark:border-orange-800 transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-orange-900 dark:text-orange-100">
                          {quiz.max_attempts}
                        </div>
                        <div className="text-xs text-orange-700 dark:text-orange-300">
                          Attempts
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          {quiz.instructions && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>
                <span className="text-base font-semibold text-blue-900 dark:text-blue-100">
                  Instructions
                </span>
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                {quiz.instructions}
              </p>
            </div>
          )}
        </div>

        <div className="lg:w-72 space-y-2">
          <button
            onClick={() => onNavigate(`/quizzes/${quiz.id}/settings`)}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium border border-gray-300 text-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 rounded-2xl hover:bg-gray-50 transition-all duration-200 hover:scale-105 transform"
          >
            <Settings className="w-4 h-4" />
            Update Quiz Settings
          </button>
          <button
            onClick={() =>
              onNavigate(`/quizzes/${quiz.id}/proctoring/settings`)
            }
            className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium border border-red-300 text-red-700 dark:text-red-300 dark:border-red-600 dark:hover:bg-red-900 rounded-2xl hover:bg-red-50 transition-all duration-200 hover:scale-105 transform"
          >
            <Shield className="w-4 h-4" />
            Proctoring Settings
          </button>
          <button
            onClick={() =>
              onNavigate(`/quizzes/${quiz.id}/proctoring/monitoring`)
            }
            className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium border border-blue-300 text-blue-700 dark:text-blue-300 dark:border-blue-600 dark:hover:bg-blue-900 rounded-2xl hover:bg-blue-50 transition-all duration-200 hover:scale-105 transform"
          >
            <Eye className="w-4 h-4" />
            Live Monitoring
          </button>
          <button
            onClick={() =>
              onNavigate(`/quizzes/${quiz.id}/proctoring/analytics`)
            }
            className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium border border-orange-300 text-orange-700 dark:text-orange-300 dark:border-orange-600 dark:hover:bg-orange-900 rounded-2xl hover:bg-orange-50 transition-all duration-200 hover:scale-105 transform"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics & Reports
          </button>
          <button
            onClick={() => onNavigate(`/quizzes/${quiz.id}/submissions`)}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium border border-indigo-300 text-indigo-700 dark:text-indigo-300 dark:border-indigo-600 dark:hover:bg-indigo-900 rounded-2xl hover:bg-indigo-50 transition-all duration-200 hover:scale-105 transform"
          >
            <Users className="w-4 h-4" />
            View Submissions
          </button>
        </div>
      </div>
    </div>
  );
};

const QuizEditForm: React.FC<{
  editForm: any;
  onChange: (field: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ editForm, onChange, onSave, onCancel }) => (
  <div className="bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800/50 rounded-3xl p-4 md:p-6">
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Quiz Title
        </label>
        <input
          type="text"
          value={editForm.title}
          onChange={(e) => onChange("title", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={editForm.description}
          onChange={(e) => onChange("description", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Instructions
        </label>
        <textarea
          value={editForm.instructions}
          onChange={(e) => onChange("instructions", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={editForm.status}
            onChange={(e) => onChange("status", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex items-center pt-6">
          <input
            type="checkbox"
            id="is_public"
            checked={editForm.is_public}
            onChange={(e) => onChange("is_public", e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="is_public"
            className="ml-2 text-sm text-gray-700 dark:text-gray-300"
          >
            Public access
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-300 text-gray-700 dark:text-white rounded-full hover:bg-gray-50 dark:hover:bg-blue-700 dark:hover:border-blue-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
);

const QuestionCard: React.FC<{
  question: QuizQuestion;
  index: number;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  editing?: boolean;
  isReordering?: boolean;
}> = ({
  question,
  index,
  onPreview,
  onEdit,
  onDelete,
  isDeleting,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  editing = false,
  isReordering = false,
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "single_choice":
        return "🔘";
      case "multiple_choice":
        return "☑️";
      case "true_false":
        return "✅";
      case "numerical":
        return "🔢";
      case "matching":
        return "🔗";
      case "fill_blank":
        return "📝";
      case "short_answer":
        return "💬";
      default:
        return "❓";
    }
  };

  return (
    <div
      className={`bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50 rounded-xl md:rounded-2xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 ${
        isDragging
          ? "opacity-50 scale-95 shadow-lg ring-2 ring-blue-400 ring-opacity-50"
          : isDragOver
            ? "border-blue-400 bg-blue-50 scale-105 shadow-md ring-2 ring-blue-400 ring-opacity-50 border-dashed"
            : "hover:border-gray-300 dark:hover:border-gray-600"
      } ${!editing && !isReordering ? "cursor-move" : ""} ${
        isReordering ? "pointer-events-none opacity-75" : ""
      }`}
      draggable={!editing && !isReordering}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="listitem"
      aria-label={`Question ${index + 1}: ${question.question_text}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-xl">
              Q{index + 1}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <span className="text-base">
                {getTypeIcon(question.question_type)}
              </span>
              {question.question_type.replace("_", " ")}
            </span>
            <span className="px-2 py-1 text-xs font-medium rounded-xl bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800">
              {question.points}pt
            </span>
          </div>
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2 leading-tight">
            {question.question_text}
          </h3>
          {question.explanation && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
              💡 {question.explanation}
            </div>
          )}
        </div>
        <div className="flex gap-2 sm:ml-4">
          {/* Drag Handle */}
          {!editing && !isReordering && (
            <div
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-xl transition-all duration-200 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 hover:scale-110 transform"
              onMouseDown={(e) => {
                e.preventDefault();
                // This helps ensure the drag starts properly
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  // Could implement keyboard-based reordering here if needed
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Drag question ${index + 1} to reorder`}
              title="Drag to reorder questions"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <button
            onClick={onPreview}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-xl transition-all duration-200 hover:scale-110 transform"
            title="Preview question"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 hover:scale-110 transform"
            title="Edit question"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-xl transition-all duration-200 hover:scale-110 transform disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete question"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const EmptyQuestionsState: React.FC<{
  onAddQuestion: () => void;
}> = ({ onAddQuestion }) => (
  <div className="text-center pb-12">
    <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shadow-lg">
      <BookOpen className="w-8 h-8 text-blue-500 dark:text-blue-400" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
      No questions yet
    </h3>
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
      Start building your quiz with engaging questions to create an amazing
      learning experience
    </p>
    <button
      onClick={onAddQuestion}
      className="inline-flex items-center px-4 py-2.5 text-sm font-normal bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 transform"
    >
      <Plus className="w-4 h-4 mr-2" />
      Add Your First Question
    </button>
  </div>
);

const LoadingSpinner: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
    <span className="ml-2 text-sm text-gray-600">{message}</span>
  </div>
);

const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}> = ({ message, onRetry, retryLabel = "Try Again" }) => (
  <div className="text-center py-8">
    <div className="text-red-600 text-sm mb-3">{message}</div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {retryLabel}
      </button>
    )}
  </div>
);

export const QuizView: React.FC<QuizViewProps> = ({ quizId }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { currentQuiz, questions, loading, error } = useSelector(
    (state: RootState) => state.quiz,
  );

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    instructions: "",
    status: "draft" as QuizStatus,
    is_public: false,
  });
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuizQuestion | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const handlePreview = (question: QuizQuestion) => {
    setPreviewQuestion(question);
    setPreviewModalOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewModalOpen(false);
    setPreviewQuestion(null);
  };

  const handleDragStart = (index: number) => {
    if (editing || isReordering) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (editing || isReordering) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (
      editing ||
      isReordering ||
      draggedIndex === null ||
      draggedIndex === dropIndex
    ) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newQuestions = [...questions];
    const draggedQuestion = newQuestions[draggedIndex];

    // Remove dragged item and insert at new position
    newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(dropIndex, 0, draggedQuestion);

    // Update order values
    const questionOrders = newQuestions.map((question, index) => ({
      id: question.id,
      order: index + 1,
    }));

    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsReordering(true);

    try {
      await dispatch(reorderQuestions({ quizId, questionOrders })).unwrap();
    } catch (error) {
      console.error("Failed to reorder questions:", error);
      // Refresh questions to revert to original order
      dispatch(fetchQuizQuestions(quizId));
    } finally {
      setIsReordering(false);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this question? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeleteLoading(questionId);
    try {
      await dispatch(deleteQuestion(questionId)).unwrap();
      dispatch(fetchQuizQuestions(quizId));
      toast.success("Question deleted successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error: any) {
      console.error("Failed to delete question:", error);

      // Extract backend error message clearly
      let errorMessage = "Failed to delete question. Please try again.";

      if (error?.response?.data?.message) {
        // Show the exact backend error message
        errorMessage = `Error: ${error.response.data.message}`;
      } else if (error?.response?.data?.error) {
        errorMessage = `Error: ${error.response.data.error}`;
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 6000, // Slightly longer for error messages
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        // Make error toast more prominent
        style: {
          backgroundColor: "#fee2e2",
          border: "1px solid #fca5a5",
          color: "#dc2626",
        },
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  useEffect(() => {
    dispatch(fetchQuiz(quizId));
    dispatch(fetchQuizQuestions(quizId));

    return () => {
      dispatch(clearCurrentQuiz());
    };
  }, [quizId, dispatch]);

  useEffect(() => {
    if (currentQuiz) {
      setEditForm({
        title: currentQuiz.title,
        description: currentQuiz.description,
        instructions: currentQuiz.instructions || "",
        status: currentQuiz.status,
        is_public: currentQuiz.is_public || false,
      });
    }
  }, [currentQuiz]);

  const handleSave = async () => {
    try {
      await dispatch(updateQuiz({ quizId, quizData: editForm })).unwrap();
      setEditing(false);
    } catch (error) {
      console.error("Failed to update quiz:", error);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    if (currentQuiz) {
      setEditForm({
        title: currentQuiz.title,
        description: currentQuiz.description,
        instructions: currentQuiz.instructions || "",
        status: currentQuiz.status,
        is_public: currentQuiz.is_public || false,
      });
    }
  };

  const updateEditForm = (field: string, value: any) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading.quiz || loading.questions) {
    return <LoadingSpinner message="Loading quiz..." />;
  }

  if (error.quiz) {
    return (
      <ErrorState
        message="Failed to load quiz"
        onRetry={() => navigate("/dashboard")}
        retryLabel="Back to Dashboard"
      />
    );
  }

  if (!currentQuiz) {
    return (
      <ErrorState
        message="Quiz not found"
        onRetry={() => navigate("/dashboard")}
        retryLabel="Back to Dashboard"
      />
    );
  }

  return (
    <div className="min-h-screen">
      <div className="">
        <div className="space-y-4">
          {/* Quiz Header */}
          {editing ? (
            <div className="animate-fade-in">
              <QuizEditForm
                editForm={editForm}
                onChange={updateEditForm}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            </div>
          ) : (
            <div className="animate-fade-in">
              <QuizHeader
                quiz={currentQuiz}
                questions={questions}
                editing={editing}
                onNavigate={navigate}
              />
            </div>
          )}

          {/* Questions Section */}
          <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-3xl border border-gray-200/80 dark:border-gray-800/50 card-hover">
            <div className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center animate-float">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Questions
                    </h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {questions.length} items • {currentQuiz.total_points || 0}{" "}
                      pts
                    </p>
                  </div>
                  {isReordering ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full animate-pulse-glow">
                      Saving...
                    </span>
                  ) : !editing && questions.length > 1 ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                      Drag to reorder
                    </span>
                  ) : null}
                </div>
                {questions.length > 0 && (
                  <button
                    onClick={() =>
                      navigate(`/quizzes/${quizId}/questions/create`)
                    }
                    className="btn-facebook px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-normal transition-all duration-200 focus-ring shadow-lg hover:shadow-xl"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Question
                  </button>
                )}
              </div>

              {questions.length > 0 ? (
                <div
                  className="space-y-3"
                  role="list"
                  aria-label="Quiz questions"
                >
                  {isReordering && (
                    <div className="flex items-center justify-center py-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      <span className="ml-2 text-sm text-gray-600">
                        Saving...
                      </span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {questions.map((question, index) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        index={index}
                        onPreview={() => handlePreview(question)}
                        onEdit={() =>
                          navigate(
                            `/quizzes/${quizId}/questions/${question.id}/edit`,
                          )
                        }
                        onDelete={() => handleDeleteQuestion(question.id)}
                        isDeleting={deleteLoading === question.id}
                        isDragging={draggedIndex === index}
                        isDragOver={dragOverIndex === index}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        editing={editing}
                        isReordering={isReordering}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyQuestionsState
                  onAddQuestion={() =>
                    navigate(`/quizzes/${quizId}/questions/create`)
                  }
                />
              )}
            </div>
          </div>

          {/* Question Preview Modal */}
          {previewQuestion && (
            <QuestionPreviewModal
              isOpen={previewModalOpen}
              onClose={handleClosePreview}
              question={previewQuestion}
              questionNumber={
                questions.findIndex((q) => q.id === previewQuestion.id) + 1
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizView;
