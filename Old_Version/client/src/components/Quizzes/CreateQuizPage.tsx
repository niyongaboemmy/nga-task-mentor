import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store";
import { createQuiz, clearQuizError } from "../../store/slices/quizSlice";
import ProctoringSettings from "../Proctoring/ProctoringSettings";
import type { CreateQuizRequest } from "../../types/quiz.types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";

export const CreateQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(false);
  const [showProctoringSettings, setShowProctoringSettings] = useState(false);
  const [createdQuizId, setCreatedQuizId] = useState<number | null>(null);
  const [enableProctoring, setEnableProctoring] = useState(false);
  const [formData, setFormData] = useState<CreateQuizRequest>({
    title: "",
    description: "",
    course_id: courseId ? parseInt(courseId) : 0,
    type: "practice",
    show_results_immediately: true,
    randomize_questions: false,
    show_correct_answers: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      return;
    }

    setLoading(true);
    dispatch(clearQuizError("quiz"));

    try {
      const result = await dispatch(
        createQuiz({
          courseId: parseInt(courseId!),
          quizData: formData,
        })
      ).unwrap();

      setCreatedQuizId(result.id);

      // Show proctoring settings after quiz creation if enabled
      if (enableProctoring) {
        setShowProctoringSettings(true);
      } else {
        navigate(`/courses/${courseId}`);
      }
    } catch (error) {
      console.error("Failed to create quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateQuizRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Show proctoring settings if quiz was just created
  if (showProctoringSettings && createdQuizId) {
    return (
      <div className="pb-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Configure Proctoring Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Set up online proctoring features for your quiz to ensure academic
            integrity.
          </p>
        </div>

        <ProctoringSettings
          quizId={createdQuizId.toString()}
          onSettingsSaved={() => {
            navigate(`/courses/${courseId}`);
          }}
        />

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              navigate(`/courses/${courseId}`);
            }}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline text-sm"
          >
            Skip proctoring setup for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="mb-2">
        <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <button
            onClick={() => navigate(`/courses/${courseId}`)}
            className="hover:text-blue-600 dark:hover:text-blue-400"
          >
            Course
          </button>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">
            Create Quiz
          </span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Create New Quiz
        </h1>
      </div>

      <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/50 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Quiz Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Enter quiz title..."
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Enter quiz description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              required
            />
          </div>

          {/* Quiz Type */}
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Quiz Type
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => handleChange("type", e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Instructions (Optional)
            </label>
            <textarea
              id="instructions"
              value={formData.instructions || ""}
              onChange={(e) => handleChange("instructions", e.target.value)}
              placeholder="Enter quiz instructions..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-gray-900 dark:text-white">
              Quiz Settings
            </h3>

            <div className="flex flex-row items-center justify-between gap-2 w-full">
              {/* Time Limit */}
              <div className="w-full">
                <label
                  htmlFor="time_limit"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Max Attempts */}
              <div className="w-full">
                <label
                  htmlFor="max_attempts"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Passing Score */}
              <div className="w-full">
                <label
                  htmlFor="passing_score"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show_results_immediately"
                  checked={formData.show_results_immediately}
                  onChange={(e) =>
                    handleChange("show_results_immediately", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="show_results_immediately"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="randomize_questions"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="show_correct_answers"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Show correct answers after completion
                </label>
              </div>
            </div>
          </div>

          {/* Proctoring Settings */}
          <div className="space-y-3">
            <h3 className="text-base font-medium text-gray-900 dark:text-white">
              Proctoring Settings
            </h3>

            <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base dark:text-white">
                  Online Proctoring
                </CardTitle>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Enable automated monitoring to ensure academic integrity
                  during quiz taking.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enable_proctoring"
                    checked={enableProctoring}
                    onChange={(e) => setEnableProctoring(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="enable_proctoring"
                    className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    Enable online proctoring for this quiz
                  </label>
                </div>

                {enableProctoring && (
                  <div className="ml-6 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <p>• Real-time video and audio monitoring</p>
                    <p>• Automated detection of suspicious behavior</p>
                    <p>• Browser lockdown and security restrictions</p>
                    <p>• Live instructor monitoring dashboard</p>
                    <p>• Comprehensive session recording and analytics</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}`)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !formData.title.trim() ||
                !formData.description.trim()
              }
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? "Creating..." : "Create Quiz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuizPage;
