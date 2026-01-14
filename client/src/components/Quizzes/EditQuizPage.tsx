import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store";
import {
  updateQuiz,
  fetchQuiz,
  clearQuizError,
} from "../../store/slices/quizSlice";
import ProctoringSettings from "../Proctoring/ProctoringSettings";
import type { UpdateQuizRequest } from "../../types/quiz.types";

export const EditQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { quizId } = useParams<{ quizId: string }>();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"quiz" | "proctoring">("quiz");
  const [formData, setFormData] = useState<UpdateQuizRequest>({
    title: "",
    description: "",
    type: "practice",
    show_results_immediately: true,
    randomize_questions: false,
    show_correct_answers: false,
    enable_automatic_grading: true,
    require_manual_grading: false,
    is_public: false,
  });

  useEffect(() => {
    const loadQuiz = async () => {
      if (!quizId) return;

      try {
        const quiz = await dispatch(fetchQuiz(parseInt(quizId))).unwrap();
        setFormData({
          title: quiz.title,
          description: quiz.description,
          type: quiz.type,
          instructions: quiz.instructions,
          time_limit: quiz.time_limit,
          max_attempts: quiz.max_attempts,
          passing_score: quiz.passing_score,
          show_results_immediately: quiz.show_results_immediately,
          randomize_questions: quiz.randomize_questions,
          show_correct_answers: quiz.show_correct_answers,
          enable_automatic_grading:
            (quiz as any).enable_automatic_grading !== false,
          require_manual_grading: (quiz as any).require_manual_grading || false,
          status: quiz.status,
          is_public: quiz.is_public || false,
        });
      } catch (error) {
        console.error("Failed to load quiz:", error);
        navigate("/dashboard");
      } finally {
        setFetchLoading(false);
      }
    };

    loadQuiz();
  }, [dispatch, quizId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.description?.trim()) {
      return;
    }

    setLoading(true);
    dispatch(clearQuizError("quiz"));

    try {
      await dispatch(
        updateQuiz({
          quizId: parseInt(quizId!),
          quizData: formData,
        })
      ).unwrap();

      navigate(`/quizzes/${quizId}`);
    } catch (error) {
      console.error("Failed to update quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof UpdateQuizRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading quiz...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="">
        <div className="space-y-4">
          {/* Back Button */}
          <div className="animate-fade-in">
            <button
              onClick={() => navigate(`/quizzes/${quizId}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Quiz
            </button>
          </div>

          {/* Header */}
          <div className="animate-bounce-in">
            <div className="bg-white dark:bg-gray-900 rounded-3xl card-hover p-6 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center animate-float">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Quiz Settings
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Configure quiz details and preferences
                    </p>
                  </div>
                </div>
              </div>
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 mt-3">
                <button
                  onClick={() => setActiveTab("quiz")}
                  className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "quiz"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Quiz Details
                </button>
                <button
                  onClick={() => setActiveTab("proctoring")}
                  className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "proctoring"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Proctoring
                </button>
              </div>
            </div>
          </div>

          {activeTab === "quiz" ? (
            <form
              onSubmit={handleSubmit}
              className="space-y-8 bg-white p-4 md:p-6 rounded-3xl dark:bg-gray-900"
            >
              {/* Title */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2"
                >
                  Quiz Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Enter quiz title..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800/60 dark:border-gray-700/50"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2"
                >
                  Description *
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Enter quiz description..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800/60 dark:border-gray-700/50"
                  required
                />
              </div>

              {/* Quiz Type */}
              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2"
                >
                  Quiz Type
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800/60 dark:border-gray-700/50"
                >
                  <option value="practice">Practice Quiz</option>
                  <option value="graded">Graded Quiz</option>
                  <option value="exam">Exam</option>
                </select>
              </div>

              {/* Instructions */}
              <div>
                <label
                  htmlFor="instructions"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2"
                >
                  Instructions (Optional)
                </label>
                <textarea
                  id="instructions"
                  value={formData.instructions || ""}
                  onChange={(e) => handleChange("instructions", e.target.value)}
                  placeholder="Enter quiz instructions..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800/60 dark:border-gray-700/50"
                />
              </div>

              {/* Settings */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Quiz Settings</h3>

                {/* Time Limit */}
                <div>
                  <label
                    htmlFor="time_limit"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2"
                  >
                    Time Limit (minutes)
                  </label>
                  <input
                    type="number"
                    id="time_limit"
                    value={formData.time_limit || ""}
                    onChange={(e) =>
                      handleChange(
                        "time_limit",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="No limit"
                    min="1"
                    max="480"
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800/60 dark:border-gray-700/50"
                  />
                </div>

                {/* Max Attempts */}
                <div>
                  <label
                    htmlFor="max_attempts"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2"
                  >
                    Maximum Attempts
                  </label>
                  <input
                    type="number"
                    id="max_attempts"
                    value={formData.max_attempts || ""}
                    onChange={(e) =>
                      handleChange(
                        "max_attempts",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="Unlimited"
                    min="1"
                    max="50"
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800/60 dark:border-gray-700/50"
                  />
                </div>

                {/* Passing Score */}
                <div>
                  <label
                    htmlFor="passing_score"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2"
                  >
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    id="passing_score"
                    value={formData.passing_score || ""}
                    onChange={(e) =>
                      handleChange(
                        "passing_score",
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    placeholder="60%"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800/60 dark:border-gray-700/50"
                  />
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="show_results_immediately"
                      checked={formData.show_results_immediately}
                      onChange={(e) =>
                        handleChange(
                          "show_results_immediately",
                          e.target.checked
                        )
                      }
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-xl"
                    />
                    <label
                      htmlFor="show_results_immediately"
                      className="ml-2 text-sm text-gray-700 dark:text-gray-400"
                    >
                      Show results immediately after completion
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="randomize_questions"
                      checked={formData.randomize_questions}
                      onChange={(e) =>
                        handleChange("randomize_questions", e.target.checked)
                      }
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-xl"
                    />
                    <label
                      htmlFor="randomize_questions"
                      className="ml-2 text-sm text-gray-700 dark:text-gray-400"
                    >
                      Randomize question order
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="show_correct_answers"
                      checked={formData.show_correct_answers}
                      onChange={(e) =>
                        handleChange("show_correct_answers", e.target.checked)
                      }
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-xl"
                    />
                    <label
                      htmlFor="show_correct_answers"
                      className="ml-2 text-sm text-gray-700 dark:text-gray-400"
                    >
                      Show correct answers after completion
                    </label>
                  </div>

                  {/* Grading Options */}
                  <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4">
                    <h4 className="text-sm font-medium">Grading Options</h4>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="enable_automatic_grading"
                        checked={formData.enable_automatic_grading !== false}
                        onChange={(e) =>
                          handleChange(
                            "enable_automatic_grading",
                            e.target.checked
                          )
                        }
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-xl"
                      />
                      <label
                        htmlFor="enable_automatic_grading"
                        className="ml-2 text-sm text-gray-700 dark:text-gray-400"
                      >
                        Show grades to students immediately after quiz
                        completion
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="require_manual_grading"
                        checked={formData.require_manual_grading || false}
                        onChange={(e) =>
                          handleChange(
                            "require_manual_grading",
                            e.target.checked
                          )
                        }
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-xl"
                      />
                      <label
                        htmlFor="require_manual_grading"
                        className="ml-2 text-sm text-gray-700 dark:text-gray-400"
                      >
                        Require instructor manual grading (grades hidden until
                        reviewed)
                      </label>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400/60 ml-6">
                      {formData.require_manual_grading
                        ? "Students will see 'Pending' until instructor reviews and grades the quiz manually."
                        : formData.enable_automatic_grading
                        ? "Grades will be calculated automatically and shown immediately."
                        : "Grades will be hidden from students (manual grading required)."}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_public"
                      checked={formData.is_public || false}
                      onChange={(e) =>
                        handleChange("is_public", e.target.checked)
                      }
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-xl"
                    />
                    <label
                      htmlFor="is_public"
                      className="ml-2 text-sm text-gray-700 dark:text-gray-400"
                    >
                      Make this quiz publicly accessible
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => navigate(`/quizzes/${quizId}`)}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !formData.title?.trim() ||
                    !formData.description?.trim()
                  }
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? "Updating..." : "Update Quiz"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <ProctoringSettings
                quizId={quizId!}
                onSettingsSaved={() => {
                  // Could show a success message or refresh data
                  console.log("Proctoring settings saved");
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditQuizPage;
