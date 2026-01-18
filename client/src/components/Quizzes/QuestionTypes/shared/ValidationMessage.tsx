import React from "react";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

interface ValidationMessageProps {
  type: "error" | "success" | "info" | "warning";
  message: string;
  className?: string;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  type,
  message,
  className = "",
}) => {
  const styles = {
    error: {
      bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-300",
      icon: AlertCircle,
    },
    success: {
      bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      text: "text-green-700 dark:text-green-300",
      icon: CheckCircle,
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
      text: "text-blue-700 dark:text-blue-300",
      icon: Info,
    },
    warning: {
      bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
      text: "text-yellow-700 dark:text-yellow-300",
      icon: AlertCircle,
    },
  };

  const config = styles[type];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg border ${config.bg} ${className} animate-fadeIn`}
      role="alert"
    >
      <Icon className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
      <p className={`text-sm font-medium ${config.text}`}>{message}</p>
    </div>
  );
};
