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
  Sparkles,
  Star,
  Heart,
  Zap,
  Crown,
  BookOpen,
  Filter,
  Download,
  BarChart3,
  Trash2,
  AlertTriangle,
  PenLine,
  ClipboardList,
  X,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import GradeAdjustmentModal from "../components/Quizzes/GradeAdjustmentModal";
import { QuizApiService } from "../services/quizApi";
import type { QuizQuestion } from "../types/quiz.types";

interface QuizSubmission {
  id: number;
  student_id: number;
  student_name?: string;
  student_email?: string;
  completed_at: string | null;
  time_taken: number;
  total_score: number | string;
  max_score: number | string;
  percentage: number | string;
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "single" | "all";
    submissionId?: number;
    studentName?: string;
  } | null>(null);
  const [resettingAll, setResettingAll] = useState(false);
  const [adjustingSubmissionId, setAdjustingSubmissionId] = useState<
    number | null
  >(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStep, setManualStep] = useState<1 | 2 | 3>(1);
  const [manualStudent, setManualStudent] = useState<{
    id: number;
    name: string;
    email: string;
  } | null>(null);
  const [manualStudentSearch, setManualStudentSearch] = useState("");
  const [enrolledStudents, setEnrolledStudents] = useState<
    { id: number; name: string; email: string }[]
  >([]);
  const [manualQuestions, setManualQuestions] = useState<QuizQuestion[]>([]);
  const [manualMarks, setManualMarks] = useState<Record<number, number>>({});
  const [loadingManualData, setLoadingManualData] = useState(false);
  const [initializingManual, setInitializingManual] = useState(false);

  useEffect(() => {
    if (quizId) {
      fetchQuiz();
      fetchSubmissions();
    }
  }, [quizId]);

  const fetchQuiz = async () => {
    try {
      const response = await axios.get(`/quizzes/${quizId}`);
      setQuiz(response.data.data);
    } catch (error) {
      console.error("Error fetching quiz:", error);
    }
  };

  const handleDeleteSubmission = async (submissionId: number) => {
    setDeletingId(submissionId);
    try {
      await axios.delete(`/quizzes/submissions/${submissionId}/delete`);
      toast.success("Submission deleted successfully");
      setSubmissions((prev) =>
        prev.filter((s) => s.submission_id !== submissionId),
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to delete submission",
      );
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleDeleteAllSubmissions = async () => {
    if (!quizId) return;
    setResettingAll(true);
    try {
      await axios.delete(`/quizzes/${quizId}/submissions/all`);
      toast.success("All submissions and proctoring data deleted");
      setSubmissions([]);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to delete submissions",
      );
    } finally {
      setResettingAll(false);
      setConfirmDelete(null);
    }
  };

  const fetchSubmissions = async (silent = false) => {
    if (!quizId) return;

    try {
      if (!silent) setLoading(true);
      const response = await axios.get(`/quizzes/${quizId}/submissions`);
      setSubmissions(response.data.data || []);
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      if (!silent)
        setError(error.response?.data?.message || "Failed to load submissions");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const resetManualModal = () => {
    setShowManualModal(false);
    setManualStep(1);
    setManualStudent(null);
    setManualStudentSearch("");
    setEnrolledStudents([]);
    setManualQuestions([]);
    setManualMarks({});
  };

  const handleOpenManualModal = async () => {
    setShowManualModal(true);
    setManualStep(1);
    setManualStudent(null);
    setManualStudentSearch("");
    setManualMarks({});
    if (!quizId) return;
    setLoadingManualData(true);
    try {
      const [studentsRes, questionsRes] = await Promise.all([
        QuizApiService.getQuizStudents(Number(quizId)),
        QuizApiService.getQuizQuestions(Number(quizId)),
      ]);
      const gradedIds = new Set(
        submissions
          .filter(
            (s) =>
              s.status === "completed" ||
              s.grade_status === "graded" ||
              s.grade_status === "auto_graded",
          )
          .map((s) => s.student_id),
      );
      setEnrolledStudents(studentsRes.data.filter((s) => !gradedIds.has(s.id)));
      const questions = questionsRes.data;
      setManualQuestions(questions);
      const initial: Record<number, number> = {};
      questions.forEach((q) => {
        initial[q.id] = 0;
        (q as any).points = parseFloat(String(q.points));
      });
      setManualMarks(initial);
    } catch (err: any) {
      toast.error("Failed to load students or questions");
    } finally {
      setLoadingManualData(false);
    }
  };

  const handleManualApprove = async () => {
    if (!quizId || !manualStudent) return;
    setInitializingManual(true);
    try {
      const initRes = await QuizApiService.initializeManualSubmission(
        Number(quizId),
        manualStudent.id,
      );
      await QuizApiService.gradeSubmission(
        initRes.data.submission_id,
        manualMarks,
      );
      toast.success("Marks recorded successfully.");
      resetManualModal();
      await fetchSubmissions(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to record marks");
    } finally {
      setInitializingManual(false);
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
        return <Crown className="w-3 h-3" />;
      case "auto_graded":
        return <Zap className="w-3 h-3" />;
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

  const pct = (s: QuizSubmission) => parseFloat(String(s.percentage)) || 0;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
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

  const stats = {
    total: submissions.length,
    completed: submissions.filter((s) => s.status === "completed").length,
    averageScore:
      submissions.length > 0
        ? Math.round(
            submissions.reduce((sum, s) => sum + pct(s), 0) /
              submissions.length,
          )
        : 0,
    highestScore:
      submissions.length > 0 ? Math.max(...submissions.map((s) => pct(s))) : 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-50 to-blue-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-blue-900/20 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-400 border-t-blue-500 mx-auto"></div>
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-500 animate-pulse" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse font-medium">
            Loading magical submissions...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="">
        <div className="text-center max-w-sm">
          <div className="relative mb-6">
            <Heart className="h-16 w-16 text-red-400 mx-auto animate-bounce" />
            <AlertCircle className="absolute -top-2 -right-2 h-8 w-8 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {error}
          </p>
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white text-sm font-medium rounded-full hover:from-blue-600 hover:to-blue-600 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <ArrowLeft className="h-3 w-3 mr-2" />
            Back to Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <button
              onClick={() => navigate(`/quizzes/${quizId}`)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-full shadow-sm hover:shadow-md transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white backdrop-blur-sm"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="text-xs font-medium">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenManualModal}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-full shadow-sm transition-all duration-200 text-blue-700 dark:text-blue-300 text-xs font-medium"
              >
                <ClipboardList className="w-3 h-3" />
                Record Manual Marks
              </button>
              {submissions.length > 0 && (
                <button
                  onClick={() => setConfirmDelete({ type: "all" })}
                  disabled={resettingAll}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-full shadow-sm transition-all duration-200 text-red-700 dark:text-red-300 text-xs font-medium disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Reset All Submissions
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 animate-in slide-in-from-bottom duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 animate-pulse" />
                    <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-blue-500 animate-ping" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                      Quiz Submissions
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      ✨ Magical results overview
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
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-3 border border-blue-200/50 dark:border-blue-800/50 transition-all duration-200 hover:scale-105">
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

                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-3 border border-green-200/50 dark:border-green-800/50 transition-all duration-200 hover:scale-105">
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

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-3 border border-blue-200/50 dark:border-blue-800/50 transition-all duration-200 hover:scale-105">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-sm font-bold text-blue-900 dark:text-blue-100">
                        {stats.averageScore}%
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        Avg
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-3 border border-amber-200/50 dark:border-amber-800/50 transition-all duration-200 hover:scale-105">
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
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-2xl p-4 mb-4 sm:mb-6">
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

            <div className="flex gap-2 sm:gap-3">
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
                  className={`p-2 px-3 rounded-xl transition-all duration-200 ${
                    viewMode === "cards"
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 px-3 rounded-xl transition-all duration-200 ${
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
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-blue-100 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500 dark:text-blue-400" />
                </div>
                <Heart className="absolute -top-2 -right-2 w-6 h-6 text-red-400 animate-bounce" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">
                No submissions found
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {searchTerm || statusFilter !== "all" || gradeFilter !== "all"
                  ? "Try adjusting your magical filters ✨"
                  : "No students have submitted this quiz yet 💫"}
              </p>
            </div>
          ) : viewMode === "cards" ? (
            // Card View
            filteredSubmissions.map((submission, index) => (
              <div
                key={submission.submission_id}
                className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-in slide-in-from-bottom"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start sm:items-center gap-3 mb-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        {pct(submission) >= 90 && (
                          <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500 animate-pulse" />
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
                          {formatDate(submission.completed_at)}
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
                          className={`w-3 h-3 ${getScoreColor(pct(submission))}`}
                        />
                        <span
                          className={`font-bold ${getScoreColor(pct(submission))}`}
                        >
                          {Math.round(pct(submission))}% (
                          {getGradeLetter(pct(submission))})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        navigate(
                          `/quizzes/${quizId}/submissions/${submission.submission_id}`,
                        )
                      }
                      className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white text-xs font-medium rounded-xl hover:from-blue-600 hover:to-blue-600 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </button>
                    {submission.grade_status !== "pending" && (
                      <button
                        onClick={() =>
                          setAdjustingSubmissionId(submission.submission_id)
                        }
                        className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white text-xs font-medium rounded-xl hover:from-blue-600 hover:to-blue-600 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        <PenLine className="w-3 h-3 mr-1" />
                        Adjust
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setConfirmDelete({
                          type: "single",
                          submissionId: submission.submission_id,
                          studentName:
                            submission.student_name || "this student",
                        })
                      }
                      disabled={deletingId === submission.submission_id}
                      className="inline-flex items-center px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-medium rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all duration-200 hover:scale-105 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
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
                    {filteredSubmissions.map((submission, index) => (
                      <tr
                        key={submission.submission_id}
                        className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg flex items-center justify-center">
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
                            className={`text-sm font-bold ${getScoreColor(pct(submission))}`}
                          >
                            {Math.round(pct(submission))}% (
                            {getGradeLetter(pct(submission))})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatTime(submission.time_taken)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(submission.completed_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                navigate(
                                  `/quizzes/${quizId}/submissions/${submission.submission_id}`,
                                )
                              }
                              className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-blue-600 transition-all duration-200 hover:scale-105"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </button>
                            {submission.grade_status !== "pending" && (
                              <button
                                onClick={() =>
                                  setAdjustingSubmissionId(
                                    submission.submission_id,
                                  )
                                }
                                className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-blue-600 transition-all duration-200 hover:scale-105"
                              >
                                <PenLine className="w-3 h-3 mr-1" />
                                Adjust
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setConfirmDelete({
                                  type: "single",
                                  submissionId: submission.submission_id,
                                  studentName:
                                    submission.student_name || "this student",
                                })
                              }
                              disabled={deletingId === submission.submission_id}
                              className="inline-flex items-center px-2 py-1 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
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

      {/* Grade Adjustment Modal */}
      {adjustingSubmissionId !== null && (
        <GradeAdjustmentModal
          submissionId={adjustingSubmissionId}
          onClose={() => setAdjustingSubmissionId(null)}
          onSaved={fetchSubmissions}
        />
      )}

      {/* Record Manual Marks Modal — 3-step wizard */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Record Manual Marks
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Step {manualStep} of 3 —{" "}
                    {manualStep === 1
                      ? "Select student"
                      : manualStep === 2
                        ? "Enter marks"
                        : "Preview & approve"}
                  </p>
                </div>
              </div>
              <button
                onClick={resetManualModal}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 px-6 py-3 flex-shrink-0">
              {([1, 2, 3] as const).map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${manualStep >= s ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`flex-1 h-0.5 ${manualStep > s ? "bg-blue-600" : "bg-gray-100 dark:bg-gray-800"}`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {/* Step 1: Select student */}
              {manualStep === 1 && (
                <div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={manualStudentSearch}
                      onChange={(e) => setManualStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  {loadingManualData ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      Loading students...
                    </div>
                  ) : enrolledStudents.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      All enrolled students have already been graded.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {enrolledStudents
                        .filter(
                          (s) =>
                            !manualStudentSearch ||
                            s.name
                              .toLowerCase()
                              .includes(manualStudentSearch.toLowerCase()) ||
                            s.email
                              .toLowerCase()
                              .includes(manualStudentSearch.toLowerCase()),
                        )
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setManualStudent(s)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${manualStudent?.id === s.id ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700" : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"}`}
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {s.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {s.email}
                              </div>
                            </div>
                            {manualStudent?.id === s.id && (
                              <CheckCircle className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" />
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Enter marks */}
              {manualStep === 2 && (
                <div>
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {manualStudent?.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {manualStudent?.email}
                      </div>
                    </div>
                  </div>
                  {manualQuestions.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      No questions found for this quiz.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {manualQuestions.map((q, idx) => {
                        const text =
                          q.questionBank?.question_text ||
                          q.question_text ||
                          `Question ${idx + 1}`;
                        const max = parseFloat(String(q.points));
                        const current = manualMarks[q.id] ?? 0;
                        return (
                          <div
                            key={q.id}
                            className="flex items-start gap-3 p-3 border border-gray-100 dark:border-gray-800 rounded-xl"
                          >
                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                                {text}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Max: {max} pts
                              </p>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={max}
                              step={0.5}
                              value={current}
                              onChange={(e) => {
                                const v = Math.min(
                                  max,
                                  Math.max(0, parseFloat(e.target.value) || 0),
                                );
                                setManualMarks((prev) => ({
                                  ...prev,
                                  [q.id]: v,
                                }));
                              }}
                              className="w-20 px-2 py-1.5 text-sm text-center border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex-shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total
                    </span>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      {Object.values(manualMarks).reduce((a, b) => a + b, 0)} /{" "}
                      {manualQuestions.reduce(
                        (a, q) => a + parseFloat(String(q.points)),
                        0,
                      )}{" "}
                      pts
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {manualStep === 3 && (
                <div>
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {manualStudent?.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {manualStudent?.email}
                      </div>
                    </div>
                  </div>
                  <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                            Question
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
                            Max
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
                            Awarded
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualQuestions.map((q, idx) => {
                          const text =
                            q.questionBank?.question_text ||
                            q.question_text ||
                            `Question ${idx + 1}`;
                          return (
                            <tr
                              key={q.id}
                              className="border-t border-gray-100 dark:border-gray-800"
                            >
                              <td className="px-3 py-2 text-xs text-gray-400">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                                {text}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500 text-right">
                                {parseFloat(String(q.points))}
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 text-right">
                                {manualMarks[q.id] ?? 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const total = Object.values(manualMarks).reduce(
                      (a, b) => a + b,
                      0,
                    );
                    const max = manualQuestions.reduce(
                      (a, q) => a + parseFloat(String(q.points)),
                      0,
                    );
                    const pct = max > 0 ? Math.round((total / max) * 100) : 0;
                    return (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Final Score
                        </span>
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                          {total} / {max} pts ({pct}%)
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <button
                onClick={
                  manualStep === 1
                    ? resetManualModal
                    : () => setManualStep((s) => (s - 1) as 1 | 2 | 3)
                }
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {manualStep === 1 ? "Cancel" : "Back"}
              </button>
              {manualStep < 3 ? (
                <button
                  onClick={() => setManualStep((s) => (s + 1) as 2 | 3)}
                  disabled={
                    manualStep === 1
                      ? !manualStudent
                      : manualQuestions.length === 0
                  }
                  className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleManualApprove}
                  disabled={initializingManual}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {initializingManual ? "Saving..." : "Approve & Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {confirmDelete.type === "all"
                    ? "Reset All Submissions"
                    : "Delete Submission"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              {confirmDelete.type === "all"
                ? `This will permanently delete all ${submissions.length} submission(s) and all proctoring data for this quiz.`
                : `This will permanently delete ${confirmDelete.studentName}'s submission and their proctoring data.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === "all") {
                    handleDeleteAllSubmissions();
                  } else if (confirmDelete.submissionId != null) {
                    handleDeleteSubmission(confirmDelete.submissionId);
                  }
                }}
                disabled={resettingAll || deletingId != null}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {resettingAll || deletingId != null ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizSubmissionsPage;
