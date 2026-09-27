import React from "react";
import { toast } from "react-toastify";
import type { AssignmentInterface } from "./AssignmentCard";
import { motion } from "framer-motion";
import { MessageSquare, Star, Award } from "lucide-react";
import ScoreRing from "../Common/ScoreRing";

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
  ) => void | Promise<void>;
  onSuccess?: () => void;
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

const SubmissionMarking: React.FC<SubmissionMarkingProps> = ({
  submission,
  assignment,
  onGradeSubmission,
  onSuccess,
}) => {
  const [rubricScores, setRubricScores] = React.useState<
    Record<number, number>
  >(() => safeParse(submission.rubric_scores, {}));
  const [feedback, setFeedback] = React.useState<string>(
    submission.feedback || "",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
  const scoreInputRef = React.useRef<HTMLInputElement>(null);

  const maxScore = Number(assignment.max_score) || 0;
  const rubricTotal = (scores: Record<number, number>) =>
    Object.values(scores).reduce((acc, curr) => acc + (Number(curr) || 0), 0);

  // The rubric fills the marks as the teacher scores each criterion. It only
  // writes on interaction, so an existing grade without rubric scores is kept.
  const handleRubricScoreChange = (index: number, value: number) => {
    setRubricScores((prev) => {
      const next = { ...prev, [index]: value };
      setScore(String(rubricTotal(next)));
      return next;
    });
  };

  const trimmed = score.trim();
  const numericScore = trimmed === "" ? null : Number(trimmed);
  const scoreError =
    numericScore === null
      ? null
      : Number.isNaN(numericScore)
        ? "Enter a number."
        : numericScore < 0
          ? "Marks can't be negative."
          : numericScore > maxScore
            ? `Marks can't exceed ${maxScore}.`
            : null;
  const canSave = numericScore !== null && !scoreError && !isSubmitting;
  const isOverridingRubric =
    rubric.length > 0 &&
    numericScore !== null &&
    Object.keys(rubricScores).length > 0 &&
    numericScore !== rubricTotal(rubricScores);

  const quickFills = [
    { label: "0", value: 0 },
    { label: "½", value: maxScore / 2 },
    { label: "¾", value: (maxScore * 3) / 4 },
    { label: "Full", value: maxScore },
  ].map((q) => ({ ...q, value: Math.round(q.value * 100) / 100 }));

  const handleSubmit = async () => {
    if (numericScore === null) {
      toast.error("Enter the marks awarded before saving.");
      scoreInputRef.current?.focus();
      return;
    }
    if (scoreError) {
      toast.error(scoreError);
      scoreInputRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    try {
      await onGradeSubmission(submission.id, numericScore, feedback, rubricScores);
      toast.success(
        submission.grade ? "Assessment updated!" : "Assessment finalized!",
      );
      // Automatically close modal on success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to save grade.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGraded = !!submission.grade;

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Marks entry: live ring preview + the one field that sets the grade */}
      <section
        aria-labelledby="marks-heading"
        className="rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-sm dark:border-blue-900/60 dark:bg-gray-900 sm:p-8"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <ScoreRing
            value={scoreError ? null : numericScore}
            max={maxScore}
            size={120}
            caption={`${numericScore ?? 0} / ${maxScore}`}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label
                id="marks-heading"
                htmlFor="marks-awarded"
                className="flex items-center gap-2 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
              >
                <Award className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Marks awarded
              </label>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {rubric.length > 0
                  ? "Filled from the rubric below. Type a value to override it."
                  : `Type the marks for this submission, from 0 to ${maxScore}.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`flex items-center rounded-xl border-2 bg-white transition-colors focus-within:ring-4 dark:bg-gray-950 ${
                  scoreError
                    ? "border-red-400 focus-within:ring-red-500/15 dark:border-red-500"
                    : "border-gray-300 focus-within:border-blue-600 focus-within:ring-blue-500/15 dark:border-gray-600 dark:focus-within:border-blue-500"
                }`}
              >
                <input
                  ref={scoreInputRef}
                  id="marks-awarded"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={maxScore}
                  step="any"
                  value={score}
                  autoFocus={!isGraded}
                  placeholder="0"
                  aria-invalid={!!scoreError}
                  aria-describedby={scoreError ? "marks-error" : undefined}
                  onChange={(e) => setScore(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSave) handleSubmit();
                  }}
                  className="w-28 rounded-l-xl bg-transparent px-4 py-3 text-3xl font-bold tabular-nums text-text-primary-light placeholder:text-gray-300 focus:outline-none dark:text-text-primary-dark dark:placeholder:text-gray-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="select-none border-l border-gray-200 px-4 py-3 text-lg font-semibold tabular-nums text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  / {maxScore}
                </span>
              </div>

              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Quick fill marks"
              >
                {quickFills.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setScore(String(q.value));
                      scoreInputRef.current?.focus();
                    }}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      numericScore === q.value
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
                    }`}
                    title={`${q.value} / ${maxScore}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {scoreError ? (
              <p id="marks-error" className="text-xs font-medium text-red-600 dark:text-red-400">
                {scoreError}
              </p>
            ) : isOverridingRubric ? (
              <p className="flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                Overriding the rubric total ({rubricTotal(rubricScores)}).
                <button
                  type="button"
                  onClick={() => setScore(String(rubricTotal(rubricScores)))}
                  className="font-semibold underline underline-offset-2"
                >
                  Use rubric total
                </button>
              </p>
            ) : numericScore === null ? (
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Not graded yet. Enter marks to grade this submission.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Interactive Rubric Section */}
      {rubric && rubric.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h6 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-[0.2em]">
              Criterion Breakdown
            </h6>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-800" />
          </div>

          <div className="space-y-4">
            {rubric.map((criterion: any, index: number) => {
              const currentScore = rubricScores[index] || 0;

              return (
                <motion.div
                  key={index + 1}
                  // onClick={() => setActiveCriterion(index)}
                  className={`relative p-6 rounded-2xl border transition-all cursor-pointer group bg-white dark:bg-gray-900/50 border-gray-100 dark:border-gray-900 hover:border-gray-200 dark:hover:border-gray-800`}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold transition-colors bg-gray-100 dark:bg-gray-800 text-gray-400`}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <h6 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
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
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                              Current Level
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 leading-relaxed max-w-2xl ml-12">
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
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                currentScore === val
                                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600"
                                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200"
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
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-24 px-4 py-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-lg font-bold text-center text-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        />
                        <span className="absolute -top-3 -right-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[9px] font-bold px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 transition-transform group-hover:scale-110">
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

      {/* Feedback + save */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 transition-all focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-900">
          <label
            htmlFor="grading-feedback"
            className="mb-3 flex items-center gap-2 text-gray-500 dark:text-gray-400"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Feedback
            </span>
            <span className="text-[10px] font-medium normal-case tracking-normal text-gray-400">
              · visible to the student
            </span>
          </label>
          <textarea
            id="grading-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Write detailed observations, encouragement, and areas for improvement..."
            className="min-h-[120px] w-full resize-none bg-transparent text-sm leading-relaxed focus:outline-none dark:text-white"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            title={numericScore === null ? "Enter the marks awarded first" : undefined}
            className="group relative overflow-hidden px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-full font-bold text-sm uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50"
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
            {/* <span className="absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-[0.2em] text-sm pointer-events-none z-10">
              Ship Grade
            </span> */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionMarking;
