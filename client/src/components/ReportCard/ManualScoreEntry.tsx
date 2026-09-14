import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Users,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  Zap,
  Eraser,
  Save,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../../services/manualAssessmentApi";
import Tooltip from "../ui/Tooltip";
import ConfirmDialog from "../ui/ConfirmDialog";

export interface StudentEntry {
  student_id: number;
  name: string;
  /** Shown next to the name when supplied (full-page marks entry has it; the
   * report-card builder's roster does not). */
  reg_number?: string;
}

// Deterministic solid avatar color per student — no gradients.
const AVATAR_COLORS = ["bg-blue-600", "bg-blue-700", "bg-gray-500", "bg-orange-500", "bg-gray-600", "bg-blue-500"];

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border-light dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/[0.08]" />
        <div className="h-2.5 w-16 rounded bg-gray-200 dark:bg-white/[0.06]" />
      </div>
      <div className="w-20 h-8 rounded-lg bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
    </div>
  );
}

export interface ManualScoreEntryProps {
  assessment: ManualAssessment;
  students: StudentEntry[];
  /** Shows a "Back" link above the title — used when this is a step in a
   * multi-step flow (the modal's create → scores handoff). */
  onBack?: () => void;
  /** Shows a "Cancel" button in the footer. */
  onCancel?: () => void;
  /** Called after a successful save with how many scores were saved. Whether
   * to navigate away afterward is entirely the caller's call — this
   * component never closes/navigates on its own. */
  onSaved?: (count: number) => void;
  /**
   * "modal": fills the height it's given and scrolls its own list
   * internally (for a fixed-height modal card).
   * "page": flows naturally with the page; the save bar stays pinned to the
   * viewport bottom via `sticky` as the page scrolls.
   */
  variant?: "modal" | "page";
}

export default function ManualScoreEntry({
  assessment,
  students,
  onBack,
  onCancel,
  onSaved,
  variant = "modal",
}: ManualScoreEntryProps) {
  const [scores, setScores] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await ManualAssessmentApiService.getScores(assessment.id);
        if (cancelled) return;
        const initial: Record<number, string> = {};
        for (const s of res.data) {
          initial[s.student_id] = String(s.score);
        }
        setScores(initial);
      } catch {
        // no existing scores yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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
      onSaved?.(entries.length);
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
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.student_id).includes(q) ||
        s.reg_number?.toLowerCase().includes(q),
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
    let count = 0;
    setScores((prev) => {
      const next = { ...prev };
      for (const s of students) {
        if (next[s.student_id] === undefined || next[s.student_id] === "") {
          next[s.student_id] = String(maxScore);
          count++;
        }
      }
      return next;
    });
    if (count > 0) toast.success(`Filled ${count} empty score${count !== 1 ? "s" : ""} with the max.`);
    else toast.info("Every score is already filled.");
  };

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const requestClearAll = () => {
    const count = Object.values(scores).filter((v) => v !== "" && v !== undefined).length;
    if (count === 0) {
      toast.info("Nothing to clear.");
      return;
    }
    setConfirmClearOpen(true);
  };

  const confirmClearAll = () => {
    const count = Object.values(scores).filter((v) => v !== "" && v !== undefined).length;
    setScores({});
    setConfirmClearOpen(false);
    toast.success(`Cleared ${count} score${count !== 1 ? "s" : ""}.`);
  };

  const isPage = variant === "page";

  return (
    <div className={`flex flex-col ${isPage ? "" : "h-full min-h-0"}`}>
      {/* Header */}
      <div className={`px-5 pt-5 pb-4 border-b border-border-light dark:border-white/[0.06] flex-shrink-0 space-y-3 ${isPage ? "rounded-t-2xl bg-white dark:bg-[#0A1020]" : ""}`}>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-slate-400 hover:text-text-primary-light dark:hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-primary-light dark:text-white">{assessment.title}</h2>
            <p className="text-xs text-text-secondary-light dark:text-slate-400 mt-0.5">
              Max score: <span className="text-text-primary-light dark:text-slate-300 font-semibold">{assessment.max_score}</span>
              {" · "}
              <span className="text-blue-600 dark:text-blue-400 font-semibold">{filledCount}</span> of {students.length} filled
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700/40 text-orange-700 dark:text-orange-300 flex-shrink-0">
            <Users className="w-3 h-3" />
            {students.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
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
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-text-primary-light dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
            />
          </div>
          <button
            onClick={fillRemainingWithMax}
            title={`Fill every empty score with the max (${maxScore})`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-all flex-shrink-0"
          >
            <Zap className="w-3 h-3" />
            Fill max
          </button>
          <Tooltip label="Clear every score entered in this session">
          <button
            onClick={requestClearAll}
            aria-label="Clear every score entered in this session"
            className="flex items-center justify-center p-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-text-secondary-light dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-300 hover:border-orange-200 dark:hover:border-orange-700/40 transition-all flex-shrink-0"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          </Tooltip>
        </div>
      </div>

      {/* Student score list */}
      <div
        className={`px-4 py-3 space-y-2 ${
          isPage
            ? "bg-white dark:bg-[#0A1020]"
            : "flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-black/[0.08] dark:scrollbar-thumb-white/[0.08]"
        }`}
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-8 h-8 text-gray-300 dark:text-slate-600" />
            <p className="text-xs text-text-secondary-light dark:text-slate-400">No students found in this course.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Search className="w-8 h-8 text-gray-300 dark:text-slate-600" />
            <p className="text-xs text-text-secondary-light dark:text-slate-400">No students match "{search}".</p>
          </div>
        ) : (
          filteredStudents.map((student, idx) => {
            const val = scores[student.student_id] ?? "";
            const numVal = parseFloat(val);
            const isValid = val === "" || (!isNaN(numVal) && numVal >= 0 && numVal <= maxScore);
            const color = AVATAR_COLORS[student.student_id % AVATAR_COLORS.length];
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
                    ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30"
                    : !isValid
                      ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/30"
                      : "bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.06]"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}>
                  {initials || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary-light dark:text-slate-200 font-medium truncate">{student.name}</p>
                  <p className="text-[11px] text-text-secondary-light dark:text-slate-400">
                    {student.reg_number ? student.reg_number : `ID #${student.student_id}`}
                  </p>
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
                    className={`w-20 px-3 py-1.5 rounded-lg text-sm text-right font-mono bg-white dark:bg-white/[0.06] border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 hover:border-gray-300 dark:hover:border-white/[0.2] ${
                      !isValid
                        ? "border-orange-400 dark:border-orange-500/50 focus:ring-orange-500/40 text-orange-700 dark:text-orange-400"
                        : val !== ""
                          ? "border-blue-400 dark:border-blue-600/50 text-blue-700 dark:text-blue-300"
                          : "border-gray-200 dark:border-white/[0.14] text-text-primary-light dark:text-slate-200"
                    }`}
                  />
                  <span className="text-xs text-text-secondary-light dark:text-slate-400 w-10 text-right">/ {maxScore}</span>
                  {val !== "" && isValid && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Floating save bar — pinned within the modal's scroll area (flex,
          never scrolls away) or stuck to the viewport bottom on a full page. */}
      <div
        className={`px-4 py-4 border-t border-border-light dark:border-white/[0.06] flex-shrink-0 bg-surface-light/80 dark:bg-gray-950/60 backdrop-blur-sm shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.35)] ${
          isPage ? "sticky bottom-0 rounded-b-2xl" : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-text-secondary-light dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 dark:shadow-blue-900/40 transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : `Save ${filledCount > 0 ? filledCount : ""} Scores`}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear all entered scores?"
        description="Every score you've typed in this session will be cleared. Scores already saved to the server are unaffected until you save again."
        confirmLabel="Clear"
        danger
        onConfirm={confirmClearAll}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
}
