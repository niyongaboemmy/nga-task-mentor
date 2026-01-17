import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import LiveProctoringDashboard from "../Proctoring/LiveProctoringDashboard";
import axios from "../../utils/axiosConfig";
import { ArrowLeft, Eye } from "lucide-react";

interface QuizProctoringMonitoringPageProps {}

export const QuizProctoringMonitoringPage: React.FC<
  QuizProctoringMonitoringPageProps
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
        const response = await axios.get(`/api/quizzes/${quizId}`);

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
    <div className="min-h-screen fixed top-0 bottom-0 left-0 right-0 z-50 bg-white dark:bg-black">
      <div className="">
        <div className="space-y-4">
          {/* Live Monitoring Dashboard */}
          <div className="animate-slide-in-left">
            <div className="bg-white/80 dark:bg-black backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/50 shadow-lg card-hover">
              <LiveProctoringDashboard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizProctoringMonitoringPage;
