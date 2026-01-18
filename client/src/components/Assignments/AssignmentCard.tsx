import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AssignmentStatusToggle from "./AssignmentStatusToggle";
import { Clock, Calendar, Timer } from "lucide-react";
import { formatDateTimeLocal } from "../../utils/dateUtils";
import { getProfileImageUrl } from "../../utils/imageUrl";

export interface AssignmentInterface {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: string;
  submission_type: string;
  allowed_file_types: string;
  rubric: string;
  course_id: string;
  created_by: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  course?: {
    id: string;
    title: string;
    code: string;
  };
  submissions: any[];
  isPublished?: boolean;
  status?: "draft" | "published" | "completed" | "removed";
}

interface AssignmentCardProps {
  assignment: AssignmentInterface;
  showSubmissions?: boolean;
  compact?: boolean;
  canManage?: boolean;
  onStatusChange?: (
    assignmentId: string,
    status: "draft" | "published" | "completed" | "removed",
  ) => void;
}

// Smart countdown component for user's local timezone
const LiveCountdown: React.FC<{ dueDate: string; isOverdue: boolean }> = ({
  dueDate,
  isOverdue,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalHours: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, totalHours: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      const due = new Date(dueDate);
      const now = new Date();
      const diff = due.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalHours: 0,
        });
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = totalSeconds % 60;
      const totalHours = Math.floor(diff / (1000 * 60 * 60));

      setTimeRemaining({ days, hours, minutes, seconds, totalHours });
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [dueDate]);

  if (isOverdue) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full">
        <Timer className="h-3 w-3 text-red-600 dark:text-red-400" />
        <span className="text-xs font-medium text-red-700 dark:text-red-300">
          Overdue
        </span>
      </div>
    );
  }

  const { days, hours, minutes, seconds, totalHours } = timeRemaining;

  // Determine urgency and styling
  const getUrgencyStyles = () => {
    if (totalHours <= 24) {
      return {
        bg: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-200 dark:border-red-800",
        text: "text-red-700 dark:text-red-300",
        icon: "text-red-600 dark:text-red-400",
        pulse: totalHours <= 6, // Pulse for very urgent (6 hours or less)
      };
    } else if (totalHours <= 48) {
      return {
        bg: "bg-orange-50 dark:bg-orange-900/20",
        border: "border-orange-200 dark:border-orange-800",
        text: "text-orange-700 dark:text-orange-300",
        icon: "text-orange-600 dark:text-orange-400",
        pulse: false,
      };
    } else {
      return {
        bg: "bg-blue-50 dark:bg-blue-900/20",
        border: "border-blue-200 dark:border-blue-800",
        text: "text-blue-700 dark:text-blue-300",
        icon: "text-blue-600 dark:text-blue-400",
        pulse: false,
      };
    }
  };

  const styles = getUrgencyStyles();

  // Format the display text
  const formatDisplay = () => {
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 border rounded-full transition-all duration-300 ${
        styles.bg
      } ${styles.border} ${styles.pulse ? "animate-pulse" : ""}`}
    >
      <Clock className={`h-3 w-3 ${styles.icon}`} />
      <span className={`text-xs font-medium ${styles.text}`}>
        {formatDisplay()}
      </span>
      <span className={`text-xs opacity-70 ${styles.text}`}>left</span>
    </div>
  );
};

const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  showSubmissions = true,
  compact = false,
  canManage = false,
  onStatusChange,
}) => {
  const formatDate = (dateString: string) => {
    return formatDateTimeLocal(dateString);
  };

  const getSubmissionTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "file":
        return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      case "text":
        return "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800";
      case "link":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800";
      default:
        return "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-700";
    }
  };

  const [currentStatus, setCurrentStatus] = useState<
    "draft" | "published" | "completed" | "removed"
  >(assignment.status || "draft");

  const handleStatusChange = async (
    assignmentId: string,
    newStatus: "draft" | "published" | "completed" | "removed",
  ) => {
    if (onStatusChange) {
      await onStatusChange(assignmentId, newStatus);
    }
    setCurrentStatus(newStatus);
  };

  const isOverdue = (() => {
    const due = new Date(assignment.due_date);
    const nowUTC = Date.now();
    const dueUTC = due.getTime();
    return dueUTC < nowUTC;
  })();
  const submissionCount = assignment.submissions?.length || 0;

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/70 hover:shadow-md transition-all duration-200 ${
        compact ? "p-3 sm:p-4 md:p-5" : "p-4 sm:p-5 md:p-6"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0 w-full">
          {/* Header row with title and status - Enhanced mobile layout */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-1 sm:mb-1">
            <div className="flex-1 min-w-0">
              <h3
                className={`font-semibold text-gray-900 dark:text-white truncate pr-2 mb-1 sm:mb-2 ${
                  compact ? "text-sm sm:text-base" : "text-base sm:text-lg"
                }`}
              >
                {assignment.title}
              </h3>
              {assignment.course && (
                <div className="text-xs opacity-65 mb-2 sm:mb-3">
                  {assignment.course.code}: {assignment.course.title}
                </div>
              )}
            </div>

            <div className="flex flex-row items-start sm:items-end gap-2 sm:gap-2 self-start sm:self-auto">
              {/* Status toggle - Enhanced mobile sizing */}
              <AssignmentStatusToggle
                assignmentId={assignment.id}
                currentStatus={currentStatus}
                onStatusChange={handleStatusChange}
                canManage={canManage}
                variant="select"
                size={compact ? "sm" : "sm"}
              />

              {/* Details button - Touch-friendly sizing */}
              <Link
                to={`/assignments/${assignment.id}`}
                className="inline-flex items-center gap-1 sm:gap-1 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 dark:bg-blue-900 dark:text-white dark:hover:bg-blue-900 min-h-[32px] sm:min-h-[36px] touch-manipulation"
                title="View assignment details and submissions"
              >
                <svg
                  className="w-3 sm:w-3.5 sm:h-3.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span className="xs:hidden">View</span>
                <span className="hidden xs:inline sm:inline">Details</span>
              </Link>
            </div>
          </div>

          {/* Enhanced info row with responsive layout */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span
                className={`truncate ${
                  isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""
                }`}
              >
                {formatDate(assignment.due_date)}
              </span>
            </div>

            {/* Live countdown - Responsive sizing */}
            <div className="min-w-0 flex-shrink-0">
              <LiveCountdown
                dueDate={assignment.due_date}
                isOverdue={isOverdue}
              />
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
              <svg
                className="h-3 w-3 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="truncate">{assignment.max_score} pts</span>
            </div>

            <div
              className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium border ${getSubmissionTypeColor(
                assignment.submission_type,
              )} min-w-0`}
            >
              <span className="truncate">{assignment.submission_type}</span>
            </div>
          </div>

          {/* Responsive submissions preview */}
          {showSubmissions && submissionCount > 0 && (
            <div className="flex items-center justify-between text-xs px-1 sm:px-0">
              <span className="text-gray-500 dark:text-gray-400 truncate">
                {submissionCount} submission{submissionCount !== 1 ? "s" : ""}
              </span>
              {assignment.submissions && assignment.submissions.length > 0 && (
                <div className="flex -space-x-1 ml-2 flex-shrink-0">
                  {assignment.submissions
                    .slice(0, 3)
                    .map((submission, index) => (
                      <div
                        key={submission.id}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                        style={{
                          zIndex: 10 - index,
                          marginLeft: index > 0 ? "-4px" : "0",
                        }}
                      >
                        {submission.user?.profile_image ? (
                          <img
                            src={
                              getProfileImageUrl(
                                submission.user.profile_image,
                              ) || ""
                            }
                            alt={`${submission.user.first_name} ${submission.user.last_name}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs">
                            {submission.user?.first_name?.charAt(0)}
                          </span>
                        )}
                      </div>
                    ))}
                  {submissionCount > 3 && (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-bold ml-1">
                      +{submissionCount - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentCard;
