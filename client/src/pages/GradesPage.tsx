import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Users,
  BookOpen,
  School,
  ClipboardList,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  ClipboardCheck,
  ArrowRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../services/manualAssessmentApi";
import { QuizGroupedApiService } from "../services/quizGroupedApi";
import { AssignmentApiService } from "../services/assignmentApi";
import { useAuth } from "../contexts/AuthContext";
import CreateAssessmentModal from "../components/Grades/CreateAssessmentModal";
import Tooltip from "../components/ui/Tooltip";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import AssessmentMappingControl from "../components/ReportCard/AssessmentMappingControl";
import {
  ReportCardApiService,
  type AssessmentCategory,
  type SubjectMappingItem,
} from "../services/reportCardApi";
import type { Course } from "../types/course.types";

// ─── Unified assessment row ───────────────────────────────────────────────────
// Quizzes, assignments, and manual entries are three separate models on the
// backend (and three separate creation flows — Quizzes/Assignments pages own
// their own CRUD), but a teacher thinks of them as one pool of "things that
// feed a subject's report card". This page groups them by subject so a
// teacher can focus on one class at a time, and hands off to the Subject
// Grades dashboard (/grades/subjects/:courseId) for report-card building.

type AssessmentKind = "quiz" | "assignment" | "manual";

interface AssessmentRow {
  key: string;
  kind: AssessmentKind;
  id: number;
  courseId: number;
  title: string;
  date: string | null;
  maxScore: number | null;
  recorded: number | null;
  manual?: ManualAssessment;
}

const KIND_BADGE: Record<AssessmentKind, string> = {
  quiz: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  assignment: "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  manual: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
};

const KIND_LABEL: Record<AssessmentKind, string> = {
  quiz: "Quiz",
  assignment: "Assignment",
  manual: "Manual",
};

// ─── Stat card ────────────────────────────────────────────────────────────────
// "tone" carries the meaning a bare number can't: blue/neutral for "on
// track", orange for "needs attention" (a small pulsing dot doubles down on
// that). A card with an `onClick` becomes a real filter toggle for the list
// below (see "Subjects Missing Assessments"), not just a static readout —
// `active` rings it while that filter is applied.

function StatCard({
  icon,
  iconBg,
  label,
  value,
  total,
  tone = "neutral",
  hint,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  total?: number;
  tone?: "good" | "warning" | "neutral";
  hint: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const pct = typeof total === "number" && total > 0 ? Math.round((value / total) * 100) : null;
  const toneText = {
    good: "text-blue-600 dark:text-blue-400",
    warning: "text-orange-600 dark:text-orange-400",
    neutral: "text-text-primary-light dark:text-text-primary-dark",
  }[tone];
  const toneBar = {
    good: "bg-blue-600",
    warning: "bg-orange-500",
    neutral: "bg-gray-400 dark:bg-gray-500",
  }[tone];

  return (
    <Tooltip label={hint}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`w-full text-left bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border p-5 flex flex-col gap-3 transition-all disabled:cursor-default ${
          onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]" : ""
        } ${active ? "border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/30" : "border-white dark:border-border-dark/30"}`}
      >
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
          {tone === "warning" && value > 0 && (
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
            </span>
          )}
          {active && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">Filtered</span>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wide">
            {label}
          </p>
          <p className={`text-2xl font-bold mt-1 ${toneText}`}>
            {value}
            {typeof total === "number" && (
              <span className="text-sm font-normal text-text-secondary-light dark:text-text-secondary-dark/50"> / {total}</span>
            )}
          </p>
        </div>
        {pct !== null && (
          <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${toneBar}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </button>
    </Tooltip>
  );
}

// ─── Recorded results button ──────────────────────────────────────────────────
// This is the one thing a teacher actually clicks per assessment, so it has
// to look clickable, not like plain data. Quizzes/assignments are graded on
// their own pages (view-only here); manual assessments are entered right on
// this page's marks screen, so an empty one reads as an outstanding task
// ("Record scores", solid blue) rather than a passive stat.

function RecordedResultsButton({
  kind,
  recorded,
  total,
  onClick,
}: {
  kind: AssessmentKind;
  recorded: number;
  total?: number;
  onClick: () => void;
}) {
  const hasTotal = typeof total === "number" && total > 0;
  const complete = hasTotal && recorded >= total;
  const started = recorded > 0;
  const isManual = kind === "manual";

  const label = complete ? "Completed" : isManual ? (started ? "Continue entry" : "Record scores") : "View results";
  const Icon = complete ? CheckCircle2 : isManual ? Pencil : Eye;

  const toneClasses = complete
    ? "bg-blue-50 dark:bg-blue-900/25 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
    : started
      ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/35"
      : isManual
        ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-900/20"
        : "bg-gray-100 dark:bg-white/[0.06] border-gray-200 dark:border-white/[0.1] text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-white/[0.12]";

  return (
    <button
      onClick={onClick}
      title={label}
      className={`group inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all active:scale-95 ${toneClasses}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{hasTotal ? `${recorded}/${total}` : recorded}</span>
      <span className="hidden lg:inline font-medium opacity-90">{label}</span>
      <ChevronRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </button>
  );
}

// ─── Subject mapping-progress pill ────────────────────────────────────────────
// How many of a subject's assessments are already mapped into a report-card
// category (CW/HW/MD/EOT) vs. still needing attention. Sits next to the
// assessment/student count in each subject header.

function MappingProgress({ mapped, total }: { mapped: number; total: number }) {
  if (total === 0) return null;
  const complete = mapped === total;
  const pct = Math.round((mapped / total) * 100);
  return (
    <div className="flex items-center gap-1.5" title={`${mapped} of ${total} assessments mapped to a report-card category`}>
      <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${complete ? "bg-blue-600" : mapped > 0 ? "bg-orange-400" : "bg-gray-300 dark:bg-gray-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-[11px] font-medium whitespace-nowrap ${
          complete
            ? "text-blue-600 dark:text-blue-400"
            : "text-text-secondary-light dark:text-text-secondary-dark/60"
        }`}
      >
        {mapped}/{total} mapped
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = ["Assessments", "Comments", "Observations"] as const;
type Tab = (typeof TABS)[number];

export default function GradesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const term         = user?.currentAcademicTerm?.name ?? "";
  const academicYear = user?.currentAcademicYear?.name ?? "";

  // ── Data ──────────────────────────────────────────────────────────────────
  const [courses, setCourses]           = useState<Course[]>([]);
  const [manualAssessments, setManualAssessments] = useState<ManualAssessment[]>([]);
  const [quizRows, setQuizRows]         = useState<AssessmentRow[]>([]);
  const [assignmentRows, setAssignmentRows] = useState<AssessmentRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<Tab>("Assessments");

  // ── Grouping / search state ──────────────────────────────────────────────
  const [search, setSearch]             = useState("");
  const [expanded, setExpanded]         = useState<Set<number>>(new Set());
  // Toggled from the "Subjects Missing Assessments" KPI card — turns a
  // static number into a real filter on the list below.
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<ManualAssessment | null>(null);
  const [presetCourseId, setPresetCourseId] = useState<number | undefined>(undefined);

  // ── Enrolled counts cache: courseId → studentCount ────────────────────────
  const [enrolledCounts, setEnrolledCounts] = useState<Map<number, number>>(new Map());

  // ── Report-card mapping cache: courseId → its subject-wide mapping ───────
  const [mappings, setMappings] = useState<Map<number, SubjectMappingItem[]>>(new Map());
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [mappingSavingKey, setMappingSavingKey] = useState<string | null>(null);

  // ── Load courses ──────────────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    try {
      const res = await CourseApiService.getCourses();
      setCourses(res.data ?? []);
      return res.data ?? [];
    } catch {
      toast.error("Failed to load courses");
      return [];
    }
  }, []);

  // ── Load manual assessments for all courses ───────────────────────────────
  const loadManualAssessments = useCallback(async (courseList: Course[]) => {
    if (courseList.length === 0) {
      setManualAssessments([]);
      return;
    }
    const ids = courseList.map((c) => c.id);
    try {
      const res = await ManualAssessmentApiService.list({
        course_ids:    ids,
        term:          term || undefined,
        academic_year: academicYear || undefined,
        with_counts:   true,
      });
      setManualAssessments(res.data ?? []);
    } catch {
      toast.error("Failed to load manual assessments");
    }
  }, [term, academicYear]);

  // ── Load quizzes + assignments across every subject (view-only here — ────
  // creation/editing of these stays on their own Quizzes/Assignments pages).
  const loadQuizzesAndAssignments = useCallback(async (courseList: Course[]) => {
    if (courseList.length === 0) {
      setQuizRows([]);
      setAssignmentRows([]);
      return;
    }
    try {
      const [quizData, assignmentData] = await Promise.all([
        QuizGroupedApiService.getGrouped({ pageSize: courseList.length }),
        AssignmentApiService.getGrouped({ pageSize: courseList.length }),
      ]);

      const quizzes: AssessmentRow[] = quizData.subjects.flatMap((s) =>
        s.quizzes.map((q) => ({
          key: `quiz-${q.id}`,
          kind: "quiz" as const,
          id: q.id,
          courseId: q.course_id,
          title: q.title,
          date: q.start_date ?? q.created_at,
          maxScore: q.total_points || null,
          recorded: q.graded_count,
        })),
      );

      const assignments: AssessmentRow[] = assignmentData.subjects.flatMap((s) =>
        s.assignments.map((a) => ({
          key: `assignment-${a.id}`,
          kind: "assignment" as const,
          id: a.id,
          courseId: a.course_id,
          title: a.title,
          date: a.due_date,
          maxScore: a.max_score ? Number(a.max_score) : null,
          recorded: a.graded_count ?? null,
        })),
      );

      setQuizRows(quizzes);
      setAssignmentRows(assignments);
    } catch {
      toast.error("Failed to load quizzes and assignments");
    }
  }, []);

  // ── Load enrolled student counts (best-effort, non-blocking) ─────────────
  const loadEnrolledCounts = useCallback(async (courseList: Course[]) => {
    const map = new Map<number, number>();
    await Promise.allSettled(
      courseList.map(async (c) => {
        try {
          const res = await CourseApiService.getCourseStudents(c.id);
          map.set(c.id, (res.data ?? []).length);
        } catch {
          // Ignore individual failures
        }
      }),
    );
    setEnrolledCounts(map);
  }, []);

  // ── Load each subject's report-card mapping (best-effort, non-blocking) ──
  const loadMappings = useCallback(async (courseList: Course[]) => {
    if (courseList.length === 0 || !term || !academicYear) {
      setMappings(new Map());
      setMappingsLoading(false);
      return;
    }
    setMappingsLoading(true);
    const map = new Map<number, SubjectMappingItem[]>();
    await Promise.allSettled(
      courseList.map(async (c) => {
        try {
          const res = await ReportCardApiService.getSubjectMapping({
            subject_id: c.id,
            term,
            academic_year: academicYear,
          });
          map.set(c.id, res.data.assessments ?? []);
        } catch {
          // Ignore individual failures — that subject just shows as unmapped.
        }
      }),
    );
    setMappings(map);
    setMappingsLoading(false);
  }, [term, academicYear]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const courseList = await loadCourses();
      await Promise.all([
        loadManualAssessments(courseList),
        loadQuizzesAndAssignments(courseList),
      ]);
      setLoading(false);
      // Load enrollment counts and mappings in background
      loadEnrolledCounts(courseList);
      loadMappings(courseList);
    })();
  }, [loadCourses, loadManualAssessments, loadQuizzesAndAssignments, loadEnrolledCounts, loadMappings]);

  // ── Unified rows: quizzes + assignments + manual entries ──────────────────
  const manualRows = useMemo<AssessmentRow[]>(
    () =>
      manualAssessments.map((a) => ({
        key: `manual-${a.id}`,
        kind: "manual" as const,
        id: a.id,
        courseId: a.course_id,
        title: ManualAssessmentApiService.getTypeLabel(a),
        date: a.assessment_date,
        maxScore: a.max_score,
        recorded: a.recorded_count ?? null,
        manual: a,
      })),
    [manualAssessments],
  );

  const assessments = useMemo<AssessmentRow[]>(
    () => [...quizRows, ...assignmentRows, ...manualRows],
    [quizRows, assignmentRows, manualRows],
  );

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const subjectsWithAssessments = new Set(assessments.map((a) => a.courseId)).size;
    const totalSubjects = courses.length;
    const subjectsWithoutAssessments = courses.filter(
      (c) => !assessments.some((a) => a.courseId === c.id),
    ).length;

    // "Classes" here = unique class groups (by class_group_id)
    const classGroupIds = [...new Set(courses.map((c) => c.class_group_id).filter(Boolean))];
    const classesWithoutAssessments = classGroupIds.filter((gid) => {
      const groupCourses = courses.filter((c) => c.class_group_id === gid);
      return !groupCourses.some((c) => assessments.some((a) => a.courseId === c.id));
    }).length;

    return {
      assessmentsTracking: subjectsWithAssessments,
      totalSubjects,
      classesWithoutAssessments,
      subjectsWithoutAssessments,
      totalAssessments: assessments.length,
    };
  }, [courses, assessments]);

  // ── Course lookup ─────────────────────────────────────────────────────────
  const courseMap = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  // ── Group assessments by subject ──────────────────────────────────────────
  const subjectGroups = useMemo(() => {
    const byId = new Map<number, AssessmentRow[]>();
    for (const c of courses) byId.set(c.id, []);
    for (const a of assessments) {
      if (!byId.has(a.courseId)) byId.set(a.courseId, []);
      byId.get(a.courseId)!.push(a);
    }
    return Array.from(byId.entries())
      .map(([courseId, rows]) => {
        const mapping = mappings.get(courseId) ?? [];
        const mappedCount = rows.filter((r) =>
          mapping.some((m) => m.assessment_type === r.kind && m.assessment_id === r.id),
        ).length;
        return { courseId, course: courseMap.get(courseId), rows, mappedCount };
      })
      .sort((a, b) => (a.course?.title ?? "").localeCompare(b.course?.title ?? ""));
  }, [courses, assessments, courseMap, mappings]);

  // ── Lookup: what category (if any) an assessment row is mapped to ────────
  const getMappedCategory = useCallback(
    (row: AssessmentRow): AssessmentCategory | null =>
      mappings.get(row.courseId)?.find((m) => m.assessment_type === row.kind && m.assessment_id === row.id)
        ?.category ?? null,
    [mappings],
  );

  // ── Quick-map: assign/clear a single assessment's category without ───────
  // opening the full Report Card Builder. Reads the subject's current
  // mapping, patches the one row, and full-replaces it (the backend's
  // subject-mapping/save endpoint always replaces the whole set for that
  // subject/term/year).
  const handleQuickMap = useCallback(
    async (row: AssessmentRow, category: AssessmentCategory | null) => {
      if (!term || !academicYear) {
        toast.error("No active term/year to map against.");
        return;
      }
      const previous = mappings.get(row.courseId) ?? [];
      const next = previous.filter((m) => !(m.assessment_type === row.kind && m.assessment_id === row.id));
      if (category) next.push({ assessment_type: row.kind, assessment_id: row.id, category });

      setMappings((prev) => new Map(prev).set(row.courseId, next));
      setMappingSavingKey(row.key);
      try {
        await ReportCardApiService.saveSubjectMapping({
          subject_id: row.courseId,
          term,
          academic_year: academicYear,
          assessments: next,
        });
        toast.success(category ? `Mapped to report-card category.` : "Mapping cleared.");
      } catch {
        toast.error("Failed to update mapping.");
        setMappings((prev) => new Map(prev).set(row.courseId, previous));
      } finally {
        setMappingSavingKey(null);
      }
    },
    [term, academicYear, mappings],
  );

  // ── Search + "missing only" filter: auto-expands matches ─────────────────
  const q = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    const base = showOnlyMissing ? subjectGroups.filter((g) => g.rows.length === 0) : subjectGroups;
    if (!q) return base;
    return base
      .map((g) => {
        const subjectMatches = (g.course?.title ?? "").toLowerCase().includes(q);
        const matchingRows = subjectMatches
          ? g.rows
          : g.rows.filter(
              (r) => r.title.toLowerCase().includes(q) || KIND_LABEL[r.kind].toLowerCase().includes(q),
            );
        return { ...g, rows: matchingRows, matched: subjectMatches || matchingRows.length > 0 };
      })
      .filter((g) => g.matched);
  }, [subjectGroups, q, showOnlyMissing]);

  const totalFilteredAssessments = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.rows.length, 0),
    [filteredGroups],
  );

  const effectivelyExpanded = useCallback(
    (courseId: number) => (q ? true : expanded.has(courseId)),
    [q, expanded],
  );

  const toggleExpanded = (courseId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(filteredGroups.map((g) => g.courseId)));
  const collapseAll = () => setExpanded(new Set());

  // ── Delete manual assessment ───────────────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState<ManualAssessment | null>(null);

  const confirmDelete = async () => {
    const a = pendingDelete;
    if (!a) return;
    setPendingDelete(null);
    try {
      await ManualAssessmentApiService.delete(a.id);
      toast.success("Assessment deleted.");
      setManualAssessments((prev) => prev.filter((x) => x.id !== a.id));
    } catch {
      toast.error("Failed to delete assessment.");
    }
  };

  // ── Navigate to the right "view results" screen per assessment kind ───────
  const goToDetail = (row: AssessmentRow) => {
    if (row.kind === "manual") navigate(`/grades/${row.id}/marks`);
    else if (row.kind === "quiz") navigate(`/quizzes/${row.id}/submissions`);
    else navigate(`/assignments/${row.id}`);
  };

  const openAddModal = (courseId?: number) => {
    setEditTarget(null);
    setPresetCourseId(courseId);
    setModalOpen(true);
  };

  const openEditModal = (a: ManualAssessment) => {
    setEditTarget(a);
    setPresetCourseId(undefined);
    setModalOpen(true);
  };

  // ── After create/edit ─────────────────────────────────────────────────────
  const handleSaved = (saved: ManualAssessment) => {
    setManualAssessments((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setModalOpen(false);
    setEditTarget(null);
    setExpanded((prev) => new Set(prev).add(saved.course_id));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">Grades</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-100 dark:bg-blue-900/20"
          label="Subjects tracked"
          value={stats.assessmentsTracking}
          total={stats.totalSubjects}
          tone={
            stats.totalSubjects > 0 && stats.assessmentsTracking === stats.totalSubjects
              ? "good"
              : stats.assessmentsTracking > 0
                ? "neutral"
                : "warning"
          }
          hint="Subjects that already have at least one assessment recorded this term."
        />
        <StatCard
          icon={<School className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-100 dark:bg-orange-900/20"
          label="Classes missing assessments"
          value={stats.classesWithoutAssessments}
          tone={stats.classesWithoutAssessments > 0 ? "warning" : "good"}
          hint="Class groups where none of their subjects have an assessment yet."
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-100 dark:bg-orange-900/20"
          label="Subjects missing assessments"
          value={stats.subjectsWithoutAssessments}
          tone={stats.subjectsWithoutAssessments > 0 ? "warning" : "good"}
          hint={
            stats.subjectsWithoutAssessments === 0
              ? "Every subject already has at least one assessment."
              : showOnlyMissing
                ? "Click to show every subject again."
                : "Click to filter the list below to only these subjects."
          }
          onClick={stats.subjectsWithoutAssessments > 0 ? () => setShowOnlyMissing((v) => !v) : undefined}
          active={showOnlyMissing}
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-blue-800 dark:text-blue-300" />}
          iconBg="bg-blue-100 dark:bg-blue-950/40"
          label="Total assessments given"
          value={stats.totalAssessments}
          tone="neutral"
          hint="Every quiz, assignment, and manual entry created this term across all subjects."
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border-light dark:border-border-dark/50">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Assessments */}
      {activeTab === "Assessments" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-text-primary-light dark:text-text-primary-dark text-lg">Subjects</span>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark text-xs font-bold">
                {filteredGroups.length}
              </span>
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                {totalFilteredAssessments} assessment{totalFilteredAssessments !== 1 ? "s" : ""}
              </span>
              {showOnlyMissing && (
                <button
                  onClick={() => setShowOnlyMissing(false)}
                  className="flex items-center gap-1 pl-2.5 pr-2 py-1 rounded-full text-[11px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                >
                  Missing only
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
                <input
                  type="text"
                  placeholder="Search subjects or assessments"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl border border-transparent text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 bg-surface-light dark:bg-surface-dark/50"
                />
              </div>
              <Tooltip label="Expand all subjects">
                <button
                  onClick={expandAll}
                  aria-label="Expand all subjects"
                  className="p-2 rounded-xl border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
                >
                  <ChevronsDown className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip label="Collapse all subjects">
                <button
                  onClick={collapseAll}
                  aria-label="Collapse all subjects"
                  className="p-2 rounded-xl border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
                >
                  <ChevronsUp className="w-4 h-4" />
                </button>
              </Tooltip>
              <button
                onClick={() => openAddModal()}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Assessment
              </button>
            </div>
          </div>

          {/* Subject cards */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <AlertCircle className="w-10 h-10 text-text-secondary-light dark:text-text-secondary-dark/40" />
              <p className="text-text-secondary-light dark:text-text-secondary-dark/70 text-sm">
                {search
                  ? "No subjects or assessments match your search."
                  : showOnlyMissing
                    ? "Every subject now has at least one assessment."
                    : "No subjects found."}
              </p>
              {showOnlyMissing && (
                <button
                  onClick={() => setShowOnlyMissing(false)}
                  className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                >
                  Show all subjects
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((g) => {
                const isOpen = effectivelyExpanded(g.courseId);
                const enrolled = enrolledCounts.get(g.courseId);
                return (
                  <div
                    key={g.courseId}
                    className="rounded-2xl shadow-sm border border-white dark:border-border-dark/30 overflow-hidden bg-card-light dark:bg-card-dark/30"
                  >
                    {/* Header — the toggle button covers only the expand/collapse
                        affordance; the actions on the right are siblings, not
                        nested inside it, so we never put a <button>/<a> inside
                        another <button> (invalid HTML + broken a11y/focus order). */}
                    <div className="w-full flex items-center justify-between gap-3 pl-5 pr-3 py-2 hover:bg-surface-light/60 dark:hover:bg-surface-dark/40 transition-colors">
                      <button
                        onClick={() => toggleExpanded(g.courseId)}
                        aria-expanded={isOpen}
                        className="flex-1 flex items-center gap-3 min-w-0 py-2 text-left"
                      >
                        <ChevronDown
                          className={`w-4 h-4 flex-shrink-0 text-text-secondary-light dark:text-text-secondary-dark/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(g.course?.code ?? "SB").substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                            {g.course?.title ?? `Subject #${g.courseId}`}
                          </p>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                            {g.rows.length} assessment{g.rows.length !== 1 ? "s" : ""}
                            {typeof enrolled === "number" ? ` · ${enrolled} student${enrolled !== 1 ? "s" : ""}` : ""}
                          </p>
                        </div>
                      </button>

                      {!mappingsLoading && g.rows.length > 0 && (
                        <div className="hidden md:block flex-shrink-0">
                          <MappingProgress mapped={g.mappedCount} total={g.rows.length} />
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link
                          to={`/grades/subjects/${g.courseId}`}
                          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          Report Card
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                        <Tooltip label="Add assessment to this subject">
                          <button
                            onClick={() => openAddModal(g.courseId)}
                            aria-label="Add assessment to this subject"
                            className="p-2 rounded-full hover:bg-surface-light dark:hover:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Mobile-only Report Card shortcut + mapping progress */}
                    <div className="sm:hidden px-5 pb-3 -mt-1 space-y-2">
                      {!mappingsLoading && g.rows.length > 0 && (
                        <MappingProgress mapped={g.mappedCount} total={g.rows.length} />
                      )}
                      <Link
                        to={`/grades/subjects/${g.courseId}`}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        Report Card <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Body */}
                    {isOpen && (
                      <div className="border-t border-border-light dark:border-border-dark/30">
                        {g.rows.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-10 text-center">
                            <p className="text-text-secondary-light dark:text-text-secondary-dark/60 text-sm">
                              No assessments yet for this subject.
                            </p>
                            <button
                              onClick={() => openAddModal(g.courseId)}
                              className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                            >
                              + Add the first one
                            </button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-light dark:divide-border-dark/30">
                              <thead>
                                <tr className="bg-surface-light dark:bg-surface-dark/50">
                                  {["Date", "Title", "Type", "Maximum", "Recorded Results", "Mapping", "Actions"].map((h) => (
                                    <th
                                      key={h}
                                      className="px-5 py-2.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider text-left"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-light dark:divide-border-dark/20">
                                {g.rows.map((a) => {
                                  const recorded = a.recorded ?? 0;
                                  return (
                                    <tr key={a.key} className="hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
                                      <td className="px-5 py-3 text-sm text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
                                        {a.date ? new Date(a.date).toLocaleDateString() : "—"}
                                      </td>
                                      <td className="px-5 py-3 text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-[240px] truncate" title={a.title}>
                                        {a.title}
                                      </td>
                                      <td className="px-5 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${KIND_BADGE[a.kind]}`}>
                                          {KIND_LABEL[a.kind]}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">{a.maxScore ?? "—"}</td>
                                      <td className="px-5 py-3 text-sm">
                                        <RecordedResultsButton
                                          kind={a.kind}
                                          recorded={recorded}
                                          total={enrolled}
                                          onClick={() => goToDetail(a)}
                                        />
                                      </td>
                                      <td className="px-5 py-3">
                                        <AssessmentMappingControl
                                          category={getMappedCategory(a)}
                                          saving={mappingSavingKey === a.key}
                                          onChange={(cat) => handleQuickMap(a, cat)}
                                        />
                                      </td>
                                      <td className="px-5 py-3">
                                        {/* Viewing/recording results now lives on the Recorded
                                            Results button itself — this column is only for
                                            manual assessments' edit/delete, so it's not a
                                            second, redundant place to click for the rest. */}
                                        {a.kind === "manual" ? (
                                          <div className="flex items-center gap-2">
                                            <Tooltip label="Edit assessment">
                                              <button
                                                onClick={() => openEditModal(a.manual!)}
                                                aria-label="Edit assessment"
                                                className="p-1.5 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                                              >
                                                <Pencil className="w-4 h-4" />
                                              </button>
                                            </Tooltip>
                                            <Tooltip label="Delete assessment">
                                              <button
                                                onClick={() => setPendingDelete(a.manual!)}
                                                aria-label="Delete assessment"
                                                className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </Tooltip>
                                          </div>
                                        ) : (
                                          <span className="text-text-secondary-light dark:text-text-secondary-dark/30 text-sm">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Comments / Observations (placeholders) */}
      {activeTab === "Comments" && (
        <div className="rounded-2xl border border-white dark:border-border-dark/30 bg-card-light dark:bg-card-dark/30 shadow-sm p-12 text-center">
          <p className="text-text-secondary-light dark:text-text-secondary-dark/60 text-sm">Comments will appear here.</p>
        </div>
      )}
      {activeTab === "Observations" && (
        <div className="rounded-2xl border border-white dark:border-border-dark/30 bg-card-light dark:bg-card-dark/30 shadow-sm p-12 text-center">
          <p className="text-text-secondary-light dark:text-text-secondary-dark/60 text-sm">Observations will appear here.</p>
        </div>
      )}

      {/* Create/Edit modal */}
      <CreateAssessmentModal
        open={modalOpen}
        courses={courses}
        existing={editTarget}
        term={term}
        academicYear={academicYear}
        presetCourseId={presetCourseId}
        onClose={() => { setModalOpen(false); setEditTarget(null); setPresetCourseId(undefined); }}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete assessment?"
        description={pendingDelete ? `"${ManualAssessmentApiService.getTypeLabel(pendingDelete)}" and every student's score for it will be removed. This can't be undone.` : ""}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
