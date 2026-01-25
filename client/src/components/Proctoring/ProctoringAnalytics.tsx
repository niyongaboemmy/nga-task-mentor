import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/Card";

interface ProctoringAnalyticsProps {
  quizId: string;
}

interface AnalyticsData {
  totalSessions: number;
  averageRiskScore: number;
  totalViolations: number;
  flaggedSessions: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  commonViolations: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  sessionDetails: Array<{
    student_name: string;
    risk_score: number;
    violations: number;
    status: string;
    start_time: string;
  }>;
}

const ProctoringAnalytics: React.FC<ProctoringAnalyticsProps> = ({
  quizId,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"all" | "week" | "month">("all");

  useEffect(() => {
    loadAnalytics();
  }, [quizId, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/proctoring/quizzes/${quizId}/analytics?timeRange=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error("Error loading proctoring analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const response = await fetch(
        `/proctoring/quizzes/${quizId}/analytics/export?timeRange=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proctoring-report-${quizId}-${timeRange}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting report:", error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="text-center py-8">No analytics data available</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Proctoring Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Monitor and analyze proctoring session data
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
          >
            <option value="all">All Time</option>
            <option value="month">Last Month</option>
            <option value="week">Last Week</option>
          </select>
          <button
            onClick={exportReport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1 */}
        <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Total Sessions
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {analytics.totalSessions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2 */}
        <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                <svg
                  className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Avg Risk Score
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {analytics.averageRiskScore.toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3 */}
        <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Total Violations
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {analytics.totalViolations}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4 */}
        <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <svg
                  className="w-5 h-5 text-orange-600 dark:text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Flagged Sessions
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {analytics.flaggedSessions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution Chart */}
      <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
        <CardContent className="p-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Risk Score Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.riskDistribution).map(
              ([level, count]) => (
                <div key={level} className="flex items-center">
                  <div className="w-16 text-xs font-medium capitalize text-gray-900 dark:text-white">
                    {level}
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          level === "critical"
                            ? "bg-red-500"
                            : level === "high"
                            ? "bg-orange-500"
                            : level === "medium"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${
                            analytics.totalSessions > 0
                              ? (count / analytics.totalSessions) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-10 text-xs text-gray-600 dark:text-gray-400">
                    {count}
                  </div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Common Violations */}
      <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
        <CardContent className="p-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Common Violations
          </h3>
          <div className="space-y-2">
            {analytics.commonViolations.map((violation, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
              >
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {violation.type.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {violation.count} times
                  </span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {violation.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Details Table */}
      <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50">
        <CardContent className="p-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Session Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white text-xs">
                    Student
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white text-xs">
                    Risk Score
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white text-xs">
                    Violations
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white text-xs">
                    Status
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white text-xs">
                    Start Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics.sessionDetails.map((session, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">
                      {session.student_name}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded-xl text-xs font-medium ${
                          session.risk_score >= 80
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : session.risk_score >= 60
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            : session.risk_score >= 30
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {session.risk_score}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">
                      {session.violations}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded-xl text-xs font-medium ${
                          session.status === "flagged"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : session.status === "completed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(session.start_time).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProctoringAnalytics;
