import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

// Interfaces
interface DashboardStats {
  totalCourses: number;
  totalAssignments: number;
  pendingSubmissions: number;
  completedAssignments: number;
  totalEnrolledStudents?: number;
}

interface RecentActivity {
  id: string;
  type: "assignment" | "submission" | "course";
  title: string;
  description: string;
  timestamp: string;
}

interface GradingSummaryItem {
  course_id: number;
  title: string;
  code: string;
  average_grade: number;
  active_students: number;
  graded_submissions: number;
}

interface AdminDashboardData {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  gradingSummary: GradingSummaryItem[];
  gradeDistribution?: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
}

const AdminDashboard: React.FC<{ data: AdminDashboardData }> = ({ data }) => {
  // Bar Chart Data
  const barChartData = useMemo(() => {
    const summary = data.gradingSummary || [];
    const topCourses = [...summary]
      .sort((a, b) => b.average_grade - a.average_grade)
      .slice(0, 7);

    return {
      labels: topCourses.map((c) => c.code),
      datasets: [
        {
          label: "Avg Grade",
          data: topCourses.map((c) => c.average_grade),
          backgroundColor: "rgba(59, 130, 246, 0.8)", // blue-500 with opacity
          hoverBackgroundColor: "rgba(59, 130, 246, 1)",
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    };
  }, [data.gradingSummary]);

  // Doughnut Chart Data
  const doughnutChartData = useMemo(() => {
    const dist = data.gradeDistribution || {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
    };
    return {
      labels: [
        "Excellent (>90%)",
        "Good (75-90%)",
        "Average (60-75%)",
        "Poor (<60%)",
      ],
      datasets: [
        {
          data: [dist.excellent, dist.good, dist.average, dist.poor],
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)", // Green - Excellent
            "rgba(59, 130, 246, 0.8)", // Blue - Good
            "rgba(245, 158, 11, 0.8)", // Yellow - Average
            "rgba(239, 68, 68, 0.8)", // Red - Poor
          ],
          borderColor: [
            "rgba(16, 185, 129, 1)",
            "rgba(59, 130, 246, 1)",
            "rgba(245, 158, 11, 1)",
            "rgba(239, 68, 68, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [data.gradeDistribution]);

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 14, weight: "bold" as const },
        bodyFont: { size: 13 },
        displayColors: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: "rgba(156, 163, 175, 0.1)" },
        ticks: { font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
    maintainAspectRatio: false,
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        padding: 12,
        cornerRadius: 8,
      },
    },
    cutout: "70%",
    maintainAspectRatio: false,
  };

  const StatCard = ({
    icon,
    value,
    label,
    color,
    badge,
    trend,
  }: {
    icon: React.ReactNode;
    value: number;
    label: string;
    color: string;
    badge?: string;
    trend?: string;
  }) => (
    <div className="group relative h-full">
      <div
        className={`relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl p-5 border border-white/20 dark:border-gray-800/60 shadow-lg shadow-gray-200/50 dark:shadow-black/20 hover:-translate-y-1 transition-transform duration-300 h-full overflow-hidden`}
      >
        <div
          className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 ${color.replace("text-", "bg-")}`}
        ></div>

        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex justify-between items-start mb-4">
            <div
              className={`p-3 rounded-xl ${color.replace("text-", "bg-").replace("600", "100")} dark:bg-opacity-10`}
            >
              {icon}
            </div>
            {badge && (
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  badge === "Urgent"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : badge === "Hot"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {badge}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {value}
            </h3>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {label}
            </p>
            {trend && (
              <p className="text-xs font-medium text-emerald-500 mt-2 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                {trend}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header Section with Glassmorphism */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-bold border border-white/30 shadow-inner">
              {data.user.first_name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">
                Welcome back, {data.user.first_name}!
              </h1>
              <p className="text-blue-100 font-medium">
                Here's what's happening in your academy today.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl font-medium transition-all text-sm">
              Generate Report
            </button>
            <button className="px-5 py-2.5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-bold shadow-lg transition-all text-sm">
              Manage Courses
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            }
            value={data.stats.totalCourses}
            label="Active Courses"
            color="text-blue-600"
            badge="System"
          />
          <StatCard
            icon={
              <svg
                className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            }
            value={data.stats.totalAssignments}
            label="Total Assignments"
            color="text-emerald-600"
            trend="+12%"
          />
          <StatCard
            icon={
              <svg
                className="w-6 h-6 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            value={data.stats.pendingSubmissions}
            label="Pending Review"
            color="text-amber-600"
            badge={data.stats.pendingSubmissions > 10 ? "Urgent" : "Normal"}
          />
          <StatCard
            icon={
              <svg
                className="w-6 h-6 text-violet-600 dark:text-violet-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            value={data.stats.completedAssignments}
            label="Graded Items"
            color="text-violet-600"
            trend="+8%"
          />
        </div>
      )}

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-black/20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Performance Overview
              </h2>
              <p className="text-sm text-gray-500">
                Average grade per course (Top 7)
              </p>
            </div>
            <select className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer p-2">
              <option>This Semester</option>
              <option>Last Semester</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <Bar options={barOptions} data={barChartData} />
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-black/20 flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Grade Distribution
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Student performance breakdown
          </p>
          <div className="flex-1 relative min-h-[250px] flex items-center justify-center">
            <Doughnut data={doughnutChartData} options={doughnutOptions} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-800 dark:text-white">
                {data.gradingSummary?.reduce(
                  (acc, curr) => acc + curr.graded_submissions,
                  0,
                ) || 0}
              </span>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
              Total Submissions
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grading Summary Table */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Course Summary
              </h2>
              <p className="text-sm text-gray-500">
                Detailed performance metrics
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Avg Grade
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Submissions
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.gradingSummary &&
                  data.gradingSummary.map((item) => (
                    <tr
                      key={item.course_id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500">{item.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.average_grade >= 80
                                  ? "bg-emerald-500"
                                  : item.average_grade >= 60
                                    ? "bg-blue-500"
                                    : item.average_grade >= 40
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                              }`}
                              style={{ width: `${item.average_grade}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-9">
                            {item.average_grade}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                          {item.active_students}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        {item.graded_submissions}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/courses/${item.course_id}/reports`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        >
                          Reports
                        </Link>
                      </td>
                    </tr>
                  ))}
                {(!data.gradingSummary || data.gradingSummary.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      No grading data available to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Mini */}
        <div className="bg-white/90 dark:bg-gray-900/40 backdrop-blur-xl rounded-3xl border border-gray-200/60 dark:border-gray-800/30 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Live Activity
          </h3>
          <div className="space-y-4">
            {data.recentActivity &&
              data.recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-4 p-3 rounded-2xl hover:bg-white dark:hover:bg-gray-800 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700 shadow-sm hover:shadow-md"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.type === "submission"
                        ? "bg-purple-100 text-purple-600"
                        : activity.type === "assignment"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {activity.type === "submission"
                      ? "📝"
                      : activity.type === "assignment"
                        ? "📚"
                        : "🔔"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {activity.description}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(activity.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
          <Link
            to="/admin/activity"
            className="block text-center mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View All Activity →
          </Link>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        .animate-ping {
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
