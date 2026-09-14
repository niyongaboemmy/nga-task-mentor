import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  PencilRuler,
  Save,
  Loader2,
  Users,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  Zap,
  Eraser,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../../services/manualAssessmentApi";

export interface StudentEntry {
  student_id: number;
  name: string;
}

// ─── Create/Edit panel ────────────────────────────────────────────────────────

function CreatePanel({
  courseId,
  term,
  academicYear,
  existing,
  onCreated,
  onUpdated,
  onClose,
}: {
  courseId: number;
  term: string;
  academicYear: string;
  existing?: ManualAssessment;
  onCreated: (assessment: ManualAssessment) => void;
  onUpdated: (assessment: ManualAssessment) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [maxScore, setMaxScore] = useState(String(existing?.max_score ?? ""));
  const [saving, setSaving] = useState(false);

  const isEdit = !!existing;

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const parsedMax = parseFloat(maxScore);

    if (!trimmedTitle) {
      toast.error("Please enter a title.");
      return;
    }
    if (isNaN(parsedMax) || parsedMax <= 0) {
      toast.error("Max score must be a positive number.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && existing) {
        const res = await ManualAssessmentApiService.update(existing.id, {
          title: trimmedTitle,
          max_score: parsedMax,
        });
        if (res.success) {
          toast.success("Assessment updated.");
          onUpdated(res.data);
        }
      } else {
        const res = await ManualAssessmentApiService.create({
          course_id: courseId,
          title: trimmedTitle,
          max_score: parsedMax,
          term,
          academic_year: academicYear,
        });
        if (res.success) {
          toast.success("Manual assessment created. You can now enter scores.");
          onCreated(res.data);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-white">
          {isEdit ? "Edit Assessment" : "New Manual Assessment"}
        </h2>
        <p className="text-xs text-slate-400">
          {isEdit
            ? "Update the title or max score for this manual entry."
            : "Create a physical-paper assessment entry that applies to all students in this subject."}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Assessment Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Science Practical Exam, Mid-Term Paper"
            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Maximum Score (marks)
          </label>
          <input
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            min={1}
            step={1}
            placeholder="e.g. 50"
            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
          />
          <p className="text-[11px] text-slate-400">
            Each student's score will be entered as a value out of this maximum.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:bg-white/[0.08] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-900/40 transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : isEdit ? "Update" : "Create & Enter Scores"}
        </button>
      </div>
    </div>
  );
}

// ─── Score entry panel ────────────────────────────────────────────────────────

// Deterministic avatar gradient per student, matching the palette used for
// roster rows elsewhere in the app (CourseReportCardsPanel) so this feels
// like the same design system rather than a bespoke list.
const AVATAR_GRADIENTS = [
  "from-blue-400 to-orange-500",
  "from-blue-400 to-slate-500",
  "from-blue-400 to-blue-700",
  "from-orange-400 to-orange-600",
  "from-slate-400 to-blue-600",
  "from-blue-600 to-slate-800",
];

function ScoresPanel({
  assessment,
  students,
  onBack,
  onClose,
}: {
  assessment: ManualAssessment;
  students: StudentEntry[];
  onBack: () => void;
  onClose: () => void;
}) {
  const [scores, setScores] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await ManualAssessmentApiService.getScores(assessment.id);
        const initial: Record<number, string> = {};
        for (const s of res.data) {
          initial[s.student_id] = String(s.score);
        }
        setScores(initial);
      } catch {
        // no existing scores yet
      } finally {
        setLoading(false);
      }
    })();
  }, [assessment.id]);

  const handleSave = async () => {
    const maxScore = parseFloat(String(assessment.max_score));
    const entries: Array<{ student_id: number; score: number }> = [];
    const errors: string[] = [];

    for (const student of students) {
      const raw = scores[student.student_id];
      if (raw === undefined || raw === "") continue;
      const val = parseFloat(raw);
      if (isNaN(val) || val < 0) {
        errors.push(`${student.name}: invalid score`);
        continue;
      }
      if (val > maxScore) {
        errors.push(`${student.name}: score exceeds max (${maxScore})`);
        continue;
      }
      entries.push({ student_id: student.student_id, score: val });
    }

    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    if (entries.length === 0) {
      toast.error("No scores entered. Fill in at least one student's score.");
      return;
    }

    setSaving(true);
    try {
      await ManualAssessmentApiService.upsertScores(assessment.id, { scores: entries });
      toast.success(`Scores saved for ${entries.length} student(s).`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to save scores.");
    } finally {
      setSaving(false);
    }
  };

  const filledCount = Object.values(scores).filter((v) => v !== "" && v !== undefined).length;
  const maxScore = parseFloat(String(assessment.max_score));

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || String(s.student_id).includes(q),
    );
  }, [students, search]);

  // Enter jumps to the next visible row instead of submitting the form —
  // turns entering 20+ scores into a fast top-to-bottom keyboard flow
  // instead of click, type, click, type.
  const focusNext = useCallback(
    (fromStudentId: number) => {
      const idx = filteredStudents.findIndex((s) => s.student_id === fromStudentId);
      const next = filteredStudents[idx + 1];
      if (next) inputRefs.current[next.student_id]?.focus();
    },
    [filteredStudents],
  );

  const fillRemainingWithMax = () => {
    setScores((prev) => {
      const next = { ...prev };
      for (const s of students) {
        if (next[s.student_id] === undefined || next[s.student_id] === "") {
          next[s.student_id] = String(maxScore);
        }
      }
      return next;
    });
  };

  const clearAll = () => {
    if (!confirm("Clear every score entered in this session?")) return;
    setScores({});
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] flex-shrink-0 space-y-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">{assessment.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Max score: <span className="text-slate-300 font-semibold">{assessment.max_score}</span>
              {" · "}
              <span className="text-blue-400 font-semibold">{filledCount}</span> of {students.length} filled
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-orange-900/40 border border-orange-700/40 text-orange-300 flex-shrink-0">
            <Users className="w-3 h-3" />
            {students.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: students.length > 0 ? `${(filledCount / students.length) * 100}%` : "0%" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Search + quick actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/[0.1] text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
            />
          </div>
          <button
            onClick={fillRemainingWithMax}
            title={`Fill every empty score with the max (${maxScore})`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-900/40 border border-blue-700/40 text-blue-300 hover:bg-blue-800/50 transition-all flex-shrink-0"
          >
            <Zap className="w-3 h-3" />
            Fill max
          </button>
          <button
            onClick={clearAll}
            title="Clear every score entered in this session"
            className="flex items-center justify-center p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-slate-400 hover:bg-orange-900/30 hover:text-orange-300 hover:border-orange-700/40 transition-all flex-shrink-0"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Student score list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/[0.08]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-8 h-8 text-slate-400" />
            <p className="text-xs text-slate-400">No students found in this course.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Search className="w-8 h-8 text-slate-400" />
            <p className="text-xs text-slate-400">No students match "{search}".</p>
          </div>
        ) : (
          filteredStudents.map((student, idx) => {
            const val = scores[student.student_id] ?? "";
            const numVal = parseFloat(val);
            const isValid = val === "" || (!isNaN(numVal) && numVal >= 0 && numVal <= maxScore);
            const gradient = AVATAR_GRADIENTS[student.student_id % AVATAR_GRADIENTS.length];
            const initials = student.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase();

            return (
              <motion.div
                key={student.student_id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx, 12) * 0.015 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                  val !== "" && isValid
                    ? "bg-blue-950/20 border-blue-800/30"
                    : !isValid
                      ? "bg-orange-950/20 border-orange-800/30"
                      : "bg-white/[0.03] border-white/[0.06]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}
                >
                  {initials || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{student.name}</p>
                  <p className="text-[11px] text-slate-400">ID #{student.student_id}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    ref={(el) => { inputRefs.current[student.student_id] = el; }}
                    type="number"
                    value={val}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [student.student_id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNext(student.student_id);
                      }
                    }}
                    min={0}
                    max={maxScore}
                    step="any"
                    placeholder="0"
                    aria-label={`Score for ${student.name}`}
                    className={`w-20 px-3 py-1.5 rounded-lg text-sm text-right font-mono bg-white/[0.06] border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 hover:border-white/[0.2] ${!isValid ? "border-orange-500/50 focus:ring-orange-500/40 text-orange-400" : val !== "" ? "border-blue-600/50 text-blue-300" : "border-white/[0.14] text-slate-200" }`}
                  />
                  <span className="text-xs text-slate-400 w-10 text-right">/ {maxScore}</span>
                  {val !== "" && isValid && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-4 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:bg-white/[0.08] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-900/40 transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : `Save ${filledCount > 0 ? filledCount : ""} Scores`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export type ManualAssessmentModalMode =
  | { type: "create" }
  | { type: "edit"; assessment: ManualAssessment }
  | { type: "scores"; assessment: ManualAssessment };

interface ManualAssessmentModalProps {
  open: boolean;
  mode: ManualAssessmentModalMode;
  courseId: number;
  term: string;
  academicYear: string;
  students: StudentEntry[];
  onClose: () => void;
  onCreated: (assessment: ManualAssessment) => void;
  onUpdated: (assessment: ManualAssessment) => void;
}

export default function ManualAssessmentModal({
  open,
  mode,
  courseId,
  term,
  academicYear,
  students,
  onClose,
  onCreated,
  onUpdated,
}: ManualAssessmentModalProps) {
  // After creating, we immediately show the scores panel for the new assessment
  const [pendingScoresAssessment, setPendingScoresAssessment] = useState<ManualAssessment | null>(null);

  const handleCreated = (assessment: ManualAssessment) => {
    onCreated(assessment);
    setPendingScoresAssessment(assessment);
  };

  const handleClose = () => {
    setPendingScoresAssessment(null);
    onClose();
  };

  // Determine which panel to show
  const showScores =
    pendingScoresAssessment !== null ||
    mode.type === "scores";

  const scoresAssessment =
    pendingScoresAssessment ??
    (mode.type === "scores" ? mode.assessment : null);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className={`relative w-full ${showScores ? "max-w-lg" : "max-w-md"} bg-[#0D1525] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden pointer-events-auto flex flex-col max-h-[90vh] transition-[max-width] duration-200`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top bar */}
              <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-orange-900/50 border border-orange-700/40 flex items-center justify-center flex-shrink-0">
                  <PencilRuler className="w-4 h-4 text-orange-300" />
                </div>
                <span className="text-sm font-semibold text-white flex-1">
                  Manual Assessment Entry
                </span>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel content */}
              <AnimatePresence mode="wait">
                {showScores && scoresAssessment ? (
                  <motion.div
                    key="scores"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    <ScoresPanel
                      assessment={scoresAssessment}
                      students={students}
                      onBack={() => setPendingScoresAssessment(null)}
                      onClose={handleClose}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="create"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1"
                  >
                    <CreatePanel
                      courseId={courseId}
                      term={term}
                      academicYear={academicYear}
                      existing={mode.type === "edit" ? mode.assessment : undefined}
                      onCreated={handleCreated}
                      onUpdated={onUpdated}
                      onClose={handleClose}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
