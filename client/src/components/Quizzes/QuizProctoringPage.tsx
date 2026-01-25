import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import ProctoringAnalytics from "../Proctoring/ProctoringAnalytics";
import LiveProctoringDashboard from "../Proctoring/LiveProctoringDashboard";
import axios from "../../utils/axiosConfig";
import {
  Eye,
  BarChart3,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle,
  Settings,
} from "lucide-react";

interface QuizProctoringPageProps {}

export const QuizProctoringPage: React.FC<QuizProctoringPageProps> = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"live" | "analytics">("live");

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
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="hover:text-blue-600"
          >
            Quiz
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Proctoring</span>
        </nav>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Proctoring Dashboard
            </h1>
            <p className="text-gray-600">
              Monitor and analyze proctoring sessions for "{quiz.title}"
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate(`/quizzes/${quizId}/settings`)}
              variant="secondary"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button
              onClick={() => navigate(`/quizzes/${quizId}`)}
              variant="secondary"
            >
              Back to Quiz
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mt-6">
          <button
            onClick={() => setActiveTab("live")}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "live"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="w-4 h-4" />
            Live Monitoring
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "analytics"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics & Reports
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "live" ? (
        <div className="space-y-6">
          {/* Quiz Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Shield className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Proctoring Status
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {quiz?.is_proctored ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Active Sessions
                    </p>
                    <p className="text-2xl font-bold text-gray-900">-</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <AlertTriangle className="w-8 h-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      High Risk Sessions
                    </p>
                    <p className="text-2xl font-bold text-gray-900">-</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Completed Sessions
                    </p>
                    <p className="text-2xl font-bold text-gray-900">-</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Proctoring Dashboard */}
          <LiveProctoringDashboard />
        </div>
      ) : (
        <ProctoringAnalytics quizId={quizId!} />
      )}
    </div>
  );
};

export default QuizProctoringPage;
