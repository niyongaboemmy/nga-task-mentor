import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Search, RefreshCw } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import api from "../../utils/axiosConfig";
import SubmissionsApiService, {
  type SubmissionListItem,
} from "../../services/submissionsApi";
import type { AssignmentInterface } from "../Assignments/AssignmentCard";
import SubmissionDetailsModal from "../Assignments/SubmissionDetailsModal";
import { getSubmissionStatusColor } from "../Assignments/AssignmentDetails";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "graded", label: "Graded" },
  { value: "late", label: "Late" },
  { value: "resubmitted", label: "Resubmitted" },
];

function formatDate(dateString?: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const Submissions: React.FC = () => {
  const { can } = usePermissions();
  const canViewAll = can("SUBMISSIONS_VIEW_ALL");
  const canGrade = can("SUBMISSIONS_GRADE");

  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionListItem | null>(null);
  const [selectedAssignment, setSelectedAssignment] =
    useState<AssignmentInterface | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingAssignmentId, setLoadingAssignmentId] = useState<
    string | null
  >(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await SubmissionsApiService.getSubmissions(
        statusFilter ? { status: statusFilter } : {},
      );
      setSubmissions(response.data || []);
    } catch (err) {
      console.error("Error fetching submissions:", err);
      setError("Failed to load submissions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const filteredSubmissions = useMemo(() => {
    if (!searchTerm) return submissions;
    const query = searchTerm.toLowerCase();
    return submissions.filter((s) => {
      const studentName =
        `${s.student?.first_name || ""} ${s.student?.last_name || ""}`.toLowerCase();
      const assignmentTitle = (s.assignment?.title || "").toLowerCase();
      return (
        studentName.includes(query) || assignmentTitle.includes(query)
      );
    });
  }, [submissions, searchTerm]);

  const openGradingModal = useCallback(
    async (submission: SubmissionListItem) => {
      if (!submission.assignment_id) return;
      setLoadingAssignmentId(submission.id);
      try {
        const response = await api.get(
          `/assignments/${submission.assignment_id}`,
        );
        const assignment = response.data.data || response.data;
        setSelectedAssignment(assignment);
        setSelectedSubmission(submission);
        setIsModalOpen(true);
      } catch (err) {
        console.error("Error fetching assignment:", err);
      } finally {
        setLoadingAssignmentId(null);
      }
    },
    [],
  );

  const handleGradeSubmission = useCallback(
    async (submissionId: string, score: number, feedback: string) => {
      await SubmissionsApiService.gradeSubmission(submissionId, {
        score,
        feedback,
      });
      setIsModalOpen(false);
      fetchSubmissions();
    },
    [fetchSubmissions],
  );

  return (
    <motion.div
      className="space-y-4 md:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm px-4 md:px-6 py-4 md:py-5"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <FileText className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                Submissions
              </h1>
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm mt-1">
                {canViewAll
                  ? "All student submissions across your courses"
                  : "Your submitted work"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark">
              {filteredSubmissions.length} submission
              {filteredSubmissions.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={fetchSubmissions}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark/50 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
          <input
            type="text"
            placeholder="Search by student or assignment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </motion.div>

      {/* List */}
      <motion.div
        variants={itemVariants}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-14 w-14 bg-surface-light dark:bg-surface-dark rounded-full flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-text-secondary-light dark:text-text-secondary-dark/60" />
            </div>
            <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              No submissions found
            </p>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 max-w-sm mx-auto mt-1">
              {searchTerm || statusFilter
                ? "Try adjusting your search or filters."
                : "Submissions will appear here once students submit their work."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-light dark:bg-surface-dark/50 text-text-secondary-light dark:text-text-secondary-dark font-medium">
                <tr>
                  {canViewAll && <th className="px-6 py-4">Student</th>}
                  <th className="px-6 py-4">Assignment</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4">Grade</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark/30">
                {filteredSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
                  >
                    {canViewAll && (
                      <td className="px-6 py-4">
                        <div className="font-medium text-text-primary-light dark:text-text-primary-dark">
                          {submission.student
                            ? `${submission.student.first_name} ${submission.student.last_name}`
                            : "—"}
                        </div>
                        <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                          {submission.student?.email}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-text-primary-light dark:text-text-primary-dark">
                      {submission.assignment?.title || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getSubmissionStatusColor(submission.status)}`}
                      >
                        {submission.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary-light dark:text-text-secondary-dark">
                      {formatDate(submission.submitted_at)}
                    </td>
                    <td className="px-6 py-4 text-text-primary-light dark:text-text-primary-dark">
                      {submission.grade || "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openGradingModal(submission)}
                        disabled={loadingAssignmentId === submission.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/25 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingAssignmentId === submission.id
                          ? "Loading..."
                          : canGrade
                            ? "Grade"
                            : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {selectedSubmission && selectedAssignment && (
        <SubmissionDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          submission={selectedSubmission}
          assignment={selectedAssignment}
          formatDate={formatDate}
          getSubmissionStatusColor={getSubmissionStatusColor}
          canManageAssignment={canGrade}
          onGradeSubmission={handleGradeSubmission}
        />
      )}
    </motion.div>
  );
};

export default Submissions;
