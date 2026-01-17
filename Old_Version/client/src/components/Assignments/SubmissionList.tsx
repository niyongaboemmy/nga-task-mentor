import React from "react";
import SubmissionSummaryItem, {
  type SubmissionItemInterface,
} from "./SubmissionSummaryItem";

interface SubmissionListProps {
  submissions: SubmissionItemInterface[];
  assignment: {
    id: string;
    title: string;
    due_date: string;
    max_score: string;
    submission_type: string;
    status?: "draft" | "published";
  };
  canSubmit: boolean;
  canManageAssignment: boolean;
  isOverdue: boolean;
  isStudent: boolean;
  userSubmission: () => SubmissionItemInterface | undefined;
  formatDate: (dateString: string) => string;
  getSubmissionStatusColor: (status: string) => string;
  onViewDetails: (submission: SubmissionItemInterface) => void;
  onOpenSubmissionModal: () => void;
}

const SubmissionList: React.FC<SubmissionListProps> = ({
  submissions,
  assignment,
  canSubmit,
  canManageAssignment,
  isOverdue,
  isStudent,
  userSubmission,
  formatDate,
  getSubmissionStatusColor,
  onViewDetails,
  onOpenSubmissionModal,
}) => {
  // Calculate submission statistics
  const gradedCount = submissions.filter((s) => s.status === "graded").length;
  const submittedCount = submissions.filter(
    (s) => s.status === "submitted"
  ).length;
  // Count pending submissions: both actual pending submissions and placeholder non-submitters
  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Submission Statistics Dashboard - Only for Instructors */}
      {canManageAssignment && submissions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-700">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 dark:bg-green-800 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Graded
                </p>
                <p className="text-2xl font-semibold text-green-900 dark:text-green-100">
                  {gradedCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-800 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Submitted
                </p>
                <p className="text-2xl font-semibold text-blue-900 dark:text-blue-100">
                  {submittedCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-400">
                  Pending
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {pendingCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student-specific messages */}
      {isStudent && (
        <>
          {/* User's own submission status */}
          {userSubmission() && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-700">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 bg-green-100 dark:bg-green-800 rounded-2xl flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                      Your Assignment Submitted
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Submitted: {formatDate(userSubmission()!.submitted_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {userSubmission()!.grade && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-2xl border border-green-300 dark:border-green-600">
                      <svg
                        className="w-4 h-4 text-green-600 dark:text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Grade: {userSubmission()!.grade} points
                      </span>
                    </div>
                  )}

                  {/* View Details Button for Students */}
                  <button
                    onClick={() => onViewDetails(userSubmission()!)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 hover:bg-green-100 dark:hover:bg-green-800 rounded-full transition-colors border border-green-300 dark:border-green-600 hover:border-green-400 dark:hover:border-green-500"
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
                </div>
              </div>
            </div>
          )}

          {/* Overdue message */}
          {!canSubmit && !userSubmission() && isOverdue && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-700">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-orange-100 dark:bg-orange-800 rounded-2xl flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-orange-600 dark:text-orange-400"
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
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                      Assignment Overdue
                    </h3>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Due date: {formatDate(assignment.due_date)} • Submissions
                      no longer accepted
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* First submission CTA for students */}
      {canSubmit && submissions.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-700">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-800 rounded-2xl flex items-center justify-center">
              <svg
                className="w-10 h-10 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div className="max-w-md">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Ready to Submit?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Be the first to submit your assignment and set the standard for
                your classmates!
              </p>
              <button
                onClick={onOpenSubmissionModal}
                className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-full transition-colors"
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
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Submit Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Submissions Grid - Only for Instructors */}
      {canManageAssignment && submissions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              All Submissions ({submissions.length})
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              <span>Click any submission for details</span>
            </div>
          </div>

          <div className="space-y-3">
            {submissions.map((submission) => (
              <SubmissionSummaryItem
                key={submission.id}
                submission={submission}
                assignment={{
                  max_score: parseInt(assignment.max_score),
                  status: assignment.status,
                }}
                formatDate={formatDate}
                getSubmissionStatusColor={getSubmissionStatusColor}
                onViewDetails={() => onViewDetails(submission)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Empty state for instructors/non-students when no submissions */}
      {!canSubmit && submissions.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-12 border border-gray-200 dark:border-gray-800">
          <div className="flex flex-col items-center gap-6 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
              <svg
                className="w-10 h-10 text-gray-500 dark:text-gray-400"
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
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Submissions Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Student submissions will appear here once they submit their
                assignments.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionList;
