import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Home,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import type { RootState, AppDispatch } from "../../store";
import { fetchQuizResults } from "../../store/slices/quizSlice";
import QuizQuestion from "./QuizQuestion";
import RichTextDisplay from "../Common/RichTextDisplay";

interface QuizResultsProps {
  submissionId: number;
}

export const QuizResults: React.FC<QuizResultsProps> = ({ submissionId }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { quizResults, loading, error } = useSelector(
    (state: RootState) => state.quiz,
  );

  const submissionError = error?.submission || null;

  useEffect(() => {
    const loadResults = async () => {
      try {
        await dispatch(fetchQuizResults(submissionId)).unwrap();
      } catch (error: any) {
        console.error("Failed to load quiz results:", error);
        // You might want to show an error state here
      }
    };

    loadResults();
  }, [submissionId, dispatch]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 70) return "text-yellow-600";
    if (percentage >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreLetter = (percentage: number) => {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  if (loading.submission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading results...</span>
      </div>
    );
  }

  if (submissionError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 mb-4">{submissionError}</div>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!quizResults) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-600 mb-4">No results found.</div>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isManualGrading =
    !!quizResults.grading_settings?.require_manual_grading ||
    quizResults.grade_status === "pending";
  const isPendingManualGrade = isManualGrading && quizResults.grade_status === "pending";

  // API may return results as either "results" or "attempts"
  const attempts: any[] = quizResults.results || quizResults.attempts || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header - Sleeker & More Professional */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg tracking-wider uppercase ${
                  isPendingManualGrade
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                }`}>
                  {isPendingManualGrade ? "Submitted" : quizResults.passed ? "Passed" : "Completed"}
                </span>
                <span className="text-gray-400 dark:text-gray-600">•</span>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {quizResults.quiz_title}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
                Quiz Evaluation
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {isPendingManualGrade ? (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
                      Awaiting Manual Grading
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-500">
                      Instructor will review your submission
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-right">
                    <div
                      className={`text-3xl font-black ${getScoreColor(quizResults.percentage)}`}
                    >
                      {Math.round(quizResults.percentage)}%
                    </div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Overall Score
                    </div>
                  </div>
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg shadow-current/10 ${
                      quizResults.percentage >= 90
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30"
                        : quizResults.percentage >= 80
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30"
                          : quizResults.percentage >= 70
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30"
                            : quizResults.percentage >= 60
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30"
                    }`}
                  >
                    {getScoreLetter(quizResults.percentage)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary Cards */}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Manual grading pending banner */}
        {isPendingManualGrade && (
          <div className="flex items-start gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-5 mb-6">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/40 rounded-full flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300 text-base">
                Your submission is under manual review
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                This quiz is graded manually by your instructor. Your marks and final result will be available once the instructor has reviewed your answers. You will be notified when grading is complete.
              </p>
            </div>
          </div>
        )}

        <div className={`grid gap-4 mb-8 ${isPendingManualGrade ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 max-w-sm" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {/* Score card — hidden while pending manual grade */}
          {!isPendingManualGrade && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Score
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {quizResults.final_score} / {quizResults.max_score}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Time Taken
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatTime(quizResults.time_taken || 0)}
              </div>
            </div>
          </div>

          {/* Pass status — hidden while pending manual grade */}
          {!isPendingManualGrade && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pass Status
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {quizResults.passed ? "Successful" : "Below Target"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Question Review */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Question Review
            </h2>
            {!isPendingManualGrade && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {attempts.filter((a: any) => a.is_correct).length}{" "}
                  Correct
                </span>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {attempts.filter((a: any) => !a.is_correct).length}{" "}
                  Incorrect
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {attempts.map((attempt: any, index: number) => (
              <div
                key={attempt.question_id}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Question Header */}
                <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      Question Details
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPendingManualGrade ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3" />
                        Pending
                      </span>
                    ) : (
                      <>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                            attempt.is_correct === true
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : attempt.is_correct === false
                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-amber-100 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {attempt.is_correct === true ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Correct
                            </>
                          ) : attempt.is_correct === false ? (
                            <>
                              <XCircle className="w-3 h-3" />
                              Incorrect
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              Pending
                            </>
                          )}
                        </span>
                        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md">
                          {attempt.points_earned != null
                            ? `${attempt.points_earned} / ${attempt.max_points || 0} pts`
                            : `— / ${attempt.max_points || 0} pts`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Question Review Content - Side by Side Comparison */}
                <div className="p-4 sm:p-6">
                  <div className="space-y-6">
                    {/* Question Text */}
                    <div className="prose prose-sm max-w-none text-gray-800 font-medium bg-blue-50/30 p-4 rounded-lg border border-blue-100/50">
                      <RichTextDisplay content={attempt.question_text || ""} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Your Answer */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Your Answer
                        </h4>
                        <div
                          className={`p-4 rounded-xl border-2 min-h-[100px] flex items-center justify-center text-center transition-all ${
                            isPendingManualGrade
                              ? "bg-gray-50/30 border-gray-200 text-gray-800"
                              : attempt.is_correct
                              ? "bg-emerald-50/30 border-emerald-100 text-emerald-900"
                              : "bg-rose-50/30 border-rose-100 text-rose-900"
                          }`}
                        >
                          {attempt.question_type ? (
                            <QuizQuestion
                              question={
                                {
                                  ...attempt.attemptQuestion,
                                  questionBank: {
                                    ...attempt.attemptQuestion?.questionBank,
                                    question_text: attempt.question_text,
                                    question_type: attempt.question_type,
                                    question_data: attempt.question_data,
                                  },
                                } as any
                              }
                              answer={attempt.user_answer}
                              onAnswerChange={() => {}}
                              disabled={true}
                              showQuestionNumber={false}
                            />
                          ) : (
                            <span className="italic text-gray-500 font-medium">
                              No answer provided
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Correct Answer — only when quiz settings allow it */}
                      {quizResults.grading_settings?.show_correct_answers &&
                        attempt.correct_answer != null && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Correct Answer
                            </h4>
                            <div className="p-4 rounded-xl bg-emerald-50/50 border-2 border-emerald-100/50 border-dashed min-h-[100px] flex items-center justify-center text-center">
                              {attempt.question_type ? (
                                <QuizQuestion
                                  question={
                                    {
                                      ...attempt.attemptQuestion,
                                      questionBank: {
                                        ...attempt.attemptQuestion?.questionBank,
                                        question_text: attempt.question_text,
                                        question_type: attempt.question_type,
                                        question_data: attempt.question_data,
                                      },
                                    } as any
                                  }
                                  answer={attempt.correct_answer}
                                  onAnswerChange={() => {}}
                                  disabled={true}
                                  showQuestionNumber={false}
                                  showCorrectAnswer={true}
                                />
                              ) : (
                                <span className="italic text-emerald-700/60 font-medium">
                                  Not available
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Explanation */}
                    {attempt.explanation && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
                          Explanation
                        </h4>
                        <div className="text-sm text-gray-600 leading-relaxed italic">
                          {attempt.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {quizResults.feedback && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">💬</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Instructor Feedback
                </h2>
                <p className="text-gray-600">
                  Personal guidance from your instructor
                </p>
              </div>
            </div>
            <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <span className="text-2xl">👨‍🏫</span>
                <p className="text-purple-800 leading-relaxed italic">
                  "{quizResults.feedback}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 font-bold text-sm flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Dashboard
          </button>
          <button
            onClick={() => navigate(`/courses/${quizResults.quiz?.course_id}`)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Back to Course
          </button>
        </div>

        {/* Encouraging Footer */}
        <div className="text-center mt-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">🌟</span>
            <span className="text-lg font-semibold text-yellow-800">
              Keep Learning!
            </span>
          </div>
          <p className="text-yellow-700">
            Every quiz is a step forward in your learning journey. You've got
            this! 🚀
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuizResults;
