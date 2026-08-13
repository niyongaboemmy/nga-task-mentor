import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { QuizApiService } from "../../services/quizApi";
import type { QuizAnalytics } from "../../types/quiz.types";
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface QuizAnalyticsPageProps {}

export const QuizAnalyticsPage: React.FC<QuizAnalyticsPageProps> = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"all" | "week" | "month">("all");

  useEffect(() => {
    const loadData = async () => {
      if (!quizId) return;

      try {
        setLoading(true);

        const [quizResponse, analyticsResponse] = await Promise.all([
          QuizApiService.getQuiz(Number(quizId)),
          QuizApiService.getQuizAnalytics(Number(quizId), timeRange),
        ]);
        setQuiz(quizResponse.data);
        setAnalytics(analyticsResponse.data);
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [quizId, timeRange]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
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
    <div className="max-w-8xl mx-auto py-5 px-4">
      {/* Header */}
      <div className="mb-5">
        <nav className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="hover:text-blue-600"
          >
            Quiz
          </button>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Analytics</span>
        </nav>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              Quiz Analytics
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Performance insights for "{quiz.title}"
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="month">Last Month</option>
              <option value="week">Last Week</option>
            </select>
            <Button
              onClick={() => navigate(`/quizzes/${quizId}`)}
              variant="secondary"
            >
              Back to Quiz
            </Button>
          </div>
        </div>
      </div>

      {!analytics ? (
        <div className="text-center py-8">
          <BarChart3 className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            No Analytics Data
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analytics will be available once students start taking this quiz.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Total Attempts
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {analytics.total_submissions}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Target className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Average Score
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {analytics.average_score.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <CheckCircle className="w-6 h-6 text-purple-600 shrink-0" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Completion Rate
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {analytics.pass_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Clock className="w-6 h-6 text-orange-600 shrink-0" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Average Time
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatTime(
                        analytics.student_analytics.length > 0
                          ? Math.round(
                              analytics.student_analytics.reduce((s, a) => s + (a.total_time / a.attempts), 0) /
                              analytics.student_analytics.length,
                            )
                          : 0,
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score Distribution */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Score Distribution</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { range: "90–100%", min: 90, max: 100 },
                  { range: "75–89%", min: 75, max: 89 },
                  { range: "60–74%", min: 60, max: 74 },
                  { range: "Below 60%", min: 0, max: 59 },
                ].map(({ range, min, max }) => {
                  const count = analytics.student_analytics.filter(
                    (a) => a.best_score >= min && a.best_score <= max,
                  ).length;
                  return (
                    <div key={range} className="flex items-center justify-between">
                      <span className="text-xs font-medium w-20 shrink-0">{range}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{
                              width: `${
                                analytics.total_submissions > 0
                                  ? (count / analytics.total_submissions) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-6 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Question Performance */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Question Performance</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.question_analytics.map((question) => (
                  <div
                    key={question.question_id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 flex-1 mr-4">
                        {question.question_text}
                      </h3>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-gray-600 dark:text-gray-400">
                          {question.total_attempts} attempts
                        </span>
                        <span
                          className={`font-medium ${getScoreColor(question.correct_rate)}`}
                        >
                          {Math.round(question.correct_rate)}% correct
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-green-600 h-1.5 rounded-full"
                        style={{ width: `${question.correct_rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Attempts */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Recent Attempts</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.student_analytics.map((student) => (
                  <div
                    key={student.student_id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {(student.student_name || student.student_email || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                          {student.student_name || student.student_email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {student.last_attempt
                            ? new Date(student.last_attempt).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-xs font-medium ${getScoreColor(student.best_score)}`}>
                          {student.best_score.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(Math.round(student.total_time / student.attempts))}
                        </p>
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QuizAnalyticsPage;
