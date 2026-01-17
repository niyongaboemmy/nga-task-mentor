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

interface Quiz {
  id: number;
  title: string;
  description: string;
  time_limit: number;
  total_points: number;
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
  };
  answers: Array<{
    question_id: number;
    user_answer: any;
    correct_answer: any;
    is_correct: boolean;
    points_earned: number;
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
    location.state?.submissionData || null
  );
  const [answers] = useState<Answer[]>(location.state?.answers || []);
  const [completedResults] = useState<any>(
    location.state?.completedResults || null
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
        const transformedResult: QuizResult = {
          total_score: completedResults.final_score || 0,
          max_score: completedResults.max_score || 0,
          percentage: completedResults.percentage || 0,
          grade: completedResults.grade || "N/A",
          answers: Array.isArray(completedResults.results)
            ? completedResults.results.map((result: any) => ({
                question_id: result.question_id,
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
      const response = await axios.get(`/api/quizzes/${id}`);
      setQuiz(response.data.data);
    } catch (error) {
      console.error("Error fetching quiz:", error);
    }
  };

  const fetchResults = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/quizzes/${id}/results`);
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
        answers:
          apiData.results?.map((result: any) => ({
            question_id: result.question_id,
            user_answer: result.user_answer,
            correct_answer: result.correct_answer,
            is_correct: result.is_correct,
            points_earned: parseFloat(result.points_earned) || 0,
            max_points: parseFloat(result.max_points) || 1,
            explanation: result.explanation || "No explanation provided.",
          })) || [],
      };

      setResult(transformedResult);
    } catch (error) {
      console.error("Error fetching quiz results:", error);
      // Calculate basic results if API fails or no submission data
      if (answers.length > 0) {
        calculateBasicResults();
      } else {
        console.warn("No answers available for calculation");
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateBasicResults = () => {
    if (!quiz || !answers.length) return;

    let totalScore = 0;
    let maxScore = 0;

    const results = quiz.questions.map((question) => {
      const userAnswer = answers.find((a) => a.question_id === question.id);
      const correct = checkAnswerCorrectness(question, userAnswer?.answer);
      const points = correct ? question.points : 0;

      totalScore += points;
      maxScore += question.points;

      return {
        question_id: question.id,
        user_answer: userAnswer?.answer || null,
        correct_answer: getCorrectAnswer(question),
        is_correct: correct,
        points_earned: points,
        max_points: question.points,
        explanation: question.explanation || "No explanation provided.",
      };
    });

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const grade = getGradeFromPercentage(percentage);

    setResult({
      total_score: totalScore,
      max_score: maxScore,
      percentage: totalScore === 0 && maxScore === 0 ? 0 : percentage,
      grade: totalScore === 0 && maxScore === 0 ? "F" : grade,
      answers: results,
    });
  };

  const checkAnswerCorrectness = (
    question: QuizQuestion,
    userAnswer: any
  ): boolean => {
    if (!userAnswer) return false;

    switch (question.question_type) {
      case "multiple_choice":
      case "single_choice":
      case "true_false":
        const correctOption = question.options?.find((opt) => opt.is_correct);
        return correctOption?.id === userAnswer;
      case "coding":
        // For basic client-side check, we can't easily verify coding execution
        // Fallback: check if it matches sample solution or if it's non-empty
        return !!userAnswer && (userAnswer === question.coding_data?.expected_output);
      case "ordering":
        return (
          JSON.stringify(question.ordering_data?.correct_order) ===
          JSON.stringify(userAnswer)
        );
      case "matching":
        return (
          JSON.stringify(question.matching_data?.correct_matches) ===
          JSON.stringify(userAnswer)
        );
      case "numerical":
        return (
          parseFloat(userAnswer) ===
          parseFloat(question.options?.[0]?.text || "")
        );
      case "short_answer":
        // Basic string comparison, could be improved with fuzzy matching
        return (
          (userAnswer?.toLowerCase().trim() || "") ===
          (question.options?.[0]?.text || "").toLowerCase().trim()
        );
      default:
        return false;
    }
  };

  const getCorrectAnswer = (question: QuizQuestion): any => {
    switch (question.question_type) {
      case "multiple_choice":
      case "true_false":
        return (
          question.options?.find((opt) => opt.is_correct)?.id ||
          question.options?.[0]?.id
        );
      case "coding":
        return question.coding_data?.expected_output || "Sample solution";
      case "ordering":
        return question.ordering_data?.correct_order || [];
      case "matching":
        return question.matching_data?.correct_matches || {};
      default:
        return null;
    }
  };

  const getGradeFromPercentage = (percentage: number): string => {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
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
          primary: "from-green-400 to-green-500",
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
          primary: "from-emerald-400 to-green-500",
          secondary: "from-emerald-50 to-green-50",
          accent: "emerald-600",
          text: "emerald-800",
          bg: "emerald-100",
          border: "emerald-200",
          darkPrimary: "from-emerald-500 to-green-600",
          darkSecondary: "from-emerald-900/20 to-green-900/20",
          darkAccent: "emerald-400",
          darkText: "emerald-200",
          darkBg: "emerald-900/30",
          darkBorder: "emerald-700/50",
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
          primary: "from-orange-400 to-red-500",
          secondary: "from-orange-50 to-red-50",
          accent: "orange-600",
          text: "orange-800",
          bg: "orange-100",
          border: "orange-200",
          darkPrimary: "from-orange-500 to-red-600",
          darkSecondary: "from-orange-900/20 to-red-900/20",
          darkAccent: "orange-400",
          darkText: "orange-200",
          darkBg: "orange-900/30",
          darkBorder: "orange-700/50",
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 dark:border-gray-700/30 max-w-md">
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

          <div className="relative bg-white dark:bg-gray-900/50 rounded-3xl p-8 animate-in slide-in-from-bottom duration-500 delay-100 border border-purple-200 dark:border-purple-800/30">
            <div className="text-center relative z-10">
              {/* Main Score Display */}
              <div className="text-center mb-8 animate-in zoom-in duration-700 delay-600">
                {result.grading_settings?.show_grades ? (
                  <div className="relative">
                    {/* Large Score Circle */}
                    <div
                      className={`mx-auto w-48 h-48 rounded-full flex items-center justify-center border-8 animate-in pulse duration-1000 delay-800 ${
                        result.grading_settings?.show_grades
                          ? `bg-gradient-to-br ${
                              getGradeTheme(result.grade).primary
                            } border-${getGradeTheme(
                              result.grade
                            ).accent.replace("600", "400")}`
                          : "bg-gray-500 border-gray-400"
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-7xl font-black text-white mb-1 animate-in scale-in duration-500 delay-1000">
                          {result.grade && result.percentage !== undefined
                            ? result.grade
                            : "N/A"}
                        </div>
                        <div className="text-xl font-bold text-white/90">
                          {result.percentage !== undefined
                            ? Math.round(result.percentage)
                            : 0}
                          %
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {result.passed !== null && result.passed !== undefined && (
                      <div
                        className={`absolute -bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-lg font-bold animate-in bounce-in duration-500 delay-1200 ${
                          result.grading_settings?.show_grades
                            ? `bg-${
                                getGradeTheme(result.grade).accent
                              } text-white`
                            : result.passed
                            ? "bg-emerald-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {result.passed ? "PASSED!" : "FAILED"}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto w-48 h-48 rounded-full bg-gray-500 border-8 border-gray-400 flex items-center justify-center animate-in pulse duration-1000 delay-800">
                    <div className="text-center">
                      <div className="text-6xl font-black text-white mb-2">
                        ⏳
                      </div>
                      <div className="text-lg font-bold text-white/90">
                        Pending Grade
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Secondary Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 backdrop-blur-sm rounded-3xl p-5 animate-in slide-in-from-left duration-500 delay-1000 hover:scale-105 transition-all border border-emerald-200 dark:border-emerald-700/50">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-emerald-700 dark:text-emerald-300 mb-2">
                      {result.total_score || 0}
                    </div>
                    <div className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
                      Points Earned
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-2 bg-emerald-100 dark:bg-emerald-800/30 rounded-full px-3 py-1 inline-block">
                      out of {result.max_score || 0}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm rounded-3xl p-5 animate-in slide-in-from-right duration-500 delay-1100 hover:scale-105 transition-all border border-blue-200 dark:border-blue-700/50">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                      {formatTime(submissionData?.time_taken || 0)}
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      Time Taken
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-300 mt-2 bg-blue-100 dark:bg-blue-800/30 rounded-full px-3 py-1 inline-block">
                      Quiz duration
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
