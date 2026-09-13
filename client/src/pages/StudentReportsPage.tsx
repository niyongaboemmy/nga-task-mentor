import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type TooltipItem,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  TrendingUp,
  Award,
  BookOpen,
  ArrowRight,
  CheckCircle,
  RefreshCw,
  Zap,
  GraduationCap,
  LayoutDashboard,
  Filter,
} from "lucide-react";
import axios from "../utils/axiosConfig";
import { toast } from "react-toastify";
import { useTheme } from "../contexts/ThemeContext";
import { STAT_COLORS } from "../components/Dashboard/dashboardUi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface ReportCard {
  courseId: number;
  courseName: string;
  code: string;
  totalMaxPoints: number;
  totalPointsEarned: number;
  percentage: number;
  status: "Passing" | "Failing" | "No Grade";
  assignmentsCompleted: number;
  totalAssignments: number;
  quizzesCompleted: number;
  totalQuizzes: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
    },
  },
};

const StudentReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get("/courses/my-grades");
      if (response.data.success) {
        setReports(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load academic reports.");
    } finally {
      setLoading(false);
    }
  };

  const calculateOverallGPA = () => {
    const activeReports = reports.filter(
      (r) => r.totalAssignments > 0 || r.totalQuizzes > 0,
    );

    if (activeReports.length === 0) return 0;
    const totalPercentage = activeReports.reduce(
      (acc, curr) => acc + curr.percentage,
      0,
    );
    return Math.round(totalPercentage / activeReports.length);
  };

  const calculateCompletionRate = () => {
    if (reports.length === 0) return 0;
    const totalItems = reports.reduce(
      (acc, curr) => acc + curr.totalAssignments + curr.totalQuizzes,
      0,
    );
    const completedItems = reports.reduce(
      (acc, curr) => acc + curr.assignmentsCompleted + curr.quizzesCompleted,
      0,
    );
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  };

  const overallGPA = calculateOverallGPA();
  const completionRate = calculateCompletionRate();

  // Chart Data Preparation — colors mirror the app's semantic status palette
  // (emerald/amber/blue/red) so the bars read the same as the Status
  // Breakdown card and the rest of the dashboard's STAT_COLORS.
  const gradeColor = (percentage: number, hover = false) => {
    const alpha = hover ? 1 : 0.85;
    if (percentage >= 80) return `rgba(16, 185, 129, ${alpha})`; // emerald-500
    if (percentage >= 60) return `rgba(245, 158, 11, ${alpha})`; // amber-500
    if (percentage >= 50) return `rgba(59, 130, 246, ${alpha})`; // blue-500
    return `rgba(239, 68, 68, ${alpha})`; // red-500
  };

  const chartData = {
    labels: reports.map((r) => r.code),
    datasets: [
      {
        label: "Grade (%)",
        data: reports.map((r) => r.percentage),
        backgroundColor: reports.map((r) => gradeColor(r.percentage)),
        hoverBackgroundColor: reports.map((r) => gradeColor(r.percentage, true)),
        borderRadius: 6,
        maxBarThickness: 48,
      },
    ],
  };

  // Chart.js reads plain colors, not Tailwind's `dark:` variant — so it's
  // rebuilt whenever the theme toggles, using the same tokens as the rest
  // of the card (text-secondary / surface borders).
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_evt: unknown, elements: Array<{ index: number }>) => {
        const el = elements[0];
        if (!el) return;
        const report = reports[el.index];
        if (report) navigate(`/courses/${report.courseId}/reports`);
      },
      onHover: (evt: { native: { target: HTMLElement } }, elements: unknown[]) => {
        evt.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "rgba(30, 41, 59, 0.95)" : "rgba(15, 23, 42, 0.92)",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (ctx: TooltipItem<"bar">) => `Grade: ${ctx.formattedValue}%`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.18)" },
          ticks: { color: isDark ? "#94a3b8" : "#64748b" },
        },
        x: {
          grid: { display: false },
          ticks: { color: isDark ? "#94a3b8" : "#64748b" },
        },
      },
    }),
    [isDark, reports, navigate],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/30" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-text-secondary-light dark:text-text-secondary-dark/70 font-semibold text-sm">
            Loading your academic profile…
          </p>
        </div>
      </div>
    );
  }

  if (!loading && reports.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center shadow-xl shadow-blue-100 dark:shadow-none border border-blue-200/50 dark:border-blue-800/40">
          <GraduationCap className="w-10 h-10 text-blue-500 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight">No Reports Yet</h2>
          <p className="mt-2 text-text-secondary-light dark:text-text-secondary-dark/70 max-w-sm leading-relaxed">
            You're not enrolled in any courses yet, or no grades have been recorded. Check back after your instructor publishes results.
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="pb-8 pt-5 space-y-8 min-h-screen"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 flex-shrink-0">
            <LayoutDashboard className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight">
              Academic Performance
            </h1>
            <p className="mt-0.5 text-text-secondary-light dark:text-text-secondary-dark/70 text-sm font-medium flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${STAT_COLORS.blue}`}>
                Student Report
              </span>
              <span className="hidden sm:inline">Comprehensive overview of your grades.</span>
            </p>
          </div>
        </div>
        <button
          onClick={fetchReports}
          className="px-6 py-3 bg-card-light dark:bg-card-dark/30 rounded-full hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-all shadow-sm hover:shadow-md flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark self-start sm:self-auto active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </motion.div>

      {/* Summary Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
      >
        {/* Overall Grade Card */}
        <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 sm:p-8 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <p
              className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4 w-fit px-2 py-1 rounded-lg ${STAT_COLORS.blue}`}
            >
              <Award className="w-4 h-4" />
              Overview
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-5xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                {overallGPA}%
              </p>
            </div>
            <p className="text-text-secondary-light dark:text-text-secondary-dark/70 font-medium text-sm">
              Overall Average Grade
            </p>

            <div
              className={`mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${overallGPA >= 50 ? STAT_COLORS.emerald : STAT_COLORS.red}`}
            >
              <CheckCircle className="w-3 h-3" />
              <span>
                {overallGPA >= 50 ? "Standing: Good" : "Needs Improvement"}
              </span>
            </div>
          </div>
        </div>

        {/* Completion Rate Card */}
        <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 sm:p-8 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <p
              className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4 w-fit px-2 py-1 rounded-lg ${STAT_COLORS.emerald}`}
            >
              <Zap className="w-4 h-4" />
              Progress
            </p>
            <div className="flex items-baseline gap-2 mb-6">
              <p className="text-5xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                {completionRate}%
              </p>
            </div>

            <div className="w-full bg-surface-light dark:bg-surface-dark h-3 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <p className="mt-3 text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-wider">
              Assignments & Quizzes Completed
            </p>
          </div>
        </div>

        {/* Course Count Card */}
        <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 sm:p-8 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <p
              className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4 w-fit px-2 py-1 rounded-lg ${STAT_COLORS.violet}`}
            >
              <BookOpen className="w-4 h-4" />
              Courses
            </p>
            <div className="flex items-baseline gap-2 mb-6">
              <p className="text-5xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                {reports.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {reports.slice(0, 3).map((r) => (
                <span
                  key={r.courseId}
                  className="text-[10px] font-bold px-2 py-1 bg-surface-light dark:bg-surface-dark rounded-lg text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider"
                >
                  {r.code}
                </span>
              ))}
              {reports.length > 3 && (
                <span className="text-[10px] font-bold px-2 py-1 bg-surface-light dark:bg-surface-dark rounded-lg text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-wider">
                  +{reports.length - 3}
                </span>
              )}
            </div>
            <p className="mt-4 text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-wider">
              Active Enrollments
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
      >
        {/* Left Column: Grade Distribution Chart */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 sm:p-8"
        >
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${STAT_COLORS.blue}`}>
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight">
                Performance Overview
              </h3>
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/60">
              Click a bar to open that course
            </span>
          </div>
          <div className="h-[220px] sm:h-[280px] lg:h-[350px] w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Right Column: Alerts / Passing Status */}
        <div className="space-y-6">
          <motion.div
            variants={itemVariants}
            className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${STAT_COLORS.indigo}`}>
                <Filter className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight">
                Status Breakdown
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${STAT_COLORS.emerald}`}>
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">
                      Passing
                    </span>
                    <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest">
                      On Track
                    </span>
                  </div>
                </div>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {reports.filter((r) => r.percentage >= 50).length}
                </span>
              </div>

              <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${STAT_COLORS.red}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">
                      Needs Attention
                    </span>
                    <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest">
                      Below 50%
                    </span>
                  </div>
                </div>
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {
                    reports.filter((r) => r.percentage < 50 && r.percentage > 0)
                      .length
                  }
                </span>
              </div>

              <div className="flex justify-between items-center p-4 bg-surface-light dark:bg-surface-dark/50 rounded-2xl group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark/70">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">
                      No Grade
                    </span>
                    <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest">
                      Not Started
                    </span>
                  </div>
                </div>
                <span className="text-2xl font-bold text-text-secondary-light dark:text-text-secondary-dark">
                  {reports.filter((r) => r.percentage === 0).length}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Detailed Course Cards Grid */}
      <div className="pt-2">
        <h3 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-5 flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          Subject Details
        </h3>
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
        >
          {reports.map((report) => (
            <motion.div
              key={report.courseId}
              variants={itemVariants}
              onClick={() => navigate(`/courses/${report.courseId}/reports`)}
              className="group bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 sm:p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg mb-3 inline-block ${STAT_COLORS.blue}`}>
                    {report.code}
                  </span>
                  <h4 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {report.courseName}
                  </h4>
                </div>
                <div
                  className={`flex flex-col items-end ${
                    report.percentage >= 50 ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  <span className="text-3xl font-bold tracking-tight">
                    {report.percentage}%
                  </span>
                </div>
              </div>

              <div className="space-y-5 mb-8">
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                    <span className="text-text-secondary-light dark:text-text-secondary-dark/60">Assignments</span>
                    <span className="text-text-primary-light dark:text-text-primary-dark">
                      {report.assignmentsCompleted}/{report.totalAssignments}
                    </span>
                  </div>
                  <div className="w-full bg-surface-light dark:bg-surface-dark h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-[width] duration-700"
                      style={{
                        width: `${
                          report.totalAssignments > 0
                            ? (report.assignmentsCompleted /
                                report.totalAssignments) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                    <span className="text-text-secondary-light dark:text-text-secondary-dark/60">Quizzes</span>
                    <span className="text-text-primary-light dark:text-text-primary-dark">
                      {report.quizzesCompleted}/{report.totalQuizzes}
                    </span>
                  </div>
                  <div className="w-full bg-surface-light dark:bg-surface-dark h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-500 rounded-full transition-[width] duration-700"
                      style={{
                        width: `${
                          report.totalQuizzes > 0
                            ? (report.quizzesCompleted / report.totalQuizzes) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <Link
                to={`/courses/${report.courseId}/reports`}
                onClick={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-surface-light dark:bg-surface-dark/60 text-text-secondary-light dark:text-text-secondary-dark font-bold uppercase tracking-wider text-xs rounded-full hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/20"
              >
                <span>View Full Report</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default StudentReportsPage;
