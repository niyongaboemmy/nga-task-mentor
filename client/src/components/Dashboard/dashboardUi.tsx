import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

// Shared MIS-parity building blocks for the Instructor/Student/Admin
// dashboards — mirrors nga_central_mis/frontend's TeacherDashboard.tsx
// stat-card recipe (bg-card-light dark:bg-card-dark/30 rounded-2xl
// shadow-sm border, tinted icon badge) instead of TaskMentor's previous
// bespoke gradient/glow styling.

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
      className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 p-6 h-full"
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
}> = ({ icon, iconColor, title, subtitle, action, children }) => (
  <motion.div
    variants={dashboardItemVariants}
    className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 p-6"
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
    {children}
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
