import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { fetchQuizResults } from "../../store/slices/quizSlice";
import { QuestionRenderer } from "./QuestionRenderer";

interface QuizResultsProps {
  submissionId: number;
}

export const QuizResults: React.FC<QuizResultsProps> = ({ submissionId }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { quizResults, loading, error } = useSelector(
    (state: RootState) => state.quiz
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header with Celebration */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Quiz Complete!</h1>
            <p className="text-blue-100 text-lg">{quizResults.quiz_title}</p>
          </div>

          {/* Animated Score Circle */}
          <div className="relative inline-block mb-6">
            <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">
                  {Math.round(quizResults.percentage)}%
                </div>
                <div className="text-sm text-blue-100">Score</div>
              </div>
            </div>
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full border-4 border-white/30">
              <div
                className="absolute inset-0 rounded-full border-4 border-white transition-all duration-1000 ease-out"
                style={{
                  borderColor:
                    quizResults.percentage >= 90
                      ? "#10B981"
                      : quizResults.percentage >= 80
                      ? "#3B82F6"
                      : quizResults.percentage >= 70
                      ? "#F59E0B"
                      : quizResults.percentage >= 60
                      ? "#F97316"
                      : "#EF4444",
                  clipPath: `polygon(0 0, ${quizResults.percentage}% 0, ${quizResults.percentage}% 100%, 0 100%)`,
                }}
              ></div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <div
              className={`px-6 py-3 rounded-full text-lg font-semibold ${
                quizResults.percentage >= 90
                  ? "bg-green-500 text-white"
                  : quizResults.percentage >= 80
                  ? "bg-blue-500 text-white"
                  : quizResults.percentage >= 70
                  ? "bg-yellow-500 text-white"
                  : quizResults.percentage >= 60
                  ? "bg-orange-500 text-white"
                  : "bg-red-500 text-white"
              }`}
            >
              Grade: {getScoreLetter(quizResults.percentage)}
            </div>
            <div
              className={`px-6 py-3 rounded-full text-lg font-medium ${
                quizResults.passed
                  ? "bg-green-100 text-green-800 border-2 border-green-300"
                  : "bg-red-100 text-red-800 border-2 border-red-300"
              }`}
            >
              {quizResults.passed ? "🎉 Passed!" : "💪 Keep Trying!"}
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary Cards */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">🏆</span>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {quizResults.final_score}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Points Earned
              </div>
              <div className="text-xs text-gray-500 mt-1">
                out of {quizResults.max_score} total
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">⏱️</span>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {formatTime(quizResults.time_taken || 0)}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Time Taken
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Completed successfully
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">📊</span>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {Math.round(quizResults.percentage)}%
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Percentage
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {quizResults.passed
                  ? "Above passing threshold"
                  : "Below passing threshold"}
              </div>
            </div>
          </div>
        </div>

        {/* Question Review */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📝</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Question Review
              </h2>
              <p className="text-gray-600">
                Review your answers and learn from the experience
              </p>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 text-lg">
                    Performance Summary
                  </h3>
                  <p className="text-blue-700">
                    {quizResults.attempts?.filter((a: any) => a.is_correct)
                      .length || 0}{" "}
                    out of {quizResults.attempts?.length || 0} questions correct
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {Math.round(quizResults.percentage)}%
                </div>
                <div className="text-sm text-blue-500 font-medium">
                  Overall Score
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${quizResults.percentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>0%</span>
              <span>{Math.round(quizResults.percentage)}% Complete</span>
              <span>100%</span>
            </div>
          </div>

          <div className="space-y-6">
            {quizResults.attempts?.map((attempt: any, index: number) => (
              <div
                key={attempt.question_id}
                className={`border-2 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg ${
                  attempt.is_correct
                    ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50"
                    : "border-red-200 bg-gradient-to-r from-red-50 to-pink-50"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          attempt.is_correct
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full ${
                          attempt.is_correct
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {attempt.is_correct ? "✅ Correct" : "❌ Incorrect"}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <span className="font-medium">
                          {attempt.points_earned || 0}
                        </span>
                        <span>/</span>
                        <span>{attempt.question?.points || 0} pts</span>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-relaxed">
                      {attempt.question_text}
                    </h3>
                  </div>
                </div>

                {/* Show user's answer */}
                <div className="mt-4 p-4 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-600">📝</span>
                    <span className="text-gray-800 font-semibold">
                      Your Answer
                    </span>
                  </div>
                  <div className="text-gray-700">
                    <QuestionRenderer
                      question={attempt.question}
                      answer={attempt.user_answer}
                      onAnswerChange={() => {}}
                      disabled={true}
                      showCorrectAnswer={false}
                    />
                  </div>
                </div>

                {/* Show explanation if available */}
                {attempt.explanation && (
                  <div className="mt-4 p-4 bg-white/70 backdrop-blur-sm border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-600">💡</span>
                      <span className="text-green-800 font-semibold">
                        Explanation
                      </span>
                    </div>
                    <p className="text-green-700 leading-relaxed">
                      {attempt.explanation}
                    </p>
                  </div>
                )}

                {/* Show correct answer if available */}
                {attempt.correct_answer && (
                  <div className="mt-4 p-4 bg-white/70 backdrop-blur-sm border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-blue-600">🎯</span>
                      <span className="text-blue-800 font-semibold">
                        Correct Answer
                      </span>
                    </div>
                    <div className="text-blue-700">
                      <QuestionRenderer
                        question={attempt.question}
                        answer={undefined}
                        onAnswerChange={() => {}}
                        disabled={true}
                        showCorrectAnswer={true}
                      />
                    </div>
                  </div>
                )}

                {/* Encouraging message */}
                <div className="mt-4 flex items-center gap-2 text-sm">
                  {attempt.is_correct ? (
                    <>
                      <span className="text-green-600">🎉</span>
                      <span className="text-green-700 font-medium">
                        Great job! You got this one right.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-blue-600">📚</span>
                      <span className="text-blue-700 font-medium">
                        Keep learning! Review the correct answer above.
                      </span>
                    </>
                  )}
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
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-semibold flex items-center justify-center gap-2"
          >
            <span>🏠</span>
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate(`/courses/${quizResults.quiz?.course_id}`)}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            <span>📚</span>
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
