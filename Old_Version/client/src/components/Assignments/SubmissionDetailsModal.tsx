import React from "react";
import axios from "axios";
import { toast } from "react-toastify";
import SubmissionMarking, {
  type SubmissionItemInterface,
} from "./SubmissionMarking";
import type { AssignmentInterface } from "./AssignmentCard";

interface SubmissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: SubmissionItemInterface;
  formatDate: (dateString: string) => string;
  getSubmissionStatusColor: (status: string) => string;
  canManageAssignment: boolean;
  onGradeSubmission: (
    submissionId: string,
    score: number,
    feedback: string
  ) => void;
  assignment: AssignmentInterface;
}

const SubmissionDetailsModal: React.FC<SubmissionDetailsModalProps> = ({
  isOpen,
  onClose,
  submission,
  assignment,
  getSubmissionStatusColor,
  canManageAssignment,
  onGradeSubmission,
}) => {
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);

  const handleDownloadFile = async (fileName: string, filename: string) => {
    setIsDownloading(fileName);
    try {
      const response = await axios.get(
        `/api/submissions/${submission.id}/files/${fileName}`,
        {
          responseType: "blob",
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast.error(error.response?.data?.message || "Failed to download file.");
    } finally {
      setIsDownloading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300 dark:border dark:border-gray-800">
        {/* Modern Compact Header */}
        <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-sm">
                <svg
                  className="w-5 h-5 text-white"
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
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  Submission Details
                </h2>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  {assignment.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-105"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Compact Content */}
        <div
          className="px-5 py-4 overflow-y-auto"
          style={{ maxHeight: "calc(90vh - 120px)" }}
        >
          {/* Student Info - Compact */}
          <div className="mb-4">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4 border border-gray-200/30 dark:border-gray-700/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  {submission.student.profile_image ? (
                    <div className="relative">
                      <img
                        src={`${
                          import.meta.env.VITE_API_BASE_URL ||
                          "https://tm.universalbridge.rw"
                        }/uploads/profile-pictures/${
                          submission.student.profile_image
                        }`}
                        alt={`${submission.student.first_name} ${submission.student.last_name}`}
                        className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white dark:ring-gray-800 shadow-sm"
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-800 ${getSubmissionStatusColor(
                          submission.status
                        )}`}
                      >
                        <span className="w-1 h-1 rounded-full bg-current block mx-auto mt-0.5"></span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-11 w-11 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center ring-2 ring-white dark:ring-gray-800 shadow-sm">
                      <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">
                        {submission.student.first_name?.[0] || "?"}
                        {submission.student.last_name?.[0] || ""}
                      </span>
                      <div
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-800 ${getSubmissionStatusColor(
                          submission.status
                        )}`}
                      >
                        <span className="w-1 h-1 rounded-full bg-current block mx-auto mt-0.5"></span>
                      </div>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {submission.student.first_name}{" "}
                      {submission.student.last_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {submission.student.email}
                    </p>
                  </div>
                </div>

                <div
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${getSubmissionStatusColor(
                    submission.status
                  )}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-2"></span>
                  <span className="capitalize">{submission.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grade & Status - Compact Grid */}
          <div className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {submission.grade &&
                submission.grade !== null &&
                submission.grade !== "" && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-3 border border-green-200/50 dark:border-green-800/50">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
                        <svg
                          className="w-4 h-4 text-white"
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
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                          Score
                        </p>
                        <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                          {submission.grade} points
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {submission.is_late && (
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-2xl p-3 border border-orange-200/50 dark:border-orange-800/50">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                      <svg
                        className="w-4 h-4 text-white"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                        Status
                      </p>
                      <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                        Late Submission
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content Sections - Compact */}
          <div className="space-y-4">
            {/* Text Submission */}
            {submission.text_submission && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/40 dark:border-gray-700/40 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-7 w-7 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center shadow-sm">
                    <svg
                      className="w-4 h-4 text-white"
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
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Text Submission
                  </h4>
                </div>
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                  {submission.text_submission}
                </div>
              </div>
            )}

            {/* File Submissions */}
            {submission.file_submissions &&
              submission.file_submissions.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/40 dark:border-gray-700/40 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-7 w-7 bg-gradient-to-br from-blue-400 to-blue-700 rounded-xl flex items-center justify-center shadow-sm">
                      <svg
                        className="w-4 h-4 text-white"
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
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Files (
                      {
                        JSON.parse(
                          submission.file_submissions as unknown as string
                        ).length
                      }
                      )
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {JSON.parse(
                      submission.file_submissions as unknown as string
                    ).map((file: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-xl p-3 border border-gray-200/50 dark:border-gray-600/50"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-7 w-7 bg-white dark:bg-gray-600 rounded-xl flex items-center justify-center border border-gray-200/50 dark:border-gray-500/50 shadow-sm">
                            <svg
                              className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400"
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
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {file.originalname || file.filename}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(file.size / 1024).toFixed(1)} KB •{" "}
                              {file.mimetype}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            onClick={() => {
                              const fileName =
                                file.path.split("/").pop() ||
                                file.path.split("\\").pop() ||
                                file.filename;
                              window.open(
                                `${
                                  import.meta.env.VITE_API_BASE_URL ||
                                  "https://tm.universalbridge.rw"
                                }/uploads/${fileName}`,
                                "_blank"
                              );
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => {
                              const fileName =
                                file.path.split("/").pop() ||
                                file.path.split("\\").pop() ||
                                file.filename;
                              handleDownloadFile(
                                fileName,
                                file.originalname || fileName
                              );
                            }}
                            disabled={
                              isDownloading ===
                              (file.path.split("/").pop() ||
                                file.path.split("\\").pop() ||
                                file.filename)
                            }
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent"
                          >
                            {isDownloading ===
                            (file.path.split("/").pop() ||
                              file.path.split("\\").pop() ||
                              file.filename) ? (
                              <svg
                                className="w-4 h-4 animate-spin"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            ) : (
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
                                  d="M12 10v6m0 0l4-4m-4 4l-4-4m8 2h6a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h8z"
                                />
                              </svg>
                            )}
                            <span>
                              {isDownloading ===
                              (file.path.split("/").pop() ||
                                file.path.split("\\").pop() ||
                                file.filename)
                                ? "Downloading..."
                                : "Download"}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Instructor Feedback */}
            {submission.feedback && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-7 w-7 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Instructor Feedback
                  </h4>
                </div>
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 border border-blue-100/50 dark:border-blue-800/50">
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
                    {submission.feedback}
                  </p>
                </div>
              </div>
            )}

            {/* Grading Interface */}
            {canManageAssignment &&
              submission.status === "submitted" &&
              (!submission.grade ||
                submission.grade === null ||
                submission.grade === "") && (
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-4 border border-amber-200/50 dark:border-amber-800/50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-7 w-7 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-sm">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Ready to Grade
                    </h4>
                  </div>
                  <SubmissionMarking
                    submission={submission}
                    assignment={assignment}
                    onGradeSubmission={onGradeSubmission}
                  />
                </div>
              )}
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionDetailsModal;
