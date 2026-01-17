import React from "react";
import axios from "axios";
import { getProfileImageUrl } from "../../utils/imageUrl";
import SubmissionDetailsModal from "./SubmissionDetailsModal";
import { toast } from "react-toastify";
import type { AssignmentInterface } from "./AssignmentCard";
import FilePreviewModal from "../Submissions/FilePreviewModal";

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
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_image?: string;
  };
}

interface SubmissionListItemProps {
  submission: SubmissionItemInterface;
  assignment: AssignmentInterface;
  currentUser?: {
    id: string;
    role: string;
  };
  canManageAssignment: boolean;
  onGradeSubmission: (
    submissionId: string,
    score: number,
    feedback: string,
  ) => void;
  onDeleteSuccess: () => void;
  canRemove: boolean;
  formatDate: (dateString: string) => string;
  getSubmissionStatusColor: (status: string) => string;
}

const SubmissionListItem: React.FC<SubmissionListItemProps> = ({
  submission,
  assignment,
  currentUser,
  canManageAssignment,
  onGradeSubmission,
  onDeleteSuccess,
  canRemove,
  formatDate,
  getSubmissionStatusColor,
}) => {
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<{
    url: string;
    name: string;
  } | null>(null);

  const handleDeleteSubmission = async () => {
    if (!submission) return;

    // Check if assignment is published before allowing deletion
    if (assignment.status !== "published") {
      toast.error(
        "Cannot remove submission. Assignment is no longer accepting submissions.",
      );
      return;
    }

    setIsDeleting(true);
    try {
      await axios.delete(`/api/submissions/${submission.id}`);
      onDeleteSuccess();
      toast.success("Submission removed successfully!");
    } catch (error: any) {
      console.error("Error deleting submission:", error);
      toast.error(
        error.response?.data?.message || "Failed to remove submission.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadFile = async (fileName: string, filename: string) => {
    // Extract filename from path (fileName parameter is actually the full path)
    const extractedFileName =
      fileName.split("/").pop() || fileName.split("\\").pop() || fileName;

    setIsDownloading(extractedFileName);
    try {
      const response = await axios.get(
        `/api/submissions/${submission.id}/files/${extractedFileName}`,
        {
          responseType: "blob",
        },
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

  // Check if this is the current user's submission (for remove functionality)
  const isOwnSubmission =
    currentUser &&
    submission.student?.id?.toString() === currentUser.id.toString();

  return (
    <>
      <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-800/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {submission.student?.profile_image ? (
                <img
                  src={
                    getProfileImageUrl(submission.student.profile_image) || ""
                  }
                  alt={`${submission.student.first_name} ${submission.student.last_name}`}
                  className="h-11 w-11 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div className="h-11 w-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {submission.student?.first_name?.[0] || "?"}
                    {submission.student?.last_name?.[0] || "?"}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                {submission.student
                  ? `${submission.student.first_name} ${submission.student.last_name}`
                  : "Unknown Student"}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {submission.student?.email || "No email available"}
              </p>
            </div>
          </div>
          <div
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border-2 ${getSubmissionStatusColor(
              submission.status,
            )}`}
          >
            <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
            {submission.status}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mb-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400"
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
            <span className="text-gray-600 dark:text-gray-400">
              Submitted:{" "}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatDate(submission.submitted_at)}
            </span>
          </div>
          {submission.grade !== undefined && (
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-400"
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
              <span className="text-gray-600 dark:text-gray-400">Score: </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {submission.grade}/{assignment.max_score} points
              </span>
            </div>
          )}
        </div>

        {submission.feedback && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
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
              <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Instructor Feedback
              </h5>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {submission.feedback}
            </p>
          </div>
        )}

        {submission.file_submissions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400"
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Files ({submission.file_submissions.length})
                </span>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(true)}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 bg-blue-50 dark:hover:text-blue-300 px-4 py-2 rounded-full hover:bg-blue-100/60 dark:bg-blue-800/20 dark:hover:bg-blue-800/60 transition-colors"
              >
                <svg
                  className="h-4 w-4 mr-1"
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
                View Details
              </button>
            </div>
            <div className="space-y-2">
              {(
                JSON.parse(
                  submission.file_submissions as unknown as string,
                ) as {
                  path: string;
                  size: number;
                  filename: string;
                  mimetype: string;
                  originalname: string;
                }[]
              ).map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg">
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {file.originalname || file.filename}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024).toFixed(2)} KB • {file.mimetype}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const fileName =
                          file.path.split("/").pop() ||
                          file.path.split("\\").pop() ||
                          file.filename;
                        const url = `${
                          import.meta.env.VITE_API_BASE_URL ||
                          "https://tm.universalbridge.rw"
                        }/uploads/${fileName}`;
                        setSelectedFile({
                          url,
                          name: file.originalname || fileName,
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                        const fileName =
                          file.path.split("/").pop() ||
                          file.path.split("\\").pop() ||
                          file.filename;
                        handleDownloadFile(
                          fileName,
                          file.originalname || fileName,
                        );
                      }}
                      disabled={
                        isDownloading ===
                        (file.path.split("/").pop() ||
                          file.path.split("\\").pop() ||
                          file.filename)
                      }
                      className="px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isDownloading ===
                      (file.path.split("/").pop() ||
                        file.path.split("\\").pop() ||
                        file.filename)
                        ? "..."
                        : "Download"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Remove Submission Button - only for own submissions */}
        {isOwnSubmission && canRemove && assignment.status === "published" && (
          <div className="mt-2">
            <div className="flex items-center justify-center">
              <button
                onClick={() => {
                  toast.info(
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-orange-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                        <span className="font-medium dark:text-white">
                          Remove Submission
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Are you sure you want to remove your submission? This
                        action cannot be undone.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            toast.dismiss();
                            handleDeleteSubmission();
                          }}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-full transition-colors"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => toast.dismiss()}
                          className="px-3 py-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-full transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>,
                    {
                      autoClose: false,
                      closeOnClick: false,
                      closeButton: false,
                      draggable: false,
                      position: "top-center",
                      className:
                        "border border-red-200 dark:border-red-800 rounded-2xl dark:bg-gray-900",
                    },
                  );
                }}
                disabled={isDeleting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-full transition-colors disabled:opacity-50 border border-red-200 dark:border-red-800"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span className="dark:text-white">
                  {isDeleting ? "Removing..." : "Remove Submission"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submission Details Modal */}
      <SubmissionDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        submission={submission}
        assignment={assignment}
        formatDate={formatDate}
        getSubmissionStatusColor={getSubmissionStatusColor}
        canManageAssignment={canManageAssignment}
        onGradeSubmission={onGradeSubmission}
      />

      <FilePreviewModal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        fileUrl={selectedFile?.url || ""}
        fileName={selectedFile?.name || ""}
      />
    </>
  );
};

export default SubmissionListItem;
