import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import SubmissionModal from "./SubmissionModal";
import AssignmentHeader from "./AssignmentHeader";
import SubmissionList from "./SubmissionList";
import AssignmentForm from "./AssignmentForm";
import SubmissionDetailsModal from "./SubmissionDetailsModal";
import { type SubmissionItemInterface } from "./SubmissionSummaryItem";

export const getSubmissionStatusColor = (status: string) => {
  switch (status) {
    case "submitted":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
    case "graded":
      return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
    case "pending":
      return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
};

interface Assignment {
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
    code: string;
    title: string;
  };
  submissions: SubmissionItemInterface[];
  status?: "draft" | "published";
}

const AssignmentDetails = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItemInterface[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "submissions">(
    "submissions"
  );
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionItemInterface | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    max_score: "",
    submission_type: "both",
    allowed_file_types: "",
    rubric: "",
    status: "draft",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;
    try {
      const response = await axios.put(
        `/api/assignments/${assignment.id}`,
        editFormData
      );
      setAssignment(response.data.data);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating assignment:", error);
    }
  };

  const userSubmission = () =>
    submissions?.find(
      (submission) => submission.student?.id.toString() === user?.id.toString()
    );

  const isStudent = user?.role === "student";
  const dueDate = assignment ? new Date(assignment.due_date) : null;
  const isOverdue = dueDate
    ? (() => {
        const nowUTC = Date.now();
        const dueUTC = dueDate.getTime();
        return dueUTC < nowUTC;
      })()
    : false;

  const canSubmit = isStudent && !userSubmission() && !!user && !isOverdue;
  const canManageAssignment =
    user?.role === "instructor" || user?.role === "admin";

  const fetchAssignment = useCallback(async () => {
    try {
      const response = await axios.get(`/api/assignments/${assignmentId}`);
      setAssignment(response.data.data || response.data);
    } catch (error) {
      console.error("Error fetching assignment:", error);
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await axios.get(
        `/api/assignments/${assignmentId}/submissions`
      );
      setSubmissions(response.data.data || response.data);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        setSubmissions([]);
      } else {
        setSubmissions([]);
      }
    }
  }, [assignmentId]);

  const handleStatusChange = useCallback(
    async (
      assignmentId: string,
      status: "draft" | "published" | "completed" | "removed"
    ) => {
      try {
        await axios.patch(`/api/assignments/${assignmentId}/status`, {
          status,
        });
        fetchAssignment();
      } catch (error) {
        console.error("Error updating assignment status:", error);
      }
    },
    [fetchAssignment]
  );

  const handleGradeSubmission = useCallback(
    async (submissionId: string, score: number, feedback: string) => {
      try {
        await axios.patch(`/api/submissions/${submissionId}/grade`, {
          score,
          maxScore: parseInt(assignment!.max_score),
          feedback,
        });
        await fetchSubmissions();
      } catch (error) {
        console.error("Error grading submission:", error);
        throw error;
      }
    },
    [assignment, fetchSubmissions]
  );

  useEffect(() => {
    fetchAssignment();
    fetchSubmissions();
  }, [assignmentId, fetchAssignment, fetchSubmissions]);

  // Modern Loading State
  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-gray-600 dark:border-t-gray-400 rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Loading Assignment
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Please wait while we fetch the assignment details...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modern Error State
  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
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
                Assignment Not Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The assignment you're looking for doesn't exist or has been
                removed.
              </p>
              <Link
                to="/courses"
                className="inline-flex items-center px-6 py-3 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-medium rounded-full transition-colors"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="space-y-4 pb-10">
        {/* Clean Header */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-white dark:border-gray-800 overflow-hidden">
          <AssignmentHeader
            assignment={assignment}
            formatDate={formatDate}
            isOverdue={isOverdue}
            canManageAssignment={canManageAssignment}
            onStatusChange={handleStatusChange}
          />
        </div>

        {/* Clean Tab Navigation */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-white dark:border-gray-800 overflow-hidden">
          <div className="border-b mt-1 border-gray-200 dark:border-gray-800">
            <nav className="flex space-x-0 px-6">
              <button
                onClick={() => setActiveTab("submissions")}
                className={`py-3 px-6 border-b-2 rounded-t-2xl font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === "submissions"
                    ? "border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <svg
                  className="h-5 w-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Submissions</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activeTab === "submissions"
                      ? "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {submissions.length}
                </span>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "submissions" && (
              <SubmissionList
                submissions={submissions}
                assignment={{
                  id: assignment.id,
                  title: assignment.title,
                  due_date: assignment.due_date,
                  max_score: assignment.max_score,
                  submission_type: assignment.submission_type,
                  status: assignment.status,
                }}
                canSubmit={canSubmit}
                canManageAssignment={canManageAssignment}
                isOverdue={isOverdue}
                isStudent={isStudent}
                userSubmission={userSubmission}
                formatDate={formatDate}
                getSubmissionStatusColor={getSubmissionStatusColor}
                onViewDetails={(submission) => {
                  setSelectedSubmission(submission);
                  setIsDetailsModalOpen(true);
                }}
                onOpenSubmissionModal={() => setIsModalOpen(true)}
              />
            )}
          </div>
        </div>

        {/* Modals */}
        <SubmissionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          assignment={{
            id: assignment.id,
            title: assignment.title,
            submission_type: assignment.submission_type,
            max_score: parseInt(assignment.max_score),
            due_date: assignment.due_date,
            status: assignment.status,
          }}
          onSubmissionSuccess={() => {
            fetchAssignment();
            fetchSubmissions();
          }}
          existingSubmission={userSubmission}
        />

        <AssignmentForm
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          editFormData={editFormData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
        />

        {selectedSubmission && (
          <SubmissionDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            submission={selectedSubmission}
            assignment={assignment}
            formatDate={formatDate}
            getSubmissionStatusColor={getSubmissionStatusColor}
            canManageAssignment={canManageAssignment}
            onGradeSubmission={handleGradeSubmission}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(AssignmentDetails);
