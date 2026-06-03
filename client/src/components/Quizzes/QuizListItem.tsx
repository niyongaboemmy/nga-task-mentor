import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Eye,
  Trash2,
  Globe,
  Lock,
  ClipboardList,
  HelpCircle,
  Star,
  Clock,
  BookOpen,
  Zap,
  CheckCircle2,
  FileEdit,
  Loader2,
} from "lucide-react";

interface Quiz {
  id: number;
  title: string;
  description: string;
  status: string;
  type: string;
  is_public?: boolean;
  total_questions?: number;
  total_points?: number;
  time_limit?: number;
  created_at?: string;
}

interface QuizListItemProps {
  quiz: Quiz;
  onDelete?: (quizId: number) => void;
  onTogglePublic?: (quizId: number, currentPublicStatus: boolean) => void;
  deleteLoading?: string | null;
  publicLoading?: string | null;
  showActions?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string; icon: React.ReactNode }
> = {
  published: {
    label: "Published",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/60",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  draft: {
    label: "Draft",
    dot: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/60",
    icon: <FileEdit className="w-3 h-3" />,
  },
  completed: {
    label: "Completed",
    dot: "bg-blue-500",
    badge:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/25 dark:text-blue-400 dark:ring-blue-800/60",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

const TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; bg: string; fg: string }
> = {
  Exam: {
    icon: <Zap className="w-4 h-4" />,
    bg: "from-red-500/20 to-orange-500/20 dark:from-red-600/30 dark:to-orange-600/30",
    fg: "text-red-600 dark:text-red-400",
  },
  Assessment: {
    icon: <ClipboardList className="w-4 h-4" />,
    bg: "from-blue-500/20 to-indigo-500/20 dark:from-blue-600/30 dark:to-indigo-600/30",
    fg: "text-blue-600 dark:text-blue-400",
  },
  Homework: {
    icon: <BookOpen className="w-4 h-4" />,
    bg: "from-purple-500/20 to-violet-500/20 dark:from-purple-600/30 dark:to-violet-600/30",
    fg: "text-purple-600 dark:text-purple-400",
  },
  Quiz: {
    icon: <HelpCircle className="w-4 h-4" />,
    bg: "from-teal-500/20 to-green-500/20 dark:from-teal-600/30 dark:to-green-600/30",
    fg: "text-teal-600 dark:text-teal-400",
  },
};

export const QuizListItem: React.FC<QuizListItemProps> = ({
  quiz,
  onDelete,
  onTogglePublic,
  deleteLoading,
  publicLoading,
  showActions = true,
}) => {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusCfg = STATUS_CONFIG[quiz.status] ?? STATUS_CONFIG["draft"];
  const typeCfg = TYPE_CONFIG[quiz.type] ?? TYPE_CONFIG["Quiz"];

  const isDeleting = deleteLoading === quiz.id.toString();
  const isTogglingPublic = publicLoading === quiz.id.toString();

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete?.(quiz.id);
    setConfirmDelete(false);
  };

  return (
    <div className="group flex items-center gap-4 bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 hover:border-blue-300 dark:hover:border-blue-700/60 shadow-sm hover:shadow-md hover:shadow-blue-100/40 dark:hover:shadow-blue-900/20 transition-all duration-200 hover:-translate-y-0.5 px-4 py-3 animate-in fade-in slide-in-from-bottom-1">

      {/* Type icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${typeCfg.bg} flex items-center justify-center`}>
        <span className={typeCfg.fg}>{typeCfg.icon}</span>
      </div>

      {/* Info block — grows to fill space */}
      <div className="flex-1 min-w-0">

        {/* Row 1: title + STATUS badge + type tag */}
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {quiz.title}
          </h4>

          {/* STATUS — lifecycle of the quiz */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusCfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>

          {quiz.type && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {quiz.type}
            </span>
          )}
        </div>

        {/* Row 2: stats + divider + VISIBILITY toggle */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            {quiz.total_questions ?? 0} questions
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" />
            {quiz.total_points ?? 0} pts
          </span>
          {quiz.time_limit && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {quiz.time_limit} min
            </span>
          )}

          {/* Visibility — who can access this quiz (instructor only) */}
          {!isStudent && onTogglePublic && (
            <>
              <span className="text-gray-300 dark:text-gray-700 select-none">|</span>

              {/* Explicit "Visibility:" label so it's never confused with Status */}
              <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 select-none">
                Visibility:
              </span>

              <button
                onClick={() => onTogglePublic(quiz.id, quiz.is_public || false)}
                disabled={isTogglingPublic}
                aria-label={quiz.is_public ? "Currently public — click to make private" : "Currently private — click to make public"}
                className="flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Switch track */}
                <span
                  className="relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full border transition-colors duration-200 ease-in-out"
                  style={
                    quiz.is_public
                      ? { backgroundColor: "rgb(59 130 246)", borderColor: "rgb(59 130 246)" }
                      : { backgroundColor: "rgb(209 213 219)", borderColor: "rgb(209 213 219)" }
                  }
                >
                  {isTogglingPublic ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                  ) : (
                    <span
                      className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                        quiz.is_public ? "translate-x-[13px]" : "translate-x-[1px]"
                      }`}
                    />
                  )}
                </span>

                {/* Current state label — clearly describes what IS, not what the action does */}
                <span className={`text-[11px] font-semibold transition-colors ${
                  quiz.is_public
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}>
                  {isTogglingPublic ? "Saving…" : quiz.is_public ? "Public" : "Private"}
                </span>

                {/* Icon for the current state */}
                {!isTogglingPublic && (
                  quiz.is_public
                    ? <Globe className="w-3 h-3 text-blue-500" />
                    : <Lock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action buttons — only View and Delete (not Visibility, which is inline above) */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isStudent ? (
          quiz.status === "published" ? (
            <Link
              to={`/quizzes/${quiz.id}/take`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg shadow-emerald-500/25"
            >
              <Zap className="w-3.5 h-3.5" />
              Start Quiz
            </Link>
          ) : null
        ) : (
          showActions && (
            <>
              <Link
                to={`/quizzes/${quiz.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/25 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/60 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </Link>

              {onDelete && (
                <button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  title={confirmDelete ? "Click again to confirm delete" : "Delete quiz"}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed ${
                    confirmDelete
                      ? "bg-red-500 hover:bg-red-600 text-white border-red-500 scale-105 shadow-md shadow-red-200 dark:shadow-red-900/30"
                      : "bg-red-50 hover:bg-red-100 text-red-600 border-red-200/70 dark:bg-red-900/20 dark:hover:bg-red-900/35 dark:text-red-400 dark:border-red-800/60"
                  }`}
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {isDeleting ? "Deleting…" : confirmDelete ? "Confirm?" : "Delete"}
                  </span>
                </button>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};

export default QuizListItem;
