import React from "react";
import { getProfileImageUrl } from "../../utils/imageUrl";

export interface SubmissionItemInterface {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  text_submission: string;
  file_submissions: {
    path: string;
    size: number;
    filename: string;
    mimetype: string;
    originalname: string;
  }[];
  grade: string | null;
  feedback: string | null;
  resubmissions: any[];
  is_late: boolean;
  comments: any[];
  rubric_scores?: any;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_image?: string;
  };
  submittedByUser?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface SubmissionSummaryItemProps {
  submission: SubmissionItemInterface;
  assignment: {
    max_score: number;
    title?: string;
    status?: string;
  };
  formatDate: (dateString: string) => string;
  getSubmissionStatusColor: (status: string) => string;
  onViewDetails?: () => void; // Callback to open details modal
}

const SubmissionSummaryItem: React.FC<SubmissionSummaryItemProps> = ({
  submission,
  formatDate,
  getSubmissionStatusColor,
  onViewDetails,
}) => {
  // Check if this is a placeholder submission (student who hasn't submitted)
  const isPlaceholder = !submission.id || (submission as any)._isPlaceholder;

  return (
    <div className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 pr-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Student Info Section */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Profile Avatar */}
          <div className="flex-shrink-0">
            {submission.student?.profile_image ? (
              <div className="relative">
                <img
                  src={
                    getProfileImageUrl(submission.student.profile_image) || ""
                  }
                  alt={`${submission.student.first_name} ${submission.student.last_name}`}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover border border-gray-200 dark:border-gray-600 group-hover:border-gray-300 dark:group-hover:border-gray-500 transition-colors"
                />
                {submission.grade && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-gray-600 group-hover:border-gray-300 dark:group-hover:border-gray-500 transition-colors">
                <span className="text-text-secondary-light dark:text-text-secondary-dark font-semibold text-lg">
                  {submission.student?.first_name?.[0] || "?"}
                </span>
                <span className="text-text-secondary-light dark:text-text-secondary-dark font-semibold text-lg ml-0.5">
                  {submission.student?.last_name?.[0] || ""}
                </span>
                {submission.grade && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Student Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-text-primary-light dark:text-text-primary-dark text-base sm:text-base group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                  {submission.student
                    ? `${submission.student.first_name} ${submission.student.last_name}`
                    : "Unknown Student"}
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate">
                  {submission.student?.email || "No email available"}
                </p>
                {submission.submittedByUser && (
                  <div className="flex items-center gap-1 mt-1">
                    <svg className="w-3 h-3 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                      Submitted by {submission.submittedByUser.first_name} {submission.submittedByUser.last_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Submission Meta */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
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
                  <span>
                    {isPlaceholder
                      ? "Not submitted"
                      : submission.submitted_at
                        ? formatDate(submission.submitted_at)
                        : "No submission date"}
                  </span>
                </div>

                {submission.is_late && (
                  <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Late</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="flex flex-row items-center justify-between lg:justify-end gap-3 lg:gap-4">
          {/* Grade Badge */}
          {submission.grade &&
            submission.grade !== null &&
            submission.grade !== "" && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium border border-green-200 dark:border-green-700">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span>{submission.grade} pts</span>
              </div>
            )}

          {/* Status Badge */}
          <div
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getSubmissionStatusColor(
              submission.status,
            )}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-2"></span>
            <span className="capitalize">{submission.status}</span>
          </div>

          {/* View Details Button */}
          {onViewDetails && !isPlaceholder && (
            <button
              onClick={onViewDetails}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
            >
              <svg
                className="h-4 w-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
              <span className="hidden sm:inline">View Details</span>
              <span className="sm:hidden">Details</span>
            </button>
          )}

          {/* Grade button for placeholder (not submitted) students */}
          {isPlaceholder && onViewDetails && (
            <button
              onClick={onViewDetails}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors border border-amber-200 dark:border-amber-700"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Grade Student
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionSummaryItem;
