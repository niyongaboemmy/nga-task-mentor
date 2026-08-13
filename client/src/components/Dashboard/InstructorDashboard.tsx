import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Eye,
  BookOpen,
  ListTodo,
  CheckCircle,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  StatCard,
  SectionCard,
  PillLink,
  dashboardContainerVariants,
  dashboardItemVariants,
} from "./dashboardUi";

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

const activityIconClasses: Record<RecentActivity["type"], string> = {
  assignment: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  submission: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  quiz: "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  course: "bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
};

const InstructorDashboard: React.FC<{ data: InstructorDashboardData }> = ({ data }) => {
  const getUrgencyLevel = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue <= 24) return "critical";
    if (hoursUntilDue <= 48) return "urgent";
    if (hoursUntilDue <= 72) return "soon";
    return "normal";
  };

  return (
    <motion.div
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={dashboardItemVariants}>
        <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
          Welcome back, {data.user.first_name}!
        </h2>
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          Ready to guide your students' learning journey?
        </p>
      </motion.div>

      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard
            icon={<BookOpen className="w-6 h-6" />}
            value={(data.stats.totalCourses ?? 0).toLocaleString()}
            label="Courses Teaching"
            color="blue"
          />
          <StatCard
            icon={<ListTodo className="w-6 h-6" />}
            value={(data.stats.totalAssignments ?? 0).toLocaleString()}
            label="Total Assignments"
            color="emerald"
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            value={(data.stats.pendingSubmissions ?? 0).toLocaleString()}
            label="Pending Grading"
            color="amber"
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            value={(data.stats.completedAssignments ?? 0).toLocaleString()}
            label="Completed"
            color="violet"
          />
          <StatCard
            icon={<Eye className="w-6 h-6" />}
            value={(data.activeProctoring || 0).toLocaleString()}
            label="Active Proctoring"
            color="red"
          />
        </div>
      )}

      {data?.courses && data.courses.length > 0 && (
        <SectionCard
          icon={<GraduationCap className="w-5 h-5" />}
          iconColor="blue"
          title="Courses Teaching"
          subtitle="Overview of your active courses"
          action={<PillLink to="/courses">View All</PillLink>}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.slice(0, 6).map((course) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="group bg-surface-light dark:bg-surface-dark/50 rounded-2xl p-4 border border-border-light dark:border-border-dark/30 hover:border-blue-200 dark:hover:border-blue-900 transition-colors block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <h4 className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                        {course.code}
                      </h4>
                    </div>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 line-clamp-1 mt-0.5">
                      {course.title}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
                <div className="flex items-center gap-4 pt-3 border-t border-border-light dark:border-border-dark/30 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                  {course.assignmentCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <ListTodo className="w-4 h-4" />
                      {course.assignmentCount}
                    </span>
                  )}
                  {course.quizCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      {course.quizCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      {data?.pendingGrading && data.pendingGrading.length > 0 && (
        <SectionCard
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="amber"
          title="Pending Grading"
          subtitle="Assignments awaiting your review"
          action={
            <div className="flex gap-2">
              <PillLink to="/assignments" variant="amber">
                Grade Now
              </PillLink>
              <PillLink to="/proctoring/live" variant="red" icon={<Eye className="w-4 h-4" />}>
                Live
              </PillLink>
            </div>
          }
        >
          <div className="space-y-3">
            {data.pendingGrading.slice(0, 3).map((assignment) => {
              const urgency = getUrgencyLevel(assignment.due_date);
              return (
                <Link
                  key={assignment.id}
                  to={`/assignments/${assignment.id}`}
                  className={`block rounded-2xl p-4 border transition-colors ${
                    urgency === "critical"
                      ? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                      : urgency === "urgent"
                        ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30"
                        : "bg-surface-light dark:bg-surface-dark/50 border-border-light dark:border-border-dark/30 hover:border-amber-200 dark:hover:border-amber-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                        {assignment.title}
                      </h4>
                      {assignment.course && (
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                          {assignment.course.code}: {assignment.course.title}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      {assignment.pendingSubmissions} pending
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Due {new Date(assignment.due_date).toLocaleDateString()}
                    </span>
                    <span>{assignment.max_score} pts</span>
                    <span className="capitalize">{assignment.submission_type}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        icon={<Clock className="w-5 h-5" />}
        iconColor="violet"
        title="Recent Activity"
        subtitle="Your latest interactions and progress"
        action={<PillLink to="/assignments">View All</PillLink>}
      >
        {data?.recentActivity && data.recentActivity.length > 0 ? (
          <div className="space-y-1">
            {data.recentActivity.slice(0, 4).map((activity) => (
              <Link
                key={activity.id}
                to={getActivityLink(activity)}
                className="flex items-start gap-3 p-3 rounded-2xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
              >
                <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${activityIconClasses[activity.type]}`}>
                  {activity.type === "assignment" && <ListTodo className="w-5 h-5" />}
                  {activity.type === "submission" && <CheckCircle className="w-5 h-5" />}
                  {activity.type === "course" && <BookOpen className="w-5 h-5" />}
                  {activity.type === "quiz" && <CheckCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
                    {activity.title}
                  </p>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 line-clamp-1">
                    {activity.description}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-text-secondary-light dark:text-text-secondary-dark/60 pt-1">
                  {new Date(activity.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="mx-auto h-14 w-14 bg-surface-light dark:bg-surface-dark rounded-full flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 text-text-secondary-light dark:text-text-secondary-dark/60" />
            </div>
            <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              No recent activity yet
            </p>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 max-w-sm mx-auto mt-1">
              Activity will appear here as you interact with courses and assignments.
            </p>
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
};

export default InstructorDashboard;
