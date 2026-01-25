import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import ProctoringSettings from "../Proctoring/ProctoringSettings";
import axios from "../../utils/axiosConfig";
import { ArrowLeft, Shield } from "lucide-react";

interface QuizProctoringSettingsPageProps {}

export const QuizProctoringSettingsPage: React.FC<
  QuizProctoringSettingsPageProps
> = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuiz = async () => {
      if (!quizId) return;

      try {
        setLoading(true);
        const response = await axios.get(`/quizzes/${quizId}`);

        const data = response.data;
        setQuiz(data.data || data);
      } catch (error: any) {
        console.error("Error loading quiz:", error);
        setError("Failed to load quiz details");
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [quizId]);

  const handleSettingsSaved = () => {
    // Settings saved successfully
    console.log("Proctoring settings saved");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || "Quiz not found"}</p>
          <Button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="mt-4"
            variant="secondary"
          >
            Back to Quiz
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="">
        <div className="space-y-4">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 animate-fade-in">
            <button
              onClick={() => navigate(`/courses/${quiz.course_id}`)}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 hover:scale-105 transform"
            >
              Course
            </button>
            <span className="text-gray-400">/</span>
            <button
              onClick={() => navigate(`/quizzes/${quizId}`)}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 hover:scale-105 transform"
            >
              Quiz
            </button>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              Settings
            </span>
          </nav>

          {/* Header */}
          <div className="animate-fade-in">
            <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/50 card-hover p-4">
              <div className="flex flex-row items-center gap-4">
                <Button
                  onClick={() => navigate(`/quizzes/${quizId}`)}
                  variant="secondary"
                  className="btn-facebook bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full focus-ring transition-all duration-200"
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </div>
                </Button>
                <div className="w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-xl flex items-center justify-center animate-float">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Proctoring Settings
                  </h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Configure security for "{quiz.title}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Component */}
          <div className="animate-slide-in-right">
            <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/50 card-hover">
              <ProctoringSettings
                quizId={quizId!}
                onSettingsSaved={handleSettingsSaved}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizProctoringSettingsPage;
