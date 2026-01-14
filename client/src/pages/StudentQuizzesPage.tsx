import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import {
  BookOpen,
  Clock,
  Filter,
  Search,
  Trophy,
  Calendar,
  TrendingUp,
  Eye,
  Loader2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface QuizResult {
  id: number;
  quiz_id: number;
  quiz_title: string;
  quiz_description: string;
  course_name?: string;
  instructor_name?: string;
  final_score: number;
  max_score: number;
  percentage: number;
  grade: string;
  status: string;
  submitted_at: string;
  time_taken: number;
  question_count: number;
  difficulty?: string;
  tags?: string[];
}

interface AvailableQuiz {
  id: number;
  title: string;
  description: string;
  course_name?: string;
  instructor_name?: string;
  time_limit?: number;
  question_count: number;
  difficulty?: string;
  tags?: string[];
}

interface FilterState {
  search: string;
  status: string;
  course: string;
  dateRange: string;
  scoreRange: string;
  sortBy: string;
}

const StudentQuizzesPage: React.FC = () => {
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<AvailableQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    course: "all",
    dateRange: "all",
    scoreRange: "all",
    sortBy: "submitted_at",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [courses, setCourses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch student's quiz results and available quizzes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch completed quiz results
        const resultsResponse = await axios.get("/api/quizzes/my-results");
        const results = resultsResponse.data.data || [];
        setQuizResults(results);

        // Fetch available quizzes
        const availableResponse = await axios.get("/api/quizzes/available");
        const available = availableResponse.data.data || [];
        setAvailableQuizzes(available);

        // Extract unique courses from both results and available quizzes
        const allCourses = [
          ...new Set([
            ...results.map((r: QuizResult) => r.course_name).filter(Boolean),
            ...available
              .map((q: AvailableQuiz) => q.course_name)
              .filter(Boolean),
          ]),
        ] as string[];
        setCourses(allCourses);
      } catch (error) {
        console.error("Error fetching quiz data:", error);
        setQuizResults([]);
        setAvailableQuizzes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter and sort quiz results
  const filteredResults = useMemo(() => {
    let filtered = quizResults.filter((result) => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch =
          result.quiz_title.toLowerCase().includes(searchTerm) ||
          result.quiz_description.toLowerCase().includes(searchTerm) ||
          result.course_name?.toLowerCase().includes(searchTerm) ||
          result.instructor_name?.toLowerCase().includes(searchTerm) ||
          result.tags?.some((tag) => tag.toLowerCase().includes(searchTerm));

        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== "all" && result.status !== filters.status)
        return false;

      // Course filter
      if (filters.course !== "all" && result.course_name !== filters.course)
        return false;

      // Date range filter
      if (filters.dateRange !== "all") {
        const submittedDate = new Date(result.submitted_at);
        const now = new Date();
        const daysDiff = Math.floor(
          (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        switch (filters.dateRange) {
          case "today":
            if (daysDiff > 0) return false;
            break;
          case "week":
            if (daysDiff > 7) return false;
            break;
          case "month":
            if (daysDiff > 30) return false;
            break;
          case "quarter":
            if (daysDiff > 90) return false;
            break;
        }
      }

      // Score range filter
      if (filters.scoreRange !== "all") {
        const percentage = result.percentage;
        switch (filters.scoreRange) {
          case "excellent":
            if (percentage < 90) return false;
            break;
          case "good":
            if (percentage < 70 || percentage >= 90) return false;
            break;
          case "average":
            if (percentage < 50 || percentage >= 70) return false;
            break;
          case "poor":
            if (percentage >= 50) return false;
            break;
        }
      }

      return true;
    });

    // Sort results
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "submitted_at":
          return (
            new Date(b.submitted_at).getTime() -
            new Date(a.submitted_at).getTime()
          );
        case "quiz_title":
          return a.quiz_title.localeCompare(b.quiz_title);
        case "percentage":
          return b.percentage - a.percentage;
        case "final_score":
          return b.final_score - a.final_score;
        case "time_taken":
          return b.time_taken - a.time_taken;
        default:
          return 0;
      }
    });

    return filtered;
  }, [quizResults, filters]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      course: "all",
      dateRange: "all",
      scoreRange: "all",
      sortBy: "submitted_at",
    });
    setCurrentPage(1);
  };

  const getGradeColor = (grade: string) => {
    switch (grade?.toUpperCase()) {
      case "A":
        return "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30";
      case "B":
        return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
      case "C":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30";
      case "D":
        return "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30";
      case "F":
        return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
      default:
        return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800";
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (percentage >= 80) return "text-green-600 dark:text-green-400";
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (percentage >= 60) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const QuizResultItem: React.FC<{ result: QuizResult }> = ({ result }) => {
    return (
      <div className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/25 hover:-translate-y-0.5 p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Left side - Quiz info */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl flex items-center justify-center">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {result.quiz_title}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium self-start sm:self-auto ${getGradeColor(
                    result.grade
                  )}`}
                >
                  {result.grade}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(result.time_taken)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className="hidden sm:inline">
                    {formatDate(result.submitted_at)}
                  </span>
                  <span className="sm:hidden">
                    {new Date(result.submitted_at).toLocaleDateString()}
                  </span>
                </div>
                {result.course_name && (
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    <span className="truncate max-w-20 sm:max-w-24">
                      {result.course_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Score and action */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
            <div className="text-left sm:text-right">
              <div
                className={`text-lg font-bold mb-0.5 ${getScoreColor(
                  result.percentage
                )}`}
              >
                {Math.round(result.percentage)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {result.final_score}/{result.max_score}
              </div>
            </div>

            <Link
              to={`/quizzes/${result.quiz_id}/results`}
              className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap"
            >
              <Eye className="h-3 w-3 mr-1.5" />
              <span className="hidden sm:inline">View</span>
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Statistics
  const stats = useMemo(() => {
    const total = quizResults.length;
    const completed = quizResults.filter(
      (r) => r.status === "completed"
    ).length;
    const available = availableQuizzes.length;
    const averageScore =
      total > 0
        ? quizResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / total
        : 0;
    const highestScore =
      total > 0 ? Math.max(...quizResults.map((r) => r.percentage || 0)) : 0;

    return {
      total,
      completed,
      available,
      averageScore: isNaN(averageScore) ? 0 : averageScore,
      highestScore: isNaN(highestScore) ? 0 : highestScore,
    };
  }, [quizResults, availableQuizzes]);

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading your quiz results...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="pb-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                My Quiz Results
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Track your progress and review your quiz performance
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-sm"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {(filters.status !== "all" ||
                  filters.course !== "all" ||
                  filters.dateRange !== "all" ||
                  filters.scoreRange !== "all") && (
                  <span className="ml-2 bg-pink-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                    {
                      [
                        filters.status,
                        filters.course,
                        filters.dateRange,
                        filters.scoreRange,
                      ].filter((f) => f !== "all").length
                    }
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/25 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Completed
                </p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </p>
              </div>
              <CheckCircle className="h-6 w-6 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:shadow-orange-100/50 dark:hover:shadow-orange-900/25 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Available
                </p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.available}
                </p>
              </div>
              <BookOpen className="h-6 w-6 text-orange-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:shadow-purple-100/50 dark:hover:shadow-purple-900/25 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Average Score
                </p>
                <p
                  className={`text-xl font-bold ${getScoreColor(
                    stats.averageScore
                  )}`}
                >
                  {Math.round(stats.averageScore)}%
                </p>
              </div>
              <TrendingUp className="h-6 w-6 text-purple-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:shadow-yellow-100/50 dark:hover:shadow-yellow-900/25 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Highest Score
                </p>
                <p
                  className={`text-xl font-bold ${getScoreColor(
                    stats.highestScore
                  )}`}
                >
                  {Math.round(stats.highestScore)}%
                </p>
              </div>
              <Trophy className="h-6 w-6 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/25 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Total Taken
                </p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.total}
                </p>
              </div>
              <BookOpen className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-6 animate-in slide-in-from-top duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilter("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>

              {/* Course Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Course
                </label>
                <select
                  value={filters.course}
                  onChange={(e) => updateFilter("course", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Courses</option>
                  {courses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Range
                </label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => updateFilter("dateRange", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">Last 3 Months</option>
                </select>
              </div>

              {/* Score Range Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Score Range
                </label>
                <select
                  value={filters.scoreRange}
                  onChange={(e) => updateFilter("scoreRange", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Scores</option>
                  <option value="excellent">Excellent (90%+)</option>
                  <option value="good">Good (70-89%)</option>
                  <option value="average">Average (50-69%)</option>
                  <option value="poor">Poor (below 50%)</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter("sortBy", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="submitted_at">Date Taken</option>
                  <option value="quiz_title">Quiz Title</option>
                  <option value="percentage">Score</option>
                  <option value="final_score">Points</option>
                  <option value="time_taken">Time Taken</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors hover:scale-105"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {filteredResults.length} quiz result
              {filteredResults.length !== 1 ? "s" : ""} found
            </p>
            {(filters.status !== "all" ||
              filters.course !== "all" ||
              filters.dateRange !== "all" ||
              filters.scoreRange !== "all" ||
              filters.search) && (
              <button
                onClick={clearFilters}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium hover:scale-105 transition-transform"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Quiz Sections */}
        <div className="space-y-8 mb-6">
          {/* Available Quizzes */}
          {availableQuizzes.length > 0 && (
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-orange-500" />
                Available Quizzes
              </h2>
              <div className="space-y-3">
                {availableQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-700 transition-all hover:shadow-lg hover:shadow-orange-100/50 dark:hover:shadow-orange-900/25 hover:-translate-y-0.5 p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 rounded-2xl flex items-center justify-center">
                            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {quiz.title}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 self-start sm:self-auto">
                              Available
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {quiz.time_limit
                                  ? `${quiz.time_limit} min`
                                  : "No limit"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              <span>{quiz.question_count} questions</span>
                            </div>
                            {quiz.course_name && (
                              <div className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                <span className="truncate max-w-20 sm:max-w-24">
                                  {quiz.course_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 sm:gap-4">
                        <Link
                          to={`/quizzes/${quiz.id}/take`}
                          className="inline-flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Start Quiz</span>
                          <span className="sm:hidden">Start</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Quiz Results */}
          {paginatedResults.length > 0 && (
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Completed Quizzes
              </h2>
              <div className="space-y-3">
                {paginatedResults.map((result) => (
                  <QuizResultItem
                    key={`${result.quiz_id}-${result.submitted_at}`}
                    result={result}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {availableQuizzes.length === 0 && paginatedResults.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl flex items-center justify-center mb-4 animate-bounce">
              <Search className="h-12 w-12 text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No quizzes available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {filters.search ||
              filters.status !== "all" ||
              filters.course !== "all" ||
              filters.dateRange !== "all" ||
              filters.scoreRange !== "all"
                ? "Try adjusting your filters or search terms."
                : "No quizzes are currently available. Check back later!"}
            </p>
            {(filters.search ||
              filters.status !== "all" ||
              filters.course !== "all" ||
              filters.dateRange !== "all" ||
              filters.scoreRange !== "all") && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl hover:scale-105 transition-all duration-200 mr-4"
              >
                Clear Filters
              </button>
            )}
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl hover:scale-105 transition-all duration-200"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </div>
        )}

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

            {/* Mobile pagination - show fewer pages */}
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
      </div>
    </div>
  );
};

export default StudentQuizzesPage;
