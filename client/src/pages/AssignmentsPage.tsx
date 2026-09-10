import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  Search,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Calendar,
  Award,
  Users,
  CheckCircle2,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import {
  AssignmentApiService,
  type GroupedSubject,
  type GroupedAssignment,
  type AssignmentStatus,
} from "../services/assignmentApi";
import { formatDateTimeLocal } from "../utils/dateUtils";
import { onAcademicPeriodChanged } from "../utils/academicPeriodEvents";

/* ── helpers ─────────────────────────────────────────────────────────────── */

const SUBJECT_HUES = [211, 262, 340, 24, 152, 190, 45, 288];
const hueFor = (id: number) => SUBJECT_HUES[Math.abs(id) % SUBJECT_HUES.length];

const STATUS_META: Record<
  AssignmentStatus,
  { label: string; cls: string; dot: string }
> = {
  draft: {
    label: "Draft",
    cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-800/50",
    dot: "bg-amber-400",
  },
  published: {
    label: "Published",
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800/50",
    dot: "bg-emerald-400",
  },
  completed: {
    label: "Completed",
    cls: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-800/50",
    dot: "bg-blue-400",
  },
  removed: {
    label: "Removed",
    cls: "text-gray-600 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700",
    dot: "bg-gray-400",
  },
};

const COLLAPSE_KEY = "tm.assignments.collapsed";
const loadCollapsed = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}");
  } catch {
    return {};
  }
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ── assignment row ──────────────────────────────────────────────────────── */

function AssignmentRow({
  a,
  canManage,
  onStatus,
}: {
  a: GroupedAssignment;
  canManage: boolean;
  onStatus: (id: number, s: AssignmentStatus) => void;
}) {
  const overdue =
    a.status !== "completed" &&
    !a.my_submission &&
    new Date(a.due_date).getTime() < Date.now();
  const meta = STATUS_META[a.status] ?? STATUS_META.draft;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="group flex flex-col gap-2 rounded-xl border border-transparent bg-surface-light px-3.5 py-3 transition-colors hover:border-blue-200 dark:bg-surface-dark/40 dark:hover:border-blue-900/50 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <Link
          to={`/assignments/${a.id}`}
          className="truncate text-sm font-semibold text-text-primary-light hover:text-blue-600 dark:text-text-primary-dark dark:hover:text-blue-400"
        >
          {a.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          <span className={`flex items-center gap-1 ${overdue ? "font-medium text-red-600 dark:text-red-400" : ""}`}>
            <Calendar className="h-3 w-3" />
            {formatDateTimeLocal(a.due_date)}
            {overdue && " · overdue"}
          </span>
          <span className="flex items-center gap-1">
            <Award className="h-3 w-3" />
            {a.max_score} pts
          </span>
          <span className="flex items-center gap-1 capitalize">
            <FileText className="h-3 w-3" />
            {a.submission_type}
          </span>
          {a.creator && (
            <span className="hidden sm:inline">
              by {a.creator.first_name} {a.creator.last_name}
            </span>
          )}
        </div>
      </div>

      {/* student: my submission state */}
      {a.my_submission !== undefined && (
        <div className="shrink-0">
          {a.my_submission?.grade ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              {a.my_submission.grade}
            </span>
          ) : a.my_submission ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              <Clock className="h-3 w-3" />
              Submitted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Not submitted
            </span>
          )}
        </div>
      )}

      {/* manager: submission counts */}
      {a.submission_count !== undefined && (
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          <Users className="h-3.5 w-3.5" />
          <span>
            {a.graded_count ?? 0}/{a.submission_count} graded
          </span>
        </div>
      )}

      {/* status */}
      <div className="shrink-0">
        {canManage ? (
          <select
            value={a.status}
            onChange={(e) => onStatus(a.id, e.target.value as AssignmentStatus)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${meta.cls}`}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="completed">Completed</option>
            <option value="removed">Removed</option>
          </select>
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        )}
      </div>

      <Link
        to={`/assignments/${a.id}`}
        className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
      >
        Open
      </Link>
    </motion.div>
  );
}

/* ── subject section ─────────────────────────────────────────────────────── */

function SubjectSection({
  subject,
  canManage,
  collapsed,
  onToggle,
  onStatus,
}: {
  subject: GroupedSubject;
  canManage: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onStatus: (id: number, s: AssignmentStatus) => void;
}) {
  const hue = hueFor(subject.subject_id);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-card-light shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `hsl(${hue} 85% 92%)`,
            color: `hsl(${hue} 70% 35%)`,
          }}
        >
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-text-primary-light dark:text-text-primary-dark">
              {subject.subject_name}
            </span>
            {subject.subject_code && (
              <span className="shrink-0 rounded-md bg-surface-light px-1.5 py-0.5 text-[10px] font-medium text-text-secondary-light dark:bg-surface-dark/60 dark:text-text-secondary-dark">
                {subject.subject_code}
              </span>
            )}
          </div>
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
            {subject.assignment_count}{" "}
            {subject.assignment_count === 1 ? "assignment" : "assignments"}
            {canManage && subject.draft_count > 0 && ` · ${subject.draft_count} draft`}
          </span>
        </div>
        {canManage && (
          <Link
            to={`/assignments/create?courseId=${subject.subject_id}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden shrink-0 items-center gap-1 rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/20 sm:flex"
          >
            <Plus className="h-3 w-3" />
            Add
          </Link>
        )}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-text-secondary-light transition-transform dark:text-text-secondary-dark ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 border-t border-border-light px-2.5 pb-3 pt-2 dark:border-border-dark/30 sm:px-3">
              {subject.assignments.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                  No assignments in this subject yet.
                </p>
              ) : (
                <AnimatePresence>
                  {subject.assignments.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      a={a}
                      canManage={canManage}
                      onStatus={onStatus}
                    />
                  ))}
                </AnimatePresence>
              )}
              {subject.has_more && (
                <Link
                  to={`/courses/${subject.subject_id}`}
                  className="block px-2 pt-1 text-center text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  View all {subject.assignment_count} in course →
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 8;

const AssignmentsPage: React.FC = () => {
  const { can } = usePermissions();

  const [subjects, setSubjects] = useState<GroupedSubject[]>([]);
  const [allSubjects, setAllSubjects] = useState<
    { id: number; name: string; code: string | null }[]
  >([]);
  const [totals, setTotals] = useState({ subjects: 0, assignments: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [canManage, setCanManage] = useState(false);
  const [scope, setScope] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [status, setStatus] = useState("all");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const isStudent = can("SUBMISSIONS_CREATE") && !can("ASSIGNMENTS_VIEW_SUBMISSIONS");

  const fetchData = useCallback(
    async (opts?: { refresh?: boolean }) => {
      opts?.refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const data = await AssignmentApiService.getGrouped({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          status,
          subjectId,
        });
        setSubjects(data.subjects);
        setAllSubjects(data.all_subjects);
        setTotals(data.totals);
        setTotalPages(data.pagination.total_pages);
        setCanManage(data.can_manage);
        setScope(data.scope);
      } catch (e: any) {
        console.error(e);
        setError(
          e?.response?.data?.message ?? "Could not load assignments. Try again.",
        );
        setSubjects([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch, status, subjectId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 whenever a filter changes
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, status, subjectId]);

  // Refresh on academic period switch
  useEffect(() => onAcademicPeriodChanged(() => fetchData({ refresh: true })), [fetchData]);

  const toggleSection = (id: number) => {
    setCollapsed((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleStatus = async (id: number, newStatus: AssignmentStatus) => {
    // optimistic
    setSubjects((prev) =>
      prev.map((s) => ({
        ...s,
        assignments: s.assignments.map((a) =>
          a.id === id ? { ...a, status: newStatus } : a,
        ),
      })),
    );
    try {
      await AssignmentApiService.setStatus(id, newStatus);
    } catch {
      fetchData({ refresh: true });
    }
  };

  const statusOptions = useMemo(
    () =>
      isStudent
        ? [
            { v: "all", l: "All" },
            { v: "published", l: "Published" },
            { v: "completed", l: "Completed" },
          ]
        : [
            { v: "all", l: "All statuses" },
            { v: "published", l: "Published" },
            { v: "draft", l: "Draft" },
            { v: "completed", l: "Completed" },
            { v: "removed", l: "Removed" },
          ],
    [isStudent],
  );

  const scopeLabel =
    scope === "all"
      ? "all subjects"
      : scope === "assigned"
        ? "your assigned subjects"
        : scope === "enrolled"
          ? "your enrolled subjects"
          : "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-white/60 bg-card-light px-5 py-4 shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                Assignments
              </h1>
              <p className="mt-0.5 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {totals.assignments} assignment
                {totals.assignments === 1 ? "" : "s"} across {totals.subjects}{" "}
                subject{totals.subjects === 1 ? "" : "s"}
                {scopeLabel && ` — ${scopeLabel}`}
              </p>
            </div>
          </div>
          {canManage && (
            <Link
              to="/assignments/create"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-700 hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Create Assignment
            </Link>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-2 z-10 flex flex-col gap-3 rounded-2xl border border-white/60 bg-card-light/95 p-3 shadow-sm backdrop-blur dark:border-border-dark/30 dark:bg-card-dark/50 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
          <input
            type="text"
            placeholder="Search by subject or assignment title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-transparent bg-surface-light py-2.5 pl-9 pr-4 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark"
          />
        </div>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}
          className="rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark lg:w-56"
        >
          <option value="">All subjects</option>
          {allSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ? `${s.code} — ` : ""}
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark lg:w-44"
        >
          {statusOptions.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
        <button
          onClick={() => fetchData({ refresh: true })}
          disabled={refreshing}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border-light px-3 py-2.5 text-sm text-text-secondary-light transition-colors hover:bg-surface-light disabled:opacity-50 dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:bg-surface-dark/60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="lg:hidden">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-white/60 bg-card-light dark:border-border-dark/30 dark:bg-card-dark/30"
            />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-card-light py-16 text-center shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
          <AlertCircle className="mx-auto h-12 w-12 text-text-secondary-light/50 dark:text-text-secondary-dark/40" />
          <h3 className="mt-3 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {search || status !== "all" || subjectId
              ? "No assignments match your filters"
              : scope === "assigned"
                ? "You have no assigned subjects this term"
                : scope === "enrolled"
                  ? "You're not enrolled in any subjects this term"
                  : "No assignments yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            {search || status !== "all" || subjectId
              ? "Try clearing the search or filters."
              : "Assignments will appear here, grouped by subject, once they're created for the selected term."}
          </p>
          {canManage && !search && status === "all" && !subjectId && (
            <Link
              to="/assignments/create"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create your first assignment
            </Link>
          )}
        </div>
      ) : (
        <>
          <motion.div layout className="space-y-3">
            {subjects.map((s) => (
              <SubjectSection
                key={s.subject_id}
                subject={s}
                canManage={canManage}
                collapsed={!!collapsed[s.subject_id]}
                onToggle={() => toggleSection(s.subject_id)}
                onStatus={handleStatus}
              />
            ))}
          </motion.div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-card-light px-4 py-3 text-sm shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                Page {page} of {totalPages} · {totals.subjects} subjects
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 rounded-full border border-border-light px-3 py-1.5 disabled:opacity-40 dark:border-border-dark/50"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 rounded-full border border-border-light px-3 py-1.5 disabled:opacity-40 dark:border-border-dark/50"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AssignmentsPage;
