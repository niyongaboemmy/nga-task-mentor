import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import type { AppDispatch } from "../../store";
import {
  updateQuiz,
  fetchQuiz,
  clearQuizError,
  type QuizMutationError,
} from "../../store/slices/quizSlice";
import ProctoringSettings from "../Proctoring/ProctoringSettings";
import type { UpdateQuizRequest } from "../../types/quiz.types";
import {
  quizToFormValues,
  type QuizFormValues,
} from "../../utils/quizFormValidation";
import QuizForm from "./QuizForm";

export const EditQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { quizId } = useParams<{ quizId: string }>();
  const parsedQuizId = Number(quizId);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"quiz" | "proctoring">("quiz");
  const [initialValues, setInitialValues] = useState<QuizFormValues | null>(null);
  const [serverError, setServerError] = useState<QuizMutationError | null>(null);

  useEffect(() => {
    const loadQuiz = async () => {
      if (!Number.isInteger(parsedQuizId) || parsedQuizId <= 0) {
        toast.error("Invalid quiz link.");
        navigate("/dashboard");
        return;
      }

      try {
        const quiz = await dispatch(fetchQuiz(parsedQuizId)).unwrap();
        setInitialValues(quizToFormValues(quiz));
      } catch (error) {
        toast.error(
          typeof error === "string"
            ? error
            : (error as { message?: string })?.message || "Failed to load quiz.",
        );
        navigate("/dashboard");
      } finally {
        setFetchLoading(false);
      }
    };

    loadQuiz();
  }, [dispatch, parsedQuizId, navigate]);

  const handleSubmit = async (payload: UpdateQuizRequest) => {
    setLoading(true);
    setServerError(null);
    dispatch(clearQuizError("quiz"));

    try {
      const updated = await dispatch(
        updateQuiz({ quizId: parsedQuizId, quizData: payload }),
      ).unwrap();
      toast.success(`Quiz "${updated.title}" updated successfully`);
      navigate(`/quizzes/${quizId}`);
    } catch (error) {
      const err = (error ?? {}) as QuizMutationError;
      setServerError(err);
      toast.error(
        err.errors?.length
          ? "Some fields need attention — see the highlighted fields."
          : err.message || "Failed to update quiz. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading quiz...</span>
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md transition-all duration-200 text-text-secondary-light dark:text-text-secondary-dark hover:text-gray-900 dark:hover:text-white"
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl card-hover p-6 pb-4">
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
                    <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                      Quiz Settings
                    </h1>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
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
                      : "border-transparent text-text-secondary-light dark:text-text-secondary-dark/70 hover:text-gray-700 dark:hover:text-gray-300"
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
                      : "border-transparent text-text-secondary-light dark:text-text-secondary-dark/70 hover:text-gray-700 dark:hover:text-gray-300"
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
            <div className="bg-white p-4 md:p-6 rounded-2xl dark:bg-gray-900">
              {initialValues && (
                <QuizForm
                  mode="edit"
                  initialValues={initialValues}
                  submitting={loading}
                  serverErrors={serverError?.errors ?? null}
                  serverMessage={
                    serverError && !serverError.errors?.length
                      ? serverError.message
                      : null
                  }
                  submitLabel="Update Quiz"
                  onSubmit={handleSubmit}
                  onCancel={() => navigate(`/quizzes/${quizId}`)}
                />
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <ProctoringSettings
                quizId={quizId!}
                onSettingsSaved={() => {
                  // ProctoringSettings already toasts on save.
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
