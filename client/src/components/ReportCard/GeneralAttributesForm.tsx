import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
  ChevronDown,
  UserCheck,
  Search,
  X,
  Zap,
  Sparkles,
  Lock,
  Download,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "react-toastify";
import { ReportCardApiService, type AttributeRating } from "../../services/reportCardApi";
import { ReportCardWorkflowApi, apiMessage } from "../../services/reportCardWorkflowApi";
import Select from "../ui/Select";
import { AiAnsweredBy, AiSourceControl } from "../ai/AiSourceControl";
import HandoffControl from "../ai/HandoffControl";
import { useAiPolicy } from "../../hooks/useAiAccess";
import type { AiHandoffRequest } from "../../services/aiHandoffApi";
import type { AiAnswer } from "../../services/myAiApi";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * The fallback attribute list, used until (or if) the school's scheme loads.
 * The real list comes from GET /report-cards/scheme (scheme.attributes).
 */
// eslint-disable-next-line react-refresh/only-export-components
export const GENERAL_ATTRIBUTES = [
  "Punctuality",
  "Obedience",
  "Neatness",
  "Participation",
  "Cooperation",
  "Responsibility",
] as const;

export type GeneralAttribute = (typeof GENERAL_ATTRIBUTES)[number];

const RATINGS: AttributeRating[] = ["Excellent", "Very good", "Good"];

/** Tooltip on a locked row. */
const LOCK_HINT = "Approved/Reviewed — reopen to draft to change";

// Semantic, theme-aware colors only — blue (primary), emerald (positive),
// amber (caution) and red (negative).
export type AttendanceKey = "present" | "absent" | "excused" | "late" | "sick";
export type AttendanceCounts = Record<AttendanceKey, number>;

const ATTENDANCE_FIELDS: Array<{ key: AttendanceKey; label: string; short: string; cls: string }> = [
  { key: "present", label: "Present", short: "P", cls: "text-emerald-700 dark:text-emerald-300" },
  { key: "absent", label: "Absent", short: "A", cls: "text-red-700 dark:text-red-300" },
  { key: "excused", label: "Excused", short: "E", cls: "text-blue-700 dark:text-blue-300" },
  { key: "late", label: "Late", short: "L", cls: "text-amber-700 dark:text-amber-300" },
  { key: "sick", label: "Sick", short: "S", cls: "text-text-secondary-light dark:text-text-secondary-dark" },
];

const ZERO_COUNTS: AttendanceCounts = { present: 0, absent: 0, excused: 0, late: 0, sick: 0 };

const RATING_COLORS: Record<AttributeRating, string> = {
  Excellent:   "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-400/40 bg-emerald-50 dark:bg-emerald-500/10",
  "Very good": "text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-400/40 bg-blue-50 dark:bg-blue-500/10",
  Good:        "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-400/40 bg-amber-50 dark:bg-amber-500/10",
};

const RATING_DOT: Record<AttributeRating, string> = {
  Excellent: "bg-emerald-500",
  "Very good": "bg-blue-500",
  Good: "bg-amber-500",
};

// ─── Attendance helpers ───────────────────────────────────────────────────────

/** Days on the register: every status counts once. */
// eslint-disable-next-line react-refresh/only-export-components
export const attendanceTotal = (c: AttendanceCounts) => c.present + c.absent + c.excused + c.late + c.sick;

/** Share of days the student was in school (present or late), or null with no days. */
// eslint-disable-next-line react-refresh/only-export-components
export const attendancePct = (c: AttendanceCounts): number | null => {
  const total = attendanceTotal(c);
  return total > 0 ? Math.round(((c.present + c.late) / total) * 100) : null;
};

/**
 * One word for the AI comment draft: the status that covers most days
 * (absent, excused and sick count together as away). Null with no days.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function dominantAttendance(c: AttendanceCounts): "present" | "absent" | "late" | null {
  if (attendanceTotal(c) === 0) return null;
  const away = c.absent + c.excused + c.sick;
  if (away > c.present && away >= c.late) return "absent";
  if (c.late > c.present && c.late > away) return "late";
  return "present";
}

const toCount = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 0;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentRow {
  id: number;
  name: string;
}

export interface StudentInitialData {
  /** Day counts for the term. */
  present?: number;
  absent?: number;
  excused?: number;
  late?: number;
  sick?: number;
  /** @deprecated The old single term status; ignored (counts replace it). */
  attendance?: "present" | "absent" | "late";
  attributes: Partial<Record<string, AttributeRating>>;
  comment: string;
  /** Behaviour out of 40 (RTB/CAMIS card); null = not given. */
  behaviour?: number | null;
}

interface StudentFormState {
  attendance: AttendanceCounts;
  /** Behaviour out of 40, as typed ("" = none). */
  behaviour: string;
  attributes: Partial<Record<string, AttributeRating>>;
  comment: string;
  saved: boolean;
  saving: boolean;
  /** Edited since load/save (an initialData refresh leaves it alone). */
  dirty: boolean;
  error: string | null;
  reportCardId: number | null;
}

export interface GeneralAttributesFormProps {
  students: StudentRow[];
  term: string;
  academicYear: string;
  initialData?: Record<number, StudentInitialData>;
  onAllSaved?: (reportCardIds: number[]) => void;
  /** The term's subject totals per student (out of 100), for AI comment drafts. */
  results?: Record<number, Array<{ name: string; score: number | null }>>;
  /** The attributes to rate. Omitted: the school's scheme is loaded (GENERAL_ATTRIBUTES until then). */
  attributes?: string[];
  /** Students whose card is past draft: read-only rows. */
  lockedStudentIds?: Set<number>;
  /**
   * Shows "Import attendance". The form shows the spinner and toasts; resolve
   * with a message to show it instead of the default success toast. Refresh
   * the counts by passing new `initialData` (unedited rows pick it up).
   */
  onImportAttendance?: () => Promise<void | string>;
  /** Hide the page-style heading (when embedded in another page). */
  hideHeading?: boolean;
}

/** "Aline Uwase" -> "Aline": what replaces [NAME] in an AI draft. */
// eslint-disable-next-line react-refresh/only-export-components
export const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

function rowFromInitial(pre: StudentInitialData | undefined): StudentFormState {
  return {
    attendance: {
      present: toCount(pre?.present),
      absent: toCount(pre?.absent),
      excused: toCount(pre?.excused),
      late: toCount(pre?.late),
      sick: toCount(pre?.sick),
    },
    attributes: pre?.attributes ?? {},
    comment: pre?.comment ?? "",
    behaviour: pre?.behaviour == null ? "" : String(pre.behaviour),
    saved: false,
    saving: false,
    dirty: false,
    error: null,
    reportCardId: null,
  };
}

function buildInitialState(
  students: StudentRow[],
  initialData?: Record<number, StudentInitialData>,
): Record<number, StudentFormState> {
  return Object.fromEntries(students.map((s) => [s.id, rowFromInitial(initialData?.[s.id])]));
}

// ─── Small parts ──────────────────────────────────────────────────────────────

/** Small "Draft with AI" button beside a comment box. */
function AiDraftButton({ student, busy, onDraft, compact }: { student: StudentRow; busy: boolean; onDraft: (s: StudentRow) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onDraft(student)}
      disabled={busy}
      aria-label={`Draft a comment for ${student.name} with AI`}
      title="Draft with AI (you can edit it before saving)"
      className={`inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200 ${compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-[11px]"}`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Sparkles className="h-3 w-3" aria-hidden />}
      {compact ? "AI" : "Draft with AI"}
    </button>
  );
}

function LockBadge() {
  return (
    <span
      title={LOCK_HINT}
      data-testid="row-locked"
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
    >
      <Lock className="h-3 w-3" aria-hidden />
      Locked
      <span className="sr-only">: {LOCK_HINT}</span>
    </span>
  );
}

function RadioPill({
  name,
  value,
  checked,
  onChange,
  label,
  colorClass,
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  colorClass: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`
        flex items-center justify-center px-2.5 py-1 rounded-lg border text-xs font-medium select-none
        transition-colors duration-150
        focus-within:ring-2 focus-within:ring-blue-400/50 focus-within:ring-offset-1 focus-within:ring-offset-transparent
        ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
        ${checked
          ? colorClass
          : `text-slate-500 dark:text-white/40 border-slate-200 dark:border-white/10 bg-transparent ${disabled ? "" : "hover:text-slate-700 dark:hover:text-white/70 hover:border-slate-300 dark:hover:border-white/25"}`
        }
      `}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
        aria-label={label}
      />
      {label}
    </label>
  );
}

/** One day-count box. */
export const BEHAVIOUR_MAX = 40;
/** "" -> null; otherwise a number within 0..40 (2 decimals), or undefined when invalid. */
// eslint-disable-next-line react-refresh/only-export-components
export function parseBehaviour(v: string): number | null | undefined {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > BEHAVIOUR_MAX) return undefined;
  return Math.round(n * 100) / 100;
}

/** Behaviour mark out of 40 (CAMIS "Behavior" row). */
function BehaviourInput({ student, value, disabled, onChange, wide = false }: { student: StudentRow; value: string; disabled: boolean; onChange: (v: string) => void; wide?: boolean }) {
  const invalid = parseBehaviour(value) === undefined;
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={BEHAVIOUR_MAX}
        step={0.5}
        value={value}
        disabled={disabled}
        placeholder="–"
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        aria-label={`${student.name}: behaviour out of ${BEHAVIOUR_MAX}`}
        aria-invalid={invalid || undefined}
        data-testid={`behaviour-${student.id}`}
        className={`${wide ? "w-full" : "w-14"} rounded-xl border bg-white px-2 py-1.5 text-center text-sm tabular-nums text-text-primary-light focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 dark:bg-white/[0.04] dark:text-text-primary-dark ${
          invalid ? "border-red-400 dark:border-red-500/60" : "border-slate-200 dark:border-white/10"
        }`}
      />
      <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">/{BEHAVIOUR_MAX}</span>
    </div>
  );
}

function CountInput({
  student,
  field,
  value,
  disabled,
  onChange,
  wide = false,
}: {
  student: StudentRow;
  field: (typeof ATTENDANCE_FIELDS)[number];
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
  wide?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={999}
      step={1}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(toCount(e.target.value))}
      onFocus={(e) => e.target.select()}
      aria-label={`${field.label} days for ${student.name}`}
      className={`${wide ? "w-full" : "w-12"} rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-center text-xs tabular-nums text-text-primary-light focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-white/80`}
    />
  );
}

function AttendanceSummary({ counts }: { counts: AttendanceCounts }) {
  const total = attendanceTotal(counts);
  const pct = attendancePct(counts);
  return (
    <span className="whitespace-nowrap text-[11px] tabular-nums text-text-secondary-light dark:text-text-secondary-dark/70">
      <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{total}</span> day{total === 1 ? "" : "s"}
      {pct != null && (
        <>
          {" · "}
          <span className={`font-semibold ${pct >= 90 ? "text-emerald-700 dark:text-emerald-300" : pct >= 75 ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}`}>{pct}%</span>
        </>
      )}
    </span>
  );
}

interface RowHandlers {
  onCountChange: (studentId: number, key: AttendanceKey, value: number) => void;
  onBehaviourChange: (studentId: number, value: string) => void;
  onAttributeChange: (studentId: number, attr: string, rating: AttributeRating) => void;
  onCommentChange: (studentId: number, comment: string) => void;
  onDraft?: (student: StudentRow) => void;
}

// ─── Mobile student card (accordion) ──────────────────────────────────────────

function MobileStudentCard({
  student,
  state,
  attributes,
  locked,
  handlers,
  onSave,
  drafting = false,
}: {
  student: StudentRow;
  state: StudentFormState;
  attributes: string[];
  locked: boolean;
  handlers: RowHandlers;
  onSave: (student: StudentRow) => Promise<void>;
  drafting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const completedCount = attributes.filter((a) => state.attributes[a]).length;
  const n = attributes.length || 1;

  return (
    <div
      data-testid={`student-card-${student.id}`}
      className={`rounded-2xl border overflow-hidden transition-colors duration-200 ${ state.saved ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5" : open ? "border-blue-300 dark:border-blue-400/30 bg-white dark:bg-white/5" : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20" }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          {student.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{student.name}</span>
            {state.saved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            {locked && <LockBadge />}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <AttendanceSummary counts={state.attendance} />
            <span className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark/70">
              {completedCount}/{attributes.length} attributes rated
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 relative w-8 h-8 mr-1">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="12" fill="none" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="3" />
            <circle
              cx="16" cy="16" r="12"
              fill="none"
              stroke={completedCount === attributes.length ? "#10b981" : "#3b82f6"}
              strokeWidth="3"
              strokeDasharray={`${(completedCount / n) * 75.4} 75.4`}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text-secondary-light dark:text-text-secondary-dark/70">
            {completedCount}/{attributes.length}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/70 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-100 dark:border-white/[0.08]">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 mb-2 mt-2">
                  Attendance (days this term)
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {ATTENDANCE_FIELDS.map((f) => (
                    <label key={f.key} className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-semibold ${f.cls}`}>{f.label}</span>
                      <CountInput
                        student={student}
                        field={f}
                        value={state.attendance[f.key]}
                        disabled={locked}
                        onChange={(v) => handlers.onCountChange(student.id, f.key, v)}
                        wide
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 mb-2">
                  Behaviour (out of {BEHAVIOUR_MAX})
                </p>
                <div className="max-w-[9rem]">
                  <BehaviourInput student={student} value={state.behaviour} disabled={locked} onChange={(v) => handlers.onBehaviourChange(student.id, v)} wide />
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 mb-2">
                  Conduct &amp; Attributes
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attributes.map((attr) => (
                    <div
                      key={attr}
                      className={`rounded-xl p-2.5 border transition-colors ${ state.attributes[attr] ? "border-blue-200 dark:border-blue-400/20 bg-blue-50/60 dark:bg-blue-500/10" : "border-slate-100 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03]" }`}
                    >
                      <p className="text-[11px] font-semibold text-text-secondary-light dark:text-text-secondary-dark/80 mb-1.5">{attr}</p>
                      <div className="flex flex-col gap-1">
                        {RATINGS.map((rating) => (
                          <RadioPill
                            key={rating}
                            name={`m-${attr}-${student.id}`}
                            value={rating}
                            checked={state.attributes[attr] === rating}
                            onChange={() => handlers.onAttributeChange(student.id, attr, rating)}
                            label={rating === "Very good" ? "V.Good" : rating}
                            colorClass={RATING_COLORS[rating]}
                            disabled={locked}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Teacher's Comment
                  <span className="normal-case font-normal text-text-secondary-light/60 dark:text-text-secondary-dark/40 ml-1">(optional)</span>
                  {handlers.onDraft && !locked && (
                    <span className="ml-auto normal-case tracking-normal">
                      <AiDraftButton student={student} busy={drafting} onDraft={handlers.onDraft} />
                    </span>
                  )}
                </p>
                <textarea
                  value={state.comment}
                  onChange={(e) => handlers.onCommentChange(student.id, e.target.value)}
                  readOnly={locked}
                  placeholder="Write a comment about this student…"
                  rows={3}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-text-primary-light dark:text-white/80 placeholder-slate-400 dark:placeholder-white/25 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/60 transition-colors scrollbar-thin read-only:opacity-70"
                  aria-label={`Comment for ${student.name}`}
                />
              </div>

              {state.error && (
                <p className="text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {state.error}
                </p>
              )}

              {locked ? (
                <p className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs text-text-secondary-light dark:border-white/10 dark:text-text-secondary-dark/70">
                  <Lock className="h-3.5 w-3.5" aria-hidden /> {LOCK_HINT}
                </p>
              ) : (
                <button
                  onClick={() => onSave(student)}
                  disabled={state.saving || state.saved}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-colors duration-200 active:scale-[0.98] ${state.saved ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 cursor-default" : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 disabled:opacity-40 disabled:cursor-not-allowed" }`}
                >
                  {state.saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : state.saved ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {state.saving ? "Saving…" : state.saved ? "Saved" : "Save Student"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Desktop table row ────────────────────────────────────────────────────────

function StudentTableRow({
  student,
  state,
  attributes,
  locked,
  handlers,
  drafting = false,
}: {
  student: StudentRow;
  state: StudentFormState;
  attributes: string[];
  locked: boolean;
  handlers: RowHandlers;
  drafting?: boolean;
}) {
  return (
    <tr
      data-testid={`student-row-${student.id}`}
      title={locked ? LOCK_HINT : undefined}
      className={`border-b border-slate-100 dark:border-white/5 transition-colors ${locked ? "bg-slate-50/70 dark:bg-white/[0.02]" : state.saved ? "bg-emerald-50/50 dark:bg-emerald-500/5" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"}`}
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{student.name}</span>
          {state.saved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
          {locked && <LockBadge />}
        </div>
      </td>

      {ATTENDANCE_FIELDS.map((f) => (
        <td key={f.key} className="px-1 py-3 text-center">
          <CountInput
            student={student}
            field={f}
            value={state.attendance[f.key]}
            disabled={locked}
            onChange={(v) => handlers.onCountChange(student.id, f.key, v)}
          />
        </td>
      ))}
      <td className="px-2 py-3" data-testid={`attendance-total-${student.id}`}>
        <AttendanceSummary counts={state.attendance} />
      </td>
      <td className="px-2 py-3">
        <BehaviourInput student={student} value={state.behaviour} disabled={locked} onChange={(v) => handlers.onBehaviourChange(student.id, v)} />
      </td>

      {attributes.map((attr) => (
        <td key={attr} className="px-3 py-3">
          <div className="flex flex-col gap-1">
            {RATINGS.map((rating) => (
              <RadioPill
                key={rating}
                name={`${attr}-${student.id}`}
                value={rating}
                checked={state.attributes[attr] === rating}
                onChange={() => handlers.onAttributeChange(student.id, attr, rating)}
                label={rating === "Very good" ? "V.Good" : rating}
                colorClass={RATING_COLORS[rating]}
                disabled={locked}
              />
            ))}
          </div>
        </td>
      ))}

      <td className="px-4 py-3 min-w-[180px]">
        <textarea
          value={state.comment}
          onChange={(e) => handlers.onCommentChange(student.id, e.target.value)}
          readOnly={locked}
          placeholder="Teacher's comment…"
          rows={2}
          className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-2 text-text-primary-light dark:text-white/80 placeholder-slate-400 dark:placeholder-white/25 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400/60 focus:bg-white dark:focus:bg-slate-700 transition-colors scrollbar-thin read-only:opacity-70"
          aria-label={`Comment for ${student.name}`}
        />
        {handlers.onDraft && !locked && (
          <div className="mt-1 flex justify-end">
            <AiDraftButton student={student} busy={drafting} onDraft={handlers.onDraft} compact />
          </div>
        )}
        {state.error && (
          <p className="text-red-600 dark:text-red-400 text-[10px] mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {state.error}
          </p>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/** "Open in my AI ▾" for one student's comment: who it is for, then the hand-off control. */
function HandoffPicker({
  students,
  value,
  onChange,
  disabled,
  control,
}: {
  students: StudentRow[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  control: React.ReactNode;
}) {
  const { policy } = useAiPolicy();
  if (!policy?.external?.handoff) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="report-comment-handoff-picker">
      <Select
        size="sm"
        variant="outline"
        className="min-w-[12rem]"
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        aria-label="Student for Open in my AI"
      >
        <option value="">Open in my AI for…</option>
        {students.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.name}
          </option>
        ))}
      </Select>
      {value && control}
    </div>
  );
}

export default function GeneralAttributesForm({
  students,
  term,
  academicYear,
  initialData,
  onAllSaved,
  results,
  attributes: attributesProp,
  lockedStudentIds,
  onImportAttendance,
  hideHeading = false,
}: GeneralAttributesFormProps) {
  const [formState, setFormState] = useState<Record<number, StudentFormState>>(() =>
    buildInitialState(students, initialData),
  );
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  // Cards the server refused with 409 CARD_LOCKED during this session.
  const [lockedLocal, setLockedLocal] = useState<Set<number>>(() => new Set());
  // AI comment drafts: who is being drafted now, and the bulk run's progress.
  const [drafting, setDrafting] = useState<Record<number, boolean>>({});
  // My AI: a one-off choice for drafting ("" = the person's default) and who answered last.
  const [aiRoute, setAiRoute] = useState("");
  const [lastAi, setLastAi] = useState<AiAnswer | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const formStateRef = useRef(formState);
  formStateRef.current = formState;
  const [query, setQuery] = useState("");
  const [fillDays, setFillDays] = useState("");
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ── The attribute list: the prop, else the school's scheme ──
  const [schemeAttributes, setSchemeAttributes] = useState<string[] | null>(null);
  const [schemeState, setSchemeState] = useState<"idle" | "loading" | "failed">(attributesProp ? "idle" : "loading");
  useEffect(() => {
    if (attributesProp) return;
    let live = true;
    setSchemeState("loading");
    ReportCardWorkflowApi.scheme()
      .then((res) => {
        if (!live) return;
        const list = res?.data?.scheme?.attributes;
        if (Array.isArray(list) && list.length) setSchemeAttributes(list);
        setSchemeState("idle");
      })
      .catch(() => live && setSchemeState("failed"));
    return () => {
      live = false;
    };
  }, [attributesProp]);
  const attributes: string[] = useMemo(
    () => (attributesProp && attributesProp.length ? attributesProp : schemeAttributes ?? [...GENERAL_ATTRIBUTES]),
    [attributesProp, schemeAttributes],
  );

  // ── Keep rows in step with the student list and refreshed initialData ──
  // New students get a row; rows nobody has edited or saved here take the
  // fresh data (an attendance import, say). Edited/saved rows are never overwritten.
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    setFormState((prev) => {
      const next: Record<number, StudentFormState> = { ...prev };
      for (const s of students) {
        const cur = prev[s.id];
        if (!cur) next[s.id] = rowFromInitial(initialData?.[s.id]);
        else if (!cur.dirty && !cur.saving && !cur.saved && initialData?.[s.id]) {
          next[s.id] = { ...rowFromInitial(initialData[s.id]), reportCardId: cur.reportCardId };
        }
      }
      return next;
    });
  }, [students, initialData]);

  const isLocked = useCallback(
    (id: number) => !!lockedStudentIds?.has(id) || lockedLocal.has(id),
    [lockedStudentIds, lockedLocal],
  );
  const rowOf = (id: number): StudentFormState => formState[id] ?? rowFromInitial(initialData?.[id]);

  const updateScrollFades = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollFades();
    window.addEventListener("resize", updateScrollFades);
    return () => window.removeEventListener("resize", updateScrollFades);
  }, [updateScrollFades, students.length, attributes.length]);

  /** Change one student's row (creating it if the list just grew). */
  const patchRow = useCallback(
    (studentId: number, patch: (row: StudentFormState) => Partial<StudentFormState>) => {
      setFormState((prev) => {
        const row = prev[studentId] ?? rowFromInitial(undefined);
        return { ...prev, [studentId]: { ...row, ...patch(row) } };
      });
    },
    [],
  );

  const handlers: RowHandlers = {
    onCountChange: (studentId, key, value) =>
      patchRow(studentId, (r) => ({ attendance: { ...r.attendance, [key]: value }, saved: false, dirty: true })),
    onAttributeChange: (studentId, attr, rating) =>
      patchRow(studentId, (r) => ({ attributes: { ...r.attributes, [attr]: rating }, saved: false, dirty: true })),
    onCommentChange: (studentId, comment) => patchRow(studentId, () => ({ comment, saved: false, dirty: true })),
    onBehaviourChange: (studentId, behaviour) => patchRow(studentId, () => ({ behaviour, saved: false, dirty: true })),
    onDraft: (s) => void draftComment(s),
  };

  /** What the AI reads for one student (the same for the school AI and "Open in my AI"). */
  const commentBody = (student: StudentRow) => {
    const state = formStateRef.current[student.id] ?? rowFromInitial(undefined);
    return {
      term,
      academic_year: academicYear,
      subjects: results?.[student.id] ?? [],
      attributes: attributes
        .filter((a) => state.attributes[a])
        .map((a) => ({ attribute_name: a, rating: state.attributes[a] as AttributeRating })),
      attendance: dominantAttendance(state.attendance),
      current: state.comment.trim() || null,
    };
  };

  const putComment = (student: StudentRow, comment: string) => {
    const text = comment.split("[NAME]").join(firstName(student.name));
    patchRow(student.id, () => ({ comment: text, saved: false, dirty: true }));
  };

  /** "Open in my AI ▾": which student's comment the hand-off is for. */
  const [handoffStudentId, setHandoffStudentId] = useState<string>("");
  const handoffStudent = students.find((s) => String(s.id) === handoffStudentId) ?? null;
  const handoffRequest = async (aiHandoff: AiHandoffRequest) => {
    if (!handoffStudent || !formStateRef.current[handoffStudent.id]) throw new Error("Choose the student first.");
    return ReportCardApiService.draftComment({ ...commentBody(handoffStudent), aiHandoff });
  };

  /** Draft one student's comment with AI into the comment box (unsaved). Returns false on failure. */
  const draftComment = async (student: StudentRow, quiet = false): Promise<boolean> => {
    if (!formStateRef.current[student.id] || isLocked(student.id)) return false;
    setDrafting((d) => ({ ...d, [student.id]: true }));
    try {
      const res = await ReportCardApiService.draftComment({
        ...commentBody(student),
        ...(aiRoute ? { aiRoute } : {}),
      });
      setLastAi(res.ai ?? res.data.ai ?? null);
      putComment(student, res.data.comment);
      if (!quiet) toast.success(`Drafted a comment for ${firstName(student.name)}. Check it, then save.`);
      return true;
    } catch (e) {
      if (!quiet) toast.error(apiMessage(e, "The AI couldn't draft this comment. Try again."));
      return false;
    } finally {
      setDrafting((d) => ({ ...d, [student.id]: false }));
    }
  };

  const editableStudents = students.filter((s) => !isLocked(s.id));

  /** Draft every empty comment (two at a time, so free AI tiers aren't flooded). */
  const draftEmptyComments = async () => {
    const todo = editableStudents.filter((s) => !formStateRef.current[s.id]?.comment.trim());
    if (!todo.length) return;
    setBulk({ done: 0, total: todo.length });
    let failed = 0;
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const s = todo[next++];
        if (!(await draftComment(s, true))) failed++;
        setBulk((b) => (b ? { ...b, done: b.done + 1 } : b));
      }
    };
    await Promise.all([worker(), worker()]);
    setBulk(null);
    if (failed) toast.error(`${failed} comment${failed === 1 ? "" : "s"} couldn't be drafted. Try those again.`);
    else toast.success(`Drafted ${todo.length} comment${todo.length === 1 ? "" : "s"}. Check them, then save.`);
  };
  const emptyCount = editableStudents.filter((s) => !formState[s.id]?.comment.trim()).length;

  const saveStudent = async (student: StudentRow, notify = false): Promise<number | null> => {
    if (isLocked(student.id)) return null;
    const state = formStateRef.current[student.id] ?? rowFromInitial(initialData?.[student.id]);
    const rated = attributes
      .filter((a) => state.attributes[a])
      .map((a) => ({ attribute_name: a, rating: state.attributes[a]! }));

    const behaviour = parseBehaviour(state.behaviour);
    if (behaviour === undefined) {
      const message = `Behaviour must be between 0 and ${BEHAVIOUR_MAX}.`;
      patchRow(student.id, () => ({ error: message }));
      if (notify) toast.error(`${student.name}: ${message}`);
      return null;
    }

    if (rated.length === 0) {
      const message = "Please rate at least one attribute.";
      patchRow(student.id, () => ({ error: message }));
      if (notify) toast.error(`${student.name}: ${message}`);
      return null;
    }

    patchRow(student.id, () => ({ saving: true, error: null }));

    try {
      const result = await ReportCardApiService.saveAttributes({
        student_id: student.id,
        term,
        academic_year: academicYear,
        class_teacher_comment: state.comment.trim() || null,
        attendance_present: state.attendance.present,
        attendance_absent: state.attendance.absent,
        attendance_excused: state.attendance.excused,
        attendance_late: state.attendance.late,
        attendance_sick: state.attendance.sick,
        behaviour_mark: behaviour,
        attributes: rated,
      });

      patchRow(student.id, () => ({ saving: false, saved: true, dirty: false, reportCardId: result.data.report_card_id }));
      if (notify) toast.success(`Saved ${student.name}'s attributes.`);
      return result.data.report_card_id;
    } catch (e) {
      const res = (e as { response?: { status?: number; data?: { code?: string } } })?.response;
      if (res?.status === 409 && res.data?.code === "CARD_LOCKED") {
        setLockedLocal((prev) => new Set(prev).add(student.id));
        const message = apiMessage(e, "This report card is past draft and can't be changed.");
        patchRow(student.id, () => ({ saving: false, error: null }));
        toast.error(`${student.name}: ${message}`);
        return null;
      }
      const message = apiMessage(e, "Save failed. Try again.");
      patchRow(student.id, () => ({ saving: false, error: message }));
      if (notify) toast.error(`${student.name}: ${message}`);
      return null;
    }
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    const todo = students.filter((s) => !isLocked(s.id));
    const skipped = students.length - todo.length;
    const savedIds: number[] = [];

    for (const student of todo) {
      const rcId = await saveStudent(student);
      if (rcId !== null) savedIds.push(rcId);
    }

    setIsSavingAll(false);
    const skippedNote = skipped ? ` ${skipped} locked card${skipped === 1 ? "" : "s"} left unchanged.` : "";

    if (todo.length > 0 && savedIds.length === todo.length) {
      toast.success(`All ${savedIds.length} student records saved successfully.${skippedNote}`);
      onAllSaved?.(savedIds);
    } else if (todo.length === 0) {
      toast.warning("Every card here is locked. Reopen them to draft to change them.");
    } else {
      toast.warning(`${savedIds.length} of ${todo.length} records saved. Check errors above.${skippedNote}`);
    }
  };

  const handleImport = async () => {
    if (!onImportAttendance) return;
    setImporting(true);
    try {
      const msg = await onImportAttendance();
      toast.success(typeof msg === "string" && msg ? msg : "Attendance imported from the registers.");
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't import attendance. Try again."));
    } finally {
      setImporting(false);
    }
  };

  const savedCount = editableStudents.filter((s) => formState[s.id]?.saved).length;
  const allSaved = editableStudents.length > 0 && savedCount === editableStudents.length;
  const progressPct = editableStudents.length > 0 ? Math.round((savedCount / editableStudents.length) * 100) : 0;
  const lockedCount = students.length - editableStudents.length;

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, query]);
  const filteredEditable = filteredStudents.filter((s) => !isLocked(s.id));

  // Bulk actions — rating a class of 18+ students one radio at a time is the
  // real friction in this workflow, so column quick-fill applies to every
  // currently visible (filtered), unlocked student in one action.
  const applyRatingToColumn = (attr: string, rating: AttributeRating) => {
    if (filteredEditable.length === 0) return;
    setFormState((prev) => {
      const next = { ...prev };
      for (const s of filteredEditable) {
        const row = next[s.id] ?? rowFromInitial(undefined);
        next[s.id] = { ...row, attributes: { ...row.attributes, [attr]: rating }, saved: false, dirty: true };
      }
      return next;
    });
    toast.success(`Set ${attr} to "${rating}" for ${filteredEditable.length} student${filteredEditable.length !== 1 ? "s" : ""}.`);
  };

  /** Copy the first visible row's count down the column. */
  const fillDownCount = (key: AttendanceKey) => {
    const [first, ...rest] = filteredEditable;
    if (!first || rest.length === 0) return;
    const value = rowOf(first.id).attendance[key];
    setFormState((prev) => {
      const next = { ...prev };
      for (const s of rest) {
        const row = next[s.id] ?? rowFromInitial(undefined);
        next[s.id] = { ...row, attendance: { ...row.attendance, [key]: value }, saved: false, dirty: true };
      }
      return next;
    });
    const label = ATTENDANCE_FIELDS.find((f) => f.key === key)?.label ?? key;
    toast.success(`Copied ${label} = ${value} to ${rest.length} student${rest.length !== 1 ? "s" : ""}.`);
  };

  /** Everyone visible present for N days, nothing else. */
  const markAllPresent = () => {
    const days = toCount(fillDays);
    if (!days || filteredEditable.length === 0) return;
    setFormState((prev) => {
      const next = { ...prev };
      for (const s of filteredEditable) {
        const row = next[s.id] ?? rowFromInitial(undefined);
        next[s.id] = { ...row, attendance: { ...ZERO_COUNTS, present: days }, saved: false, dirty: true };
      }
      return next;
    });
    toast.success(`Marked ${filteredEditable.length} student${filteredEditable.length !== 1 ? "s" : ""} present for ${days} day${days === 1 ? "" : "s"}.`);
  };

  return (
    <div className="p-4 md:p-6">

      {/* ── Sticky header + progress ── */}
      <div className="sticky top-16 z-10 pb-4 bg-gray-100/95 dark:bg-black/90 backdrop-blur-sm">
        <div className="pt-1 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {!hideHeading && (
            <div>
              <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                General Attributes
              </h1>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 mt-1.5 ml-0.5">
                {term} · {academicYear} · {students.length} student{students.length !== 1 ? "s" : ""}
                {lockedCount > 0 && ` · ${lockedCount} locked`}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            {students.length > 1 && (
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor="ga-fill-days">Days in term</label>
                <input
                  id="ga-fill-days"
                  type="number"
                  min={1}
                  max={999}
                  inputMode="numeric"
                  value={fillDays}
                  onChange={(e) => setFillDays(e.target.value)}
                  placeholder="Days"
                  className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-text-primary-light focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:border-white/10 dark:bg-slate-800 dark:text-white/80"
                />
                <button
                  type="button"
                  onClick={markAllPresent}
                  disabled={!toCount(fillDays) || filteredEditable.length === 0}
                  title="Set every visible, unlocked student present for this many days"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-text-primary-light transition-colors hover:border-blue-300 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-text-primary-dark"
                >
                  <UserCheck className="h-4 w-4" aria-hidden />
                  All present
                </button>
              </div>
            )}
            {onImportAttendance && (
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing}
                data-testid="import-attendance"
                title="Pull day counts from the attendance registers (locked cards are left alone)"
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                {importing ? "Importing…" : "Import attendance"}
              </button>
            )}
            {students.length > 6 && (
              <div className="relative flex-1 min-w-[140px] sm:flex-none">
                <Search className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search student…"
                  className="w-full sm:w-52 pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-text-primary-light dark:text-white/80 placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/60 transition-colors"
                  aria-label="Search students"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark/50 hover:text-text-primary-light dark:hover:text-white/80 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {students.length > 0 && (
              <div className="flex flex-col gap-1">
                <AiSourceControl idPrefix="report-comment-ai-source" value={aiRoute} onChange={setAiRoute} disabled={!!bulk} />
                <AiAnsweredBy ai={lastAi} />
                <HandoffPicker
                  students={editableStudents}
                  value={handoffStudentId}
                  onChange={setHandoffStudentId}
                  disabled={!!bulk}
                  control={
                    <HandoffControl
                      idPrefix="report-comment-handoff"
                      pupilData
                      disabled={!!bulk || !handoffStudent}
                      request={handoffRequest}
                      onImported={(body) => {
                        if (!handoffStudent) return;
                        setLastAi(body.ai ?? body.data?.ai ?? null);
                        putComment(handoffStudent, String(body.data?.comment ?? ""));
                      }}
                    />
                  }
                />
              </div>
            )}
            {students.length > 0 && (
              <button
                type="button"
                onClick={() => void draftEmptyComments()}
                disabled={!!bulk || emptyCount === 0}
                data-testid="ai-draft-all"
                title="Draft every empty comment with AI. Nothing is saved until you save."
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-40 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200"
              >
                {bulk ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {bulk ? `Drafting ${bulk.done}/${bulk.total}…` : `Draft empty comments (${emptyCount})`}
              </button>
            )}
            {savedCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-full px-3 py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedCount}/{editableStudents.length} saved
              </span>
            )}
            <button
              onClick={handleSaveAll}
              disabled={isSavingAll || allSaved || editableStudents.length === 0}
              data-testid="save-all-button"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 active:scale-95"
            >
              {isSavingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : allSaved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSavingAll ? "Saving…" : allSaved ? "All Saved" : "Save All"}
            </button>
          </div>
        </div>

        {editableStudents.length > 0 && (
          <div className="mt-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Saved progress
              </span>
              <span className="font-semibold text-text-primary-light dark:text-text-secondary-dark">{progressPct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
          {RATINGS.map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${RATING_DOT[r]}`} />
              {r}
            </span>
          ))}
          <span className="flex items-center gap-1 text-text-secondary-light/70 dark:text-text-secondary-dark/40">
            <MessageSquare className="w-3 h-3" /> Comment is optional
          </span>
          <span className="text-text-secondary-light/70 dark:text-text-secondary-dark/40">
            Attendance: days Present · Absent · Excused · Late · Sick; % = present + late
          </span>
          {schemeState === "loading" && (
            <span className="flex items-center gap-1" data-testid="scheme-loading">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Loading the school's attributes…
            </span>
          )}
          {schemeState === "failed" && (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3 w-3" aria-hidden /> Couldn't load the school's attribute list; showing the default one.
            </span>
          )}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="py-20 text-center text-text-secondary-light dark:text-text-secondary-dark/40">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No students in this class.</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-16 text-center text-text-secondary-light dark:text-text-secondary-dark/40">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No students match “{query}”.</p>
        </div>
      ) : (
        <>
          {/* ── Mobile / tablet: accordion cards (hidden on lg+) ── */}
          <div className="lg:hidden space-y-3 mt-4">
            {filteredStudents.map((student) => (
              <MobileStudentCard
                key={student.id}
                student={student}
                state={rowOf(student.id)}
                attributes={attributes}
                locked={isLocked(student.id)}
                handlers={handlers}
                onSave={async (s) => { await saveStudent(s, true); }}
                drafting={!!drafting[student.id]}
              />
            ))}
          </div>

          {/* ── Desktop: scrollable table (hidden below lg) ── */}
          <div className="hidden lg:block mt-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden relative">
            {canScrollLeft && (
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-white dark:from-gray-900 to-transparent" />
            )}
            {canScrollRight && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-white dark:from-gray-900 to-transparent" />
            )}
            <div className="overflow-x-auto" ref={tableScrollRef} onScroll={updateScrollFades}>
              <table className="w-full border-collapse text-sm" data-testid="attributes-table">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.03]">
                    <th className="px-4 pt-3" />
                    <th
                      colSpan={ATTENDANCE_FIELDS.length + 1}
                      className="px-2 pt-3 text-center text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider whitespace-nowrap border-x border-slate-100 dark:border-white/5"
                      title="Days this term for each register status"
                    >
                      Attendance
                    </th>
                    <th colSpan={attributes.length + 2} className="px-3 pt-3" />
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider whitespace-nowrap">
                      Student
                    </th>
                    {ATTENDANCE_FIELDS.map((f) => (
                      <th key={f.key} className="px-1 py-3 text-center text-xs font-semibold whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5">
                          <abbr title={f.label} className={`no-underline ${f.cls}`}>{f.short}</abbr>
                          <button
                            type="button"
                            onClick={() => fillDownCount(f.key)}
                            disabled={filteredEditable.length < 2}
                            aria-label={`Copy the first row's ${f.label} days to all visible students`}
                            title={`Copy the first row's ${f.label} days down`}
                            className="rounded p-0.5 text-text-secondary-light/60 transition-colors hover:text-blue-600 disabled:opacity-30 dark:text-text-secondary-dark/40 dark:hover:text-blue-400"
                          >
                            <ArrowDownToLine className="h-3 w-3" aria-hidden />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-3 text-left text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider whitespace-nowrap">
                      Total
                    </th>
                    <th
                      className="px-2 py-3 text-left text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider whitespace-nowrap"
                      title="Behaviour out of 40, printed first on the card and outside every total"
                    >
                      Behaviour
                    </th>
                    {attributes.map((attr) => (
                      <th
                        key={attr}
                        className="px-3 py-3 text-left text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1">
                          <span>{attr}</span>
                          <label className="relative">
                            <span className="sr-only">Quick fill {attr} for all visible students</span>
                            <Select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) applyRatingToColumn(attr, e.target.value as AttributeRating);
                                e.target.value = "";
                              }}
                              className="w-4"
                              aria-label={`Quick fill ${attr} for all visible students`}
                              title={`Quick fill ${attr}`}
                            >
                              <option value="" disabled>Fill…</option>
                              {RATINGS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </Select>
                            <Zap className="w-3 h-3 text-text-secondary-light/60 dark:text-text-secondary-dark/40 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" />
                          </label>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider">
                      Comment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <StudentTableRow
                      key={student.id}
                      student={student}
                      state={rowOf(student.id)}
                      attributes={attributes}
                      locked={isLocked(student.id)}
                      handlers={handlers}
                      drafting={!!drafting[student.id]}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-text-secondary-light dark:text-text-secondary-dark/50">
              <span>
                {filteredStudents.length !== students.length
                  ? `${filteredStudents.length} of ${students.length} students shown`
                  : `${students.length} student${students.length !== 1 ? "s" : ""} total`}
              </span>
              <span>{attributes.length} attributes · 3 rating levels</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
