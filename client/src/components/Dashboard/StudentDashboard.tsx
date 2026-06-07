import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import AssignmentCard, {
  type AssignmentInterface,
} from "../Assignments/AssignmentCard";
import CountdownTimer from "./CountdownTimer";
import {
  AlertTriangle,
  Clock,
  BookOpen,
  Users,
  Award,
  TrendingUp,
  CheckCircle,
  ListTodo,
  ArrowRight,
  FileText,
  Download,
  Eye,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import ReportCardPreview from "../ReportCard/ReportCardPreview";
import { ReportCardApiService } from "../../services/reportCardApi";

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

function getActivityLink(activity: RecentActivity): string {
  const resourceId = activity.resource_id ?? String(activity.id).split("_").slice(1).join("_");
  switch (activity.type) {
    case "assignment":
    case "submission": return resourceId ? `/assignments/${resourceId}` : "/assignments";
    case "course": return resourceId ? `/courses/${resourceId}` : "/courses";
    case "quiz": return resourceId ? `/quizzes/${resourceId}` : "/assignments";
    default: return "/assignments";
  }
}

interface StudentDashboardData {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    roles?: Array<{ id: number; name: string }>;
  };
  stats: DashboardStats;
  pendingAssignments: AssignmentInterface[];
  recentActivity: RecentActivity[];
  publicQuizzes: any[];
  enrolledCourses: any[];
  availableQuizzes: any[];
}

const StudentDashboard: React.FC<{ data: StudentDashboardData }> = ({
  data,
}) => {
  const { user } = useAuth();

  // ── Report Card state ──
  const [showPreview, setShowPreview]         = useState(false);
  const [downloadingPdf, setDownloadingPdf]   = useState(false);

  const currentTerm        = user?.currentAcademicTerm?.name as string | undefined;
  const currentAcademicYear = user?.currentAcademicYear?.name as string | undefined;

  const handleDownloadPdf = useCallback(async () => {
    if (!user?.id) return;
    setDownloadingPdf(true);
    try {
      const res = await ReportCardApiService.getStudentReportCard(
        parseInt(String(user.id), 10),
        { term: currentTerm, academic_year: currentAcademicYear },
      );
      if (!res.success) throw new Error("not_found");
      const blob = await ReportCardApiService.generatePdf(res.data.report_card.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `ReportCard-${data.user.first_name}_${data.user.last_name}-${res.data.report_card.term}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not generate PDF. Your report card may not be available yet.");
    } finally {
      setDownloadingPdf(false);
    }
  }, [user, currentTerm, currentAcademicYear, data.user]);

  const enrolledCourseIds = React.useMemo(
    () => data.enrolledCourses.map((c) => String(c.id)),
    [data.enrolledCourses],
  );

  const filteredAssignments = React.useMemo(
    () =>
      data.pendingAssignments.filter((a) =>
        enrolledCourseIds.includes(String(a.course_id)),
      ),
    [data.pendingAssignments, enrolledCourseIds],
  );

  const filteredQuizzes = React.useMemo(
    () =>
      data.availableQuizzes.filter((q) =>
        enrolledCourseIds.includes(String(q.course_id)),
      ),
    [data.availableQuizzes, enrolledCourseIds],
  );
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
    value: number | string;
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
                  badge.includes("Hot")
                    ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : badge.includes("New")
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
              <div className="h-20 w-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-inner border border-white/10 group-hover:scale-105 transition-transform duration-300">
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
                  {data.user.roles && data.user.roles.length > 0
                    ? data.user.roles[0].name
                    : "Student"}
                </span>
              </div>
              <p className="text-blue-100 text-lg font-medium max-w-xl">
                You have{" "}
                <span className="text-white font-bold">
                  {data.stats.pendingSubmissions} assignments
                </span>{" "}
                due soon. Keep up the momentum! 🚀
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid - Single Line Layout */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/reports" className="block h-full">
            <StatCard
              icon={<Award className="w-6 h-6" />}
              value="GPA"
              label="Global Report"
              color="text-purple-600"
              trend="View Reports"
              badge="View"
            />
          </Link>

          <StatCard
            icon={<BookOpen className="w-6 h-6" />}
            value={data.stats.totalCourses}
            label="Active Courses"
            color="text-blue-600"
            badge="Enrolled"
          />

          <StatCard
            icon={<ListTodo className="w-6 h-6" />}
            value={data.stats.totalAssignments}
            label="Assignments"
            color="text-emerald-600"
            trend="+8 this month"
            badge="Total"
          />

          <StatCard
            icon={<Clock className="w-6 h-6" />}
            value={data.stats.pendingSubmissions}
            label="Pending"
            color="text-amber-600"
            badge={
              data.stats.pendingSubmissions > 0 ? "Action Needed" : "All Clear"
            }
          />
        </div>
      )}

      {/* Assignment Cards - Modern List Design */}
      {filteredAssignments && filteredAssignments.length > 0 && (
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
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Assignments Due
                </h3>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Tasks requiring your immediate attention
                </p>
              </div>
            </div>
            <Link
              to="/assignments"
              className="px-6 py-3 bg-gray-50 dark:bg-gray-800 font-bold text-gray-900 dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="grid gap-4">
            {filteredAssignments.slice(0, 3).map((assignment, index) => {
              const urgency = getUrgencyLevel(assignment.due_date);

              return (
                <Link key={index + 1} to={`/assignments/${assignment.id}`} className="block">
                  <motion.div
                    variants={itemVariants}
                    className={`group relative rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-1 border-2 ${
                      urgency === "critical"
                        ? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                        : urgency === "urgent"
                          ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30"
                          : "bg-white dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800"
                    }`}
                  >
                    <div className="relative z-10">
                      <AssignmentCard
                        assignment={assignment}
                        compact={true}
                        showSubmissions={false}
                      />
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Available Copurse Quizzes Section */}
      {filteredQuizzes && filteredQuizzes.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-gray-900 rounded-[1.6rem] p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-500">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    Available Quizzes
                  </h3>
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-bold uppercase tracking-wider">
                    {filteredQuizzes.length} Active
                  </span>
                </div>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Assessments ready for you to take
                </p>
              </div>
            </div>
            <Link
              to="/courses"
              className="px-6 py-3 bg-gray-50 dark:bg-gray-800 font-bold text-gray-900 dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Go to Courses
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes
              .slice(0, 3)
              .map((quiz: any, index: number) => {
                const deadline = quiz.deadline || quiz.end_date;
                const isExpired = deadline && new Date(deadline) < new Date();

                return (
                  <motion.div
                    key={quiz.id || index}
                    variants={itemVariants}
                    className="group flex flex-col justify-between bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] p-6 hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-emerald-200 dark:hover:border-emerald-900 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          Quiz
                        </span>
                        {deadline && (
                          <div className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <CountdownTimer
                              deadline={deadline}
                              showLabel={false}
                              className="font-mono"
                            />
                          </div>
                        )}
                      </div>

                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {quiz.title}
                      </h4>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                        {quiz.course_name || "General Knowledge"}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
                        <span>{quiz.totalPoints || 100} PTS</span>
                        <span>{quiz.totalQuestions || 10} Qs</span>
                      </div>

                      <Link
                        to={`/quizzes/${quiz.id}/take`}
                        className={`w-full py-3 rounded-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all ${
                          isExpired
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        }`}
                        onClick={(e) => isExpired && e.preventDefault()}
                      >
                        {isExpired ? "Closed" : "Start Quiz"}
                        {!isExpired && <TrendingUp className="w-3 h-3" />}
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* Enrolled Courses with Deadlines */}
      {data?.enrolledCourses && data.enrolledCourses.length > 0 && (
        <div className="bg-white/90 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-gray-800/30 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div className="flex items-start md:items-center space-x-2 sm:space-x-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg relative">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    Course Deadlines
                  </h3>
                  <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-medium rounded-full w-max mb-2 md:mb-0">
                    {data.enrolledCourses.length} Active
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Upcoming assignments and quiz deadlines
                </p>
              </div>
            </div>
            <Link
              to="/courses"
              className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-medium rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200 self-start sm:self-auto"
            >
              View All
              <svg
                className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>

          <div className="grid gap-3 sm:gap-4">
            {data.enrolledCourses.slice(0, 3).map((course, index) => {
              const nextDeadline =
                course.next_deadline ||
                course.assignment_deadline ||
                course.quiz_deadline;
              const isExpired =
                nextDeadline && new Date(nextDeadline) < new Date();
              const isUrgent =
                nextDeadline &&
                !isExpired &&
                new Date(nextDeadline).getTime() - new Date().getTime() <
                  48 * 60 * 60 * 1000;

              return (
                <Link
                  key={course.id || index}
                  to={`/courses/${course.id}`}
                  className={`group relative rounded-xl p-3 sm:p-4 transition-all duration-200 hover:shadow-sm block ${
                    isExpired
                      ? "bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                      : isUrgent
                        ? "bg-orange-50/80 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                        : "bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                  } hover:scale-[1.01] sm:hover:scale-[1.02]`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {/* Urgency indicator stripe */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                      isExpired
                        ? "bg-red-500"
                        : isUrgent
                          ? "bg-orange-500"
                          : "bg-blue-500"
                    }`}
                  ></div>

                  <div className="flex flex-col sm:flex-row items-start justify-between ml-2">
                    <div className="flex-1 w-full">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs font-medium">
                              📚 {course.code || course.subject}
                            </span>
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium">
                              {course.instructor_name || course.teacher}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base mb-1">
                            {course.name || course.title}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {course.description}
                          </p>
                        </div>
                        {/* <div className="flex-shrink-0 ml-3">
                          <div className="text-right">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {course.progress || 0}% Complete
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {course.assignments_count || 0} assignments
                            </div>
                          </div>
                        </div> */}
                      </div>

                      {/* Course stats and countdown */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          {/* <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>
                              {course.enrolled_students || course.students || 0}{" "}
                              students
                            </span>
                          </div> */}
                          {course.next_item_type && (
                            <>
                              <span>•</span>
                              <span>Next: {course.next_item_type}</span>
                            </>
                          )}
                        </div>

                        {nextDeadline && (
                          <CountdownTimer
                            deadline={nextDeadline}
                            variant={
                              isExpired
                                ? "expired"
                                : isUrgent
                                  ? "urgent"
                                  : "default"
                            }
                            showLabel={false}
                            className="text-xs"
                          />
                        )}
                      </div>

                      {/* Action button */}
                      <div className="mt-3">
                        <Link
                          to={`/courses/${course.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          View Course
                          <svg
                            className="ml-1 h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {/* Recent Activity Section */}
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
              <Link
                key={activity.id}
                to={getActivityLink(activity)}
                className="block"
              >
                <motion.div
                  variants={itemVariants}
                  className="group relative flex items-start gap-4 p-4 rounded-3xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200"
                >
                  {/* Activity icon */}
                  <div
                    className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${
                      activity.type === "assignment"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : activity.type === "submission"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                    }`}
                  >
                    {activity.type === "assignment" && (
                      <ListTodo className="w-6 h-6" />
                    )}
                    {activity.type === "submission" && (
                      <CheckCircle className="w-6 h-6" />
                    )}
                    {activity.type === "course" && (
                      <BookOpen className="w-6 h-6" />
                    )}
                    {activity.type === "quiz" && (
                      <CheckCircle className="w-6 h-6" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate transition-colors">
                          {activity.title}
                        </p>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {activity.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {new Date(activity.timestamp).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
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

      {/* ── My Report Cards ── */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                My Report Cards
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentTerm && currentAcademicYear
                  ? `${currentTerm} · ${currentAcademicYear}`
                  : "Current academic term"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Card preview tile */}
          <div className="flex-1 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/40">
            <div className="w-12 h-14 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center border border-gray-100 dark:border-gray-700 flex-shrink-0">
              <FileText className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">
                Academic Report Card
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {currentTerm ?? "—"} · {currentAcademicYear ?? "—"}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                {data.user.first_name} {data.user.last_name}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 sm:flex-col">
            <button
              onClick={() => setShowPreview(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl
                bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold
                shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                transition-all duration-200 active:scale-95"
            >
              <Eye className="w-4 h-4" />
              View
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl
                bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold
                shadow-lg shadow-emerald-500/30
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 active:scale-95"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloadingPdf ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Report Card Preview modal */}
      {showPreview && user?.id && (
        <ReportCardPreview
          studentId={parseInt(String(user.id), 10)}
          studentName={`${data.user.first_name} ${data.user.last_name}`}
          term={currentTerm}
          academicYear={currentAcademicYear}
          onClose={() => setShowPreview(false)}
        />
      )}

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

export default StudentDashboard;
