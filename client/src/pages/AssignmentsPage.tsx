import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Search,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Award,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import {
  AssignmentApiService,
  type ListedAssignment,
  type AssignmentStatus,
  type StudentAssignmentState,
} from "../services/assignmentApi";
import { formatDateTimeLocal } from "../utils/dateUtils";
import { onAcademicPeriodChanged } from "../utils/academicPeriodEvents";

/**
 * Assignments: one list, newest first, with a search box, a subject filter
 * and status chips. Students' chips are their own state (to do, overdue,
 * submitted, graded) with counts; staff filter by the assignment's status.
 */

/* ── helpers ─────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 20;
/** Created within this many days: tagged "New". */
const NEW_DAYS = 7;

const STATUS_META: Record<AssignmentStatus, { label: string; cls: string; dot: string }> = {
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

const STUDENT_CHIPS: { v: "all" | StudentAssignmentState; l: string }[] = [
  { v: "all", l: "All" },
  { v: "todo", l: "To do" },
  { v: "missed", l: "Overdue" },
  { v: "submitted", l: "Submitted" },
  { v: "graded", l: "Graded" },
];

const STAFF_CHIPS: { v: "all" | AssignmentStatus; l: string }[] = [
  { v: "all", l: "All" },
  { v: "published", l: "Published" },
  { v: "draft", l: "Draft" },
  { v: "completed", l: "Completed" },
  { v: "removed", l: "Removed" },
];

const isNew = (createdAt: string | null) =>
  !!createdAt && Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 86_400_000;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ── row ─────────────────────────────────────────────────────────────────── */

function StudentBadge({ a }: { a: ListedAssignment }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";
  switch (a.my_state) {
    case "graded":
      return (
        <span className={`${base} border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400`}>
          <CheckCircle2 className="h-3 w-3" />
          {a.my_submission?.grade ? `Graded · ${a.my_submission.grade}` : "Graded"}
        </span>
      );
    case "submitted":
      return (
        <span className={`${base} border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400`}>
          <Clock className="h-3 w-3" />
          Submitted
        </span>
      );
    case "missed":
      return (
        <span className={`${base} border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400`}>
          <AlertCircle className="h-3 w-3" />
          Overdue
        </span>
      );
    default:
      return <span className={`${base} border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300`}>To do</span>;
  }
}

function AssignmentRow({
  a,
  isStudent,
  canManage,
  onStatus,
}: {
  a: ListedAssignment;
  isStudent: boolean;
  canManage: boolean;
  onStatus: (id: number, s: AssignmentStatus) => void;
}) {
  const meta = STATUS_META[a.status] ?? STATUS_META.draft;
  // Co-teachers see each other's assignments; only the creator (or a super
  // admin) may change the status.
  const canChangeStatus = canManage && a.can_manage === true;
  const dueSoonOrLate = isStudent && (a.my_state === "todo" || a.my_state === "missed");
  const late = isStudent && a.my_state === "missed";

  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-surface-light/70 dark:hover:bg-surface-dark/30 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={`/assignments/${a.id}`}
            className="truncate text-sm font-semibold text-text-primary-light hover:text-blue-600 dark:text-text-primary-dark dark:hover:text-blue-400"
          >
            {a.title}
          </Link>
          {isNew(a.created_at) && (
            <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          <span className="font-medium text-text-primary-light/80 dark:text-text-primary-dark/80">
            {a.subject_code ? `${a.subject_code} · ` : ""}
            {a.subject_name}
          </span>
          <span className={`flex items-center gap-1 ${late ? "font-medium text-red-600 dark:text-red-400" : dueSoonOrLate ? "text-text-primary-light/80 dark:text-text-primary-dark/80" : ""}`}>
            <Calendar className="h-3 w-3" />
            Due {formatDateTimeLocal(a.due_date)}
          </span>
          <span className="flex items-center gap-1">
            <Award className="h-3 w-3" />
            {a.max_score} pts
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {isStudent ? (
          <StudentBadge a={a} />
        ) : (
          <>
            {a.submission_count !== undefined && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70" title="Graded / handed in">
                <Users className="h-3.5 w-3.5" />
                {a.graded_count ?? 0}/{a.submission_count} graded
              </span>
            )}
            {canChangeStatus ? (
              <select
                value={a.status}
                onChange={(e) => onStatus(a.id, e.target.value as AssignmentStatus)}
                aria-label={`Status of ${a.title}`}
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
          </>
        )}
      </div>
    </li>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

const AssignmentsPage: React.FC = () => {
  const { can } = usePermissions();
  const isStudent = can("SUBMISSIONS_CREATE") && !can("ASSIGNMENTS_VIEW_SUBMISSIONS");

  const [items, setItems] = useState<ListedAssignment[]>([]);
  const [counts, setCounts] = useState<Partial<Record<StudentAssignmentState, number>>>({});
  const [subjects, setSubjects] = useState<{ id: number; name: string; code: string | null }[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [canManage, setCanManage] = useState(false);
  const [scope, setScope] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [status, setStatus] = useState("all");
  const [subjectId, setSubjectId] = useState<number | "">("");

  // Only the latest request may update the list (filters change faster than responses).
  const requestSeq = useRef(0);

  const fetchData = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const mine = ++requestSeq.current;
      opts?.refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const data = await AssignmentApiService.list({ page, pageSize: PAGE_SIZE, search: debouncedSearch, status, subjectId });
        if (mine !== requestSeq.current) return;
        setItems(data.items);
        setCounts(data.counts ?? {});
        setSubjects(data.subjects);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.total_pages);
        setCanManage(data.can_manage);
        setScope(data.scope);
      } catch (e: any) {
        if (mine !== requestSeq.current) return;
        setError(e?.response?.data?.message ?? "Could not load assignments. Try again.");
        setItems([]);
      } finally {
        if (mine === requestSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, debouncedSearch, status, subjectId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Back to page 1 whenever a filter changes.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, status, subjectId]);

  useEffect(() => onAcademicPeriodChanged(() => fetchData({ refresh: true })), [fetchData]);

  const handleStatus = async (id: number, newStatus: AssignmentStatus) => {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
    try {
      await AssignmentApiService.setStatus(id, newStatus);
    } catch {
      fetchData({ refresh: true });
    }
  };

  const chips = isStudent ? STUDENT_CHIPS : STAFF_CHIPS;
  const allCount = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const filtered = !!(search || status !== "all" || subjectId);
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setSubjectId("");
  };
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">Assignments</h1>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Newest first</p>
          </div>
        </div>
        {canManage && (
          <Link
            to="/assignments/create"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create assignment
          </Link>
        )}
      </div>

      {/* Find */}
      <div className="space-y-3 rounded-2xl border border-white/60 bg-card-light p-3 shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
            <input
              type="search"
              placeholder="Search assignments or subjects"
              aria-label="Search assignments"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-transparent bg-surface-light py-2.5 pl-9 pr-4 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark"
            />
          </div>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}
            aria-label="Subject"
            className="rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark sm:w-60"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} — ` : ""}
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchData({ refresh: true })}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
            className="flex items-center justify-center rounded-xl border border-border-light px-3 py-2.5 text-text-secondary-light transition-colors hover:bg-surface-light disabled:opacity-50 dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:bg-surface-dark/60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => {
            const active = status === c.v;
            const n = isStudent ? (c.v === "all" ? allCount : counts[c.v as StudentAssignmentState]) : undefined;
            return (
              <button
                key={c.v}
                type="button"
                onClick={() => setStatus(c.v)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-border-light text-text-secondary-light hover:border-blue-300 hover:text-blue-600 dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:text-blue-400"
                }`}
              >
                {c.l}
                {n !== undefined && <span className={`ml-1.5 tabular-nums ${active ? "text-blue-100" : "opacity-70"}`}>{n}</span>}
              </button>
            );
          })}
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="divide-y divide-border-light overflow-hidden rounded-2xl border border-white/60 bg-card-light dark:divide-border-dark/30 dark:border-border-dark/30 dark:bg-card-dark/30" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 px-4 py-4">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-surface-light dark:bg-surface-dark/60" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-surface-light dark:bg-surface-dark/60" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        !error && (
          <div className="rounded-2xl border border-white/60 bg-card-light py-14 text-center shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
            <AlertCircle className="mx-auto h-10 w-10 text-text-secondary-light/50 dark:text-text-secondary-dark/40" />
            <h3 className="mt-3 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {filtered
                ? "No assignments match"
                : scope === "assigned"
                  ? "You have no assigned subjects this term"
                  : scope === "enrolled"
                    ? "You're not enrolled in any subjects this term"
                    : "No assignments yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              {filtered ? "Try another search or clear the filters." : "Assignments for the selected term will appear here, newest first."}
            </p>
            {filtered ? (
              <button type="button" onClick={clearFilters} className="mt-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                Clear filters
              </button>
            ) : (
              canManage && (
                <Link to="/assignments/create" className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Create your first assignment
                </Link>
              )
            )}
          </div>
        )
      ) : (
        <>
          <ul
            aria-label="Assignments"
            aria-busy={refreshing}
            className="divide-y divide-border-light overflow-hidden rounded-2xl border border-white/60 bg-card-light shadow-sm dark:divide-border-dark/30 dark:border-border-dark/30 dark:bg-card-dark/30"
          >
            {items.map((a) => (
              <AssignmentRow key={a.id} a={a} isStudent={isStudent} canManage={canManage} onStatus={handleStatus} />
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <span className="text-text-secondary-light dark:text-text-secondary-dark">
              {firstShown}–{lastShown} of {total}
            </span>
            {totalPages > 1 && (
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
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AssignmentsPage;
