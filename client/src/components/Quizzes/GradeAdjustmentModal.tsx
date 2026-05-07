import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  RotateCcw,
  Save,
  User,
  BookOpen,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Loader2,
  Sparkles,
  Award,
} from "lucide-react";
import { toast } from "react-toastify";
import { QuizApiService } from "../../services/quizApi";

interface QuestionData {
  question_id: number;
  question_text: string;
  question_type: string;
  question_data: any;
  points: number;
  order: number;
  explanation: string;
  correct_answer: any;
  student_answer: any;
  is_correct: boolean | null;
  points_earned: number | null;
  time_taken: number;
}

interface SubmissionData {
  submission_id: number;
  quiz_title: string;
  student_name: string;
  student_email: string;
  current_score: number;
  max_score: number;
  percentage: number;
  passed: boolean | null;
  questions: QuestionData[];
}

interface Props {
  submissionId: number;
  onClose: () => void;
  onSaved: () => void;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  numerical: "Numerical",
  coding: "Coding",
  fill_blank: "Fill in Blank",
  matching: "Matching",
  ordering: "Ordering",
  algorithmic: "Algorithmic",
  logical_expression: "Logical Expression",
  drag_drop: "Drag & Drop",
};

function getGradeLetter(pct: number) {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function getGradeColor(pct: number) {
  if (pct >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 80) return "text-green-600 dark:text-green-400";
  if (pct >= 70) return "text-blue-600 dark:text-blue-400";
  if (pct >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function formatAnswer(answer: any): string {
  if (answer === null || answer === undefined) return "—";
  if (typeof answer === "boolean") return answer ? "True" : "False";
  if (typeof answer === "string") return answer;
  if (typeof answer === "number") return String(answer);
  if (Array.isArray(answer)) return answer.join(", ");
  try {
    return JSON.stringify(answer, null, 2);
  } catch {
    return String(answer);
  }
}

const GradeAdjustmentModal: React.FC<Props> = ({
  submissionId,
  onClose,
  onSaved,
}) => {
  const [data, setData] = useState<SubmissionData | null>(null);
  const [grades, setGrades] = useState<Record<number, number>>({});
  const [originalGrades, setOriginalGrades] = useState<Record<number, number>>(
    {},
  );
  const [feedback, setFeedback] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<
    Record<number, boolean>
  >({});

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    setLoadingData(true);
    try {
      const res = await QuizApiService.getSubmissionForGrading(submissionId);
      if (res.success && res.data) {
        const d: SubmissionData = res.data;
        setData(d);
        const initial: Record<number, number> = {};
        d.questions.forEach((q) => {
          initial[q.question_id] = q.points_earned ?? 0;
        });
        setGrades(initial);
        setOriginalGrades(initial);
        setFeedback("");
      }
    } catch {
      toast.error("Failed to load submission data");
      onClose();
    } finally {
      setLoadingData(false);
    }
  };

  const setQuestionGrade = useCallback(
    (questionId: number, value: number, max: number) => {
      const clamped = Math.max(0, Math.min(max, Math.round(value * 2) / 2));
      setGrades((prev) => ({ ...prev, [questionId]: clamped }));
    },
    [],
  );

  const toggleExpand = (questionId: number) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const resetToOriginal = () => {
    setGrades(originalGrades);
    setFeedback("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await QuizApiService.gradeSubmission(
        submissionId,
        grades,
        feedback || undefined,
      );
      if (res.success) {
        toast.success("Marks updated successfully");
        onSaved();
        onClose();
      } else {
        toast.error("Failed to save marks");
      }
    } catch {
      toast.error("Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  // Derived live score
  const newTotal = data
    ? data.questions.reduce((sum, q) => sum + (grades[q.question_id] ?? 0), 0)
    : 0;
  const maxTotal = data?.max_score ?? 0;
  const newPct = maxTotal > 0 ? (newTotal / maxTotal) * 100 : 0;
  const oldTotal = data?.current_score ?? 0;
  const delta = newTotal - oldTotal;
  const hasChanges =
    JSON.stringify(grades) !== JSON.stringify(originalGrades) ||
    feedback.trim() !== "";

  if (loadingData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 flex flex-col items-center gap-4 shadow-2xl">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Loading submission...
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[96vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                Adjust Marks
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {data.student_name}{" "}
                {data.student_email && (
                  <span className="opacity-60">· {data.student_email}</span>
                )}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate mt-0.5">
                {data.quiz_title}
              </p>
            </div>
          </div>

          {/* Live score badge */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <div
                className={`text-xl font-black ${getGradeColor(newPct)}`}
              >
                {getGradeLetter(newPct)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {newTotal.toFixed(1)}/{maxTotal} · {newPct.toFixed(1)}%
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body: question list ── */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4 space-y-3">
          {data.questions.map((q, idx) => {
            const earned = grades[q.question_id] ?? 0;
            const isExpanded = !!expandedQuestions[q.question_id];
            const isFull = earned >= q.points;
            const isZero = earned === 0;
            const cardBg = isFull
              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
              : isZero
              ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
              : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10";

            return (
              <div
                key={q.question_id}
                className={`rounded-xl border transition-all duration-200 ${cardBg}`}
              >
                {/* Question header row */}
                <div className="flex items-start gap-3 p-4">
                  {/* Number */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      isFull
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : isZero
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Text + badge */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                      {q.question_text || "—"}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-white/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                      {QUESTION_TYPE_LABELS[q.question_type] || q.question_type}
                    </span>
                  </div>

                  {/* Points editor */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() =>
                        setQuestionGrade(q.question_id, earned - 0.5, q.points)
                      }
                      disabled={earned <= 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={q.points}
                      step={0.5}
                      value={earned}
                      onChange={(e) =>
                        setQuestionGrade(
                          q.question_id,
                          parseFloat(e.target.value) || 0,
                          q.points,
                        )
                      }
                      className="w-14 text-center text-sm font-bold border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() =>
                        setQuestionGrade(q.question_id, earned + 0.5, q.points)
                      }
                      disabled={earned >= q.points}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-gray-400 ml-1 whitespace-nowrap">
                      / {q.points}
                    </span>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(q.question_id)}
                    className="p-1 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 text-gray-400 transition-colors flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded: student answer + correct answer */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-white/50 dark:border-gray-800/50 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-1 mb-1">
                          {q.is_correct === true ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          ) : q.is_correct === false ? (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            Student's Answer
                          </span>
                        </div>
                        <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words font-mono">
                          {formatAnswer(q.student_answer)}
                        </pre>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800">
                        <div className="flex items-center gap-1 mb-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            Correct Answer
                          </span>
                        </div>
                        <pre className="text-xs text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap break-words font-mono">
                          {formatAnswer(q.correct_answer)}
                        </pre>
                      </div>
                    </div>
                    {q.explanation && (
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                          Explanation
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Feedback */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Instructor Feedback
              </span>
              <span className="text-xs text-gray-400">(optional)</span>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="Add feedback for the student..."
              className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* ── Sticky footer: score summary + actions ── */}
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm px-5 sm:px-7 py-4">
          {/* Score comparison row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Old score */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <BookOpen className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-none">
                  Original
                </div>
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {oldTotal}/{maxTotal}
                </div>
              </div>
            </div>

            {/* Arrow + delta */}
            <div
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold ${
                delta > 0
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : delta < 0
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              }`}
            >
              {delta > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : delta < 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)} pts
            </div>

            {/* New score */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <Award className="w-4 h-4 text-blue-500" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-none">
                  New Score
                </div>
                <div
                  className={`text-sm font-bold ${getGradeColor(newPct)}`}
                >
                  {newTotal.toFixed(1)}/{maxTotal} · {newPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Grade letter */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-none">
                  Grade
                </div>
                <div
                  className={`text-sm font-black ${getGradeColor(newPct)}`}
                >
                  {getGradeLetter(newPct)}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={resetToOriginal}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save Adjustments"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeAdjustmentModal;
