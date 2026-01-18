import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "react-toastify";
import { formatDateTimeLocal } from "../../utils/dateUtils";
import { type RubricCriterion } from "./AssignmentCard";
import { Award, ChevronDown, ChevronUp, Target } from "lucide-react";
import FileDropzone from "../Common/FileDropzone";

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: {
    id: string;
    title: string;
    submission_type: string;
    max_score: number;
    due_date: string;
    status?: string;
    rubric?: RubricCriterion[] | string | null;
  };
  onSubmissionSuccess: () => void;
  existingSubmission?: any;
}

const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSubmissionSuccess,
  existingSubmission,
}) => {
  const [submissionText, setSubmissionText] = useState(
    existingSubmission?.text_submission || "",
  );
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubmissionText(existingSubmission?.text_submission || "");
      setSubmissionFile(null);
    }
  }, [isOpen, existingSubmission]);

  const [showRubric, setShowRubric] = useState(false);

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

  const handleSubmitAssignment = async () => {
    // Validate that at least one submission method is provided
    if (!submissionText.trim() && !submissionFile) {
      toast.error("Please provide either text submission or file submission.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();

      // Only append if there's actual content
      if (submissionText.trim()) {
        formData.append("text_submission", submissionText.trim());
      }

      if (submissionFile) {
        formData.append("file_submission", submissionFile);
      }

      // Debug logging
      console.log("Submitting assignment with:", {
        hasText: !!submissionText.trim(),
        hasFile: !!submissionFile,
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => [
          key,
          value instanceof File ? `File: ${value.name}` : value,
        ]),
      });

      await axios.post(`/api/assignments/${assignment.id}/submit`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Refresh data
      onSubmissionSuccess();

      // Reset form
      setSubmissionText("");
      setSubmissionFile(null);
      onClose();

      toast.success("Assignment submitted successfully!");
    } catch (error: any) {
      console.error("Error submitting assignment:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to submit assignment. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeLocal(new Date(dateString), {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm -top-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-y-auto max-h-[99vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {existingSubmission
                      ? "Update Submission"
                      : "Submit Assignment"}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {assignment.title}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

            {/* Content */}
            <div className="px-6 py-6">
              {/* Assignment Info */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Assignment Details
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      assignment.submission_type === "both"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        : assignment.submission_type === "file"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    }`}
                  >
                    {assignment.submission_type === "both"
                      ? "📁 + ✍️"
                      : assignment.submission_type === "file"
                        ? "📁"
                        : "✍️"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-blue-700 dark:text-blue-300">
                  <span>Due: {formatDate(assignment.due_date)}</span>
                  <span>•</span>
                  <span>{assignment.max_score} points</span>
                </div>
              </div>

              {/* Rubric Section */}
              {parsedRubric.length > 0 && (
                <div className="mb-6 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-gray-800/30">
                  <button
                    onClick={() => setShowRubric(!showRubric)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Award className="w-5 h-5 text-indigo-500" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        Grading Rubric ({parsedRubric.length} Criteria)
                      </span>
                    </div>
                    {showRubric ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <AnimatePresence>
                    {showRubric && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <div className="p-4 space-y-3">
                          {parsedRubric.map((criterion, idx) => (
                            <div
                              key={idx}
                              className="bg-white dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex gap-2">
                                  <Target className="w-4 h-4 text-gray-400 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                      {criterion.criteria}
                                    </p>
                                    {criterion.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {criterion.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg shrink-0">
                                  {criterion.max_score} pts
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Submission Form */}
              <div className="space-y-6">
                {/* Text Submission */}
                {(assignment.submission_type === "text" ||
                  assignment.submission_type === "both") && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Submission
                    </label>
                    <textarea
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                      placeholder="Enter your submission here..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white resize-y transition-colors min-h-[200px]"
                    />
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {submissionText.length}/2000 characters
                    </div>
                  </div>
                )}

                {/* File Submission */}
                {(assignment.submission_type === "file" ||
                  assignment.submission_type === "both") && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      File Submission
                    </label>
                    <FileDropzone
                      onFilesSelected={(files: File[]) =>
                        setSubmissionFile(files[0] || null)
                      }
                      maxFiles={1}
                      existingFiles={submissionFile ? [submissionFile] : []}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div></div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitAssignment}
                    disabled={
                      isSubmitting ||
                      (!submissionText.trim() && !submissionFile)
                    }
                    className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded-full transition-colors"
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : existingSubmission
                        ? "Update Submission"
                        : "Submit Assignment"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SubmissionModal;
