import React from "react";
import { Link } from "react-router-dom";

interface Quiz {
  id: number;
  title: string;
  description: string;
  status: string;
  type: string;
  is_public?: boolean;
  total_questions?: number;
  questions?: {
    id: string;
    question_type: string;
    points: string;
    order: string;
  }[];
  total_points?: number;
  time_limit?: number;
  created_at?: string;
  totalQuestions: string;
  totalPoints: string;
  isAvailable: boolean;
  isPublic: boolean;
}

interface QuizListItemProps {
  quiz: Quiz;
  onDelete?: (quizId: number) => void;
  onTogglePublic?: (quizId: number, currentPublicStatus: boolean) => void;
  deleteLoading?: string | null;
  publicLoading?: string | null;
  showActions?: boolean;
}

export const QuizListItem: React.FC<QuizListItemProps> = ({
  quiz,
  onDelete,
  onTogglePublic,
  deleteLoading,
  publicLoading,
  showActions = true,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  return (
    <div className="group bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/25 hover:-translate-y-0.5 p-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between gap-4">
        {/* Left side - Quiz info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl flex items-center justify-center">
              <svg
                className="h-5 w-5 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {quiz.title}
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  quiz.status,
                )}`}
              >
                {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {quiz.questions?.length || 0} questions
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                {quiz.questions?.reduce(
                  (total, question) => total + Number(question.points),
                  0,
                ) || 0}{" "}
                points
              </span>
              {quiz.time_limit && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {quiz.time_limit} min
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        {showActions && (
          <div className="flex items-center gap-2">
            <Link
              to={`/quizzes/${quiz.id}`}
              className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-md shadow-lg"
            >
              View
            </Link>

            {onDelete && (
              <button
                onClick={() => onDelete(quiz.id)}
                disabled={deleteLoading === quiz.id.toString()}
                className="inline-flex items-center px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 shadow-lg"
              >
                {deleteLoading === quiz.id.toString() ? "..." : "Delete"}
              </button>
            )}

            {onTogglePublic && (
              <button
                onClick={() => onTogglePublic(quiz.id, quiz.is_public || false)}
                disabled={publicLoading === quiz.id.toString()}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors shadow-lg ${
                  quiz.is_public
                    ? "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                    : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                } disabled:opacity-50`}
              >
                {publicLoading === quiz.id.toString()
                  ? "..."
                  : quiz.is_public
                    ? "Private"
                    : "Public"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizListItem;
