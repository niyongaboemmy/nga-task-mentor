import { useState, useCallback } from "react";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
} from "lucide-react";
import { toast } from "react-toastify";
import { ReportCardApiService, type AttributeRating } from "../../services/reportCardApi";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { value: "absent", label: "Absent", color: "text-red-300 border-red-400/50 bg-red-500/10" },
  { value: "late", label: "Late", color: "text-amber-300 border-amber-400/50 bg-amber-500/10" },
] as const;

type AttendanceStatus = "present" | "absent" | "late";

const RATING_COLORS: Record<AttributeRating, string> = {
  Excellent: "text-emerald-300 border-emerald-400/50 checked:bg-emerald-500",
  "Very good": "text-blue-300 border-blue-400/50",
  Good: "text-amber-300 border-amber-400/50",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentRow {
  id: number;
  name: string;
}

interface StudentFormState {
  attendance: AttendanceStatus;
  attributes: Partial<Record<GeneralAttribute, AttributeRating>>;
  comment: string;
  saved: boolean;
  saving: boolean;
  error: string | null;
}

export interface GeneralAttributesFormProps {
  students: StudentRow[];
  term: string;
  academicYear: string;
  /** Called after all students are saved successfully */
  onAllSaved?: () => void;
}

function buildInitialState(students: StudentRow[]): Record<number, StudentFormState> {
  return Object.fromEntries(
    students.map((s) => [
      s.id,
      {
        attendance: "present" as AttendanceStatus,
        attributes: {},
        comment: "",
        saved: false,
        saving: false,
        error: null,
      },
    ]),
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

// ─── Single student row ───────────────────────────────────────────────────────

function StudentFormRow({
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
      className={`
        border-b border-white/5 transition-colors
        ${state.saved ? "bg-emerald-500/5" : "hover:bg-white/2"}
      `}
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
          className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-2
            text-white/80 placeholder-white/25 resize-none
            focus:outline-none focus:border-indigo-400/60 focus:bg-white/8
            transition-colors scrollbar-thin"
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
  onAllSaved,
}: GeneralAttributesFormProps) {
  const [formState, setFormState] = useState<Record<number, StudentFormState>>(() =>
    buildInitialState(students),
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

  const saveStudent = async (student: StudentRow): Promise<boolean> => {
    const state = formState[student.id];
    const attributes = GENERAL_ATTRIBUTES.filter((a) => state.attributes[a]).map((a) => ({
      attribute_name: a,
      rating: state.attributes[a]!,
    }));

    if (attributes.length === 0) {
      setFormState((prev) => ({
        ...prev,
        [student.id]: {
          ...prev[student.id],
          error: "Please rate at least one attribute.",
        },
      }));
      return false;
    }

    setFormState((prev) => ({
      ...prev,
      [student.id]: { ...prev[student.id], saving: true, error: null },
    }));

    try {
      await ReportCardApiService.saveAttributes({
        student_id: student.id,
        term,
        academic_year: academicYear,
        class_teacher_comment: state.comment.trim() || null,
        attendance_present: state.attendance === "present" ? 1 : 0,
        attendance_absent: state.attendance === "absent" ? 1 : 0,
        attendance_late: state.attendance === "late" ? 1 : 0,
        attributes,
      });

      setFormState((prev) => ({
        ...prev,
        [student.id]: { ...prev[student.id], saving: false, saved: true },
      }));
      return true;
    } catch {
      setFormState((prev) => ({
        ...prev,
        [student.id]: {
          ...prev[student.id],
          saving: false,
          error: "Save failed. Try again.",
        },
      }));
      return false;
    }
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    let successCount = 0;

    for (const student of students) {
      const ok = await saveStudent(student);
      if (ok) successCount++;
    }

    setIsSavingAll(false);

    if (successCount === students.length) {
      toast.success(`All ${successCount} student records saved successfully.`);
      onAllSaved?.();
    } else {
      toast.warning(`${successCount} of ${students.length} records saved. Check errors above.`);
    }
  };

  const savedCount = Object.values(formState).filter((s) => s.saved).length;
  const allSaved = savedCount === students.length && students.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            General Attributes
          </h1>
          <p className="text-sm text-white/50 mt-0.5">
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
              bg-gradient-to-r from-indigo-500 to-purple-600 text-white
              hover:from-indigo-400 hover:to-purple-500
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-lg shadow-indigo-500/30 transition-all duration-200 active:scale-95"
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

      {/* Legend row */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-white/40">
        {RATINGS.map((r) => (
          <span key={r} className={`flex items-center gap-1 ${RATING_COLORS[r].split(" ")[0]}`}>
            <span className="w-2 h-2 rounded-full bg-current opacity-70" />
            {r}
          </span>
        ))}
        <span className="flex items-center gap-1 text-white/25">
          <MessageSquare className="w-3 h-3" /> Comment is optional
        </span>
      </div>

      {/* Table */}
      {students.length === 0 ? (
        <div className="py-20 text-center text-white/30">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No students in this class.</p>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" data-testid="attributes-table">
              <thead>
                <tr className="border-b border-white/10 bg-white/3">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap">
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
                  <StudentFormRow
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

          {/* Table footer summary */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between text-xs text-white/30">
            <span>{students.length} student{students.length !== 1 ? "s" : ""} total</span>
            <span>{GENERAL_ATTRIBUTES.length} attributes · 3 rating levels</span>
          </div>
        </div>
      )}
    </div>
  );
}
