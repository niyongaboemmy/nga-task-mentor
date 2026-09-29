import React from "react";
import { toast } from "react-toastify";
import { getProfileImageUrl } from "../../utils/imageUrl";
import SubmissionMarking, {
  type SubmissionItemInterface,
} from "./SubmissionMarking";
import type { AssignmentInterface } from "./AssignmentCard";
import FilePreviewModal from "../Submissions/FilePreviewModal";
import ScoreRing from "../Common/ScoreRing";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Award,
  FileText,
  Download,
  Eye,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Star,
  Info,
  X,
  Send,
  Clock,
} from "lucide-react";
import axios from "../../utils/axiosConfig";

interface SubmissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: SubmissionItemInterface;
  formatDate: (dateString: string) => string;
  getSubmissionStatusColor: (status: string) => string;
  /** Creator or super admin of the assignment: shows the grading console. */
  canManageAssignment: boolean;
  /** Viewer can review but not grade (e.g. a co-teacher): explain why. */
  showGradingLockedNotice?: boolean;
  onGradeSubmission: (
    submissionId: string,
    score: number,
    feedback: string,
  ) => void;
  assignment: AssignmentInterface;
}

const safeParse = (data: any, fallback: any = []) => {
  if (!data) return fallback;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Error parsing JSON data:", e);
      return fallback;
    }
  }
  return data;
};

const SubmissionDetailsModal: React.FC<SubmissionDetailsModalProps> = ({
  isOpen,
  onClose,
  submission,
  assignment,
  formatDate,
  getSubmissionStatusColor,
  canManageAssignment,
  showGradingLockedNotice = false,
  onGradeSubmission,
}) => {
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<{
    url: string;
    name: string;
  } | null>(null);
  const [newComment, setNewComment] = React.useState("");
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [localComments, setLocalComments] = React.useState<any[]>(() =>
    safeParse(submission.comments, []),
  );
  const [showBreakdown, setShowBreakdown] = React.useState(true);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await axios.post(
        `/submissions/${submission.id}/comments`,
        {
          content: newComment,
        },
      );

      if (response.data.success) {
        setLocalComments(safeParse(response.data.data.comments || response.data.data, []));
        setNewComment("");
        toast.success("Comment added successfully");
      }
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error(error.response?.data?.message || "Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDownloadFile = async (fileName: string, filename: string) => {
    setIsDownloading(fileName);
    try {
      const response = await axios.get(
        `/submissions/${submission.id}/files/${fileName}`,
        {
          responseType: "blob",
        },
      );

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

  const rubric = React.useMemo(() => {
    if (!assignment.rubric) return [];
    if (typeof assignment.rubric === "string") {
      try {
        return JSON.parse(assignment.rubric);
      } catch (e) {
        return [];
      }
    }
    return assignment.rubric;
  }, [assignment.rubric]);

  const fileSubmissions = React.useMemo(() => {
    if (!submission.file_submissions) return [];
    if (typeof submission.file_submissions === "string") {
      try {
        return JSON.parse(submission.file_submissions);
      } catch (e) {
        console.error("Error parsing file_submissions:", e);
        return [];
      }
    }
    return submission.file_submissions;
  }, [submission.file_submissions]);

  // Escape closes the dialog (unless the file preview on top of it is open).
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !selectedFile) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, selectedFile]);

  if (!isOpen) return null;

  const fileKey = (file: any) => file.path?.split(/[/\\]/).pop() || file.filename;
  const subjectLabel = assignment.course
    ? [assignment.course.code, assignment.course.title].filter(Boolean).join(" · ")
    : null;
  const submittedBy = (submission as any).submittedByUser;
  const isGraded = !!submission.grade;
  const statusNote = isGraded
    ? "Graded"
    : submission.status === "draft"
      ? "Not submitted yet"
      : "Awaiting a grade";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-dialog-title"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-5xl max-h-[95vh] bg-white dark:bg-background-dark rounded-2xl shadow-2xl overflow-hidden border border-transparent dark:border-border-dark/60 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 sm:px-8 py-5 sm:py-6 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:border-b dark:border-border-dark/60 text-white relative">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              {submission.student.profile_image ? (
                <img
                  src={getProfileImageUrl(submission.student.profile_image) || undefined}
                  alt=""
                  className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl object-cover ring-2 ring-white/20"
                />
              ) : (
                <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 bg-white/15 dark:bg-blue-600 rounded-2xl flex items-center justify-center">
                  <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h2 id="submission-dialog-title" className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                  {submission.student.first_name} {submission.student.last_name}
                </h2>
                <p className="mt-0.5 text-sm text-blue-100 dark:text-slate-300 truncate">
                  {assignment.title}
                  {subjectLabel && <span className="text-blue-200/90 dark:text-slate-400"> · {subjectLabel}</span>}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {submission.submitted_at && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/15 text-white">
                      <Clock className="w-3 h-3" aria-hidden />
                      Submitted {formatDate(submission.submitted_at)}
                    </span>
                  )}
                  {submission.is_late && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400 text-amber-950">Late</span>
                  )}
                  {submittedBy && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/15 text-white">
                      Submitted by {submittedBy.first_name} {submittedBy.last_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close submission"
              className="p-2.5 shrink-0 bg-white/10 hover:bg-white/20 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-background-dark p-4 sm:p-8 sm:pt-6">
          <div className="w-full space-y-6">
            {/* Grade & status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="md:col-span-2 bg-white dark:bg-surface-dark rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-border-dark/60 flex items-center gap-6">
                <ScoreRing
                  value={submission.grade ? parseFloat(submission.grade.split("/")[0]) : null}
                  max={Number(assignment.max_score) || 0}
                  size={104}
                  strokeWidth={9}
                />
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wider">Grade</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-bold text-text-primary-light dark:text-text-primary-dark">
                      {submission.grade || "Not graded"}
                    </span>
                    {submission.grade && (
                      <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">points</span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-center items-center text-center gap-2 border ${getSubmissionStatusColor(submission.status)}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-current/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h5 className="text-lg font-bold capitalize">{submission.status}</h5>
                <p className="text-xs font-medium opacity-80">{statusNote}</p>
              </div>
            </div>

            {/* Rubric breakdown */}
            {submission.grade && rubric.length > 0 && (
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  aria-expanded={showBreakdown}
                  className="w-full px-5 sm:px-8 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-text-primary-light dark:text-text-primary-dark"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/15 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                      <Award className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-lg font-bold">Grade breakdown</h4>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Score per rubric criterion</p>
                    </div>
                  </div>
                  {showBreakdown ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                <AnimatePresence>
                  {showBreakdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-200 dark:border-border-dark/60"
                    >
                      <div className="p-5 sm:p-8 space-y-6">
                        {rubric.map((criterion: any, index: number) => {
                          const parsedRubricScores = safeParse(submission.rubric_scores, {});
                          const scoreValue = parsedRubricScores?.[index] || 0;
                          const ratio = criterion.max_score ? scoreValue / criterion.max_score : 0;
                          return (
                            <div key={index} className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden />
                                  <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                                    {criterion.criteria}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark tabular-nums">
                                  <span className="text-blue-600 dark:text-blue-300 text-sm font-bold mr-1">{scoreValue}</span>/ {criterion.max_score}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${ratio * 100}%` }}
                                  transition={{ duration: 1, delay: 0.2 + index * 0.1 }}
                                  className={`h-full rounded-full ${ratio > 0.8 ? "bg-green-500" : ratio > 0.5 ? "bg-blue-500" : "bg-orange-500"}`}
                                />
                              </div>
                              {criterion.description && (
                                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark ml-5 leading-relaxed">
                                  {criterion.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Submission materials */}
            <section className="space-y-4" aria-labelledby="materials-heading">
              <div className="flex items-center gap-4">
                <h3 id="materials-heading" className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
                  Submitted work
                </h3>
                <div className="h-px flex-1 bg-slate-200 dark:bg-border-dark/60" />
              </div>

              {fileSubmissions.length === 0 && !submission.text_submission && (
                <p className="rounded-2xl border border-dashed border-slate-300 dark:border-border-dark p-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Nothing was attached to this submission.
                </p>
              )}

              {fileSubmissions.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark/60 p-4 sm:p-6 space-y-3">
                  <h4 className="text-xs font-semibold flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark">
                    <Download className="w-3.5 h-3.5" /> Files ({fileSubmissions.length})
                  </h4>
                  <ul className="space-y-2">
                    {fileSubmissions.map((file: any, idx: number) => {
                      const key = fileKey(file);
                      const name = file.originalname || file.filename;
                      return (
                        <li
                          key={idx}
                          className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-border-dark/60 hover:border-blue-400/60 dark:hover:border-blue-500/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate text-text-primary-light dark:text-text-primary-dark">{name}</p>
                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedFile({ url: `${import.meta.env.VITE_API_BASE_URL || ""}/uploads/${key}`, name: file.originalname || key })
                              }
                              aria-label={`Preview ${name}`}
                              className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/15 dark:hover:text-blue-300 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(key, name)}
                              disabled={isDownloading === key}
                              aria-label={`Download ${name}`}
                              className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-500/15 dark:hover:text-green-300 transition-colors disabled:opacity-50"
                            >
                              {isDownloading === key ? (
                                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {submission.text_submission && (
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark/60 p-4 sm:p-6 space-y-3">
                  <h4 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">Written response</h4>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-text-primary-light dark:text-text-primary-dark">
                    {submission.text_submission}
                  </div>
                </div>
              )}

              {submission.feedback && (
                <div className="rounded-2xl p-4 sm:p-6 space-y-2 bg-blue-600 text-white dark:bg-blue-500/10 dark:text-blue-50 dark:border dark:border-blue-400/30">
                  <h4 className="text-xs font-semibold flex items-center gap-2 text-blue-100 dark:text-blue-300">
                    <Star className="w-3.5 h-3.5" /> Teacher's feedback
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{submission.feedback}</p>
                </div>
              )}
            </section>

            {/* Grading console (creator or super admin) */}
            {canManageAssignment && submission.status !== "draft" && submission.status !== undefined && (
              <section className="pt-4" aria-label="Grading">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
                    Grading
                  </h3>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-border-dark/60" />
                </div>
                <SubmissionMarking
                  submission={submission}
                  assignment={assignment}
                  onGradeSubmission={onGradeSubmission}
                  onSuccess={onClose}
                />
              </section>
            )}

            {!canManageAssignment && showGradingLockedNotice && (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-border-dark/60 dark:bg-surface-dark dark:text-slate-300">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <p>Only this assignment's creator or a super admin can grade submissions. You can review the work and add comments.</p>
              </div>
            )}

            {/* Comments */}
            <section className="space-y-4 pt-4" aria-labelledby="comments-heading">
              <div className="flex items-center gap-4">
                <h3 id="comments-heading" className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
                  Comments{localComments.length > 0 ? ` (${localComments.length})` : ""}
                </h3>
                <div className="h-px flex-1 bg-slate-200 dark:bg-border-dark/60" />
              </div>

              <div className="bg-white dark:bg-surface-dark rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-border-dark/60">
                <div className="max-h-[400px] overflow-y-auto px-2 sm:px-4 py-3 space-y-5" aria-live="polite">
                  {localComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                      <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-500" aria-hidden />
                      <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">No comments yet</p>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        Ask a question or leave a note about this submission.
                      </p>
                    </div>
                  ) : (
                    localComments.map((comment: any, idx: number) => (
                      <div key={idx} className={`flex ${comment.isInstructor ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] sm:max-w-[80%] ${comment.isInstructor ? "text-right" : "text-left"}`}>
                          <span
                            className={`text-xs font-semibold block mb-1 ${
                              comment.isInstructor ? "text-blue-600 dark:text-blue-300" : "text-text-secondary-light dark:text-text-secondary-dark"
                            }`}
                          >
                            {comment.isInstructor ? "Teacher" : "Student"} · {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                          <div
                            className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words text-left ${
                              comment.isInstructor
                                ? "bg-blue-600 text-white rounded-tr-md"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100 rounded-tl-md"
                            }`}
                          >
                            {comment.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex items-end gap-3 rounded-xl border border-slate-300 bg-slate-50 p-2 pl-3 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-border-dark dark:bg-slate-900/60 dark:focus-within:border-blue-400">
                  <label htmlFor="submission-comment" className="sr-only">
                    Write a comment
                  </label>
                  <textarea
                    id="submission-comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        if (!isSubmittingComment && newComment.trim()) handleAddComment();
                      }
                    }}
                    rows={1}
                    placeholder="Write a comment… (Enter to send, Shift+Enter for a new line)"
                    className="flex-1 min-h-[2.5rem] max-h-40 bg-transparent border-none focus:ring-0 focus:outline-none text-sm py-2 resize-y text-text-primary-light placeholder:text-slate-400 dark:text-text-primary-dark dark:placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={isSubmittingComment || !newComment.trim()}
                    onClick={handleAddComment}
                    aria-label="Send comment"
                    className="h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white transition-colors disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                  >
                    {isSubmittingComment ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-8 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-border-dark/60 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <Info className="w-3.5 h-3.5 shrink-0" /> Comments are visible to the student and their teachers.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 shrink-0 bg-slate-100 dark:bg-slate-700 text-text-primary-light dark:text-text-primary-dark rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>

      <FilePreviewModal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        fileUrl={selectedFile?.url || ""}
        fileName={selectedFile?.name || ""}
      />
    </div>
  );
};

export default SubmissionDetailsModal;
