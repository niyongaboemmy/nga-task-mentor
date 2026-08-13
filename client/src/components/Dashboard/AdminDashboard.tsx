import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, ClipboardList, Clock, CheckCircle, Activity } from "lucide-react";
import BulkExportReportCards from "../ReportCard/BulkExportReportCards";
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
import { StatCard, SectionCard, PillLink } from "./dashboardUi";

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

ChartJS.defaults.font.family = '"Inter", ui-sans-serif, system-ui, sans-serif';
ChartJS.defaults.font.size = 12;

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
  gradingSummaryError?: boolean;
}

const activityIcon: Record<RecentActivity["type"], React.ReactNode> = {
  submission: <ClipboardList className="w-5 h-5" />,
  assignment: <BookOpen className="w-5 h-5" />,
  course: <Activity className="w-5 h-5" />,
};

const activityIconClasses: Record<RecentActivity["type"], string> = {
  submission: "bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
  assignment: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  course: "bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark",
};

const AdminDashboard: React.FC<{
  data: AdminDashboardData;
  scope: "current" | "all";
  onScopeChange: (scope: "current" | "all") => void;
}> = ({ data, scope, onScopeChange }) => {
  const navigate = useNavigate();

  const barChartData = useMemo(() => {
    const summary = data.gradingSummary || [];
    const topCourses = [...summary].sort((a, b) => b.average_grade - a.average_grade).slice(0, 7);

    return {
      labels: topCourses.map((c) => c.code),
      datasets: [
        {
          label: "Avg Grade",
          data: topCourses.map((c) => c.average_grade),
          backgroundColor: "rgba(59, 130, 246, 0.8)",
          hoverBackgroundColor: "rgba(59, 130, 246, 1)",
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    };
  }, [data.gradingSummary]);

  const doughnutChartData = useMemo(() => {
    const dist = data.gradeDistribution || { excellent: 0, good: 0, average: 0, poor: 0 };
    return {
      labels: ["Excellent (>90%)", "Good (75-90%)", "Average (60-75%)", "Poor (<60%)"],
      datasets: [
        {
          data: [dist.excellent, dist.good, dist.average, dist.poor],
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(239, 68, 68, 0.8)",
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
        labels: { usePointStyle: true, padding: 20, font: { size: 11 } },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
            Welcome back, {data.user.first_name}!
          </h2>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">
            Here's what's happening in your academy today.
          </p>
        </div>
        <button
          onClick={() => navigate("/courses")}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-colors self-start sm:self-auto"
        >
          Manage Courses
        </button>
      </div>

      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<BookOpen className="w-6 h-6" />}
            value={(data.stats.totalCourses ?? 0).toLocaleString()}
            label="Active Courses"
            color="blue"
          />
          <StatCard
            icon={<ClipboardList className="w-6 h-6" />}
            value={(data.stats.totalAssignments ?? 0).toLocaleString()}
            label="Total Assignments"
            color="emerald"
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            value={(data.stats.pendingSubmissions ?? 0).toLocaleString()}
            label="Pending Review"
            color="amber"
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            value={(data.stats.completedAssignments ?? 0).toLocaleString()}
            label="Graded Items"
            color="violet"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card-light dark:bg-card-dark/30 rounded-3xl shadow-sm border border-white dark:border-border-dark/30 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
                Performance Overview
              </h3>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                Average grade per course (Top 7)
              </p>
            </div>
            <select
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as "current" | "all")}
              className="bg-surface-light dark:bg-surface-dark border-none rounded-lg text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark focus:ring-2 focus:ring-blue-500 cursor-pointer p-2"
            >
              <option value="current">Current Term</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <Bar options={barOptions} data={barChartData} />
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark/30 rounded-3xl shadow-sm border border-white dark:border-border-dark/30 p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
            Grade Distribution
          </h3>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 mb-6">
            Student performance breakdown
          </p>
          <div className="flex-1 relative min-h-[220px] flex items-center justify-center">
            <Doughnut data={doughnutChartData} options={doughnutOptions} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                {data.gradingSummary?.reduce((acc, curr) => acc + curr.graded_submissions, 0) || 0}
              </span>
            </div>
          </div>
          <p className="text-center text-xs text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-wider font-medium mt-4">
            Total Submissions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card-light dark:bg-card-dark/30 rounded-3xl shadow-sm border border-white dark:border-border-dark/30 overflow-hidden">
          <div className="p-6 border-b border-border-light dark:border-border-dark/30">
            <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
              Course Summary
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              Detailed performance metrics
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-light dark:bg-surface-dark/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider">
                    Avg Grade
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider">
                    Submissions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark/30">
                {data.gradingSummary &&
                  data.gradingSummary.map((item) => (
                    <tr key={item.course_id} className="hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-text-primary-light dark:text-text-primary-dark">
                          {item.title}
                        </div>
                        <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                          {item.code}
                        </div>
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
                            />
                          </div>
                          <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark w-9">
                            {item.average_grade}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark">
                          {item.active_students}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                        {item.graded_submissions}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/courses/${item.course_id}/reports`}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Reports
                        </Link>
                      </td>
                    </tr>
                  ))}
                {(!data.gradingSummary || data.gradingSummary.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-secondary-light dark:text-text-secondary-dark/70">
                      {data.gradingSummaryError ? (
                        <span className="text-red-600 dark:text-red-400">
                          Couldn't load grading data — the external MIS may be unreachable. Try refreshing the page.
                        </span>
                      ) : (
                        "No grading data available to display."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <SectionCard
          icon={<Activity className="w-5 h-5" />}
          iconColor="emerald"
          title="Live Activity"
          subtitle="Latest actions across the platform"
        >
          <div className="space-y-1">
            {data.recentActivity &&
              data.recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-2xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
                >
                  <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${activityIconClasses[activity.type]}`}>
                    {activityIcon[activity.type]}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
                      {activity.title}
                    </p>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 line-clamp-1">
                      {activity.description}
                    </p>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/50 mt-0.5">
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark/30 text-center">
            <PillLink to="/admin/activity">View All Activity</PillLink>
          </div>
        </SectionCard>
      </div>

      <BulkExportReportCards />
    </div>
  );
};

export default AdminDashboard;
