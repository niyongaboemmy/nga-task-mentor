import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { CourseApiService } from "../services/courseApi";
import axiosConfig from "../utils/axiosConfig";
import { usePermissions } from "../hooks/usePermissions";
import { useTermYearSelector } from "../hooks/useTermYearSelector";
import ReportCardBuilder, { type SubjectOption } from "../components/ReportCard/ReportCardBuilder";
import TermYearSelect from "../components/ReportCard/TermYearSelect";
import SubjectReportCardDashboard from "../components/ReportCard/SubjectReportCardDashboard";
import {
  ReportCardApiService,
  type AssessmentCategory,
  type SubjectMappingItem,
} from "../services/reportCardApi";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../services/manualAssessmentApi";
import type { StudentEntry } from "../components/ReportCard/ManualAssessmentModal";
import { toast } from "react-toastify";

// ─── Page ─────────────────────────────────────────────────────────────────────
// The one-stop dashboard for a subject's report-card picture: class average,
// per-student status/score (SubjectReportCardDashboard), and — collapsed by
// default once a mapping exists — the drag-drop builder to (re)map
// assessments into CW/HW/MD/EOT. Term/year is a real dropdown (not a URL
// param edit), owned here via useTermYearSelector so switching it re-fetches
// both the builder's assessment lists and the dashboard below together.

interface RosterStudent extends StudentEntry {
  name: string;
}

export default function SubjectGradesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { can } = usePermissions();
  const isAdmin = can("REPORT_CARDS_APPROVE");

  const {
    years, terms, academicYear, term, academicTermId,
    setAcademicYear, setTerm,
  } = useTermYearSelector();

  const [subject, setSubject] = useState<SubjectOption | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [initialMappings, setInitialMappings] = useState<SubjectMappingItem[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  // ── Load course + assessments + roster (re-runs when term/year changes) ──
  useEffect(() => {
    if (!courseId || !term || !academicYear) return;
    const id = parseInt(courseId, 10);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [courseRes, quizzesRes, assignmentsRes, studentsRes, manualsRes] = await Promise.all([
          CourseApiService.getCourse(id),
          CourseApiService.getCourseQuizzes(id, academicTermId),
          axiosConfig
            .get(`/courses/${id}/assignments`, {
              params: academicTermId ? { academic_term_id: academicTermId } : undefined,
            })
            .then((r) => r.data),
          CourseApiService.getCourseStudents(id).catch(() => ({ data: [] })),
          ManualAssessmentApiService.list({ course_id: id, term, academic_year: academicYear }).catch(
            () => ({ success: true, data: [] as ManualAssessment[] }),
          ),
        ]);

        const rawStudents: any[] = studentsRes.data ?? [];
        const entries: RosterStudent[] = rawStudents
          .map((s: any) => {
            const uid = s.user?.id ?? s.user?.user_id ?? s.student_id ?? 0;
            const fn = s.profile?.first_name ?? s.user?.first_name ?? "";
            const ln = s.profile?.last_name ?? s.user?.last_name ?? "";
            return { student_id: uid, name: `${fn} ${ln}`.trim() || `Student #${uid}` };
          })
          .filter((s) => s.student_id);
        setStudents(entries);

        const fetchedManuals: ManualAssessment[] = manualsRes.data ?? [];

        setSubject({
          id,
          name: courseRes.data.title ?? `Course #${id}`,
          quizzes: (quizzesRes.data ?? []).map((q: any) => ({ id: q.id, title: q.title })),
          assignments: ((assignmentsRes as any).data ?? []).map((a: any) => ({ id: a.id, title: a.title })),
          manualAssessments: fetchedManuals,
        });
      } catch {
        setError("Failed to load subject data. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, term, academicYear, academicTermId]);

  // ── Existing subject-wide mapping (pre-populates the builder) ─────────────
  useEffect(() => {
    if (!subject || !term || !academicYear) return;
    (async () => {
      setMappingLoading(true);
      try {
        const res = await ReportCardApiService.getSubjectMapping({ subject_id: subject.id, term, academic_year: academicYear });
        const mappings = res.data.assessments ?? [];
        setInitialMappings(mappings);
        // No mapping yet → open the builder by default so there's nothing more to click.
        setBuilderOpen(mappings.length === 0);
      } catch {
        setInitialMappings([]);
        setBuilderOpen(true);
      } finally {
        setMappingLoading(false);
      }
    })();
  }, [subject, term, academicYear]);

  // ── Shape initialMappings into the builder's dropped-item structure ───────
  const initialDropped = useMemo<
    Partial<Record<AssessmentCategory, Array<{ dndId: string; assessment_id: number; assessment_type: "quiz" | "assignment" | "manual"; title: string; subject_id: number }>>>
  >(() => {
    if (!subject || initialMappings.length === 0) return {};
    const dropped: Record<AssessmentCategory, any[]> = { CW: [], HW: [], MD: [], EOT: [] };
    const allItems = [
      ...subject.quizzes.map((q) => ({ id: q.id, title: q.title, type: "quiz" as const })),
      ...subject.assignments.map((a) => ({ id: a.id, title: a.title, type: "assignment" as const })),
      ...subject.manualAssessments.map((m) => ({ id: m.id, title: m.title, type: "manual" as const })),
    ];
    for (const mapping of initialMappings) {
      const found = allItems.find((i) => i.id === mapping.assessment_id && i.type === mapping.assessment_type);
      if (found) {
        dropped[mapping.category].push({
          dndId: `${mapping.assessment_type}-${mapping.assessment_id}`,
          assessment_id: mapping.assessment_id,
          assessment_type: mapping.assessment_type,
          title: found.title,
          subject_id: subject.id,
        });
      }
    }
    return dropped;
  }, [subject, initialMappings]);

  // Bumped after a builder save so the dashboard's overview re-fetches.
  const [dashboardKey, setDashboardKey] = useState(0);
  const onBuilderSaved = (studentsUpdated: number) => {
    toast.success(`Applied to ${studentsUpdated} enrolled student${studentsUpdated !== 1 ? "s" : ""}.`);
    setDashboardKey((k) => k + 1);
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">Loading subject grades…</p>
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-orange-500" />
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">{error ?? "Could not load this subject."}</p>
          <Link to="/grades" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Grades
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link
        to="/grades"
        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Grades
      </Link>

      {/* Header */}
      <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest font-medium mb-1">
            Report card dashboard
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">{subject.name}</h1>
        </div>

        <TermYearSelect
          years={years}
          terms={terms}
          academicYear={academicYear}
          term={term}
          onAcademicYearChange={setAcademicYear}
          onTermChange={setTerm}
        />
      </div>

      {/* Build Mapping — collapsible */}
      <div className="rounded-2xl border border-white dark:border-border-dark/30 overflow-hidden">
        <button
          onClick={() => setBuilderOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-card-light dark:bg-card-dark/30 hover:bg-surface-light/60 dark:hover:bg-surface-dark/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Build Mapping
            </span>
            {initialMappings.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-full px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3" /> {initialMappings.length} mapped
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60 transition-transform ${builderOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {builderOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#060A12] overflow-hidden"
            >
              {mappingLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <ReportCardBuilder
                  term={term}
                  academicYear={academicYear}
                  subjects={[subject]}
                  initialDropped={initialDropped}
                  onSaved={onBuilderSaved}
                  students={students}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Class average, progress, roster */}
      <SubjectReportCardDashboard
        key={dashboardKey}
        courseId={subject.id}
        term={term}
        academicYear={academicYear}
        isAdmin={isAdmin}
      />

      {/* Class attributes shortcut */}
      {students.length > 0 && term && academicYear && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Class Teacher Attributes</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 leading-relaxed">
                Fill attendance, behavior ratings and teacher comments for all students at once
              </p>
            </div>
          </div>
          <Link
            to={`/courses/${courseId}/report-card-attributes?term=${encodeURIComponent(term)}&year=${encodeURIComponent(academicYear)}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            Open <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
