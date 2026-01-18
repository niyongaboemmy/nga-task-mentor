import React from "react";
import { toast } from "react-toastify";
import { getProfileImageUrl } from "../../utils/imageUrl";
import SubmissionMarking, {
  type SubmissionItemInterface,
} from "./SubmissionMarking";
import type { AssignmentInterface } from "./AssignmentCard";
import FilePreviewModal from "../Submissions/FilePreviewModal";
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
  Plus,
  ChevronRight,
} from "lucide-react";
import axios from "../../utils/axiosConfig";

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
    feedback: string,
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
  const [selectedFile, setSelectedFile] = React.useState<{
    url: string;
    name: string;
  } | null>(null);
  const [newComment, setNewComment] = React.useState("");
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [localComments, setLocalComments] = React.useState<any[]>(
    submission.comments || [],
  );
  const [showBreakdown, setShowBreakdown] = React.useState(true);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await axios.post(
        `/api/submissions/${submission.id}/comments`,
        {
          content: newComment,
        },
      );

      if (response.data.success) {
        setLocalComments(response.data.data.comments);
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
        `/api/submissions/${submission.id}/files/${fileName}`,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-5xl max-h-[95vh] bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden dark:border dark:border-gray-800 flex flex-col"
      >
        {/* Premium Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <FileText className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-5">
              {submission.student.profile_image ? (
                <img
                  src={
                    getProfileImageUrl(submission.student.profile_image) ||
                    undefined
                  }
                  alt={submission.student.first_name}
                  className="h-14 w-14 rounded-2xl object-cover shadow-lg transform -rotate-3 ring-2 ring-white/20"
                />
              ) : (
                <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                  <FileText className="w-7 h-7 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  {submission.student.first_name}'s Submission
                </h2>
                <div className="flex items-center gap-2 mt-1 opacity-70">
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {assignment.title}
                  </span>
                  <div className="w-1 h-1 bg-white rounded-full" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {assignment.course_id || "CS101"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all hover:rotate-90"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 p-8 pt-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Grade Highlight & Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none flex items-center gap-6">
                <div className="h-24 w-24 rounded-full border-[6px] border-blue-500/20 flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full border-[6px] border-blue-600 border-t-transparent animate-[spin_3s_linear_infinite]" />
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {submission.grade
                      ? Math.round(
                          (parseFloat(submission.grade.split("/")[0]) /
                            (Number(assignment.max_score) || 1)) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">
                    Final Assessment
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-gray-900 dark:text-white">
                      {submission.grade || "Ungraded"}
                    </span>
                    {submission.grade && (
                      <span className="text-sm font-bold text-gray-400 uppercase tracking-tighter">
                        Points
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`rounded-[2rem] p-8 flex flex-col justify-center items-center text-center gap-2 border shadow-lg ${getSubmissionStatusColor(submission.status)}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-current/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h5 className="text-lg font-black uppercase tracking-tight">
                  {submission.status}
                </h5>
                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
                  Marked by Instructor
                </p>
              </div>
            </div>

            {/* Rubric Breakdown for Student */}
            {submission.grade && rubric.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl shadow-gray-200/30">
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Award className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                        Grade Breakdown
                      </h4>
                      <p className="text-xs text-gray-500 font-medium">
                        Evaluation based on specific criteria
                      </p>
                    </div>
                  </div>
                  {showBreakdown ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                <AnimatePresence>
                  {showBreakdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100 dark:border-gray-800"
                    >
                      <div className="p-8 space-y-6">
                        {rubric.map((criterion: any, index: number) => {
                          const scoreValue =
                            submission.rubric_scores?.[index] || 0;
                          const ratio = scoreValue / criterion.max_score;

                          return (
                            <div key={index} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {criterion.criteria}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-gray-500">
                                  <span className="text-blue-600 dark:text-blue-400 text-sm font-black mr-1">
                                    {scoreValue}
                                  </span>
                                  / {criterion.max_score}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${ratio * 100}%` }}
                                  transition={{
                                    duration: 1,
                                    delay: 0.2 + index * 0.1,
                                  }}
                                  className={`h-full rounded-full ${ratio > 0.8 ? "bg-green-500" : ratio > 0.5 ? "bg-blue-500" : "bg-orange-500"}`}
                                />
                              </div>
                              {criterion.description && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 ml-5 italic leading-relaxed">
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

            {/* Content Display: Files & Text */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <h6 className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em]">
                  Submission Materials
                </h6>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* File List */}
                {submission.file_submissions && (
                  <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-gray-400">
                      <Download className="w-3 h-3" /> Sent Files
                    </h4>
                    <div className="space-y-3">
                      {JSON.parse(
                        submission.file_submissions as unknown as string,
                      ).map((file: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 group hover:border-blue-500/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate dark:text-white">
                              {file.originalname || file.filename}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const fileName =
                                  file.path.split(/[\/\\]/).pop() ||
                                  file.filename;
                                setSelectedFile({
                                  url: `${import.meta.env.VITE_API_BASE_URL || ""}/uploads/${fileName}`,
                                  name: file.originalname || fileName,
                                });
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDownloadFile(
                                  file.path.split(/[\/\\]/).pop() ||
                                    file.filename,
                                  file.originalname || file.filename,
                                )
                              }
                              disabled={
                                isDownloading ===
                                (file.path.split(/[\/\\]/).pop() ||
                                  file.filename)
                              }
                              className="p-2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                            >
                              {isDownloading ===
                              (file.path.split(/[\/\\]/).pop() ||
                                file.filename) ? (
                                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructor Feedback */}
                {submission.feedback && (
                  <div className="bg-blue-600 rounded-3xl p-6 text-white space-y-4 shadow-xl shadow-blue-600/20">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-blue-100">
                      <Star className="w-3 h-3" /> Instructor Notes
                    </h4>
                    <p className="text-sm font-medium leading-relaxed opacity-90 italic">
                      "{submission.feedback}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary: Text Submission Full */}
            {submission.text_submission && (
              <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Written Response
                </h4>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {submission.text_submission}
                </div>
              </div>
            )}

            {/* Grading System (For Instructor) */}
            {canManageAssignment && submission.status !== "draft" && (
              <div className="relative pt-12">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-12 w-px bg-gradient-to-t from-gray-200 to-transparent dark:from-gray-800" />
                  <div className="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-500">
                    Grading Console
                  </div>
                </div>
                <SubmissionMarking
                  submission={submission}
                  assignment={assignment}
                  onGradeSubmission={onGradeSubmission}
                />
              </div>
            )}

            {/* Real-time Threaded Comments */}
            <div className="space-y-6 pt-12">
              <div className="flex items-center gap-4">
                <h6 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
                  Conversation Thread
                </h6>
                <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-800" />
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="max-h-[400px] overflow-y-auto px-6 py-4 space-y-6">
                  {localComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-30">
                      <MessageSquare className="w-12 h-12" />
                      <p className="text-sm font-bold italic uppercase tracking-widest">
                        Digital Void
                      </p>
                    </div>
                  ) : (
                    localComments.map((comment: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex ${comment.isInstructor ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] space-y-1 ${comment.isInstructor ? "items-end text-right" : "items-start text-left"}`}
                        >
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${comment.isInstructor ? "text-blue-500" : "text-gray-400"}`}
                          >
                            {comment.isInstructor ? "Instructor" : "Student"} •{" "}
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                          <div
                            className={`px-5 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                              comment.isInstructor
                                ? "bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-500/20"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-tl-none"
                            }`}
                          >
                            {comment.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] mt-4 flex items-center gap-4 border border-gray-200 dark:border-gray-700">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type a premium message..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 dark:text-white resize-none h-10 scrollbar-hide"
                  />
                  <button
                    disabled={isSubmittingComment || !newComment.trim()}
                    onClick={handleAddComment}
                    className="h-10 w-10 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 shadow-xl hover:scale-110 active:scale-90 transition-all disabled:opacity-20"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-12 py-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            <Info className="w-3 h-3" /> Encrypted Session
          </div>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all"
          >
            Exit Console
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
