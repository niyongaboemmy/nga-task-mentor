import { useState, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "react-toastify";
import { ReportCardApiService, type AttributeRating } from "../../services/reportCardApi";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present", color: "text-emerald-300 border-emerald-400/50 bg-emerald-500/10" },
  { value: "absent",  label: "Absent",  color: "text-red-300 border-red-400/50 bg-red-500/10" },
  { value: "late",    label: "Late",    color: "text-amber-300 border-amber-400/50 bg-amber-500/10" },
] as const;

type AttendanceStatus = "present" | "absent" | "late";

const RATING_COLORS: Record<AttributeRating, string> = {
  Excellent:  "text-emerald-300 border-emerald-400/50 bg-emerald-500/10",
  "Very good": "text-blue-300 border-blue-400/50 bg-blue-500/10",
  Good:        "text-amber-300 border-amber-400/50 bg-amber-500/10",
};

const ATTENDANCE_META: Record<AttendanceStatus, { label: string; cls: string }> = {
  present: { label: "Present", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" },
  absent:  { label: "Absent",  cls: "bg-red-500/20 text-red-300 border-red-400/30" },
  late:    { label: "Late",    cls: "bg-amber-500/20 text-amber-300 border-amber-400/30" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentRow {
  id: number;
  name: string;
}

export interface StudentInitialData {
  attendance: AttendanceStatus;
  attributes: Partial<Record<GeneralAttribute, AttributeRating>>;
  comment: string;
}

interface StudentFormState {
  attendance: AttendanceStatus;
  attributes: Partial<Record<GeneralAttribute, AttributeRating>>;
  comment: string;
  saved: boolean;
  saving: boolean;
  error: string | null;
  reportCardId: number | null;
}

export interface GeneralAttributesFormProps {
  students: StudentRow[];
  term: string;
  academicYear: string;
  initialData?: Record<number, StudentInitialData>;
  onAllSaved?: (reportCardIds: number[]) => void;
}

function buildInitialState(
  students: StudentRow[],
  initialData?: Record<number, StudentInitialData>,
): Record<number, StudentFormState> {
  return Object.fromEntries(
    students.map((s) => {
      const pre = initialData?.[s.id];
      return [
        s.id,
        {
          attendance: pre?.attendance ?? ("present" as AttendanceStatus),
          attributes: pre?.attributes ?? {},
          comment: pre?.comment ?? "",
          saved: false,
          saving: false,
          error: null,
          reportCardId: null,
        },
      ];
    }),
  );
}

// ─── Radio pill ───────────────────────────────────────────────────────────────

function RadioPill({
  name,
  value,
  checked,
  onChange,
  label,
  colorClass,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  colorClass: string;
}) {
  return (
    <label
      className={`
        flex items-center justify-center px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer
        transition-all duration-150 select-none
        ${checked
          ? `${colorClass} border-opacity-100 shadow-sm`
          : "text-white/40 border-white/10 hover:text-white/70 hover:border-white/25 bg-transparent"
        }
      `}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
        aria-label={label}
      />
      {label}
    </label>
  );
}

// ─── Mobile student card (accordion) ──────────────────────────────────────────

function MobileStudentCard({
  student,
  state,
  onAttendanceChange,
  onAttributeChange,
  onCommentChange,
  onSave,
}: {
  student: StudentRow;
  state: StudentFormState;
  onAttendanceChange: (studentId: number, value: AttendanceStatus) => void;
  onAttributeChange: (studentId: number, attr: GeneralAttribute, rating: AttributeRating) => void;
  onCommentChange: (studentId: number, comment: string) => void;
  onSave: (student: StudentRow) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const completedCount = GENERAL_ATTRIBUTES.filter((a) => state.attributes[a]).length;
  const attMeta = ATTENDANCE_META[state.attendance];

  return (
    <div
      data-testid={`student-card-${student.id}`}
      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${ state.saved ? "border-emerald-500/30 bg-emerald-500/5" : open ? "border-indigo-400/30 bg-white/5" : "border-white/10 bg-white/5 hover:border-white/20" }`}
    >
      {/* Card header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg shadow-indigo-500/20">
          {student.name.charAt(0).toUpperCase()}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white/90">{student.name}</span>
            {state.saved && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${attMeta.cls}`}>
              {attMeta.label}
            </span>
            <span className="text-[10px] text-white/40">
              {completedCount}/{GENERAL_ATTRIBUTES.length} attributes rated
            </span>
            {completedCount === GENERAL_ATTRIBUTES.length && (
              <span className="text-[10px] text-emerald-400 font-semibold">✓ Complete</span>
            )}
          </div>
        </div>

        {/* Progress ring */}
        <div className="flex-shrink-0 relative w-8 h-8 mr-1">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle
              cx="16" cy="16" r="12"
              fill="none"
              stroke={completedCount === GENERAL_ATTRIBUTES.length ? "#34d399" : "#818cf8"}
              strokeWidth="3"
              strokeDasharray={`${(completedCount / GENERAL_ATTRIBUTES.length) * 75.4} 75.4`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/60">
            {completedCount}/{GENERAL_ATTRIBUTES.length}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expandable body */}
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
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/8">
              {/* Attendance */}
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-2 mt-2">
                  Attendance (overall status for the term)
                </p>
                <div className="flex gap-2 flex-wrap">
                  {ATTENDANCE_OPTIONS.map(({ value, label, color }) => (
                    <RadioPill
                      key={value}
                      name={`m-attendance-${student.id}`}
                      value={value}
                      checked={state.attendance === value}
                      onChange={() => onAttendanceChange(student.id, value)}
                      label={label}
                      colorClass={color}
                    />
                  ))}
                </div>
              </div>

              {/* Attributes grid */}
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-2">
                  Conduct &amp; Attributes
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GENERAL_ATTRIBUTES.map((attr) => (
                    <div
                      key={attr}
                      className={`rounded-xl p-2.5 border transition-colors ${ state.attributes[attr] ? "border-indigo-400/20 bg-indigo-500/10" : "border-white/8 bg-white/3" }`}
                    >
                      <p className="text-[11px] font-semibold text-white/60 mb-1.5 flex items-center justify-between">
                        <span>{attr}</span>
                        {state.attributes[attr] && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ RATING_COLORS[state.attributes[attr]!] }`}>
                            {state.attributes[attr] === "Very good" ? "VG" : state.attributes[attr]!.slice(0, 1)}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-col gap-1">
                        {RATINGS.map((rating) => (
                          <RadioPill
                            key={rating}
                            name={`m-${attr}-${student.id}`}
                            value={rating}
                            checked={state.attributes[attr] === rating}
                            onChange={() => onAttributeChange(student.id, attr, rating)}
                            label={rating === "Very good" ? "V.Good" : rating}
                            colorClass={RATING_COLORS[rating]}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Teacher's Comment
                  <span className="normal-case font-normal text-white/25 ml-1">(optional)</span>
                </p>
                <textarea
                  value={state.comment}
                  onChange={(e) => onCommentChange(student.id, e.target.value)}
                  placeholder="Write a comment about this student…"
                  rows={3}
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white/80 placeholder-white/25 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400/50 transition-all scrollbar-thin"
                  aria-label={`Comment for ${student.name}`}
                />
              </div>

              {/* Error */}
              {state.error && (
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {state.error}
                </p>
              )}

              {/* Per-student save */}
              <button
                onClick={() => onSave(student)}
                disabled={state.saving || state.saved}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all duration-200 active:scale-[0.98] ${state.saved ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300 cursor-default" : "bg-indigo-600/20 border-indigo-400/30 text-indigo-300 hover:bg-indigo-600/35 disabled:opacity-40 disabled:cursor-not-allowed" }`}
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
  onAttendanceChange,
  onAttributeChange,
  onCommentChange,
}: {
  student: StudentRow;
  state: StudentFormState;
  onAttendanceChange: (studentId: number, value: AttendanceStatus) => void;
  onAttributeChange: (studentId: number, attr: GeneralAttribute, rating: AttributeRating) => void;
  onCommentChange: (studentId: number, comment: string) => void;
}) {
  return (
    <tr
      data-testid={`student-row-${student.id}`}
      className={`border-b border-white/5 transition-colors ${state.saved ? "bg-emerald-500/5" : "hover:bg-white/2"}`}
    >
      {/* Student name */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-white/90">{student.name}</span>
          {state.saved && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          )}
        </div>
      </td>

      {/* Attendance */}
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          {ATTENDANCE_OPTIONS.map(({ value, label, color }) => (
            <RadioPill
              key={value}
              name={`attendance-${student.id}`}
              value={value}
              checked={state.attendance === value}
              onChange={() => onAttendanceChange(student.id, value)}
              label={label}
              colorClass={color}
            />
          ))}
        </div>
      </td>

      {/* General Attributes */}
      {GENERAL_ATTRIBUTES.map((attr) => (
        <td key={attr} className="px-3 py-3">
          <div className="flex flex-col gap-1">
            {RATINGS.map((rating) => (
              <RadioPill
                key={rating}
                name={`${attr}-${student.id}`}
                value={rating}
                checked={state.attributes[attr] === rating}
                onChange={() => onAttributeChange(student.id, attr, rating)}
                label={rating === "Very good" ? "V.Good" : rating}
                colorClass={RATING_COLORS[rating]}
              />
            ))}
          </div>
        </td>
      ))}

      {/* Comment */}
      <td className="px-4 py-3 min-w-[180px]">
        <textarea
          value={state.comment}
          onChange={(e) => onCommentChange(student.id, e.target.value)}
          placeholder="Teacher's comment…"
          rows={2}
          className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white/80 placeholder-white/25 resize-none focus:outline-none focus:border-indigo-400/60 focus:bg-white/8 transition-colors scrollbar-thin"
          aria-label={`Comment for ${student.name}`}
        />
        {state.error && (
          <p className="text-red-400 text-[10px] mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {state.error}
          </p>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GeneralAttributesForm({
  students,
  term,
  academicYear,
  initialData,
  onAllSaved,
}: GeneralAttributesFormProps) {
  const [formState, setFormState] = useState<Record<number, StudentFormState>>(() =>
    buildInitialState(students, initialData),
  );
  const [isSavingAll, setIsSavingAll] = useState(false);

  const updateStudentField = useCallback(
    <K extends keyof StudentFormState>(studentId: number, field: K, value: StudentFormState[K]) => {
      setFormState((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], [field]: value },
      }));
    },
    [],
  );

  const handleAttendanceChange = useCallback(
    (studentId: number, value: AttendanceStatus) => {
      updateStudentField(studentId, "attendance", value);
    },
    [updateStudentField],
  );

  const handleAttributeChange = useCallback(
    (studentId: number, attr: GeneralAttribute, rating: AttributeRating) => {
      setFormState((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          attributes: { ...prev[studentId].attributes, [attr]: rating },
        },
      }));
    },
    [],
  );

  const handleCommentChange = useCallback(
    (studentId: number, comment: string) => {
      updateStudentField(studentId, "comment", comment);
    },
    [updateStudentField],
  );

  const saveStudent = async (student: StudentRow): Promise<number | null> => {
    const state = formState[student.id];
    const attributes = GENERAL_ATTRIBUTES.filter((a) => state.attributes[a]).map((a) => ({
      attribute_name: a,
      rating: state.attributes[a]!,
    }));

    if (attributes.length === 0) {
      setFormState((prev) => ({
        ...prev,
        [student.id]: { ...prev[student.id], error: "Please rate at least one attribute." },
      }));
      return null;
    }

    setFormState((prev) => ({
      ...prev,
      [student.id]: { ...prev[student.id], saving: true, error: null },
    }));

    try {
      const result = await ReportCardApiService.saveAttributes({
        student_id: student.id,
        term,
        academic_year: academicYear,
        class_teacher_comment: state.comment.trim() || null,
        attendance_present: state.attendance === "present" ? 1 : 0,
        attendance_absent:  state.attendance === "absent"  ? 1 : 0,
        attendance_late:    state.attendance === "late"    ? 1 : 0,
        attributes,
      });

      setFormState((prev) => ({
        ...prev,
        [student.id]: {
          ...prev[student.id],
          saving: false,
          saved: true,
          reportCardId: result.data.report_card_id,
        },
      }));
      return result.data.report_card_id;
    } catch {
      setFormState((prev) => ({
        ...prev,
        [student.id]: { ...prev[student.id], saving: false, error: "Save failed. Try again." },
      }));
      return null;
    }
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    const savedIds: number[] = [];

    for (const student of students) {
      const rcId = await saveStudent(student);
      if (rcId !== null) savedIds.push(rcId);
    }

    setIsSavingAll(false);

    if (savedIds.length === students.length) {
      toast.success(`All ${savedIds.length} student records saved successfully.`);
      onAllSaved?.(savedIds);
    } else {
      toast.warning(`${savedIds.length} of ${students.length} records saved. Check errors above.`);
    }
  };

  const savedCount  = Object.values(formState).filter((s) => s.saved).length;
  const allSaved    = savedCount === students.length && students.length > 0;
  const progressPct = students.length > 0 ? Math.round((savedCount / students.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 md:p-6">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            General Attributes
          </h1>
          <p className="text-sm text-white/50 mt-1.5 ml-0.5">
            {term} · {academicYear} · {students.length} student{students.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savedCount}/{students.length} saved
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={isSavingAll || allSaved}
            data-testid="save-all-button"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 transition-all duration-200 active:scale-95"
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

      {/* ── Progress bar ── */}
      {students.length > 0 && (
        <div className="mb-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              Saved progress
            </span>
            <span className="font-semibold text-white/60">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* ── Legend (ratings reference) ── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-white/40">
        {RATINGS.map((r) => (
          <span key={r} className={`flex items-center gap-1.5 ${RATING_COLORS[r].split(" ")[0]}`}>
            <span className="w-2 h-2 rounded-full bg-current opacity-70" />
            {r}
          </span>
        ))}
        <span className="flex items-center gap-1 text-white/25">
          <MessageSquare className="w-3 h-3" /> Comment is optional
        </span>
      </div>

      {students.length === 0 ? (
        <div className="py-20 text-center text-white/30">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No students in this class.</p>
        </div>
      ) : (
        <>
          {/* ── Mobile / tablet: accordion cards (hidden on lg+) ── */}
          <div className="lg:hidden space-y-3">
            {students.map((student) => (
              <MobileStudentCard
                key={student.id}
                student={student}
                state={formState[student.id]}
                onAttendanceChange={handleAttendanceChange}
                onAttributeChange={handleAttributeChange}
                onCommentChange={handleCommentChange}
                onSave={async (s) => { await saveStudent(s); }}
              />
            ))}
          </div>

          {/* ── Desktop: scrollable table (hidden below lg) ── */}
          <div className="hidden lg:block bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" data-testid="attributes-table">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap">
                      Student
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap"
                      title="Overall attendance status for the term, not a day count"
                    >
                      Attendance
                    </th>
                    {GENERAL_ATTRIBUTES.map((attr) => (
                      <th
                        key={attr}
                        className="px-3 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap"
                      >
                        {attr}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Comment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <StudentTableRow
                      key={student.id}
                      student={student}
                      state={formState[student.id]}
                      onAttendanceChange={handleAttendanceChange}
                      onAttributeChange={handleAttributeChange}
                      onCommentChange={handleCommentChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between text-xs text-white/30">
              <span>{students.length} student{students.length !== 1 ? "s" : ""} total</span>
              <span>{GENERAL_ATTRIBUTES.length} attributes · 3 rating levels</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
