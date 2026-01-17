import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store";
import { createQuiz, clearQuizError } from "../../store/slices/quizSlice";
import ProctoringSettings from "../Proctoring/ProctoringSettings";
import type { CreateQuizRequest } from "../../types/quiz.types";
import { Card, CardContent, CardHeader } from "../ui/Card";

interface CreateQuizProps {
  courseId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const CreateQuiz: React.FC<CreateQuizProps> = ({
  courseId,
  onSuccess,
  onCancel,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [showProctoringSettings, setShowProctoringSettings] = useState(false);
  const [createdQuizId, setCreatedQuizId] = useState<number | null>(null);
  const [enableProctoring, setEnableProctoring] = useState(false);
  const [formData, setFormData] = useState<CreateQuizRequest>({
    title: "",
    description: "",
    course_id: courseId,
    type: "practice",
    show_results_immediately: true,
    randomize_questions: false,
    show_correct_answers: false,
    enable_automatic_grading: true,
    require_manual_grading: false,
    is_public: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      return;
    }

    setLoading(true);
    dispatch(clearQuizError("quiz"));

    try {
      const result = await dispatch(createQuiz(formData)).unwrap();

      setCreatedQuizId(result.id);

      // Show proctoring settings after quiz creation if enabled
      if (enableProctoring) {
        setShowProctoringSettings(true);
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate(`/courses/${courseId}`);
        }
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Configure Proctoring Settings
          </h2>
          <p className="text-gray-600">
            Set up online proctoring features for your quiz to ensure academic
            integrity.
          </p>
        </div>

        <ProctoringSettings
          quizId={createdQuizId.toString()}
          onSettingsSaved={() => {
            if (onSuccess) {
              onSuccess();
            } else {
              navigate(`/courses/${courseId}`);
            }
          }}
        />

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              if (onSuccess) {
                onSuccess();
              } else {
                navigate(`/courses/${courseId}`);
              }
            }}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Skip proctoring setup for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Create New Quiz
        </h2>
        <p className="text-gray-600">Set up a new quiz for your course</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Quiz Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Enter quiz title..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Description *
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Enter quiz description..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Quiz Type */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Quiz Type
          </label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => handleChange("type", e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Instructions (Optional)
          </label>
          <textarea
            id="instructions"
            value={formData.instructions || ""}
            onChange={(e) => handleChange("instructions", e.target.value)}
            placeholder="Enter quiz instructions..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Quiz Settings</h3>

          {/* Time Limit */}
          <div>
            <label
              htmlFor="time_limit"
              className="block text-sm font-medium text-gray-700 mb-2"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Max Attempts */}
          <div>
            <label
              htmlFor="max_attempts"
              className="block text-sm font-medium text-gray-700 mb-2"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Passing Score */}
          <div>
            <label
              htmlFor="passing_score"
              className="block text-sm font-medium text-gray-700 mb-2"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  handleChange("show_results_immediately", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="show_results_immediately"
                className="ml-2 text-sm text-gray-700"
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
                className="ml-2 text-sm text-gray-700"
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
                className="ml-2 text-sm text-gray-700"
              >
                Show correct answers after completion
              </label>
            </div>

            {/* Grading Options */}
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900">
                Grading Options
              </h4>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enable_automatic_grading"
                  checked={formData.enable_automatic_grading !== false}
                  onChange={(e) =>
                    handleChange("enable_automatic_grading", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="enable_automatic_grading"
                  className="ml-2 text-sm text-gray-700"
                >
                  Show grades to students immediately after quiz completion
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="require_manual_grading"
                  checked={formData.require_manual_grading || false}
                  onChange={(e) =>
                    handleChange("require_manual_grading", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="require_manual_grading"
                  className="ml-2 text-sm text-gray-700"
                >
                  Require instructor manual grading (grades hidden until
                  reviewed)
                </label>
              </div>

              <div className="text-xs text-gray-500 ml-6">
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
                onChange={(e) => handleChange("is_public", e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_public" className="ml-2 text-sm text-gray-700">
                Make this quiz publicly accessible
              </label>
            </div>
          </div>
        </div>

        {/* Proctoring Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            Proctoring Settings
          </h3>

          <Card>
            <CardHeader>
              <h4 className="text-md font-medium text-gray-900">
                Online Proctoring
              </h4>
              <p className="text-sm text-gray-600">
                Enable automated monitoring to ensure academic integrity during
                quiz taking.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  className="ml-2 text-sm text-gray-700"
                >
                  Enable online proctoring for this quiz
                </label>
              </div>

              {enableProctoring && (
                <div className="ml-6 space-y-3 text-sm text-gray-600">
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
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={
              loading || !formData.title.trim() || !formData.description.trim()
            }
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Quiz"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;
