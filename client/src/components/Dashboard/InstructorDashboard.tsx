import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Flame, Eye } from "lucide-react";

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

interface InstructorCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  credits: number;
  is_active: boolean;
  max_students: number;
  start_date: string;
  end_date: string;
  assignmentCount: number;
  enrolledCount: number;
  progress: {
    enrolled: number;
    capacity: number;
    assignments: number;
  };
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

  // Function to get urgency styling
  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return {
          border: "border-red-300 dark:border-red-700",
          bg: "bg-red-50/80 dark:bg-red-900/20",
          accent: "bg-red-500",
          text: "text-red-700 dark:text-red-300",
          icon: <Flame className="h-3 w-3 text-red-500 animate-pulse" />,
        };
      case "urgent":
        return {
          border: "border-orange-300 dark:border-orange-700",
          bg: "bg-orange-50/80 dark:bg-orange-900/20",
          accent: "bg-orange-500",
          text: "text-orange-700 dark:text-orange-300",
          icon: <AlertTriangle className="h-3 w-3 text-orange-500" />,
        };
      case "soon":
        return {
          border: "border-amber-300 dark:border-amber-700",
          bg: "bg-amber-50/80 dark:bg-amber-900/20",
          accent: "bg-amber-500",
          text: "text-amber-700 dark:text-amber-300",
          icon: <Clock className="h-3 w-3 text-amber-500" />,
        };
      default:
        return {
          border: "border-gray-200 dark:border-gray-600",
          bg: "bg-gray-50/80 dark:bg-gray-800/50",
          accent: "bg-gray-400",
          text: "text-gray-600 dark:text-gray-400",
          icon: null,
        };
    }
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
    <div className="group relative">
      <div
        className={`relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/60 dark:border-gray-800/60 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-200/25 dark:hover:shadow-gray-900/25 transition-all duration-300 hover:-translate-y-1 h-full ${color}`}
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 rounded-xl opacity-[0.02] dark:opacity-[0.04] bg-gradient-to-br from-current to-transparent"></div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div
              className={`p-3 rounded-lg ${color
                .replace("text-", "bg-")
                .replace("-600", "-100 dark:bg-opacity-20")}`}
            >
              {icon}
            </div>
            {badge && (
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  badge.includes("Hot")
                    ? "bg-red-500 text-white"
                    : badge.includes("New")
                    ? "bg-green-500 text-white"
                    : "bg-blue-500 text-white"
                }`}
              >
                {badge}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {value}
            </div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {label}
            </div>
            {trend && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {trend}
              </div>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-2 right-2 opacity-20">
          <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
        </div>
        <div className="absolute bottom-2 left-3 opacity-20">
          <div className="w-0.5 h-0.5 bg-current rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section - Enhanced Mobile Design */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-500 to-blue-700 dark:from-blue-900/60 dark:via-blue-900/30 dark:to-blue-950/50 rounded-3xl p-4 sm:p-6 border border-gray-100 dark:border-blue-900/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-5 w-full sm:w-auto">
            {/* Responsive avatar */}
            <div className="relative flex-shrink-0 hidden sm:block">
              <div className="h-12 w-12 sm:h-16 sm:w-16 bg-gradient-to-br from-blue-600 via-blue-600 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-lg sm:text-xl font-bold text-white">
                  {data.user.first_name?.charAt(0)}
                  {data.user.last_name?.charAt(0)}
                </span>
              </div>
              {/* Sparkle effect */}
              <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-yellow-400 rounded-full animate-spin opacity-75"></div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                  Welcome back, {data.user.first_name}! 👋
                </h1>
                <div
                  className={`px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-medium rounded-full self-start`}
                >
                  Instructor
                </div>
              </div>
              <p className="text-sm sm:text-base text-white/80">
                Ready to guide your students' learning journey? ✨
              </p>
            </div>
          </div>

          {/* Mobile-optimized decorative elements */}
          <div className="hidden sm:flex items-center space-x-3 opacity-25">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div
              className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Enhanced Mobile Responsiveness */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
          <StatCard
            icon={
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5"
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
            }
            value={data.stats.totalCourses}
            label="Courses Teaching"
            color="text-blue-600"
            trend="+2 this semester"
            badge="Active"
          />

          <StatCard
            icon={
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            value={data.stats.totalAssignments}
            label="Total Assignments"
            color="text-emerald-600"
            trend="+8 this month"
            badge="New"
          />

          <StatCard
            icon={
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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
            label="Pending Grading"
            color="text-amber-600"
            badge={data.stats.pendingSubmissions > 0 ? "Urgent" : "Clear"}
          />

          {data.stats.totalEnrolledStudents !== undefined ? (
            <StatCard
              icon={
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              }
              value={data.stats.totalEnrolledStudents}
              label="Enrolled Students"
              color="text-purple-600"
              trend="+12 this semester"
              badge="Growing"
            />
          ) : (
            <StatCard
              icon={
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
              label="Completed"
              color="text-violet-600"
              trend="+15 this semester"
              badge="Hot"
            />
          )}

          {/* Live Proctoring Card */}
          <StatCard
            icon={<Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
            value={0} // This would be dynamic based on active sessions
            label="Active Proctoring"
            color="text-red-600"
            trend="Live monitoring"
            badge="Real-time"
          />
        </div>
      )}

      {/* Instructor Courses Overview - Enhanced Mobile Layout */}
      {data?.courses && data.courses.length > 0 && (
        <div className="bg-white/90 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-gray-800/20 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
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
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Courses Teaching
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Overview of your active courses
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

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.slice(0, 6).map((course, index) => {
              const enrollmentRate =
                course.max_students > 0
                  ? (course.enrolledCount / course.max_students) * 100
                  : 0;

              return (
                <div
                  key={course.id}
                  className="group relative bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-3 sm:p-4 transition-all duration-200 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:shadow-sm animate-fade-in"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {course.code}: {course.title}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {course.description}
                      </p>
                    </div>
                    <div
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        course.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {course.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Enrollment</span>
                      <span>
                        {course.enrolledCount}/{course.max_students}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(enrollmentRate, 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Assignments</span>
                      <span>{course.assignmentCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Instructor Pending Grading - Enhanced Mobile Layout */}
      {data?.pendingGrading && data.pendingGrading.length > 0 && (
        <div className="bg-white/90 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-gray-800/20 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div className="flex items-start md:items-center space-x-2 sm:space-x-3">
              <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg relative">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {/* Pending indicator pulse */}
                <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 bg-amber-500 rounded-full animate-ping opacity-75"></div>
                <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 bg-amber-500 rounded-full"></div>
              </div>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    Pending Grading
                  </h3>
                  {/* Pending badge */}
                  <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium rounded-full animate-pulse w-max mb-2 md:mb-0">
                    <svg
                      className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="">PENDING</span>
                    <span className="xs:hidden">!</span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Assignments awaiting your review
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to="/assignments"
                className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-medium rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors duration-200 self-start sm:self-auto"
              >
                Grade Now
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
              <Link
                to="/proctoring/live"
                className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors duration-200 self-start sm:self-auto"
              >
                <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Live Proctoring
              </Link>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {data.pendingGrading.slice(0, 3).map((assignment, index) => {
              const urgency = getUrgencyLevel(assignment.due_date);
              const urgencyStyles = getUrgencyStyles(urgency);

              return (
                <div
                  key={assignment.id}
                  className={`group relative rounded-xl p-3 sm:p-4 transition-all duration-200 hover:shadow-sm animate-fade-in ${urgencyStyles.bg} ${urgencyStyles.border} hover:scale-[1.01] sm:hover:scale-[1.02]`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {/* Urgency indicator stripe */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${urgencyStyles.accent} rounded-l-xl`}
                  ></div>

                  <div className="flex flex-col sm:flex-row items-start justify-between ml-2">
                    <div className="flex-1 w-full">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                            {assignment.title}
                          </h4>
                          {assignment.course && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {assignment.course.code}:{" "}
                              {assignment.course.title}
                            </p>
                          )}
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {assignment.pendingSubmissions} pending
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <span>
                          Due:{" "}
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                        <span>{assignment.max_score} pts</span>
                        <span className="capitalize">
                          {assignment.submission_type}
                        </span>
                      </div>

                      {/* Show first few pending submissions */}
                      {assignment.submissions &&
                        assignment.submissions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Recent submissions:
                            </p>
                            <div className="space-y-2">
                              {assignment.submissions
                                .slice(0, 2)
                                .map((submission) => (
                                  <div
                                    key={submission.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {submission.student?.first_name}{" "}
                                      {submission.student?.last_name}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
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
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  +{assignment.pendingSubmissions - 2} more
                                  submissions
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Timeline - Enhanced Mobile Design */}
      <div className="bg-white/90 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-gray-800/30 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Your latest interactions and progress
              </p>
            </div>
          </div>
          <Link to="/assignments">
            <button className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 self-start sm:self-auto">
              View all →
            </button>
          </Link>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            data.recentActivity
              .slice(0, 4)
              .map((activity: RecentActivity, index: number) => (
                <div
                  key={activity.id}
                  className="group relative flex items-start space-x-3 sm:space-x-4 p-3 sm:p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 animate-fade-in"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {/* Timeline line */}
                  <div className="absolute left-4 sm:left-6 top-8 sm:top-12 bottom-0 w-px bg-gray-200 dark:bg-gray-700 group-last:hidden"></div>

                  {/* Activity icon */}
                  <div
                    className={`relative z-10 flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 sm:group-hover:scale-110 ${
                      activity.type === "assignment"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : activity.type === "submission"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                    }`}
                  >
                    {activity.type === "assignment" && (
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    )}
                    {activity.type === "submission" && (
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    )}
                    {activity.type === "course" && (
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5"
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
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 line-clamp-2">
                          {activity.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                          {new Date(activity.timestamp).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="text-center py-8 sm:py-12">
              <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <svg
                  className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-1 sm:mb-2">
                No recent activity yet
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto px-4">
                Activity will appear here as you interact with courses and
                assignments.
              </p>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default InstructorDashboard;
