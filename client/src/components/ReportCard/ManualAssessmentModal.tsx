import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PencilRuler, Save, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../../services/manualAssessmentApi";
import ManualScoreEntry, { type StudentEntry } from "./ManualScoreEntry";

// Re-exported so existing imports (`from "./ManualAssessmentModal"`) keep working.
export type { StudentEntry };

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
        <h2 className="text-lg font-bold text-text-primary-light dark:text-white">
          {isEdit ? "Edit Assessment" : "New Manual Assessment"}
        </h2>
        <p className="text-xs text-text-secondary-light dark:text-slate-400">
          {isEdit
            ? "Update the title or max score for this manual entry."
            : "Create a physical-paper assessment entry that applies to all students in this subject."}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary-light dark:text-slate-400 uppercase tracking-wider">
            Assessment Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Science Practical Exam, Mid-Term Paper"
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-text-primary-light dark:text-white placeholder:text-gray-400 dark:placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary-light dark:text-slate-400 uppercase tracking-wider">
            Maximum Score (marks)
          </label>
          <input
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            min={1}
            step={1}
            placeholder="e.g. 50"
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-text-primary-light dark:text-white placeholder:text-gray-400 dark:placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
          />
          <p className="text-[11px] text-text-secondary-light dark:text-slate-400">
            Each student's score will be entered as a value out of this maximum.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-text-secondary-light dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 dark:shadow-blue-900/40 transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : isEdit ? "Update" : "Create & Enter Scores"}
        </button>
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
            className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          >
            <div
              className={`relative w-full ${showScores ? "max-w-2xl" : "max-w-md"} max-h-full bg-white dark:bg-gray-900 border border-white/20 dark:border-white/[0.1] rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/60 overflow-hidden pointer-events-auto flex flex-col transition-[max-width] duration-200`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top bar */}
              <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border-light dark:border-white/[0.06] flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-700/40 flex items-center justify-center flex-shrink-0">
                  <PencilRuler className="w-4 h-4 text-orange-600 dark:text-orange-300" />
                </div>
                <span className="text-sm font-semibold text-text-primary-light dark:text-white flex-1">
                  Manual Assessment Entry
                </span>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-slate-400 hover:text-text-primary-light dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all"
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
                    <ManualScoreEntry
                      variant="modal"
                      assessment={scoresAssessment}
                      students={students}
                      onBack={() => setPendingScoresAssessment(null)}
                      onCancel={handleClose}
                      onSaved={handleClose}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="create"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 overflow-y-auto"
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
