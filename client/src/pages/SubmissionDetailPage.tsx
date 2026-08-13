import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosConfig";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Trophy,
  User,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
  Calendar,
  BarChart3,
} from "lucide-react";
import RichTextDisplay from "../components/Common/RichTextDisplay";

interface QuestionResult {
  question_id: number;
  question_text: string;
  question_type: string;
  question_data?: any;
  points: number;
  order: number;
  explanation?: string;
  correct_answer?: any;
  student_answer?: any;
  is_correct: boolean | null;
  points_earned: number | null;
  time_taken?: number;
}

interface SubmissionDetail {
  submission_id: number;
  quiz_id: number;
  quiz_title: string;
  student_name: string;
  student_email: string;
  attempt_number: number;
  started_at: string;
  completed_at: string;
  time_taken: number;
  current_score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  questions: QuestionResult[];
}

const QUESTION_TYPE_META: Record<string, { label: string; color: string }> = {
  multiple_choice:    { label: "MCQ",            color: "bg-blue-100 text-blue-700"       },
  single_choice:      { label: "Single Choice",  color: "bg-blue-100 text-blue-700"       },
  true_false:         { label: "T/F",            color: "bg-indigo-100 text-indigo-700"   },
  short_answer:       { label: "Short Answer",   color: "bg-purple-100 text-purple-700"   },
  essay:              { label: "Essay",          color: "bg-pink-100 text-pink-700"       },
  fill_blank:         { label: "Fill in Blank",  color: "bg-amber-100 text-amber-700"     },
  matching:           { label: "Matching",       color: "bg-teal-100 text-teal-700"       },
  ordering:           { label: "Ordering",       color: "bg-cyan-100 text-cyan-700"       },
  dropdown:           { label: "Dropdown",       color: "bg-lime-100 text-lime-700"       },
  coding:             { label: "Coding",         color: "bg-slate-100 text-slate-700"     },
  numerical:          { label: "Numerical",      color: "bg-orange-100 text-orange-700"   },
  logical_expression: { label: "Logical Expr",   color: "bg-violet-100 text-violet-700"   },
  drag_drop:          { label: "Drag & Drop",    color: "bg-sky-100 text-sky-700"         },
  algorithmic:        { label: "Algorithmic",    color: "bg-emerald-100 text-emerald-700" },
};

function getQuestionStyle(isCorrect: boolean | null) {
  if (isCorrect === true)
    return {
      border: "border-emerald-200 dark:border-emerald-800",
      bg: "bg-emerald-50/50 dark:bg-emerald-900/10",
      label: "Correct",
      labelColor: "text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500",
    };
  if (isCorrect === false)
    return {
      border: "border-red-200 dark:border-red-800",
      bg: "bg-red-50/50 dark:bg-red-900/10",
      label: "Incorrect",
      labelColor: "text-red-700 dark:text-red-400",
      dot: "bg-red-500",
    };
  return {
    border: "border-gray-200 dark:border-gray-700",
    bg: "bg-gray-50/50 dark:bg-gray-800/10",
    label: "Pending Review",
    labelColor: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  };
}

function formatTime(seconds: number) {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function parseAnswer(raw: any): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// Extract a numeric index from any of the known formats a single-choice answer can take
function extractChoiceIndex(answer: any): number | null {
  if (typeof answer === "number") return answer;
  if (typeof answer === "string") {
    const n = parseInt(answer, 10);
    return isNaN(n) ? null : n;
  }
  if (answer && typeof answer === "object") {
    // Normalized student answer: { selected_option_index: N }
    if (typeof answer.selected_option_index === "number")
      return answer.selected_option_index;
    if (typeof answer.selected_option_index === "string") {
      const n = parseInt(answer.selected_option_index, 10);
      if (!isNaN(n)) return n;
    }
    // Normalized correct answer after grader: { correct_option_index: N }
    if (typeof answer.correct_option_index === "number")
      return answer.correct_option_index;
    // Raw question_data stored as correct_answer: { options:[...], correct_option_index: N }
    if (typeof answer.correct_option_index === "string") {
      const n = parseInt(answer.correct_option_index, 10);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function extractBool(answer: any): boolean | null {
  if (typeof answer === "boolean") return answer;
  if (answer === "true" || answer === 1) return true;
  if (answer === "false" || answer === 0) return false;
  if (answer && typeof answer === "object") {
    // Normalized: { selected_answer: bool }
    if (typeof answer.selected_answer === "boolean")
      return answer.selected_answer;
    if (typeof answer.selected_answer === "string")
      return answer.selected_answer.toLowerCase() === "true";
    // Raw question_data: { correct_answer: bool }
    if (typeof answer.correct_answer === "boolean")
      return answer.correct_answer;
    if (typeof answer.answer === "boolean") return answer.answer;
    if (typeof answer.correct_answer === "string")
      return answer.correct_answer.toLowerCase() === "true";
  }
  return null;
}

function OptionBadge({ idx, options }: { idx: number; options: string[] }) {
  const letter = String.fromCharCode(65 + idx);
  const text = options[idx];
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
        {letter}
      </span>
      <span>{text ?? `Option ${idx + 1}`}</span>
    </div>
  );
}

function renderAnswer(
  rawAnswer: any,
  questionType: string,
  questionData?: any,
): React.ReactNode {
  const answer = parseAnswer(rawAnswer);
  const qd = parseAnswer(questionData);

  if (answer === null || answer === undefined) {
    return (
      <span className="italic text-gray-400 dark:text-gray-500 text-sm">No answer submitted</span>
    );
  }

  // ── Single choice ──────────────────────────────────────────────────────────
  if (questionType === "single_choice") {
    // Options can come from question_data OR from the answer itself (if it contains full question_data)
    const options: string[] = qd?.options ?? answer?.options ?? [];
    const idx = extractChoiceIndex(answer);
    if (idx !== null) {
      return <OptionBadge idx={idx} options={options} />;
    }
    // answer might be the option text itself as a string
    if (typeof answer === "string")
      return <span className="text-sm font-medium">{answer}</span>;
    return (
      <span className="italic text-gray-400 dark:text-gray-500 text-sm">No answer recorded</span>
    );
  }

  // ── Multiple choice ────────────────────────────────────────────────────────
  if (questionType === "multiple_choice") {
    const options: string[] = qd?.options ?? answer?.options ?? [];
    const indices: number[] = Array.isArray(answer?.selected_option_indices)
      ? answer.selected_option_indices.map(Number)
      : Array.isArray(answer?.correct_option_indices)
        ? answer.correct_option_indices.map(Number)
        : Array.isArray(answer)
          ? answer.map(Number).filter((n: number) => !isNaN(n))
          : [];
    if (indices.length > 0) {
      return (
        <div className="space-y-1.5">
          {indices.map((idx) => (
            <OptionBadge key={idx} idx={idx} options={options} />
          ))}
        </div>
      );
    }
    return (
      <span className="italic text-gray-400 dark:text-gray-500 text-sm">No options selected</span>
    );
  }

  // ── True / False ───────────────────────────────────────────────────────────
  if (questionType === "true_false") {
    const val = extractBool(answer);
    if (val === null)
      return <span className="italic text-gray-400 dark:text-gray-500 text-sm">No answer</span>;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
          val
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
        }`}
      >
        {val ? (
          <>
            <CheckCircle className="w-3.5 h-3.5" /> True
          </>
        ) : (
          <>
            <XCircle className="w-3.5 h-3.5" /> False
          </>
        )}
      </span>
    );
  }

  // ── Matching ───────────────────────────────────────────────────────────────
  if (questionType === "matching") {
    // Normalized student answer: { matches: { leftId: rightId } }
    // Normalized correct answer: { matches: { leftId: rightId } } (from grader)
    // Raw correct_matches: { correct_matches: { leftId: rightId } }
    const matches: Record<string, any> =
      answer?.matches ??
      answer?.correct_matches ??
      (typeof answer === "object" && !Array.isArray(answer) ? answer : {});
    const leftItems: Array<{ id: string; text: string }> = qd?.left_items ?? [];
    const rightItems: Array<{ id: string; text: string }> =
      qd?.right_items ?? [];
    const leftMap = Object.fromEntries(leftItems.map((i) => [i.id, i.text]));
    const rightMap = Object.fromEntries(rightItems.map((i) => [i.id, i.text]));
    const entries = Object.entries(matches).filter(
      ([k]) => !["correct_matches", "left_items", "right_items"].includes(k),
    );
    if (entries.length === 0)
      return (
        <span className="italic text-gray-400 dark:text-gray-500 text-sm">
          No matches recorded
        </span>
      );
    return (
      <div className="space-y-1.5">
        {entries.map(([leftId, rightId]) => (
          <div key={leftId} className="flex items-center gap-2 text-sm">
            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded font-medium min-w-0 max-w-[45%] truncate">
              {leftMap[leftId] ?? leftId}
            </span>
            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">→</span>
            <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded font-medium min-w-0 max-w-[45%] truncate">
              {rightMap[String(rightId)] ?? String(rightId)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // ── Fill in blank ──────────────────────────────────────────────────────────
  if (questionType === "fill_blank") {
    // Normalized: { answers: [{ blank_index: N, answer: "text" }] }
    // Raw question_data: { acceptable_answers: [{ blank_index: N, answers: ["text",...] }] }
    const blanks: Array<{ blank_index: number; answer: string }> =
      Array.isArray(answer?.answers)
        ? answer.answers
        : Array.isArray(answer?.acceptable_answers)
          ? answer.acceptable_answers.map((b: any, i: number) => ({
              blank_index: b.blank_index ?? i,
              answer: Array.isArray(b.answers)
                ? b.answers[0]
                : (b.correct_answer ?? ""),
            }))
          : Array.isArray(answer)
            ? answer
            : [];
    if (blanks.length > 0) {
      return (
        <div className="space-y-1.5">
          {blanks.map((b: any, i: number) => {
            // student answer item: { blank_index: N, answer: "cell" }
            // correct answer item: { blank_index: N, answers: ["cell", ...] }
            const text =
              typeof b.answer === "string"
                ? b.answer
                : Array.isArray(b.answers)
                  ? (b.answers[0] ?? "")
                  : String(b.answer ?? "");
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-16 flex-shrink-0">
                  Blank {((b.blank_index ?? i) as number) + 1}:
                </span>
                <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded font-medium">
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    if (typeof answer === "string")
      return <span className="text-sm font-medium">{answer}</span>;
  }

  // ── Dropdown ───────────────────────────────────────────────────────────────
  if (questionType === "dropdown") {
    // Normalized: { selections: [{ dropdown_index: N, selected_option: "text" }] }
    const selections: Array<{ dropdown_index: number; selected_option: any }> =
      Array.isArray(answer?.selections)
        ? answer.selections
        : Array.isArray(answer)
          ? answer
          : [];
    const ddOptions: Array<{ dropdown_index: number; options: string[] }> =
      qd?.dropdown_options ?? [];
    if (selections.length > 0) {
      return (
        <div className="space-y-1.5">
          {selections.map((s, i) => {
            const dd = ddOptions.find(
              (d) => d.dropdown_index === (s.dropdown_index ?? i),
            );
            const rawOpt = s.selected_option;
            const optText =
              typeof rawOpt === "number" && dd
                ? (dd.options[rawOpt] ?? `Option ${rawOpt + 1}`)
                : typeof rawOpt === "string"
                  ? rawOpt
                  : (rawOpt?.text ?? rawOpt?.value ?? String(rawOpt ?? ""));
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">
                  Dropdown {(s.dropdown_index ?? i) + 1}:
                </span>
                <span className="px-2 py-0.5 bg-lime-50 dark:bg-lime-900/30 text-lime-800 dark:text-lime-200 rounded font-medium">
                  {optText}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
  }

  // ── Ordering ───────────────────────────────────────────────────────────────
  if (questionType === "ordering") {
    // Normalized student: { order: ["id1","id2",...] }
    // Normalized correct: { ordered_item_ids: ["id1","id2",...] }
    const order: string[] = Array.isArray(answer?.order)
      ? answer.order
      : Array.isArray(answer?.ordered_item_ids)
        ? answer.ordered_item_ids
        : Array.isArray(answer)
          ? answer
          : [];
    const items: Array<{ id: string; text: string }> = qd?.items ?? [];
    const itemMap = Object.fromEntries(items.map((it) => [it.id, it.text]));
    if (order.length > 0) {
      return (
        <ol className="space-y-1.5 list-none">
          {order.map((id, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span>{itemMap[id] ?? id}</span>
            </li>
          ))}
        </ol>
      );
    }
  }

  // ── Numerical ─────────────────────────────────────────────────────────────
  if (questionType === "numerical") {
    // Normalized: { answer: N, tolerance: T, units: U }
    const num = answer?.answer ?? (typeof answer === "number" ? answer : null);
    if (num !== null && num !== undefined) {
      const units = answer?.units ?? qd?.units ?? "";
      const tol = answer?.tolerance ?? qd?.tolerance;
      return (
        <div className="text-sm">
          <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">
            {num}
            {units ? ` ${units}` : ""}
          </span>
          {tol != null && tol > 0 && (
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(± {tol})</span>
          )}
        </div>
      );
    }
  }

  // ── Coding ─────────────────────────────────────────────────────────────────
  if (questionType === "coding" || questionType === "algorithmic") {
    const code =
      answer?.code ??
      answer?.solution ??
      (typeof answer === "string" ? answer : null);
    if (code) {
      return (
        <pre className="text-xs font-mono bg-gray-900 text-green-300 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
          {code}
        </pre>
      );
    }
    if (questionType === "coding") {
      return (
        <span className="italic text-gray-400 dark:text-gray-500 text-sm">
          Graded by test cases
        </span>
      );
    }
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────
  if (questionType === "drag_drop") {
    // { placements: { zoneId: itemId } }
    const placements: Record<string, string> = answer?.placements ?? {};
    const dropZones: Array<{ id: string; label: string }> =
      qd?.drop_zones ?? [];
    const draggableItems: Array<{ id: string; text: string }> =
      qd?.draggable_items ?? [];
    const zoneMap = Object.fromEntries(dropZones.map((z) => [z.id, z.label]));
    const itemMap = Object.fromEntries(
      draggableItems.map((it) => [it.id, it.text]),
    );
    const entries = Object.entries(placements);
    if (entries.length === 0)
      return (
        <span className="italic text-gray-400 dark:text-gray-500 text-sm">No items placed</span>
      );
    return (
      <div className="space-y-1.5">
        {entries.map(([zoneId, itemId]) => (
          <div key={zoneId} className="flex items-center gap-2 text-sm">
            <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded font-medium min-w-0 max-w-[45%] truncate">
              {zoneMap[zoneId] ?? zoneId}
            </span>
            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">←</span>
            <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 px-2 py-0.5 rounded font-medium min-w-0 max-w-[45%] truncate">
              {itemMap[String(itemId)] ?? String(itemId)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // ── Logical expression ─────────────────────────────────────────────────────
  if (questionType === "logical_expression") {
    // expression field may contain HTML entities (e.g. &amp;&amp; → &&)
    const raw =
      answer?.expression ??
      answer?.text ??
      (typeof answer === "string" ? answer : null);
    if (raw) {
      const decoded = raw
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&&/g, " AND ")
        .replace(/\|\|/g, " OR ")
        .replace(/!(?!=)/g, "NOT ")
        .replace(/\s{2,}/g, " ")
        .trim();
      return (
        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
          {decoded}
        </code>
      );
    }
  }

  // ── Short answer / essay ───────────────────────────────────────────────────
  if (questionType === "short_answer" || questionType === "essay") {
    const text =
      answer?.text ??
      answer?.answer ??
      answer?.content ??
      (typeof answer === "string" ? answer : null);
    if (text)
      return (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
      );
  }

  // ── Primitive fallback ─────────────────────────────────────────────────────
  if (
    typeof answer === "string" ||
    typeof answer === "number" ||
    typeof answer === "boolean"
  ) {
    return <span className="text-sm font-medium">{String(answer)}</span>;
  }

  // ── Last resort — never show raw [object Object] ───────────────────────────
  return <span className="text-sm italic text-gray-500 dark:text-gray-400">Answer recorded</span>;
}

const SubmissionDetailPage: React.FC = () => {
  const { quizId, submissionId } = useParams<{
    quizId: string;
    submissionId: string;
  }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    if (submissionId) fetchDetail();
  }, [submissionId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await axios.get(`/quizzes/submissions/${submissionId}/grade`);
      setDetail(res.data.data);
    } catch (err: any) {
      setFetchError(
        err.response?.data?.message || "Failed to load submission details",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleQuestion = (idx: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpandedQuestions(new Set());
    } else {
      setExpandedQuestions(new Set(detail?.questions.map((_, i) => i) ?? []));
    }
    setExpandAll(!expandAll);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-400 border-t-blue-600 mx-auto mb-4" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            Loading submission…
          </p>
        </div>
      </div>
    );
  }

  if (fetchError || !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
            Could not load submission
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{fetchError}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={fetchDetail}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={() => navigate(`/quizzes/${quizId}/submissions`)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const questions = detail.questions;
  const correctCount = questions.filter((q) => q.is_correct === true).length;
  const incorrectCount = questions.filter((q) => q.is_correct === false).length;
  const pendingCount = questions.filter((q) => q.is_correct === null).length;
  const percentage = Math.round(detail.percentage ?? 0);

  return (
    <div className="mx-auto px-4 py-6 pt-4">
      {/* Back */}
      <button
        onClick={() => navigate(`/quizzes/${quizId}/submissions`)}
        className="inline-flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Submissions
      </button>

      {/* Header card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                {detail.student_name || "Unknown Student"}
              </h1>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                {detail.student_email}
              </p>
              <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mt-1">
                {detail.quiz_title}
              </p>
            </div>
          </div>

          {/* Score badge */}
          <div
            className={`flex flex-col items-center justify-center rounded-2xl px-5 py-3 border-2 flex-shrink-0 ${
              percentage >= 70
                ? "border-emerald-300 dark:border-green-600/20 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-red-300 bg-red-50 dark:bg-red-900/20"
            }`}
          >
            <span
              className={`text-3xl font-extrabold ${percentage >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {percentage}%
            </span>
            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-0.5">
              {detail.current_score ?? 0}/{detail.max_score ?? 0} pts
            </span>
            <span
              className={`text-xs font-semibold mt-1 ${detail.passed ? "text-emerald-600" : "text-red-500"}`}
            >
              {detail.passed ? "PASSED" : "FAILED"}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {detail.completed_at
                ? new Date(detail.completed_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(detail.time_taken)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5" />
            <span>Attempt #{detail.attempt_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{questions.length} questions</span>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {correctCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Correct</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-800 p-4 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {incorrectCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Incorrect</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-800 p-4 text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pending</div>
        </div>
      </div>

      {/* Questions header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
          Questions ({questions.length})
        </h2>
        <button
          onClick={handleExpandAll}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* Question cards */}
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const style = getQuestionStyle(q.is_correct);
          const isExpanded = expandedQuestions.has(idx);
          const typeMeta = QUESTION_TYPE_META[q.question_type] ?? {
            label: q.question_type,
            color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
          };

          return (
            <div
              key={q.question_id}
              className={`rounded-2xl border ${style.border}/50 ${style.bg} overflow-hidden transition-all`}
            >
              {/* Question header — always visible */}
              <button
                onClick={() => toggleQuestion(idx)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}
                />
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-6 flex-shrink-0">
                  Q{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeMeta.color}`}
                    >
                      {typeMeta.label}
                    </span>
                    <span className="text-sm text-text-primary-light dark:text-text-primary-dark font-medium truncate">
                      {q.question_text
                        ?.replace(/<[^>]*>/g, "")
                        .substring(0, 100) || "—"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-semibold ${style.labelColor}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {q.points_earned != null ? q.points_earned : "—"}/{q.points}{" "}
                    pts
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-4 border-t border-black/5 dark:border-white/5">
                  {/* Full question text */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                      Question
                    </p>
                    <div className="text-sm text-text-primary-light dark:text-text-primary-dark">
                      <RichTextDisplay
                        content={q.question_text || "—"}
                        className="prose prose-sm dark:prose-invert max-w-none"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Student answer */}
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                        Student's Answer
                      </p>
                      <div
                        className={`rounded-xl p-3 border text-sm ${
                          q.is_correct === true
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                            : q.is_correct === false
                              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                              : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {renderAnswer(
                          q.student_answer,
                          q.question_type,
                          q.question_data,
                        )}
                      </div>
                    </div>

                    {/* Correct answer */}
                    {q.correct_answer != null && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                          Correct Answer
                        </p>
                        <div className="rounded-xl p-3 border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-sm">
                          {renderAnswer(
                            q.correct_answer,
                            q.question_type,
                            q.question_data,
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pending badge */}
                  {q.is_correct === null && (
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      This answer requires manual review — go to the grading
                      page to score it.
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                        Explanation
                      </p>
                      <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                        <RichTextDisplay
                          content={q.explanation}
                          className="prose prose-xs dark:prose-invert max-w-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grade button */}
      {pendingCount > 0 && (
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>
              {pendingCount} question{pendingCount > 1 ? "s" : ""} still need
              manual grading.
            </span>
          </div>
          <button
            onClick={() =>
              navigate(`/quizzes/submissions/${submissionId}/grade`)
            }
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Go to Grading
          </button>
        </div>
      )}
    </div>
  );
};

export default SubmissionDetailPage;
