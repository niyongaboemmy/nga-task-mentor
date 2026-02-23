import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
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

  // Chart Data Preparation
  const chartData = {
    labels: reports.map((r) => r.code),
    datasets: [
      {
        label: "Grade (%)",
        data: reports.map((r) => r.percentage),
        backgroundColor: reports.map((r) => {
          if (r.percentage >= 80) return "rgba(16, 185, 129, 0.8)"; // Green
          if (r.percentage >= 60) return "rgba(245, 158, 11, 0.8)"; // Yellow
          if (r.percentage >= 50) return "rgba(59, 130, 246, 0.8)"; // Blue
          return "rgba(239, 68, 68, 0.8)"; // Red
        }),
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: "rgba(156, 163, 175, 0.1)",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">
            Loading your academic profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 min-h-screen"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 transform -rotate-3">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">
              Academic Performance
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-black uppercase tracking-wider">
                Student Report
              </span>
              <span>Comprehensive overview of your grades and progress.</span>
            </p>
          </div>
        </div>
        <button
          onClick={fetchReports}
          className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[2rem] hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2 font-black text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Data</span>
        </button>
      </motion.div>

      {/* Summary Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {/* Overall Grade Card */}
        <div className="bg-white dark:bg-gray-900 rounded-[1.6rem] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors duration-700" />

          <div className="relative z-10">
            <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Award className="w-4 h-4" />
              Overview
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-5xl font-black text-gray-900 dark:text-white tabular-nums">
                {overallGPA}%
              </p>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
              Overall Average Grade
            </p>

            <div
              className={`mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${overallGPA >= 50 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
            >
              <CheckCircle className="w-3 h-3" />
              <span>
                {overallGPA >= 50 ? "Standing: Good" : "Needs Improvement"}
              </span>
            </div>
          </div>
        </div>

        {/* Completion Rate Card */}
        <div className="bg-white dark:bg-gray-900 rounded-[1.6rem] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <p className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" />
              Progress
            </p>
            <div className="flex items-baseline gap-2 mb-6">
              <p className="text-5xl font-black text-gray-900 dark:text-white tabular-nums">
                {completionRate}%
              </p>
            </div>

            <div className="w-full bg-gray-100 dark:bg-gray-800 h-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
            <p className="mt-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Assignments & Quizzes Completed
            </p>
          </div>
        </div>

        {/* Course Count Card */}
        <div className="bg-white dark:bg-gray-900 rounded-[1.6rem] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4" />
              Courses
            </p>
            <div className="flex items-baseline gap-2 mb-6">
              <p className="text-5xl font-black text-gray-900 dark:text-white tabular-nums">
                {reports.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {reports.slice(0, 3).map((r) => (
                <span
                  key={r.courseId}
                  className="text-[10px] font-black px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 uppercase tracking-wider"
                >
                  {r.code}
                </span>
              ))}
              {reports.length > 3 && (
                <span className="text-[10px] font-black px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-400 uppercase tracking-wider">
                  +{reports.length - 3}
                </span>
              )}
            </div>
            <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Active Enrollments
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        {/* Left Column: Grade Distribution Chart */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-[1.6rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-8"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              Performance Overview
            </h3>
          </div>
          <div className="h-[350px] w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Right Column: Alerts / Passing Status */}
        <div className="space-y-6">
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-gray-900 rounded-[1.6rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Filter className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Status Breakdown
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/10 rounded-3xl border border-green-100 dark:border-green-900/20 group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Passing
                    </span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      On Track
                    </span>
                  </div>
                </div>
                <span className="text-2xl font-black text-green-600 dark:text-green-400">
                  {reports.filter((r) => r.percentage >= 50).length}
                </span>
              </div>

              <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20 group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Needs Attention
                    </span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      Below 50%
                    </span>
                  </div>
                </div>
                <span className="text-2xl font-black text-red-600 dark:text-red-400">
                  {
                    reports.filter((r) => r.percentage < 50 && r.percentage > 0)
                      .length
                  }
                </span>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-700 group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      No Grade
                    </span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      Not Started
                    </span>
                  </div>
                </div>
                <span className="text-2xl font-black text-gray-600 dark:text-gray-400">
                  {reports.filter((r) => r.percentage === 0).length}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Detailed Course Cards Grid */}
      <div className="pt-4">
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Subject Details
        </h3>
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {reports.map((report) => (
            <motion.div
              key={report.courseId}
              variants={itemVariants}
              className="group bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-8 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg mb-3 inline-block">
                    {report.code}
                  </span>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {report.courseName}
                  </h4>
                </div>
                <div
                  className={`flex flex-col items-end ${
                    report.percentage >= 50 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  <span className="text-3xl font-black tracking-tight">
                    {report.percentage}%
                  </span>
                </div>
              </div>

              <div className="space-y-5 mb-8">
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                    <span className="text-gray-400">Assignments</span>
                    <span className="text-gray-900 dark:text-white">
                      {report.assignmentsCompleted}/{report.totalAssignments}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
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
                    <span className="text-gray-400">Quizzes</span>
                    <span className="text-gray-900 dark:text-white">
                      {report.quizzesCompleted}/{report.totalQuizzes}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-500 rounded-full"
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
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider text-xs rounded-2xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/20"
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
