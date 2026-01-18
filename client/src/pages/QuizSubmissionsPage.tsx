import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosConfig";
import {
  ArrowLeft,
  Users,
  Trophy,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Search,
  Calendar,
  User,
  FileText,
  TrendingUp,
  Award,
  Target,
  BarChart3,
  Download,
} from "lucide-react";

interface QuizSubmission {
  id: number;
  student_id: number;
  student_name?: string;
  student_email?: string;
  submitted_at: string;
  time_taken: number;
  total_score: number;
  max_score: number;
  percentage: number;
  grade?: string;
  status: "completed" | "in_progress" | "expired";
  grade_status: "graded" | "pending" | "auto_graded";
  attempt_number: number;
  submission_id: number;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  total_points: number;
  time_limit?: number;
  max_attempts?: number;
}

const QuizSubmissionsPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  useEffect(() => {
    if (quizId) {
      fetchQuiz();
      fetchSubmissions();
    }
  }, [quizId]);

  const fetchQuiz = async () => {
    try {
      const response = await axios.get(`/api/quizzes/${quizId}`);
      setQuiz(response.data.data);
    } catch (error) {
      console.error("Error fetching quiz:", error);
    }
  };

  const fetchSubmissions = async () => {
    if (!quizId) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/quizzes/${quizId}/submissions`);
      setSubmissions(response.data.data || []);
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      setError(error.response?.data?.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      (submission.student_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ??
        false) ||
      (submission.student_email
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ??
        false);

    const matchesStatus =
      statusFilter === "all" || submission.status === statusFilter;
    const matchesGrade =
      gradeFilter === "all" || submission.grade_status === gradeFilter;

    return matchesSearch && matchesStatus && matchesGrade;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-3 h-3" />;
      case "in_progress":
        return <Clock className="w-3 h-3" />;
      case "expired":
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "in_progress":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "expired":
        return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    }
  };

  const getGradeIcon = (gradeStatus: string) => {
    switch (gradeStatus) {
      case "graded":
        return <CheckCircle className="w-3 h-3" />;
      case "auto_graded":
        return <CheckCircle className="w-3 h-3" />;
      case "pending":
        return <Clock className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getGradeColor = (gradeStatus: string) => {
    switch (gradeStatus) {
      case "graded":
        return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
      case "auto_graded":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300";
      case "pending":
        return "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300";
      default:
        return "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (percentage >= 80) return "text-green-600 dark:text-green-400";
    if (percentage >= 70) return "text-blue-600 dark:text-blue-400";
    if (percentage >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) return;

    const headers = [
      "Student Name",
      "Email",
      "Status",
      "Grade Status",
      "Score",
      "Max Score",
      "Percentage",
      "Time Taken (s)",
      "Submitted At",
    ];

    const csvContent = [
      headers.join(","),
      ...submissions.map((s) =>
        [
          `"${s.student_name || "Unknown"}"`,
          s.student_email || "",
          s.status,
          s.grade_status,
          s.total_score,
          s.max_score,
          `${s.percentage}%`,
          s.time_taken,
          `"${new Date(s.submitted_at).toLocaleString()}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `quiz_${quizId}_submissions.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: submissions.length,
    completed: submissions.filter((s) => s.status === "completed").length,
    averageScore:
      submissions.length > 0
        ? Math.round(
            submissions.reduce((sum, s) => sum + s.percentage, 0) /
              submissions.length,
          )
        : 0,
    highestScore:
      submissions.length > 0
        ? Math.max(...submissions.map((s) => s.percentage))
        : 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-400 border-t-indigo-500 mx-auto"></div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse font-medium">
            Loading submissions...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-red-900/20 dark:to-purple-900/20 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="relative mb-6">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto animate-bounce" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {error}
          </p>
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium rounded-full hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <ArrowLeft className="h-3 w-3 mr-2" />
            Back to Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <button
              onClick={() => navigate(`/quizzes/${quizId}`)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-full shadow-sm hover:shadow-md transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white backdrop-blur-sm"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="text-xs font-medium">Back</span>
            </button>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl animate-in slide-in-from-bottom duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                      Quiz Submissions
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Overview of student submissions
                    </p>
                  </div>
                </div>
                {quiz && (
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 font-medium">
                    {quiz.title}
                  </p>
                )}
              </div>

              {/* Mini Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-3 border border-blue-200/50 dark:border-blue-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-sm font-bold text-blue-900 dark:text-blue-100">
                        {stats.total}
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        Total
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-3 border border-green-200/50 dark:border-green-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <div className="text-sm font-bold text-green-900 dark:text-green-100">
                        {stats.completed}
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300">
                        Done
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-3 border border-indigo-200/50 dark:border-indigo-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                        {stats.averageScore}%
                      </div>
                      <div className="text-xs text-indigo-700 dark:text-indigo-300">
                        Avg
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-3 border border-amber-200/50 dark:border-amber-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="text-sm font-bold text-amber-900 dark:text-amber-100">
                        {stats.highestScore}%
                      </div>
                      <div className="text-xs text-amber-700 dark:text-amber-300">
                        Best
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-2xl p-4 mb-4 sm:mb-6 shadow-lg">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200/50 dark:border-gray-700/50 dark:bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 text-xs font-medium"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200/50 dark:border-gray-700/50 dark:bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="expired">Expired</option>
              </select>

              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200/50 dark:border-gray-700/50 dark:bg-gray-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
              >
                <option value="all">All Grades</option>
                <option value="graded">Graded</option>
                <option value="auto_graded">Auto</option>
                <option value="pending">Pending</option>
              </select>

              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    viewMode === "cards"
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    viewMode === "table"
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submissions */}
        <div className="space-y-3 sm:space-y-4">
          {filteredSubmissions.length === 0 ? (
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-2xl p-8 sm:p-12 text-center shadow-lg">
              <div className="relative mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">
                No submissions found
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {searchTerm || statusFilter !== "all" || gradeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No students have submitted this quiz yet"}
              </p>
            </div>
          ) : viewMode === "cards" ? (
            // Card View
            filteredSubmissions.map((submission, index) => (
              <div
                key={submission.id}
                className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-in slide-in-from-bottom"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start sm:items-center gap-3 mb-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        {submission.percentage >= 90 && (
                          <Award className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                          {submission.student_name || "Unknown Student"}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {submission.student_email}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(submission.status)}`}
                      >
                        {getStatusIcon(submission.status)}
                        {submission.status.replace("_", " ")}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getGradeColor(submission.grade_status)}`}
                      >
                        {getGradeIcon(submission.grade_status)}
                        {submission.grade_status.replace("_", " ")}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        <Target className="w-3 h-3" />#
                        {submission.attempt_number}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {formatDate(submission.submitted_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {formatTime(submission.time_taken)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Target className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {submission.total_score}/{submission.max_score}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Trophy
                          className={`w-3 h-3 ${getScoreColor(submission.percentage)}`}
                        />
                        <span
                          className={`font-bold ${getScoreColor(submission.percentage)}`}
                        >
                          {Math.round(submission.percentage)}% (
                          {getGradeLetter(submission.percentage)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        navigate(
                          `/quizzes/${quizId}/results/${submission.submission_id}`,
                        )
                      }
                      className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            // Table View
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Student
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Grade
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((submission) => (
                      <tr
                        key={submission.id}
                        className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {submission.student_name || "Unknown"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {submission.student_email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(submission.status)}`}
                          >
                            {getStatusIcon(submission.status)}
                            {submission.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getGradeColor(submission.grade_status)}`}
                          >
                            {getGradeIcon(submission.grade_status)}
                            {submission.grade_status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-bold ${getScoreColor(submission.percentage)}`}
                          >
                            {Math.round(submission.percentage)}% (
                            {getGradeLetter(submission.percentage)})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatTime(submission.time_taken)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(submission.submitted_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              navigate(
                                `/quizzes/${quizId}/results/${submission.submission_id}`,
                              )
                            }
                            className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 hover:scale-105"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizSubmissionsPage;
