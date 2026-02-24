import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import type { RootState, AppDispatch } from "../../store";
import {
  fetchQuizzes,
  deleteQuiz,
  updateQuiz,
} from "../../store/slices/quizSlice";
import { ChevronLeft, ChevronRight } from "lucide-react";
import QuizListItem from "./QuizListItem";

interface QuizListProps {
  courseId: number;
  showCreateButton?: boolean;
  limit?: number;
  showViewAllButton?: boolean;
}

export const QuizList: React.FC<QuizListProps> = ({
  courseId,
  showCreateButton = true,
  limit,
  showViewAllButton = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { quizzes, loading, error } = useSelector(
    (state: RootState) => state.quiz
  );
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [publicLoading, setPublicLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    dispatch(fetchQuizzes(courseId));
  }, [dispatch, courseId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    setDeleteLoading(quizId.toString());
    try {
      await dispatch(deleteQuiz(quizId)).unwrap();
      toast.success("Quiz deleted successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error: any) {
      console.error("Failed to delete quiz:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to delete quiz. Please try again.";
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleTogglePublic = async (
    quizId: number,
    currentPublicStatus: boolean
  ) => {
    setPublicLoading(quizId.toString());
    try {
      await dispatch(
        updateQuiz({
          quizId,
          quizData: { is_public: !currentPublicStatus },
        })
      ).unwrap();
    } catch (error) {
      console.error("Failed to update quiz public status:", error);
    } finally {
      setPublicLoading(null);
    }
  };

  // Limit and pagination logic
  const sortedQuizzes = [...quizzes].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  );
  const limitedQuizzes = limit ? sortedQuizzes.slice(0, limit) : sortedQuizzes;
  const totalPages = Math.ceil(limitedQuizzes.length / itemsPerPage);
  const paginatedQuizzes = limitedQuizzes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "exam":
        return "bg-red-100 text-red-800";
      case "graded":
        return "bg-blue-100 text-blue-800";
      case "practice":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading.quizzes) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading quizzes...</span>
      </div>
    );
  }

  if (error.quizzes) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Failed to load quizzes</div>
        <button
          onClick={() => dispatch(fetchQuizzes(courseId))}
          className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Quizzes
        </h3>
        {showCreateButton && (
          <Link
            to={`/courses/${courseId}/quizzes/create`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Create Quiz
          </Link>
        )}
      </div>

      {/* Quiz List */}
      {quizzes.length > 0 ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {paginatedQuizzes.length} of {limitedQuizzes.length} quiz
              {limitedQuizzes.length !== 1 ? "es" : ""}
              {limit && quizzes.length > limit && ` (latest ${limit})`}
            </p>
            {showViewAllButton && limit && quizzes.length > limit && (
              <Link
                to={`/courses/${courseId}/quizzes`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                View All Quizzes
              </Link>
            )}
          </div>
          <div className="space-y-4">
            {paginatedQuizzes.map((quiz) => (
              <QuizListItem
                key={quiz.id}
                quiz={quiz}
                onDelete={handleDeleteQuiz}
                onTogglePublic={handleTogglePublic}
                deleteLoading={deleteLoading}
                publicLoading={publicLoading}
                showActions={showCreateButton}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Desktop pagination - show all pages */}
              <div className="hidden sm:flex">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
                        currentPage === page
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              {/* Mobile pagination - show current page and nearby pages */}
              <div className="flex sm:hidden">
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  const pageNum = Math.max(
                    1,
                    Math.min(totalPages, currentPage - 1 + i)
                  );
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
                        currentPage === pageNum
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No quizzes yet
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Create quizzes to assess student learning and provide practice
            opportunities.
          </p>
          {showCreateButton && (
            <div className="mt-6">
              <Link
                to={`/courses/${courseId}/quizzes/create`}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Create Your First Quiz
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default QuizList;
