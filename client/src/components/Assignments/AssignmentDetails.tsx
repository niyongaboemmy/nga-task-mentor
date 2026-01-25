import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import { fetchCourses } from "../../store/slices/courseSlice";
import api from "../../utils/axiosConfig";
import axiosLib from "axios";
import { useAuth } from "../../contexts/AuthContext";
import SubmissionModal from "./SubmissionModal";
import AssignmentHeader from "./AssignmentHeader";
import SubmissionList from "./SubmissionList";
import { toast } from "react-toastify";
import AssignmentForm from "./AssignmentForm";
import SubmissionDetailsModal from "./SubmissionDetailsModal";
import FilePreviewModal from "../Submissions/FilePreviewModal";
import { type SubmissionItemInterface } from "./SubmissionSummaryItem";
import { type RubricCriterion } from "./AssignmentCard";
import { Award, Target } from "lucide-react";
import {
  formatDateTimeLocal,
  parseLocalDateTimeToUTC,
  formatUTCToLocalDateTime,
} from "../../utils/dateUtils";

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

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: string;
  submission_type: string;
  allowed_file_types: string;
  rubric: RubricCriterion[] | string | null;
  course_id: string;
  created_by: string;
  attachments?: Attachment[];
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
  const dispatch = useDispatch<AppDispatch>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItemInterface[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "submissions">(
    "submissions",
  );
  const { user } = useAuth();
  const { courses } = useSelector(
    (state: RootState) => state.course || { courses: [] },
  );

  // Find course in redux if not provided by assignment object
  const reduxCourse = courses.find(
    (c) => c.id.toString() === assignment?.course_id.toString(),
  );

  const displayCourse =
    assignment?.course ||
    (reduxCourse
      ? {
          id: reduxCourse.id.toString(),
          code: reduxCourse.code,
          title: reduxCourse.title,
        }
      : undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionItemInterface | null>(null);

  // Add new file state
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // Update editFormData to include attachments
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    due_date: string;
    max_score: string;
    submission_type: string;
    allowed_file_types: string;
    rubric: RubricCriterion[] | string;
    status: string;
    attachments?: Attachment[];
  }>({
    title: "",
    description: "",
    due_date: "",
    max_score: "",
    submission_type: "both",
    allowed_file_types: "",
    rubric: [],
    status: "draft",
    attachments: [],
  });
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const parsedRubric = React.useMemo(() => {
    if (!assignment?.rubric) return [];
    if (typeof assignment.rubric === "string") {
      try {
        return JSON.parse(assignment.rubric) as RubricCriterion[];
      } catch (e) {
        return [];
      }
    }
    return assignment.rubric as RubricCriterion[];
  }, [assignment?.rubric]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (index: number) => {
    setEditFormData((prev) => ({
      ...prev,
      attachments: prev.attachments
        ? prev.attachments.filter((_, i) => i !== index)
        : [],
    }));
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeLocal(dateString);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;
    try {
      const utcDueDate = parseLocalDateTimeToUTC(editFormData.due_date);
      // Format as YYYY-MM-DDTHH:mm string for backend validation
      const formattedDate = utcDueDate.toISOString().slice(0, 16);

      const formData = new FormData();
      formData.append("title", editFormData.title);
      formData.append("description", editFormData.description);
      formData.append("due_date", formattedDate);
      formData.append("max_score", editFormData.max_score);
      formData.append("submission_type", editFormData.submission_type);
      const allowedFileTypesArray = Array.isArray(
        editFormData.allowed_file_types,
      )
        ? editFormData.allowed_file_types
        : editFormData.allowed_file_types
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t !== "");
      formData.append(
        "allowed_file_types",
        JSON.stringify(allowedFileTypesArray),
      );
      formData.append("rubric", JSON.stringify(editFormData.rubric));
      formData.append("status", editFormData.status);

      // Add existing attachments
      if (editFormData.attachments) {
        formData.append(
          "existing_attachments",
          JSON.stringify(editFormData.attachments),
        );
      }

      // Add new files
      if (newFiles.length > 0) {
        newFiles.forEach((file) => {
          formData.append("attachments", file);
        });
      }

      const response = await api.put(`/assignments/${assignment.id}`, formData);
      setAssignment(response.data.data);
      toast.success("Assignment updated successfully!");
      setIsEditing(false);
      fetchAssignment();
      setNewFiles([]);
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      toast.error(
        error.response?.data?.message || "Failed to update assignment",
      );
    }
  };

  const fetchAssignment = useCallback(async () => {
    try {
      const response = await api.get(`/assignments/${assignmentId}`);
      const data = response.data.data || response.data;
      setAssignment(data);
      // Initialize edit form data
      setEditFormData({
        title: data.title,
        description: data.description,
        due_date: data.due_date ? formatUTCToLocalDateTime(data.due_date) : "",
        max_score: data.max_score.toString(),
        submission_type: data.submission_type,
        allowed_file_types: Array.isArray(data.allowed_file_types)
          ? data.allowed_file_types.join(", ")
          : data.allowed_file_types || "",
        rubric: data.rubric || "",
        status: data.status || "draft",
        attachments: data.attachments || [],
      });
    } catch (error) {
      console.error("Error fetching assignment:", error);
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await api.get(
        `/assignments/${assignmentId}/submissions`,
      );
      setSubmissions(response.data.data || response.data);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      if (axiosLib.isAxiosError(error) && error.response?.status === 403) {
        setSubmissions([]);
      } else {
        setSubmissions([]);
      }
    }
  }, [assignmentId]);

  const userSubmission = () =>
    submissions?.find(
      (submission) => submission.student?.id.toString() === user?.id.toString(),
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

  const handleStatusChange = useCallback(
    async (
      assignmentId: string,
      status: "draft" | "published" | "completed" | "removed",
    ) => {
      try {
        await api.patch(`/assignments/${assignmentId}/status`, {
          status,
        });
        toast.success("Assignment status updated successfully!");
        fetchAssignment();
      } catch (error: any) {
        console.error("Error updating assignment status:", error);
        toast.error(
          error.response?.data?.message || "Failed to update assignment status",
        );
      }
    },
    [fetchAssignment],
  );

  const handleGradeSubmission = useCallback(
    async (
      submissionId: string,
      score: number,
      feedback: string,
      rubricScores?: Record<number, number>,
    ) => {
      try {
        await api.patch(`/submissions/${submissionId}/grade`, {
          score,
          maxScore: parseInt(assignment!.max_score),
          feedback,
          rubricScores,
        });
        await fetchSubmissions();
      } catch (error) {
        console.error("Error grading submission:", error);
        throw error;
      }
    },
    [assignment, fetchSubmissions],
  );

  useEffect(() => {
    fetchAssignment();
    fetchSubmissions();
    if (courses.length === 0) {
      dispatch(fetchCourses());
    }
  }, [
    assignmentId,
    fetchAssignment,
    fetchSubmissions,
    dispatch,
    courses.length,
  ]);

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
            assignment={{
              ...assignment,
              course: displayCourse,
            }}
            formatDate={formatDate}
            isOverdue={isOverdue}
            canManageAssignment={canManageAssignment}
            onStatusChange={handleStatusChange}
          />

          {/* Attachments Section */}
          {assignment?.attachments && assignment.attachments.length > 0 && (
            <div className="px-6 pb-6 pt-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Attachments
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {assignment.attachments.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      const baseUrl =
                        import.meta.env.VITE_API_BASE_URL ||
                        "http://localhost:5001";
                      const fullUrl = file.url.startsWith("http")
                        ? file.url
                        : `${baseUrl}${file.url.startsWith("/") ? "" : "/"}${file.url}`;
                      setPreviewFile({ url: fullUrl, name: file.name });
                    }}
                    className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3 group-hover:scale-110 transition-transform">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {file.size ? (file.size / 1024 / 1024).toFixed(2) : 0}{" "}
                        MB
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clean Tab Navigation */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-white dark:border-gray-800 overflow-hidden">
          <div className="border-b mt-1 border-gray-200 dark:border-gray-800">
            <nav className="flex space-x-1 px-6">
              <button
                onClick={() => setActiveTab("submissions")}
                className={`py-3 px-6 border-b-2 rounded-t-2xl font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === "submissions"
                    ? "border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <svg
                  className="h-5 w-5"
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
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  {submissions.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("details")}
                className={`py-3 px-6 border-b-2 rounded-t-2xl font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === "details"
                    ? "border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Details</span>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {activeTab === "submissions" ? (
                <motion.div
                  key="submissions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
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
                </motion.div>
              ) : (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8"
                >
                  <div className="prose prose-blue dark:prose-invert max-w-none">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Assignment Description
                    </h3>
                    <div
                      className="text-gray-700 dark:text-gray-300 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: assignment.description,
                      }}
                    />
                  </div>

                  {parsedRubric.length > 0 && (
                    <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Grading Rubric
                          </h3>
                          <p className="text-xs text-gray-500 font-medium">
                            Evaluation criteria for this assignment
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        {parsedRubric.map((criterion, idx) => (
                          <div
                            key={idx}
                            className="group bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="mt-1 w-8 h-8 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                  <Target className="w-4 h-4" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                    {criterion.criteria}
                                  </h4>
                                  {criterion.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">
                                      {criterion.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 rounded-xl text-center min-w-[70px]">
                                <span className="text-xs font-black text-blue-700 dark:text-blue-400">
                                  {criterion.max_score} pts
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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
          onClose={() => {
            setIsEditing(false);
            setNewFiles([]);
          }}
          editFormData={editFormData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          newFiles={newFiles}
          onFileChange={handleFileChange}
          onRemoveNewFile={handleRemoveNewFile}
          onRemoveExistingAttachment={handleRemoveExistingAttachment}
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

        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          fileUrl={previewFile?.url || ""}
          fileName={previewFile?.name || ""}
        />
      </div>
    </div>
  );
};

export default React.memo(AssignmentDetails);
