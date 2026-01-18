import React from "react";
import { toast } from "react-toastify";
import type { AssignmentInterface } from "./AssignmentCard";
import { motion } from "framer-motion";
import { CheckCircle2, MessageSquare, Star, Award, Zap } from "lucide-react";

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
  rubric_scores?: Record<number, number> | null;
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

interface SubmissionMarkingProps {
  submission: SubmissionItemInterface;
  assignment: AssignmentInterface;
  onGradeSubmission: (
    submissionId: string,
    score: number,
    feedback: string,
    rubricScores?: Record<number, number>,
  ) => void;
}

const SubmissionMarking: React.FC<SubmissionMarkingProps> = ({
  submission,
  assignment,
  onGradeSubmission,
}) => {
  const [rubricScores, setRubricScores] = React.useState<
    Record<number, number>
  >(submission.rubric_scores || {});
  const [feedback, setFeedback] = React.useState<string>(
    submission.feedback || "",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeCriterion, setActiveCriterion] = React.useState<number | null>(
    0,
  );

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

  const [score, setScore] = React.useState<string>(() => {
    if (!submission.grade) return "";
    const parts = submission.grade.toString().split("/");
    return parts[0] || "";
  });

  // Calculate total from rubric
  React.useEffect(() => {
    if (rubric.length > 0) {
      const total = Object.values(rubricScores).reduce(
        (acc, curr) => acc + curr,
        0,
      );
      setScore(total.toString());
    }
  }, [rubricScores, rubric.length]);

  const handleRubricScoreChange = (index: number, value: number) => {
    setRubricScores((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!score || isNaN(Number(score))) {
      toast.error("Please enter a valid score.");
      return;
    }
    const numScore = Number(score);
    if (numScore < 0 || numScore > Number(assignment.max_score)) {
      toast.error(`Score must be between 0 and ${assignment.max_score}.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await onGradeSubmission(submission.id, numScore, feedback, rubricScores);
      toast.success(
        submission.grade ? "Assessment updated!" : "Assessment finalized!",
      );
    } catch (error: any) {
      toast.error("Failed to save grade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGraded = !!submission.grade;

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Grade Header / Dial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex items-center gap-6 p-8 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors duration-700" />

          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="12"
                className="text-gray-100 dark:text-gray-800"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="56"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={2 * Math.PI * 56}
                initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                animate={{
                  strokeDashoffset:
                    2 *
                    Math.PI *
                    56 *
                    (1 -
                      (parseFloat(score) || 0) /
                        (Number(assignment.max_score) || 100)),
                }}
                transition={{ duration: 1, ease: "easeOut" }}
                strokeLinecap="round"
                className="text-blue-600 dark:text-blue-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {Math.round(
                  ((parseFloat(score) || 0) /
                    (Number(assignment.max_score) || 1)) *
                    100,
                )}
                %
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
              <Award className="w-3 h-3" />
              Comprehensive Grade
            </h4>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-gray-900 dark:text-white tabular-nums">
                {score || 0}
              </span>
              <span className="text-xl font-bold text-gray-400 dark:text-gray-600 uppercase tracking-tighter">
                / {assignment.max_score} Pts
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-xl shadow-blue-500/20 relative overflow-hidden">
          <Zap className="absolute top-4 right-4 w-24 h-24 text-white/10" />
          <div className="relative">
            <h5 className="text-lg font-bold mb-1 italic opacity-90">
              Submission Insights
            </h5>
            <p className="text-xs text-blue-100/70 mb-4 uppercase tracking-wider font-bold">
              Based on {rubric.length} Criteria
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Performance</span>
                <span>
                  {((percentage) =>
                    percentage > 80
                      ? "Excellent"
                      : percentage > 60
                        ? "Good"
                        : "Needs Work")(
                    ((parseFloat(score) || 0) /
                      (Number(assignment.max_score) || 1)) *
                      100,
                  )}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white"
                  animate={{
                    width: `${((parseFloat(score) || 0) / (Number(assignment.max_score) || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-100/50">
            <CheckCircle2 className="w-3 h-3" />
            Real-time Calibration Active
          </div>
        </div>
      </div>

      {/* Interactive Rubric Section */}
      {rubric && rubric.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h6 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
              Criterion Breakdown
            </h6>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-800" />
          </div>

          <div className="space-y-4">
            {rubric.map((criterion: any, index: number) => {
              const currentScore = rubricScores[index] || 0;
              const isActive = activeCriterion === index;

              return (
                <motion.div
                  key={index}
                  onClick={() => setActiveCriterion(index)}
                  className={`relative p-6 rounded-3xl border transition-all cursor-pointer group ${
                    isActive
                      ? "bg-white dark:bg-gray-800 border-blue-500/50 shadow-2xl shadow-blue-500/10 ring-1 ring-blue-500/20 scale-[1.01]"
                      : "bg-gray-50/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-colors ${
                            isActive
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <h6 className="text-base font-bold text-gray-900 dark:text-white">
                            {criterion.criteria}
                          </h6>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${i < Math.ceil((currentScore / criterion.max_score) * 5) ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-gray-700"}`}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                              Current Level
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl ml-12">
                        {criterion.description ||
                          "No specific instructions provided for this criterion."}
                      </p>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-4 ml-12 md:ml-0">
                      <div className="flex items-center gap-2 p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                        {/* Interactive Scoring Steps */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                          const val = Math.round(criterion.max_score * ratio);
                          return (
                            <button
                              key={ratio}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRubricScoreChange(index, val);
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                                currentScore === val
                                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600"
                                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              }`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative group">
                        <input
                          type="number"
                          min="0"
                          max={criterion.max_score}
                          value={currentScore}
                          onChange={(e) =>
                            handleRubricScoreChange(
                              index,
                              parseInt(e.target.value) || 0,
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-24 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-lg font-black text-center text-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        />
                        <span className="absolute -top-3 -right-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[9px] font-black px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 transition-transform group-hover:scale-110">
                          MAX {criterion.max_score}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Grade & Overall Feedback */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h6 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
            Overall Assessment
          </h6>
          <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-800" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-3">
            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100/50 dark:border-blue-900/30">
              <label className="block text-[10px] font-black text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-widest">
                Override Grade
              </label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full bg-transparent text-3xl font-black text-gray-900 dark:text-white focus:outline-none tabular-nums"
              />
              <div className="mt-1 h-1 w-8 bg-blue-600 rounded-full" />
            </div>
            <p className="text-[10px] text-gray-400 px-4 italic leading-tight">
              Setting a manual score will ignore auto-calculations from the
              rubric.
            </p>
          </div>

          <div className="md:col-span-3">
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 p-6 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
              <div className="flex items-center gap-2 mb-4 text-gray-400">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Private Feedback
                </span>
              </div>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Write detailed observations, encouragement, and areas for improvement..."
                className="w-full bg-transparent text-sm resize-none focus:outline-none min-h-[120px] dark:text-white leading-relaxed"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="group relative overflow-hidden px-10 py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <div className="relative flex items-center gap-3">
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-gray-900/30 dark:border-t-gray-900 rounded-full animate-spin" />
              ) : (
                <Award className="w-4 h-4" />
              )}
              <span>{isGraded ? "Update Assessment" : "Finalize Grade"}</span>
            </div>
            <motion.div
              className="absolute inset-0 bg-blue-600"
              initial={{ x: "-100%" }}
              whileHover={{ x: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity font-black uppercase tracking-[0.2em] text-sm pointer-events-none z-10">
              Ship Grade
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionMarking;
