import { useState, useEffect } from "react";
import { X, Loader2, Calendar } from "lucide-react";
import { toast } from "react-toastify";
import {
  ManualAssessmentApiService,
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_LABELS,
  type ManualAssessment,
  type AssessmentType,
} from "../../services/manualAssessmentApi";
import type { Course } from "../../types/course.types";

interface Props {
  open: boolean;
  courses: Course[];
  existing: ManualAssessment | null;
  term: string;
  academicYear: string;
  onClose: () => void;
  onSaved: (assessment: ManualAssessment) => void;
  /** Preselect + lock the subject dropdown when opened from a subject-scoped context. */
  presetCourseId?: number;
}

export default function CreateAssessmentModal({
  open,
  courses,
  existing,
  term,
  academicYear,
  onClose,
  onSaved,
  presetCourseId,
}: Props) {
  const isEdit = !!existing;

  // ── Form state ────────────────────────────────────────────────────────────
  const [courseId,          setCourseId]          = useState<number | "">("");
  const [assessmentType,    setAssessmentType]    = useState<AssessmentType | "">("");
  const [assessmentNumber,  setAssessmentNumber]  = useState("");
  const [assessmentDate,    setAssessmentDate]    = useState("");
  const [maxScore,          setMaxScore]          = useState("");
  const [addToFinalGrade,   setAddToFinalGrade]   = useState(true);
  const [saving,            setSaving]            = useState(false);

  // ── Pre-fill on edit ──────────────────────────────────────────────────────
  useEffect(() => {
    if (existing) {
      setCourseId(existing.course_id);
      setAssessmentType(existing.assessment_type ?? "");
      setAssessmentNumber(existing.assessment_number ? String(existing.assessment_number) : "");
      setAssessmentDate(existing.assessment_date ?? "");
      setMaxScore(String(existing.max_score));
      setAddToFinalGrade(existing.add_to_final_grade);
    } else {
      setCourseId(presetCourseId ?? "");
      setAssessmentType("");
      setAssessmentNumber("");
      setAssessmentDate("");
      setMaxScore("");
      setAddToFinalGrade(true);
    }
  }, [existing, open, presetCourseId]);

  if (!open) return null;

  // ── Validation & submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!courseId) { toast.error("Please select a subject."); return; }
    if (!assessmentType) { toast.error("Please select an assessment type."); return; }
    if (!assessmentDate) { toast.error("Please select a date."); return; }
    const parsedMax = parseFloat(maxScore);
    if (isNaN(parsedMax) || parsedMax <= 0) { toast.error("Maximum marks must be a positive number."); return; }

    const parsedNumber = assessmentNumber ? parseInt(assessmentNumber, 10) : null;

    // Build a display title for backward-compat (legacy title field)
    const typeLabel = ASSESSMENT_TYPE_LABELS[assessmentType];
    const title = parsedNumber ? `${typeLabel} ${parsedNumber}` : typeLabel;

    setSaving(true);
    try {
      if (isEdit && existing) {
        const res = await ManualAssessmentApiService.update(existing.id, {
          assessment_type:   assessmentType,
          assessment_number: parsedNumber,
          assessment_date:   assessmentDate,
          add_to_final_grade: addToFinalGrade,
          max_score:         parsedMax,
          title,
        });
        if (res.success) {
          toast.success("Assessment updated.");
          onSaved(res.data);
        }
      } else {
        const res = await ManualAssessmentApiService.create({
          course_id:         courseId as number,
          title,
          assessment_type:   assessmentType,
          assessment_number: parsedNumber,
          assessment_date:   assessmentDate,
          add_to_final_grade: addToFinalGrade,
          max_score:         parsedMax,
          term,
          academic_year:     academicYear,
        });
        if (res.success) {
          toast.success("Assessment created.");
          onSaved(res.data);
        }
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 dark:border-gray-700/40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-light dark:border-gray-700/40">
          <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            {isEdit ? "Edit Assessment" : "Create Assessment"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Subject selector */}
          <div>
            <label className="block text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1.5">Class</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
              disabled={isEdit || presetCourseId != null}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800 disabled:bg-gray-50 dark:disabled:bg-gray-800/50 disabled:text-gray-400 dark:disabled:text-gray-500"
            >
              <option value="">Select a subject</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment Type */}
          <div>
            <label className="block text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1.5">Assessment Type</label>
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as AssessmentType)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800"
            >
              <option value="">Assessment Type</option>
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSESSMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment Number */}
          <div>
            <label className="block text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1.5">Assessment Number</label>
            <input
              type="number"
              min={1}
              placeholder="Assessment Number"
              value={assessmentNumber}
              onChange={(e) => setAssessmentNumber(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1.5">Select Date</label>
            <div className="relative">
              <input
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-10 [color-scheme:light] dark:[color-scheme:dark]"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Maximum Marks */}
          <div>
            <label className="block text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1.5">Maximum Marks</label>
            <input
              type="number"
              min={1}
              placeholder="Maximum Marks"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Add to Final Grade */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={addToFinalGrade}
              onChange={(e) => setAddToFinalGrade(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Add to Final Grade</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-light dark:border-gray-700/40 bg-surface-light/60 dark:bg-gray-950/40">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
