import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import {
  AlertCircle,
  ArrowLeft,
  Target,
  BookOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
} from "lucide-react";
import { QuestionRenderer } from "../components/Quizzes/QuestionRenderer";
import RichTextDisplay from "../components/Common/RichTextDisplay";

interface Quiz {
  id: number;
  title: string;
  description: string;
  time_limit: number;
  total_points: number;
  passing_score?: number;
  questions: QuizQuestion[];
}

interface QuizQuestion {
  id: number;
  question_text: string;
  question_type: string;
  points: number;
  explanation?: string;
  options?: Array<{
    id: string;
    text: string;
    is_correct?: boolean;
  }>;
  coding_data?: any;
  ordering_data?: any;
  matching_data?: any;
  question_data?: any;
}

interface Answer {
  question_id: number;
  answer: any;
  time_taken?: number;
}

interface SubmissionData {
  quiz_id: number;
  answers: Answer[];
  time_taken: number;
  submitted_at: string;
}

interface QuizResult {
  total_score: number;
  max_score: number;
  percentage: number;
  grade: string;
  passed?: boolean | null;
  grading_settings?: {
    enable_automatic_grading: boolean;
    require_manual_grading: boolean;
    show_grades: boolean;
    show_correct_answers?: boolean;
  };
  time_taken?: number;
  answers: Array<{
    question_id: number;
    question_text?: string;
    question_type?: string;
    question_data?: any;
    user_answer: any;
    correct_answer: any;
    is_correct: boolean | null;
    points_earned: number | null;
    max_points: number;
    explanation?: string;
  }>;
}

type FilterTab = "all" | "correct" | "incorrect" | "pending";

const QUESTION_TYPE_META: Record<string, { label: string; colorClass: string }> = {
  multiple_choice: { label: "Multiple Choice", colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  single_choice: { label: "Single Choice", colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  true_false: { label: "True / False", colorClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  short_answer: { label: "Short Answer", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  long_answer: { label: "Long Answer", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  coding: { label: "Coding", colorClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  fill_blank: { label: "Fill in Blank", colorClass: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  matching: { label: "Matching", colorClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  ordering: { label: "Ordering", colorClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  dropdown: { label: "Dropdown", colorClass: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
};

function getQuestionStyle(isCorrect: boolean | null) {
  if (isCorrect === true) {
    return {
      border: "border-emerald-200 dark:border-emerald-800/50",
      bg: "from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/5 dark:to-teal-900/5",
      numberBg: "bg-emerald-500",
      badgeClass: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
      label: "✅ Correct",
    };
  }
  if (isCorrect === false) {
    return {
      border: "border-red-200 dark:border-red-800/50",
      bg: "from-red-50/50 to-pink-50/50 dark:from-red-900/5 dark:to-pink-900/5",
      numberBg: "bg-red-500",
      badgeClass: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700",
      label: "❌ Incorrect",
    };
  }
  return {
    border: "border-gray-200 dark:border-gray-700/50",
    bg: "from-gray-50/50 to-slate-50/50 dark:from-gray-900/5 dark:to-slate-900/5",
    numberBg: "bg-gray-400 dark:bg-gray-600",
    badgeClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700",
    label: "⏳ Pending Review",
  };
}

const QuizResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [submissionData] = useState<SubmissionData | null>(
    location.state?.submissionData || null,
  );
  const [answers] = useState<Answer[]>(location.state?.answers || []);
  const [completedResults] = useState<any>(
    location.state?.completedResults || null,
  );

  // Expand all questions when data loads
  useEffect(() => {
    if (result?.answers?.length) {
      setExpandedQuestions(new Set(result.answers.map((a) => a.question_id)));
    }
  }, [result]);

  useEffect(() => {
    if (id) {
      if (!completedResults) {
        fetchQuiz();
        fetchResults();
      } else {
        setQuiz({
          id: parseInt(id),
          title: completedResults.quiz_title || "Quiz Results",
          description: "",
          time_limit: 0,
          total_points: completedResults.max_score || 0,
          questions: [],
        });

        const gradingSettings = completedResults.grading_settings || {
          enable_automatic_grading: true,
          require_manual_grading: false,
          show_grades: true,
          show_correct_answers: false,
        };

        const transformedResult: QuizResult = {
          total_score: completedResults.final_score || 0,
          max_score: completedResults.max_score || 0,
          percentage: completedResults.percentage || 0,
          grade: gradingSettings.show_grades
            ? completedResults.grade || "N/A"
            : "N/A",
          passed: gradingSettings.show_grades ? completedResults.passed : null,
          grading_settings: gradingSettings,
          time_taken: completedResults.time_taken || 0,
          answers: Array.isArray(completedResults.results)
            ? completedResults.results.map((r: any) => ({
                question_id: r.question_id,
                question_text: r.question_text,
                question_type: r.question_type,
                question_data: r.question_data,
                user_answer: r.user_answer,
                correct_answer: r.correct_answer,
                is_correct: r.is_correct,
                // Preserve null so "Pending" shows correctly
                points_earned: r.points_earned != null ? parseFloat(r.points_earned) : null,
                max_points: r.max_points || 1,
                explanation: r.explanation || null,
              }))
            : [],
        };
        setResult(transformedResult);
        setLoading(false);
      }
    }
  }, [id, completedResults]);

  const fetchQuiz = async () => {
    try {
      const response = await axios.get(`/quizzes/${id}`);
      setQuiz(response.data.data);
    } catch (error) {
      console.error("Error fetching quiz:", error);
    }
  };

  const fetchResults = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setFetchError(null);
      const response = await axios.get(`/quizzes/${id}/results`);
      const apiData = response.data.data;

      const gradingSettings = apiData.grading_settings || {
        enable_automatic_grading: true,
        require_manual_grading: false,
        show_grades: true,
      };

      const transformedResult: QuizResult = {
        total_score: parseFloat(apiData.final_score) || 0,
        max_score: parseFloat(apiData.max_score) || 0,
        percentage: parseFloat(apiData.percentage) || 0,
        grade: gradingSettings.show_grades ? apiData.grade || "N/A" : "N/A",
        passed: gradingSettings.show_grades ? apiData.passed : null,
        grading_settings: gradingSettings,
        time_taken: apiData.time_taken || 0,
        answers:
          apiData.results?.map((r: any) => ({
            question_id: r.question_id,
            question_text: r.question_text,
            question_type: r.question_type,
            question_data: r.question_data,
            user_answer: r.user_answer,
            correct_answer: r.correct_answer,
            is_correct: r.is_correct,
            // Preserve null — null means not yet graded (pending manual review)
            points_earned: r.points_earned != null ? parseFloat(r.points_earned) : null,
            max_points: r.max_points || (r.question_type === "coding" ? 5 : 1),
            explanation: r.explanation || null,
          })) || [],
      };

      setResult(transformedResult);
    } catch (error: any) {
      console.error("Error fetching quiz results:", error);
      setFetchError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load results. Please try again.",
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getGradeFromPercentage = (percentage: number): string => {
    const p = parseFloat(percentage as any);
    const ps = parseFloat((quiz?.passing_score || 60) as any);
    if (p >= 90) return "A";
    if (p >= 80) return "B";
    if (p >= 70) return "C";
    if (p >= 60) return "D";
    if (quiz && p >= ps) return "D";
    return "F";
  };

  // time_taken from API is in seconds
  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getGradeTheme = (grade: string) => {
    switch (grade) {
      case "A":
        return {
          primary: "from-green-400 to-green-500 dark:from-green-600 dark:to-green-700",
          secondary: "from-green-50 to-green-50",
        };
      case "B":
        return {
          primary: "from-indigo-400 to-indigo-500",
          secondary: "from-indigo-50 to-indigo-50",
        };
      case "C":
        return {
          primary: "from-blue-400 to-indigo-500",
          secondary: "from-blue-50 to-indigo-50",
        };
      case "D":
        return {
          primary: "from-blue-400 to-blue-500",
          secondary: "from-blue-50 to-blue-50",
        };
      case "F":
      default:
        return {
          primary: "from-red-400 to-pink-500",
          secondary: "from-red-50 to-pink-50",
        };
    }
  };

  const toggleQuestion = (questionId: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const toggleAllQuestions = (expand: boolean) => {
    if (!result) return;
    if (expand) {
      setExpandedQuestions(new Set(result.answers.map((a) => a.question_id)));
    } else {
      setExpandedQuestions(new Set());
    }
  };

  // Filter and counts
  const correctCount = result?.answers.filter((a) => a.is_correct === true).length ?? 0;
  const incorrectCount = result?.answers.filter((a) => a.is_correct === false).length ?? 0;
  const pendingCount = result?.answers.filter((a) => a.is_correct === null).length ?? 0;
  const totalCount = result?.answers.length ?? 0;

  const filteredAnswers =
    result?.answers.filter((attempt) => {
      if (filterTab === "correct") return attempt.is_correct === true;
      if (filterTab === "incorrect") return attempt.is_correct === false;
      if (filterTab === "pending") return attempt.is_correct === null;
      return true;
    }) ?? [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 dark:border-gray-700/30">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
              Loading your quiz results...
            </p>
            <div className="mt-4 flex justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-fading"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-fading" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-fading" style={{ animationDelay: "0.2s" }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-8 border border-red-200 dark:border-red-700/30">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              Could Not Load Results
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{fetchError}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={fetchResults}
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 transition-all"
              >
                <Loader2 className="h-4 w-4 mr-2" />
                Retry
              </button>
              <Link
                to="/my-quizzes"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quizzes
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen rounded-3xl bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 dark:border-gray-700/30 max-w-md">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              Quiz Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Unable to load quiz data. Please check the quiz ID and try again.
            </p>
            <Link
              to="/my-quizzes"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Quizzes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 dark:border-gray-700/20 max-w-md">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              Results Not Available
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Quiz results could not be calculated. This may be due to missing submission data.
            </p>
            <Link
              to="/my-quizzes"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Quizzes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-4 h-4 bg-blue-200 dark:bg-blue-800/30 rounded-full animate-fading delay-100"></div>
        <div className="absolute top-40 right-20 w-6 h-6 bg-blue-200 dark:bg-blue-800/30 rounded-full animate-fading delay-500"></div>
        <div className="absolute bottom-32 left-1/4 w-3 h-3 bg-indigo-200 dark:bg-indigo-800/30 rounded-full animate-fading delay-300"></div>
        <div className="absolute bottom-20 right-1/3 w-5 h-5 bg-blue-200 dark:bg-blue-800/30 rounded-full animate-fading delay-700"></div>
        <div className="absolute top-1/4 right-10 w-8 h-8 border-2 border-blue-300 dark:border-blue-700/50 rounded-lg rotate-45 animate-spin delay-1000" style={{ animationDuration: "8s" }}></div>
        <div className="absolute bottom-1/4 left-20 w-6 h-6 border-2 border-blue-300 dark:border-blue-700/50 rounded-full animate-spin delay-1500" style={{ animationDuration: "6s" }}></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <Link
              to="/my-quizzes"
              className="inline-flex items-center px-4 py-2.5 text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:scale-105"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quizzes
            </Link>
          </div>

          <div className="relative overflow-hidden bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 animate-in slide-in-from-bottom-8 duration-700 delay-100 border-4 shadow-sm border-white/20 dark:border-gray-800/50">
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${getGradeTheme(result.grade).primary} opacity-10 blur-3xl -mr-32 -mt-32`}></div>
            <div className={`absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr ${getGradeTheme(result.grade).primary} opacity-10 blur-3xl -ml-32 -mb-32`}></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
              {/* Grade Circle */}
              <div className="shrink-0 animate-in zoom-in duration-1000 delay-300">
                <div className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${getGradeTheme(result.grade).primary} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500`}></div>
                  <div className="relative w-56 h-56 rounded-full flex items-center justify-center border-[12px] border-white/10 dark:border-gray-800/50 p-2 shadow-inner">
                    <div className={`w-full h-full rounded-full bg-gradient-to-br ${getGradeTheme(result.grade).primary} flex flex-col items-center justify-center text-white shadow-xl`}>
                      <span className="text-8xl font-black tracking-tighter animate-in slide-in-from-bottom-4 duration-500 delay-500">
                        {result.grading_settings?.show_grades ? result.grade : "⏳"}
                      </span>
                      {result.grading_settings?.show_grades && (
                        <span className="text-xl font-bold opacity-90 -mt-2">
                          {Math.round(result.percentage)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {result.passed !== null && result.passed !== undefined && (
                    <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-8 py-2.5 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg animate-in bounce-in duration-700 delay-1000 ${
                      result.passed
                        ? "bg-green-500 dark:bg-green-600 text-white shadow-green-500/30"
                        : "bg-red-500 dark:bg-red-600 text-white shadow-red-500/30"
                    }`}>
                      {result.passed ? "Qualified" : "Unqualified"}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 space-y-8 w-full">
                <div className="text-center md:text-left">
                  <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                    Performance Analysis
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    Detailed breakdown of your objective assessment results
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Score */}
                  <div className="bg-white/50 dark:bg-gray-800/30 border border-white/20 dark:border-gray-700/50 rounded-3xl p-6 flex items-center gap-5 hover:bg-white/80 dark:hover:bg-gray-800/50 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <Target className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {result.total_score}{" "}
                        <span className="text-sm font-bold text-gray-400">/ {result.max_score}</span>
                      </div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Points</div>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="bg-white/50 dark:bg-gray-800/30 border border-white/20 dark:border-gray-700/50 rounded-3xl p-6 flex items-center gap-5 hover:bg-white/80 dark:hover:bg-gray-800/50 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {formatTime(result.time_taken || submissionData?.time_taken || 0)}
                      </div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time Invested</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-2">
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700">
                    <div
                      className={`h-full bg-gradient-to-r ${getGradeTheme(result.grade).primary} rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${result.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Efficiency Threshold</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{Math.round(result.percentage)}% Mastery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Review Section */}
        <div className="bg-white/50 dark:bg-gray-900/50 rounded-[2rem] p-8 mt-8 animate-in slide-in-from-bottom duration-500 delay-1200 border-4 border-white dark:border-gray-800/30">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">📝</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Question Review</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Review your answers and learn from the experience</p>
              </div>
            </div>

            {/* Expand / Collapse All */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleAllQuestions(true)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Expand All
              </button>
              <button
                onClick={() => toggleAllQuestions(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Summary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-700/50">
              <div className="text-2xl font-black text-gray-800 dark:text-white">{totalCount}</div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">Total</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 text-center border border-emerald-100 dark:border-emerald-800/30">
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{correctCount}</div>
              <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Correct</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 text-center border border-red-100 dark:border-red-800/30">
              <div className="text-2xl font-black text-red-700 dark:text-red-400">{incorrectCount}</div>
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mt-0.5">Incorrect</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 text-center border border-amber-100 dark:border-amber-800/30">
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400">{pendingCount}</div>
              <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mt-0.5">Pending</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            {(
              [
                { key: "all", label: "All", count: totalCount, color: "gray" },
                { key: "correct", label: "Correct", count: correctCount, color: "emerald" },
                { key: "incorrect", label: "Incorrect", count: incorrectCount, color: "red" },
                { key: "pending", label: "Pending", count: pendingCount, color: "amber" },
              ] as const
            ).map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setFilterTab(key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                  filterTab === key
                    ? color === "gray"
                      ? "bg-gray-800 dark:bg-white text-white dark:text-gray-900 border-gray-800 dark:border-white shadow-sm"
                      : color === "emerald"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                      : color === "red"
                      ? "bg-red-500 text-white border-red-500 shadow-sm"
                      : "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {label}
                <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  filterTab === key ? "bg-white/25" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Question List */}
          {filteredAnswers.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-600">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-semibold">No questions in this category</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAnswers.map((attempt: any, index: number) => {
                const questionObj = {
                  id: attempt.question_id,
                  question_text: attempt.question_text,
                  question_type: attempt.question_type,
                  question_data: attempt.question_data,
                  explanation: attempt.explanation,
                  correct_answer: attempt.correct_answer,
                };
                const style = getQuestionStyle(attempt.is_correct);
                const typeMeta = QUESTION_TYPE_META[attempt.question_type] || {
                  label: attempt.question_type || "Question",
                  colorClass: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                };
                const isExpanded = expandedQuestions.has(attempt.question_id);
                const originalIndex = result.answers.findIndex((a) => a.question_id === attempt.question_id);

                return (
                  <div
                    key={attempt.question_id}
                    className={`border-2 rounded-3xl transition-all duration-300 hover:shadow-lg ${style.border} bg-gradient-to-br ${style.bg}`}
                  >
                    {/* Collapsible Header */}
                    <button
                      onClick={() => toggleQuestion(attempt.question_id)}
                      className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 group"
                    >
                      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                        {/* Question number */}
                        <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-black shadow-sm text-white ${style.numberBg}`}>
                          {originalIndex + 1}
                        </div>

                        {/* Status badge */}
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${style.badgeClass}`}>
                          {style.label}
                        </span>

                        {/* Question type badge */}
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${typeMeta.colorClass}`}>
                          {typeMeta.label}
                        </span>

                        {/* Points badge */}
                        <div className="px-3 py-1 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-blue-500" />
                          {attempt.points_earned != null ? (
                            <span>{attempt.points_earned} / {attempt.max_points || 0} pts</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">Pending grading</span>
                          )}
                        </div>

                        {/* Question text preview */}
                        {!isExpanded && (
                          <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs hidden sm:block">
                            {attempt.question_text?.replace(/<[^>]+>/g, "").slice(0, 80)}
                            {(attempt.question_text?.length ?? 0) > 80 ? "…" : ""}
                          </span>
                        )}
                      </div>

                      {/* Expand icon */}
                      <div className="shrink-0 mt-0.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>

                    {/* Expanded Body */}
                    {isExpanded && (
                      <div className="px-6 pb-8 pt-0 border-t border-gray-100 dark:border-gray-800/50">
                        {/* Question text */}
                        <div className="text-base font-bold text-gray-900 dark:text-white leading-relaxed mt-5 mb-6">
                          <RichTextDisplay content={attempt.question_text || ""} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* User's Answer */}
                          <div className="flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-3 px-1">
                              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <span className="text-xs">📝</span>
                              </div>
                              <span className="text-gray-800 dark:text-gray-200 font-bold uppercase tracking-wider text-xs">
                                Your Answer
                              </span>
                            </div>
                            <div className="flex-1 p-5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm">
                              <QuestionRenderer
                                question={questionObj as any}
                                answer={attempt.user_answer}
                                onAnswerChange={() => {}}
                                disabled={true}
                                showCorrectAnswer={false}
                              />
                            </div>
                          </div>

                          {/* Correct Answer */}
                          {result.grading_settings?.show_correct_answers &&
                            attempt.correct_answer != null && (
                              <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                    <span className="text-xs">🎯</span>
                                  </div>
                                  <span className="text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider text-xs">
                                    Correct Solution
                                  </span>
                                </div>
                                <div className="flex-1 p-5 bg-emerald-50/30 dark:bg-emerald-900/10 backdrop-blur-sm border border-emerald-200 dark:border-emerald-800/50 rounded-3xl shadow-sm">
                                  <QuestionRenderer
                                    question={questionObj as any}
                                    answer={attempt.correct_answer}
                                    onAnswerChange={() => {}}
                                    disabled={true}
                                    showCorrectAnswer={true}
                                  />
                                </div>
                              </div>
                            )}

                          {/* When pending, show a helpful message in the right column */}
                          {attempt.is_correct === null &&
                            !result.grading_settings?.show_correct_answers && (
                              <div className="flex flex-col h-full">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                  <div className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                                    <span className="text-xs">⏳</span>
                                  </div>
                                  <span className="text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider text-xs">
                                    Awaiting Review
                                  </span>
                                </div>
                                <div className="flex-1 p-5 bg-amber-50/30 dark:bg-amber-900/10 backdrop-blur-sm border border-amber-200 dark:border-amber-800/50 rounded-3xl shadow-sm flex items-center justify-center">
                                  <div className="text-center text-amber-700 dark:text-amber-400">
                                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-60" />
                                    <p className="text-sm font-semibold">This answer is being reviewed by your instructor.</p>
                                    <p className="text-xs opacity-70 mt-1">Check back later for your score.</p>
                                  </div>
                                </div>
                              </div>
                            )}
                        </div>

                        {/* Explanation */}
                        {attempt.explanation && attempt.explanation !== "No explanation provided." && (
                          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 backdrop-blur-sm border border-blue-100 dark:border-blue-800/30 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <AlertCircle className="w-5 h-5" />
                              </div>
                              <span className="text-blue-900 dark:text-blue-300 font-bold">Expert Explanation</span>
                            </div>
                            <div className="text-blue-800 dark:text-blue-400 leading-relaxed text-sm md:text-base">
                              <RichTextDisplay content={attempt.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-12 text-center animate-in slide-in-from-bottom duration-500 delay-1000">
          <div className="bg-white dark:bg-gray-800 backdrop-blur-sm rounded-3xl p-6 border border-orange-200 dark:border-orange-700/30 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              What would you like to do next?
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/my-quizzes"
                className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 transition-all duration-300 hover:scale-105"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                Take Another Quiz
              </Link>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 hover:scale-105 hover:border-gray-400 dark:hover:border-gray-500"
              >
                <Target className="h-5 w-5 mr-2" />
                Print Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizResultsPage;
