import React from "react";
import { Link } from "react-router-dom";
import AssignmentStatusToggle from "./AssignmentStatusToggle";

interface AssignmentHeaderProps {
  assignment: {
    id: string;
    title: string;
    description: string;
    due_date: string;
    max_score: string;
    submission_type: string;
    course_id: string;
    course?: {
      id: string;
      code: string;
      title: string;
    };
    status?: "draft" | "published";
  };
  formatDate: (dateString: string) => string;
  isOverdue: boolean;
  canManageAssignment: boolean;
  onStatusChange: (
    assignmentId: string,
    status: "draft" | "published" | "completed" | "removed"
  ) => void;
}

const AssignmentHeader: React.FC<AssignmentHeaderProps> = ({
  assignment,
  isOverdue,
  canManageAssignment,
  onStatusChange,
}) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "published":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
      case "completed":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      case "removed":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      case "draft":
        return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getSubmissionTypeIcon = (type: string) => {
    switch (type) {
      case "file":
        return {
          icon: (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ),
          color:
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
        };
      case "text":
        return {
          icon: (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          ),
          color:
            "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
        };
      default:
        return {
          icon: (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ),
          color:
            "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
        };
    }
  };

  const submissionTypeInfo = getSubmissionTypeIcon(assignment.submission_type);

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3">
        {/* Assignment Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-row items-center gap-2 w-full justify-between">
            {/* Breadcrumb & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <Link
                to={`/courses/${assignment.course_id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="truncate">
                  {assignment.course?.code || "Unknown Course"}
                </span>
              </Link>

              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-600">•</span>
                <div
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(
                    assignment.status
                  )}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
                  <span className="capitalize">
                    {assignment.status || "Draft"}
                  </span>
                </div>
              </div>
            </div>

            {/* Management Actions */}
            {canManageAssignment && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:flex-shrink-0">
                <div className="w-full sm:w-auto">
                  <AssignmentStatusToggle
                    assignmentId={assignment.id}
                    currentStatus={assignment.status || "draft"}
                    onStatusChange={onStatusChange}
                    canManage={canManageAssignment}
                    variant="select"
                    size="md"
                  />
                </div>

                <Link
                  to={`/assignments/${assignment.id}/edit`}
                  className="inline-flex items-center text-sm px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white dark:text-white font-medium rounded-full transition-colors w-full sm:w-auto justify-center"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <span>Edit Assignment</span>
                </Link>
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white mb-4 leading-tight">
            {assignment.title}
          </h1>

          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Due Date */}
            <div
              className={`bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border ${
                isOverdue
                  ? "border-gray-300 dark:border-gray-600/30"
                  : "border-gray-200 dark:border-gray-700/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    isOverdue
                      ? "bg-gray-200 dark:bg-gray-700"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <svg
                    className={`w-5 h-5 ${
                      isOverdue
                        ? "text-gray-600 dark:text-gray-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1 w-full">
                  <p
                    className={`text-xs font-medium uppercase tracking-wide ${
                      isOverdue
                        ? "text-gray-700 dark:text-gray-400"
                        : "text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    Due Date
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      isOverdue
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {new Date(assignment.due_date).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Points */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-600 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-400 uppercase tracking-wide">
                    Points
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {assignment.max_score} points
                  </p>
                </div>
              </div>
            </div>

            {/* Submission Type */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-600">
                  {submissionTypeInfo.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-400 uppercase tracking-wide">
                    Submission
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {assignment.submission_type}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-gray-800/60 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
            <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
              <div
                className="assignment-description leading-relaxed text-gray-700 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: assignment.description }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentHeader;
