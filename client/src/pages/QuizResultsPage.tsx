import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import {
  AlertCircle,
  ArrowLeft,
  Target,
  BookOpen,
  Loader2,
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

const QuizResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissionData] = useState<SubmissionData | null>(
    location.state?.submissionData || null,
  );
  const [answers] = useState<Answer[]>(location.state?.answers || []);
  const [completedResults] = useState<any>(
    location.state?.completedResults || null,
  );

  useEffect(() => {
    if (id) {
      if (!completedResults) {
        fetchQuiz();
        fetchResults();
      } else {
        // Set quiz data from completed results
        setQuiz({
          id: parseInt(id),
          title: completedResults.quiz_title || "Quiz Results",
          description: "",
          time_limit: 0,
          total_points: completedResults.max_score || 0,
          questions: [], // We don't need full questions for results display
        });

        // Transform completed results data to match QuizResult interface
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
            ? completedResults.results.map((result: any) => ({
                question_id: result.question_id,
                question_text: result.question_text,
                question_type: result.question_type,
                question_data: result.question_data,
                user_answer: result.user_answer,
                correct_answer: result.correct_answer,
                is_correct: result.is_correct,
                points_earned: result.points_earned || 0,
                max_points: result.max_points || 1,
                explanation: result.explanation || "No explanation provided.",
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
      const response = await axios.get(`/quizzes/${id}/results`);
      const apiData = response.data.data;

      // Check grading settings
      const gradingSettings = apiData.grading_settings || {
        enable_automatic_grading: true,
        require_manual_grading: false,
        show_grades: true,
      };

      // Transform API response to match our interface
      const transformedResult: QuizResult = {
        total_score: parseFloat(apiData.final_score) || 0,
        max_score: parseFloat(apiData.max_score) || 0,
        percentage: parseFloat(apiData.percentage) || 0,
        grade: gradingSettings.show_grades ? apiData.grade || "N/A" : "N/A",
        passed: gradingSettings.show_grades ? apiData.passed : null,
        grading_settings: gradingSettings,
        time_taken: apiData.time_taken || 0,
        answers:
          apiData.results?.map((result: any) => {
            console.log("[DEBUG Frontend] Processing result:", {
              question_id: result.question_id,
              points_earned_raw: result.points_earned,
              points_earned_type: typeof result.points_earned,
              parsed_value: parseFloat(result.points_earned),
              final_value: parseFloat(result.points_earned) || 0,
            });
            return {
              question_id: result.question_id,
              question_text: result.question_text,
              question_type: result.question_type,
              question_data: result.question_data,
              user_answer: result.user_answer,
              correct_answer: result.correct_answer,
              is_correct: result.is_correct,
              points_earned: parseFloat(result.points_earned) || 0,
              max_points:
                result.max_points ||
                (result.question_type === "coding" ? 5 : 1),
              explanation: result.explanation || "No explanation provided.",
            };
          }) || [],
      };

      setResult(transformedResult);
    } catch (error) {
      console.error("Error fetching quiz results:", error);
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

    // Check if the student passed despite a low percentage (e.g. low passing score)
    if (quiz && p >= ps) {
      return "D";
    }

    return "F";
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getGradeTheme = (grade: string) => {
    switch (grade) {
      case "A":
        return {
          primary:
            "from-green-400 to-green-500 dark:from-green-600 dark:to-green-700",
          secondary: "from-green-50 to-green-50",
          accent: "green-600",
          text: "green-800",
          bg: "green-100",
          border: "green-200",
          darkPrimary: "from-green-500 to-green-600",
          darkSecondary: "from-green-900/20 to-green-900/20",
          darkAccent: "green-400",
          darkText: "green-200",
          darkBg: "green-900/30",
          darkBorder: "green-700/50",
        };
      case "B":
        return {
          primary: "from-indigo-400 to-indigo-500",
          secondary: "from-indigo-50 to-indigo-50",
          accent: "indigo-600",
          text: "indigo-800",
          bg: "indigo-100",
          border: "indigo-200",
          darkPrimary: "from-indigo-500 to-indigo-600",
          darkSecondary: "from-indigo-900/20 to-indigo-900/20",
          darkAccent: "indigo-400",
          darkText: "indigo-200",
          darkBg: "indigo-900/30",
          darkBorder: "indigo-700/50",
        };
      case "C":
        return {
          primary: "from-blue-400 to-indigo-500",
          secondary: "from-blue-50 to-indigo-50",
          accent: "blue-600",
          text: "blue-800",
          bg: "blue-100",
          border: "blue-200",
          darkPrimary: "from-blue-500 to-indigo-600",
          darkSecondary: "from-blue-900/20 to-indigo-900/20",
          darkAccent: "blue-400",
          darkText: "blue-200",
          darkBg: "blue-900/30",
          darkBorder: "blue-700/50",
        };
      case "D":
        return {
          primary: "from-blue-400 to-blue-500",
          secondary: "from-blue-50 to-blue-50",
          accent: "blue-600",
          text: "blue-800",
          bg: "blue-100",
          border: "blue-200",
          darkPrimary: "from-blue-500 to-blue-600",
          darkSecondary: "from-blue-900/20 to-blue-900/20",
          darkAccent: "blue-400",
          darkText: "blue-200",
          darkBg: "blue-900/30",
          darkBorder: "blue-700/50",
        };
      case "F":
      default:
        return {
          primary: "from-red-400 to-pink-500",
          secondary: "from-red-50 to-pink-50",
          accent: "red-600",
          text: "red-800",
          bg: "red-100",
          border: "red-200",
          darkPrimary: "from-red-500 to-pink-600",
          darkSecondary: "from-red-900/20 to-pink-900/20",
          darkAccent: "red-400",
          darkText: "red-200",
          darkBg: "red-900/30",
          darkBorder: "red-700/50",
        };
    }
  };

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
              <div
                className="w-2 h-2 bg-blue-400 rounded-full animate-fading"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-fading"
                style={{ animationDelay: "0.2s" }}
              ></div>
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
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Quizzes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!result && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 dark:border-gray-700/20 max-w-md">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              Results Not Available
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Quiz results could not be calculated. This may be due to missing
              submission data.
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

  if (!result) {
    return null; // Still loading
  }

  return (
    <div className="">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating circles */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-blue-200 dark:bg-blue-800/30 rounded-full animate-fading delay-100"></div>
        <div className="absolute top-40 right-20 w-6 h-6 bg-blue-200 dark:bg-blue-800/30 rounded-full animate-fading delay-500"></div>
        <div className="absolute bottom-32 left-1/4 w-3 h-3 bg-indigo-200 dark:bg-indigo-800/30 rounded-full animate-fading delay-300"></div>
        <div className="absolute bottom-20 right-1/3 w-5 h-5 bg-blue-200 dark:bg-blue-800/30 rounded-full animate-fading delay-700"></div>

        {/* Floating geometric shapes */}
        <div
          className="absolute top-1/4 right-10 w-8 h-8 border-2 border-blue-300 dark:border-blue-700/50 rounded-lg rotate-45 animate-spin delay-1000"
          style={{ animationDuration: "8s" }}
        ></div>
        <div
          className="absolute bottom-1/4 left-20 w-6 h-6 border-2 border-blue-300 dark:border-blue-700/50 rounded-full animate-spin delay-1500"
          style={{ animationDuration: "6s" }}
        ></div>
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
            {/* Background Decorative Blobs */}
            <div
              className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${getGradeTheme(result.grade).primary} opacity-10 blur-3xl -mr-32 -mt-32`}
            ></div>
            <div
              className={`absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr ${getGradeTheme(result.grade).primary} opacity-10 blur-3xl -ml-32 -mb-32`}
            ></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
              {/* Left Column: Grade Circle */}
              <div className="shrink-0 animate-in zoom-in duration-1000 delay-300">
                <div className="relative group">
                  {/* Outer Glow */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${getGradeTheme(result.grade).primary} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500`}
                  ></div>

                  {/* Gauge/Progress Ring (Simplified) */}
                  <div
                    className={`relative w-56 h-56 rounded-full flex items-center justify-center border-[12px] border-white/10 dark:border-gray-800/50 p-2 shadow-inner`}
                  >
                    <div
                      className={`w-full h-full rounded-full bg-gradient-to-br ${getGradeTheme(result.grade).primary} flex flex-col items-center justify-center text-white shadow-xl`}
                    >
                      <span className="text-8xl font-black tracking-tighter animate-in slide-in-from-bottom-4 duration-500 delay-500">
                        {result.grading_settings?.show_grades
                          ? result.grade
                          : "⏳"}
                      </span>
                      {result.grading_settings?.show_grades && (
                        <span className="text-xl font-bold opacity-90 -mt-2">
                          {Math.round(result.percentage)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pass/Fail Badge */}
                  {result.passed !== null && result.passed !== undefined && (
                    <div
                      className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-8 py-2.5 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg animate-in bounce-in duration-700 delay-1000 ${
                        result.passed
                          ? "bg-green-500 dark:bg-green-600 text-white shadow-green-500/30"
                          : "bg-red-500 dark:bg-red-600 text-white shadow-red-500/30"
                      }`}
                    >
                      {result.passed ? "Qualified" : "Unqualified"}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Detailed Stats */}
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
                  {/* Score Card */}
                  <div className="bg-white/50 dark:bg-gray-800/30 border border-white/20 dark:border-gray-700/50 rounded-3xl p-6 flex items-center gap-5 hover:bg-white/80 dark:hover:bg-gray-800/50 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <Target className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {result.total_score}{" "}
                        <span className="text-sm font-bold text-gray-400">
                          / {result.max_score}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Total Points
                      </div>
                    </div>
                  </div>

                  {/* Time Card */}
                  <div className="bg-white/50 dark:bg-gray-800/30 border border-white/20 dark:border-gray-700/50 rounded-3xl p-6 flex items-center gap-5 hover:bg-white/80 dark:hover:bg-gray-800/50 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <Loader2 className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {formatTime(
                          result.time_taken || submissionData?.time_taken || 0,
                        )}
                      </div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Time Invested
                      </div>
                    </div>
                  </div>
                </div>

                {/* Motivational Message or Progress Bar (Simulated) */}
                <div className="pt-2">
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700">
                    <div
                      className={`h-full bg-gradient-to-r ${getGradeTheme(result.grade).primary} rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${result.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Efficiency Threshold
                    </span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {Math.round(result.percentage)}% Mastery
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Review Section */}
        <div className="bg-white/50 dark:bg-gray-900/50 rounded-[2rem] p-8 mt-8 animate-in slide-in-from-bottom duration-500 delay-1200 border-4 border-white dark:border-gray-800/30">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📝</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Question Review
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Review your answers and learn from the experience
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {result.answers.map((attempt: any, index: number) => {
              // Reconstruct a question object that QuestionRenderer can understand
              const questionObj = {
                id: attempt.question_id,
                question_text: attempt.question_text,
                question_type: attempt.question_type,
                question_data: attempt.question_data,
                explanation: attempt.explanation,
                correct_answer: attempt.correct_answer,
              };

              return (
                <div
                  key={attempt.question_id}
                  className={`border-2 rounded-3xl p-8 transition-all duration-300 hover:shadow-xl ${
                    attempt.is_correct
                      ? "border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/5 dark:to-teal-900/5"
                      : "border-red-200 dark:border-red-800/50 bg-gradient-to-br from-red-50/50 to-pink-50/50 dark:from-red-900/5 dark:to-pink-900/5"
                  }`}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm ${
                            attempt.is_correct
                              ? "bg-emerald-500 text-white"
                              : "bg-red-500 text-white"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span
                          className={`px-4 py-1.5 text-sm font-bold rounded-full shadow-sm border ${
                            attempt.is_correct
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700"
                          }`}
                        >
                          {attempt.is_correct ? "✅ Correct" : "❌ Incorrect"}
                        </span>
                        <div className="px-4 py-1.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-500" />
                          <span>
                            {attempt.points_earned || 0} /{" "}
                            {attempt.max_points || 0} Points
                          </span>
                        </div>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white leading-relaxed">
                        <RichTextDisplay
                          content={attempt.question_text || ""}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
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
                      attempt.correct_answer !== undefined && (
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
                  </div>

                  {/* Explanation */}
                  {attempt.explanation &&
                    attempt.explanation !== "No explanation provided." && (
                      <div className="mt-6 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 backdrop-blur-sm border border-blue-100 dark:border-blue-800/30 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                          <span className="text-blue-900 dark:text-blue-300 font-bold">
                            Expert Explanation
                          </span>
                        </div>
                        <div className="text-blue-800 dark:text-blue-400 leading-relaxed text-sm md:text-base">
                          <RichTextDisplay content={attempt.explanation} />
                        </div>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
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
