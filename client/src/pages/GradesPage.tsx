import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Users,
  BookOpen,
  School,
  ClipboardList,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import {
  ManualAssessmentApiService,
  ASSESSMENT_TYPE_LABELS,
  type ManualAssessment,
} from "../services/manualAssessmentApi";
import { useAuth } from "../contexts/AuthContext";
import CreateAssessmentModal from "../components/Grades/CreateAssessmentModal";
import type { Course } from "../types/course.types";

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
    <div className="bg-card-light dark:bg-card-dark/30 rounded-3xl shadow-sm border border-white dark:border-border-dark/30 p-6 flex flex-col gap-4">
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

// ─── Main page ────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];
const TABS = ["Assessments", "Comments", "Observations"] as const;
type Tab = (typeof TABS)[number];

export default function GradesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const term         = user?.currentAcademicTerm?.name ?? "";
  const academicYear = user?.currentAcademicYear?.name ?? "";

  // ── Data ──────────────────────────────────────────────────────────────────
  const [courses, setCourses]         = useState<Course[]>([]);
  const [assessments, setAssessments] = useState<ManualAssessment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<Tab>("Assessments");

  // ── Table state ───────────────────────────────────────────────────────────
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<ManualAssessment | null>(null);

  // ── Enrolled counts cache: courseId → studentCount ────────────────────────
  const [enrolledCounts, setEnrolledCounts] = useState<Map<number, number>>(new Map());

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

  // ── Load assessments for all courses ─────────────────────────────────────
  const loadAssessments = useCallback(async (courseList: Course[]) => {
    if (courseList.length === 0) {
      setAssessments([]);
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
      setAssessments(res.data ?? []);
    } catch {
      toast.error("Failed to load assessments");
    }
  }, [term, academicYear]);

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const courseList = await loadCourses();
      await loadAssessments(courseList);
      setLoading(false);
      // Load enrollment counts in background
      loadEnrolledCounts(courseList);
    })();
  }, [loadCourses, loadAssessments, loadEnrolledCounts]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const subjectsWithAssessments = new Set(assessments.map((a) => a.course_id)).size;
    const totalSubjects = courses.length;
    const subjectsWithoutAssessments = courses.filter(
      (c) => !assessments.some((a) => a.course_id === c.id),
    ).length;

    // "Classes" here = unique class groups (by class_group_id)
    const classGroupIds = [...new Set(courses.map((c) => c.class_group_id).filter(Boolean))];
    const classesWithoutAssessments = classGroupIds.filter((gid) => {
      const groupCourses = courses.filter((c) => c.class_group_id === gid);
      return !groupCourses.some((c) => assessments.some((a) => a.course_id === c.id));
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

  // ── Filtered & paginated assessments ─────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return assessments;
    const q = search.toLowerCase();
    return assessments.filter((a) => {
      const course = courseMap.get(a.course_id);
      const subjectLabel = course?.title ?? "";
      const typeLabel = ManualAssessmentApiService.getTypeLabel(a);
      return (
        subjectLabel.toLowerCase().includes(q) ||
        typeLabel.toLowerCase().includes(q)
      );
    });
  }, [assessments, search, courseMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated  = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handlePageChange = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  // ── Delete assessment ─────────────────────────────────────────────────────
  const handleDelete = async (a: ManualAssessment) => {
    if (!window.confirm(`Delete "${ManualAssessmentApiService.getTypeLabel(a)}"? All student scores will be removed.`)) return;
    try {
      await ManualAssessmentApiService.delete(a.id);
      toast.success("Assessment deleted.");
      setAssessments((prev) => prev.filter((x) => x.id !== a.id));
    } catch {
      toast.error("Failed to delete assessment.");
    }
  };

  // ── Navigate to student marks ─────────────────────────────────────────────
  const goToMarks = (a: ManualAssessment) => {
    navigate(`/grades/${a.id}/marks`);
  };

  // ── After create/edit ─────────────────────────────────────────────────────
  const handleSaved = (saved: ManualAssessment) => {
    setAssessments((prev) => {
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
          icon={<School className="w-6 h-6 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-100 dark:bg-violet-900/20"
          label="Classes without assessments"
          value={stats.classesWithoutAssessments}
        />
        <StatCard
          icon={<Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/20"
          label="Subjects without assessments"
          value={stats.subjectsWithoutAssessments}
        />
        <StatCard
          icon={<BookOpen className="w-6 h-6 text-red-600 dark:text-red-400" />}
          iconBg="bg-red-100 dark:bg-red-900/20"
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
          {/* Table header toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-text-primary-light dark:text-text-primary-dark text-lg">All Assessments</span>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark text-xs font-bold">
                {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
                <input
                  type="text"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 pr-4 py-2 rounded-xl border border-transparent text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-56 bg-surface-light dark:bg-surface-dark/50"
                />
              </div>
              <button
                onClick={() => { setEditTarget(null); setModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Assessment
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <AlertCircle className="w-10 h-10 text-text-secondary-light dark:text-text-secondary-dark/40" />
              <p className="text-text-secondary-light dark:text-text-secondary-dark/70 text-sm">
                {search ? "No assessments match your search." : "No assessments yet. Click \"+  Add Assessment\" to create one."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl shadow-sm border border-white dark:border-border-dark/30 overflow-hidden bg-card-light dark:bg-card-dark/30">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark/30">
                <thead>
                  <tr className="bg-surface-light dark:bg-surface-dark/50">
                    {["Date", "Subject", "Type", "Maximum", "Recorded Results", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wider text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark/20">
                  {paginated.map((a) => {
                    const course   = courseMap.get(a.course_id);
                    const typeLabel = ManualAssessmentApiService.getTypeLabel(a);
                    const enrolled = enrolledCounts.get(a.course_id) ?? "—";
                    const recorded = a.recorded_count ?? 0;
                    return (
                      <tr key={a.id} className="hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
                        <td className="px-5 py-4 text-sm text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
                          {a.assessment_date ?? "—"}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                          {course?.title ?? `Course #${a.course_id}`}
                        </td>
                        <td className="px-5 py-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">{typeLabel}</td>
                        <td className="px-5 py-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">{a.max_score}</td>
                        <td className="px-5 py-4 text-sm">
                          {typeof enrolled === "number" ? (
                            <RecordedChip
                              recorded={recorded}
                              total={enrolled}
                              onClick={() => goToMarks(a)}
                            />
                          ) : (
                            <span className="text-text-secondary-light dark:text-text-secondary-dark/50 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setEditTarget(a); setModalOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(a)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-border-light dark:border-border-dark/30 bg-surface-light dark:bg-surface-dark/50">
                <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  <span>Rows per page</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                    className="border border-border-light dark:border-border-dark/50 rounded-lg px-2 py-1 text-sm bg-white dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {ROWS_PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-0.5 ml-3">
                    <button onClick={() => handlePageChange(1)} disabled={page === 1} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
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
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSaved={handleSaved}
      />
    </div>
  );
}
