import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Eye,
  BookOpen,
  Users,
  TrendingUp,
  CheckCircle,
  ListTodo,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

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
  type: "assignment" | "submission" | "course" | "quiz";
  title: string;
  description: string;
  timestamp: string;
  resource_id?: string;
}

interface InstructorCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  assignmentCount: number;
  quizCount: number;
}

interface PendingGradingAssignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: string;
  submission_type: string;
  pendingSubmissions: number;
  course?: {
    id: string;
    title: string;
    code: string;
  };
  submissions: Array<{
    id: string;
    status: string;
    submitted_at: string;
    student: {
      id: string;
      first_name: string;
      last_name: string;
      profile_image?: string;
    };
  }>;
}

interface InstructorDashboardData {
  stats: DashboardStats;
  courses?: InstructorCourse[];
  pendingGrading?: PendingGradingAssignment[];
  recentActivity: RecentActivity[];
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
  activeProctoring?: number;
}

function getActivityLink(activity: RecentActivity): string {
  const resourceId = activity.resource_id ?? String(activity.id).split("_").slice(1).join("_");
  switch (activity.type) {
    case "assignment":
    case "submission":
      return resourceId ? `/assignments/${resourceId}` : "/assignments";
    case "course":
      return resourceId ? `/courses/${resourceId}` : "/courses";
    case "quiz":
      return resourceId ? `/quizzes/${resourceId}` : "/assignments";
    default:
      return "/assignments";
  }
}

const InstructorDashboard: React.FC<{ data: InstructorDashboardData }> = ({
  data,
}) => {
  // Function to calculate urgency level based on due date
  const getUrgencyLevel = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue <= 24) return "critical"; // Due within 24 hours
    if (hoursUntilDue <= 48) return "urgent"; // Due within 48 hours
    if (hoursUntilDue <= 72) return "soon"; // Due within 72 hours
    return "normal";
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
    <motion.div variants={itemVariants} className={`group relative h-full`}>
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none transition-all duration-300 hover:-translate-y-1 h-full overflow-hidden`}
      >
        {/* Background Glow */}
        <div
          className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-[0.08] blur-3xl ${color.replace("text-", "bg-")}`}
        ></div>

        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between mb-4">
            <div
              className={`p-3.5 rounded-2xl ${color
                .replace("text-", "bg-")
                .replace("-600", "-50 dark:bg-opacity-10")} ${color}`}
            >
              {icon}
            </div>
            {badge && (
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  badge.includes("Hot") || badge.includes("Urgent")
                    ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : badge.includes("New") || badge.includes("Growing")
                      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {badge}
              </span>
            )}
          </div>

          <div>
            <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1">
              {value}
            </div>
            <div className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {label}
            </div>
            {trend && (
              <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg w-max">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 p-1"
    >
      {/* Welcome Section - Enhanced Mobile Design */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-[1.6rem] p-8 shadow-xl shadow-blue-500/20"
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-[0.05] rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-pink-500 opacity-[0.1] rounded-full blur-2xl"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Responsive avatar */}
            <div className="relative hidden sm:block group">
              <div className="h-20 w-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-inner border border-white/20 group-hover:scale-105 transition-transform duration-300">
                <span className="text-3xl font-black text-white">
                  {data.user.first_name?.charAt(0)}
                  {data.user.last_name?.charAt(0)}
                </span>
              </div>
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-400 border-4 border-blue-700 rounded-full"></div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-black text-white tracking-tight">
                  Welcome back, {data.user.first_name}!
                </h1>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                  Instructor
                </span>
              </div>
              <p className="text-blue-100 text-lg font-medium max-w-xl">
                Ready to guide your students' learning journey? ✨
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid - Single Line Layout (5 cols) */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard
            icon={<BookOpen className="w-6 h-6" />}
            value={data.stats.totalCourses}
            label="Courses Teaching"
            color="text-blue-600"
            trend="+2 this semester"
            badge="Active"
          />

          <StatCard
            icon={<ListTodo className="w-6 h-6" />}
            value={data.stats.totalAssignments}
            label="Total Assignments"
            color="text-emerald-600"
            trend="+8 this month"
            badge="New"
          />

          <StatCard
            icon={<Clock className="w-6 h-6" />}
            value={data.stats.pendingSubmissions}
            label="Pending Grading"
            color="text-amber-600"
            badge={data.stats.pendingSubmissions > 0 ? "Urgent" : "Clear"}
          />

          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            value={data.stats.completedAssignments}
            label="Completed"
            color="text-violet-600"
            trend="+15 this semester"
            badge="Hot"
          />

          {/* Live Proctoring Card */}
          <StatCard
            icon={<Eye className="w-6 h-6" />}
            value={data.activeProctoring || 0}
            label="Active Proctoring"
            color="text-red-600"
            trend="Live monitoring"
            badge="Real-time"
          />
        </div>
      )}

      {/* Instructor Courses Overview - Enhanced Mobile Layout */}
      {data?.courses && data.courses.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-gray-900 rounded-[1.6rem] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-500">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Courses Teaching
                </h3>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Overview of your active courses
                </p>
              </div>
            </div>
            <Link
              to="/courses"
              className="px-6 py-3 bg-gray-50 dark:bg-gray-800 font-bold text-gray-900 dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.slice(0, 6).map((course) => {
              return (
                <motion.div key={course.id} variants={itemVariants}>
                  <Link
                    to={`/courses/${course.id}`}
                    className="group relative bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-900 block"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          <h4 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                            {course.code}
                          </h4>
                        </div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-1">
                          {course.title}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        Active
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col gap-1">
                          {course.assignmentCount > 0 && (
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300">
                              <ListTodo className="w-4 h-4" />
                              <span>{course.assignmentCount} Assignments</span>
                            </div>
                          )}
                          {course.quizCount > 0 && (
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300">
                              <CheckCircle className="w-4 h-4" />
                              <span>{course.quizCount} Quizzes</span>
                            </div>
                          )}
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-700 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                          <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Instructor Pending Grading - Enhanced Mobile Layout */}
      {data?.pendingGrading && data.pendingGrading.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-gray-900 rounded-[1.6rem] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-500">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    Pending Grading
                  </h3>
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
                    {data.pendingGrading.length} PENDING
                  </span>
                </div>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Assignments awaiting your review
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                to="/assignments"
                className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 font-bold text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                Grade Now
              </Link>
              <Link
                to="/proctoring/live"
                className="px-6 py-3 bg-red-50 dark:bg-red-900/20 font-bold text-red-700 dark:text-red-300 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-2"
              >
                <Eye className="w-5 h-5" />
                <span>Live</span>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {data.pendingGrading.slice(0, 3).map((assignment) => {
              const urgency = getUrgencyLevel(assignment.due_date);

              const urgencyColor =
                urgency === "critical"
                  ? "red"
                  : urgency === "urgent"
                    ? "orange"
                    : "amber";

              return (
                <motion.div key={assignment.id} variants={itemVariants}>
                <Link
                  to={`/assignments/${assignment.id}`}
                  className={`group relative rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-1 border-2 block ${
                    urgency === "critical"
                      ? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                      : urgency === "urgent"
                        ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30"
                        : "bg-white dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between">
                    <div className="flex-1 w-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            {assignment.title}
                          </h4>
                          {assignment.course && (
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              {assignment.course.code}:{" "}
                              {assignment.course.title}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-${urgencyColor}-100 text-${urgencyColor}-700 dark:bg-${urgencyColor}-900/30 dark:text-${urgencyColor}-400`}
                          >
                            {assignment.pendingSubmissions} pending
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Due:{" "}
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                        <span>{assignment.max_score} pts</span>
                        <span>{assignment.submission_type}</span>
                      </div>

                      {/* Show first few pending submissions */}
                      {assignment.submissions &&
                        assignment.submissions.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                            <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                              Recent submissions
                            </p>
                            <div className="space-y-2">
                              {assignment.submissions
                                .slice(0, 2)
                                .map((submission) => (
                                  <div
                                    key={submission.id}
                                    className="flex items-center justify-between text-sm p-3 bg-white/50 dark:bg-gray-900/50 rounded-xl"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">
                                        {submission.student?.first_name?.charAt(
                                          0,
                                        )}
                                        {submission.student?.last_name?.charAt(
                                          0,
                                        )}
                                      </div>
                                      <span className="font-bold text-gray-700 dark:text-gray-200">
                                        {submission.student?.first_name}{" "}
                                        {submission.student?.last_name}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                        submission.status === "submitted"
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                      }`}
                                    >
                                      {submission.status}
                                    </span>
                                  </div>
                                ))}
                              {assignment.pendingSubmissions > 2 && (
                                <div className="text-xs text-center font-bold text-gray-500 dark:text-gray-400 mt-2">
                                  +{assignment.pendingSubmissions - 2} more
                                  submissions
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Activity Timeline - Enhanced Mobile Design */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-gray-900 rounded-[1.6rem] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-500">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                Recent Activity
              </h3>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                Your latest interactions and progress
              </p>
            </div>
          </div>
          <Link to="/assignments">
            <button className="px-6 py-3 bg-gray-50 dark:bg-gray-800 font-bold text-gray-900 dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              View all
            </button>
          </Link>
        </div>

        <div className="space-y-4">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            data.recentActivity.slice(0, 4).map((activity: RecentActivity) => (
              <motion.div key={activity.id} variants={itemVariants}>
                <Link
                  to={getActivityLink(activity)}
                  className="group relative flex items-start gap-4 p-4 rounded-3xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200"
                >
                  {/* Activity icon */}
                  <div
                    className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${
                      activity.type === "assignment"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : activity.type === "submission"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : activity.type === "quiz"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                            : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                    }`}
                  >
                    {activity.type === "assignment" && <ListTodo className="w-6 h-6" />}
                    {activity.type === "submission" && <CheckCircle className="w-6 h-6" />}
                    {activity.type === "course" && <BookOpen className="w-6 h-6" />}
                    {activity.type === "quiz" && <CheckCircle className="w-6 h-6" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {activity.title}
                        </p>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {activity.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {new Date(activity.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto h-20 w-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                No recent activity yet
              </h3>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 max-w-sm mx-auto px-4">
                Activity will appear here as you interact with courses and
                assignments.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Mobile-optimized floating elements */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-none">
        <div className="relative">
          <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full animate-bounce opacity-60"></div>
          <div
            className="absolute -top-0.5 -left-0.5 sm:-top-1 sm:-left-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce opacity-40"
            style={{ animationDelay: "0.3s" }}
          ></div>
          <div
            className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-pink-400 rounded-full animate-bounce opacity-50"
            style={{ animationDelay: "0.6s" }}
          ></div>
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0,0,0);
          }
          40%, 43% {
            transform: translate3d(0, -8px, 0);
          }
          70% {
            transform: translate3d(0, -4px, 0);
          }
          90% {
            transform: translate3d(0, -2px, 0);
          }
        }

        .animate-bounce {
          animation: bounce 1s infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
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
    </motion.div>
  );
};

export default InstructorDashboard;
