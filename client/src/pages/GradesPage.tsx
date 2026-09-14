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
  ChevronsDown,
  ChevronsUp,
  ClipboardCheck,
  ArrowRight,
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

function StatCard({
  icon,
  label,
  value,
  sub,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
}) {
  return (
    <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 p-6 flex flex-col gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">{label}</p>
        <p className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mt-1">
          {value}
          {sub && <span className="text-sm font-normal text-text-secondary-light dark:text-text-secondary-dark/60 ml-1">{sub}</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Recorded results chip ────────────────────────────────────────────────────

function RecordedChip({
  recorded,
  total,
  onClick,
}: {
  recorded: number;
  total: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition-colors"
    >
      {recorded} / {total}
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

  // ── Search: filters subjects/assessments, auto-expands matches ───────────
  const q = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return subjectGroups;
    return subjectGroups
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
  }, [subjectGroups, q]);

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
          icon={<ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-100 dark:bg-blue-900/20"
          label="Assessments tracking"
          value={stats.assessmentsTracking}
          sub="/ subject"
        />
        <StatCard
          icon={<School className="w-6 h-6 text-gray-600 dark:text-gray-400" />}
          iconBg="bg-gray-200 dark:bg-gray-800/60"
          label="Classes without assessments"
          value={stats.classesWithoutAssessments}
        />
        <StatCard
          icon={<Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-100 dark:bg-orange-900/20"
          label="Subjects without assessments"
          value={stats.subjectsWithoutAssessments}
        />
        <StatCard
          icon={<BookOpen className="w-6 h-6 text-blue-800 dark:text-blue-300" />}
          iconBg="bg-blue-100 dark:bg-blue-950/40"
          label="Total given assessments"
          value={stats.totalAssessments}
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
                {search ? "No subjects or assessments match your search." : "No subjects found."}
              </p>
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
                                        {typeof enrolled === "number" ? (
                                          <RecordedChip recorded={recorded} total={enrolled} onClick={() => goToDetail(a)} />
                                        ) : (
                                          <span className="text-text-secondary-light dark:text-text-secondary-dark/50 text-sm">—</span>
                                        )}
                                      </td>
                                      <td className="px-5 py-3">
                                        <AssessmentMappingControl
                                          category={getMappedCategory(a)}
                                          saving={mappingSavingKey === a.key}
                                          onChange={(cat) => handleQuickMap(a, cat)}
                                        />
                                      </td>
                                      <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                          {a.kind === "manual" ? (
                                            <>
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
                                            </>
                                          ) : (
                                            <Tooltip label="View results">
                                              <button
                                                onClick={() => goToDetail(a)}
                                                aria-label="View results"
                                                className="p-1.5 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                                              >
                                                <Eye className="w-4 h-4" />
                                              </button>
                                            </Tooltip>
                                          )}
                                        </div>
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
