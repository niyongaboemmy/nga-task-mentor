import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ListTodo, CheckCircle, BookOpen, Clock } from "lucide-react";

// Shared MIS-parity building blocks for the Instructor/Student/Admin
// dashboards — mirrors nga_central_mis/frontend's TeacherDashboard.tsx
// stat-card recipe (bg-card-light dark:bg-card-dark/30 rounded-2xl
// shadow-sm, tinted icon badge) instead of TaskMentor's previous
// bespoke gradient/glow styling. Deliberately shadow-only (no border) —
// a border on top of shadow-sm double-outlines the card.

// eslint-disable-next-line react-refresh/only-export-components
export const STAT_COLORS = {
  blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
  red: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
  purple: "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  indigo: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
} as const;

export type StatColor = keyof typeof STAT_COLORS;

// eslint-disable-next-line react-refresh/only-export-components
export const dashboardItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

// eslint-disable-next-line react-refresh/only-export-components
export const dashboardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

export const StatCard: React.FC<{
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: StatColor;
  to?: string;
}> = ({ icon, value, label, color, to }) => {
  const inner = (
    <motion.div
      variants={dashboardItemVariants}
      className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 h-full"
    >
      <div className="flex items-center">
        <div className={`p-2 rounded-2xl ${STAT_COLORS[color]}`}>{icon}</div>
        <div className="ml-4">
          <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark/70">
            {label}
          </p>
          <p className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {value}
          </p>
        </div>
      </div>
    </motion.div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
};

export const SectionCard: React.FC<{
  icon: React.ReactNode;
  iconColor: StatColor;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Override the default body padding/spacing — e.g. "" when the child renders its own table with padded cells. */
  bodyClassName?: string;
}> = ({ icon, iconColor, title, subtitle, action, children, bodyClassName }) => (
  <motion.div
    variants={dashboardItemVariants}
    className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm overflow-hidden"
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 pb-0">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${STAT_COLORS[iconColor]}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            {title}
          </h3>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            {subtitle}
          </p>
        </div>
      </div>
      {action}
    </div>
    <div className={bodyClassName ?? "p-6"}>{children}</div>
  </motion.div>
);

export const PillLink: React.FC<{
  to: string;
  children: React.ReactNode;
  variant?: "neutral" | "amber" | "red" | "blue";
  icon?: React.ReactNode;
}> = ({ to, children, variant = "neutral", icon }) => {
  const variantClasses = {
    neutral:
      "bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-700",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40",
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40",
  };
  return (
    <Link
      to={to}
      className={`px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-1.5 ${variantClasses[variant]}`}
    >
      {icon}
      {children}
    </Link>
  );
};

// Instructor/Student dashboards share an identical "Recent Activity"
// feed shape — type, icon map, link resolution, row markup, and empty
// state were previously copy-pasted verbatim in both files.

export type ActivityType = "assignment" | "submission" | "course" | "quiz";

export interface RecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  resource_id?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const activityIconClasses: Record<ActivityType, string> = {
  assignment: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  submission: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  quiz: "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  course: "bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
};

// eslint-disable-next-line react-refresh/only-export-components
export function getActivityLink(activity: RecentActivity): string {
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

const activityTypeIcon: Record<ActivityType, React.ReactNode> = {
  assignment: <ListTodo className="w-5 h-5" />,
  submission: <CheckCircle className="w-5 h-5" />,
  course: <BookOpen className="w-5 h-5" />,
  quiz: <CheckCircle className="w-5 h-5" />,
};

export const ActivityRow: React.FC<{ activity: RecentActivity }> = ({ activity }) => (
  <Link
    to={getActivityLink(activity)}
    className="flex items-start gap-3 p-3 rounded-2xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
  >
    <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${activityIconClasses[activity.type]}`}>
      {activityTypeIcon[activity.type]}
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
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="text-center py-10">
    <div className="mx-auto h-14 w-14 bg-surface-light dark:bg-surface-dark rounded-full flex items-center justify-center mb-3">
      {icon}
    </div>
    <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{title}</p>
    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 max-w-sm mx-auto mt-1">
      {description}
    </p>
  </div>
);
