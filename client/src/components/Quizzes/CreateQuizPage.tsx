import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import type { AppDispatch } from "../../store";
import {
  createQuiz,
  clearQuizError,
  type QuizMutationError,
} from "../../store/slices/quizSlice";
import ProctoringSettings from "../Proctoring/ProctoringSettings";
import type { CreateQuizRequest } from "../../types/quiz.types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import QuizForm from "./QuizForm";

export const CreateQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { courseId } = useParams<{ courseId: string }>();
  const parsedCourseId = Number(courseId);
  const [loading, setLoading] = useState(false);
  const [showProctoringSettings, setShowProctoringSettings] = useState(false);
  const [createdQuizId, setCreatedQuizId] = useState<number | null>(null);
  const [enableProctoring, setEnableProctoring] = useState(false);
  const [serverError, setServerError] = useState<QuizMutationError | null>(null);

  const goToCourse = () => navigate(`/courses/${courseId}`);

  const handleSubmit = async (payload: CreateQuizRequest) => {
    if (!Number.isInteger(parsedCourseId) || parsedCourseId <= 0) {
      toast.error("This page was opened without a valid course. Go back to the course and try again.");
      return;
    }

    setLoading(true);
    setServerError(null);
    dispatch(clearQuizError("quiz"));

    try {
      const result = await dispatch(
        createQuiz({ courseId: parsedCourseId, quizData: payload }),
      ).unwrap();

      setCreatedQuizId(result.id);
      toast.success(`Quiz "${result.title}" created successfully`);

      // Show proctoring settings after quiz creation if enabled
      if (enableProctoring) {
        setShowProctoringSettings(true);
      } else {
        goToCourse();
      }
    } catch (error) {
      const err = (error ?? {}) as QuizMutationError;
      setServerError(err);
      toast.error(
        err.errors?.length
          ? "Some fields need attention — see the highlighted fields."
          : err.message || "Failed to create quiz. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Show proctoring settings if quiz was just created
  if (showProctoringSettings && createdQuizId) {
    return (
      <div className="pb-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
            Configure Proctoring Settings
          </h2>
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm">
            Set up online proctoring features for your quiz to ensure academic
            integrity.
          </p>
        </div>

        <ProctoringSettings
          quizId={createdQuizId.toString()}
          onSettingsSaved={goToCourse}
        />

        <div className="mt-4 text-center">
          <button
            onClick={goToCourse}
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
        <nav className="flex items-center space-x-2 text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">
          <button
            onClick={goToCourse}
            className="hover:text-blue-600 dark:hover:text-blue-400"
          >
            Course
          </button>
          <span>/</span>
          <span className="text-text-primary-light dark:text-text-primary-dark font-medium">
            Create Quiz
          </span>
        </nav>
        <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
          Create New Quiz
        </h1>
      </div>

      <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/50 p-6">
        <QuizForm
          mode="create"
          submitting={loading}
          serverErrors={serverError?.errors ?? null}
          serverMessage={
            serverError && !serverError.errors?.length ? serverError.message : null
          }
          onSubmit={handleSubmit}
          onCancel={goToCourse}
        >
          {/* Proctoring Settings */}
          <div className="space-y-3">
            <h3 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">
              Proctoring Settings
            </h3>

            <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base dark:text-white">
                  Online Proctoring
                </CardTitle>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
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
                    className="ml-2 text-sm text-text-secondary-light dark:text-text-secondary-dark"
                  >
                    Enable online proctoring for this quiz
                  </label>
                </div>

                {enableProctoring && (
                  <div className="ml-6 space-y-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
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
        </QuizForm>
      </div>
    </div>
  );
};

export default CreateQuizPage;
