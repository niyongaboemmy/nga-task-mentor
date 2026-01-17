import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import type { RootState, AppDispatch } from "../store";
import {
  fetchQuizzes,
  deleteQuiz,
  updateQuiz,
} from "../store/slices/quizSlice";
import QuizListItem from "../components/Quizzes/QuizListItem";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  BookOpen,
  Plus,
  ArrowLeft,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
} from "lucide-react";

const QuizListPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { quizzes, loading } = useSelector(
    (state: RootState) => state.quiz
  );

  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [publicLoading, setPublicLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const itemsPerPage = 12;

  useEffect(() => {
    if (courseId) {
      dispatch(fetchQuizzes(parseInt(courseId)));
    }
  }, [dispatch, courseId]);

  // Filter and sort quizzes
  const filteredAndSortedQuizzes = useMemo(() => {
    let filtered = quizzes.filter((quiz) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          quiz.title.toLowerCase().includes(term) ||
          quiz.description.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Status filter
      if (statusFilter !== "all" && quiz.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== "all" && quiz.type !== typeFilter) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "title":
          aValue = (a.title || "").toLowerCase();
          bValue = (b.title || "").toLowerCase();
          break;
        case "created_at":
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        case "total_questions":
          aValue = a.total_questions || 0;
          bValue = b.total_questions || 0;
          break;
        case "total_points":
          aValue = a.total_points || 0;
          bValue = b.total_points || 0;
          break;
        default:
          return 0;
      }

      if (aValue === bValue) return 0;

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [quizzes, searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);


  // Pagination
  const totalPages = Math.ceil(filteredAndSortedQuizzes.length / itemsPerPage);
  const paginatedQuizzes = filteredAndSortedQuizzes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Group quizzes by status
  const groupedQuizzes = useMemo(() => {
    const groups: { [key: string]: typeof filteredAndSortedQuizzes } = {
      published: [],
      draft: [],
      completed: [],
    };

    paginatedQuizzes.forEach((quiz) => {
      if (groups[quiz.status]) {
        groups[quiz.status].push(quiz);
      } else {
        groups.draft.push(quiz); // fallback
      }
    });

    return groups;
  }, [paginatedQuizzes]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSortBy("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published":
        return "🟢";
      case "draft":
        return "🟡";
      case "completed":
        return "🔵";
      default:
        return "⚪";
    }
  };

  if (loading.quizzes) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                to={`/courses/${courseId}`}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Course
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Course Quizzes
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage and organize all quizzes for this course
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={`/courses/${courseId}/quizzes/create`}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Quiz
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Quizzes
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {quizzes.length}
                  </p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Published
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {groupedQuizzes.published.length}
                  </p>
                </div>
                <div className="text-2xl">🟢</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drafts
                  </p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                    {groupedQuizzes.draft.length}
                  </p>
                </div>
                <div className="text-2xl">🟡</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Completed
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {groupedQuizzes.completed.length}
                  </p>
                </div>
                <div className="text-2xl">🔵</div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search quizzes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Types</option>
                  <option value="exam">Exam</option>
                  <option value="graded">Graded</option>
                  <option value="practice">Practice</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="created_at">Date Created</option>
                  <option value="title">Title</option>
                  <option value="total_questions">Questions</option>
                  <option value="total_points">Points</option>
                </select>

                <button
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="p-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {sortOrder === "asc" ? (
                    <SortAsc className="h-5 w-5" />
                  ) : (
                    <SortDesc className="h-5 w-5" />
                  )}
                </button>

                <div className="flex border border-gray-300 dark:border-gray-600 rounded-xl">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-3 rounded-l-xl transition-colors ${
                      viewMode === "list"
                        ? "bg-blue-500 text-white"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <List className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-3 rounded-r-xl transition-colors ${
                      viewMode === "grid"
                        ? "bg-blue-500 text-white"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <Grid3X3 className="h-5 w-5" />
                  </button>
                </div>

                {(searchTerm ||
                  statusFilter !== "all" ||
                  typeFilter !== "all") && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Groups */}
        <div className="space-y-8">
          {Object.entries(groupedQuizzes).map(([status, quizzes]) => {
            if (quizzes.length === 0) return null;

            return (
              <div key={status} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getStatusIcon(status)}</span>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                    {status} Quizzes ({quizzes.length})
                  </h2>
                </div>

                {viewMode === "list" ? (
                  <div className="space-y-4">
                    {quizzes.map((quiz) => (
                      <QuizListItem
                        key={quiz.id}
                        quiz={quiz}
                        onDelete={handleDeleteQuiz}
                        onTogglePublic={handleTogglePublic}
                        deleteLoading={deleteLoading}
                        publicLoading={publicLoading}
                        showActions={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all hover:-translate-y-1"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              {quiz.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                              {quiz.description}
                            </p>

                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                  quiz.status
                                )}`}
                              >
                                {quiz.status.charAt(0).toUpperCase() +
                                  quiz.status.slice(1)}
                              </span>
                              {quiz.is_public && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                  Public
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                              <span>{quiz.total_questions || 0} questions</span>
                              <span>{quiz.total_points || 0} points</span>
                              {quiz.time_limit && (
                                <span>{quiz.time_limit} min</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Link
                            to={`/quizzes/${quiz.id}`}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 text-sm font-medium"
                          >
                            View Quiz
                          </Link>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleTogglePublic(
                                  quiz.id,
                                  quiz.is_public || false
                                )
                              }
                              disabled={publicLoading === quiz.id.toString()}
                              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                                quiz.is_public
                                  ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                                  : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                              } disabled:opacity-50`}
                            >
                              {publicLoading === quiz.id.toString()
                                ? "..."
                                : quiz.is_public
                                ? "Private"
                                : "Public"}
                            </button>

                            <button
                              onClick={() => handleDeleteQuiz(quiz.id)}
                              disabled={deleteLoading === quiz.id.toString()}
                              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-full disabled:opacity-50"
                            >
                              {deleteLoading === quiz.id.toString()
                                ? "..."
                                : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(
                  1,
                  Math.min(totalPages - 4, currentPage - 2 + i)
                );
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      currentPage === pageNum
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
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
              className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Empty State */}
        {filteredAndSortedQuizzes.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto h-24 w-24 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl flex items-center justify-center mb-6">
              <Search className="h-12 w-12 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                ? "No quizzes match your filters"
                : "No quizzes yet"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your search terms or filters to find what you're looking for."
                : "Create your first quiz to start assessing student learning and progress."}
            </p>

            {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
              <Link
                to={`/quizzes/${courseId}/questions/create`}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Quiz
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizListPage;
