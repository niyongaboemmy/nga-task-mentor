import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ClipboardList,
  HelpCircle,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import {
  SubmissionsApiService,
  type GroupedSubmissionsSubject,
  type GroupedAssessment,
} from "../services/submissionsApi";
import { onAcademicPeriodChanged } from "../utils/academicPeriodEvents";

/* ── helpers ─────────────────────────────────────────────────────────────── */

const SUBJECT_HUES = [211, 262, 340, 24, 152, 190, 45, 288];
const hueFor = (id: number) => SUBJECT_HUES[Math.abs(id) % SUBJECT_HUES.length];

const prettyStatus = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const MY_STATUS_STYLE = (status: string): string => {
  const s = status.toLowerCase();
  if (["graded", "auto_graded"].includes(s))
    return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800/50";
  if (["submitted", "completed", "resubmitted"].includes(s))
    return "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-800/50";
  if (["late"].includes(s))
    return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-800/50";
  if (["in_progress", "pending"].includes(s))
    return "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-900/20 dark:border-violet-800/50";
  return "text-gray-600 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700";
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const STATUS_LABELS: Record<string, string> = {
  needs_grading: "Needs grading",
  fully_graded: "Fully graded",
  no_submissions: "No submissions",
};

const COLLAPSE_KEY = "tm.submissions.collapsed";
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

/* ── assessment row ──────────────────────────────────────────────────────── */

function AssessmentRow({
  a,
  canViewAll,
}: {
  a: GroupedAssessment;
  canViewAll: boolean;
}) {
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
          to={a.detail_url}
          className="truncate text-sm font-semibold text-text-primary-light hover:text-blue-600 dark:text-text-primary-dark dark:hover:text-blue-400"
        >
          {a.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          {a.last_submission_at ? (
            <span>Last submission {fmtDate(a.last_submission_at)}</span>
          ) : (
            <span>No submissions yet</span>
          )}
          {a.max_score != null && <span>{a.max_score} pts</span>}
          {a.status !== "published" && (
            <span className="capitalize">{a.status}</span>
          )}
        </div>
      </div>

      {canViewAll ? (
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/80">
            <Users className="h-3.5 w-3.5" />
            {a.submission_count}
          </span>
          {a.pending_count > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              <Clock className="h-3 w-3" />
              {a.pending_count} to grade
            </span>
          ) : a.submission_count > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              All graded
            </span>
          ) : null}
          {a.avg_percentage != null && (
            <span className="w-12 text-right text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
              {a.avg_percentage}%
            </span>
          )}
        </div>
      ) : (
        <div className="shrink-0">
          {a.my_status ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${MY_STATUS_STYLE(a.my_status)}`}
            >
              {a.my_grade_display ??
                (a.my_percentage != null
                  ? `${a.my_percentage}%`
                  : prettyStatus(a.my_status))}
            </span>
          ) : null}
        </div>
      )}

      <Link
        to={a.detail_url}
        className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
      >
        {canViewAll ? `View ${a.submission_count} submission${a.submission_count === 1 ? "" : "s"}` : "Open"}
      </Link>
    </motion.div>
  );
}

/* ── type sub-group ──────────────────────────────────────────────────────── */

function TypeGroup({
  label,
  icon,
  group,
  subjectId,
  canViewAll,
}: {
  label: string;
  icon: React.ReactNode;
  group: GroupedSubmissionsSubject["assignments"];
  subjectId: number;
  canViewAll: boolean;
}) {
  if (group.count === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-2 pt-1">
        <span className="text-text-secondary-light dark:text-text-secondary-dark/80">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/80">
          {label}
        </span>
        <span className="rounded-full bg-surface-light px-1.5 text-[10px] font-semibold text-text-secondary-light dark:bg-surface-dark/60 dark:text-text-secondary-dark">
          {group.count}
        </span>
      </div>
      <AnimatePresence>
        {group.items.map((a) => (
          <AssessmentRow key={`${a.type}-${a.id}`} a={a} canViewAll={canViewAll} />
        ))}
      </AnimatePresence>
      {group.has_more && (
        <Link
          to={`/courses/${subjectId}`}
          className="block px-2 text-center text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View all {group.count} in course →
        </Link>
      )}
    </div>
  );
}

/* ── subject section ─────────────────────────────────────────────────────── */

function SubjectSection({
  subject,
  collapsed,
  onToggle,
  canViewAll,
  typeFilter,
}: {
  subject: GroupedSubmissionsSubject;
  collapsed: boolean;
  onToggle: () => void;
  canViewAll: boolean;
  typeFilter: string;
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
            {subject.assessment_count}{" "}
            {subject.assessment_count === 1 ? "assessment" : "assessments"} ·{" "}
            {subject.submission_total} submission
            {subject.submission_total === 1 ? "" : "s"}
            {canViewAll && subject.pending_total > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {" "}
                · {subject.pending_total} to grade
              </span>
            )}
          </span>
        </div>
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
            <div className="space-y-3 border-t border-border-light px-2.5 pb-3 pt-2.5 dark:border-border-dark/30 sm:px-3">
              {subject.assessment_count === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                  No assessments in this subject yet.
                </p>
              ) : (
                <>
                  {typeFilter !== "quiz" && (
                    <TypeGroup
                      label="Assignments"
                      icon={<ClipboardList className="h-3.5 w-3.5" />}
                      group={subject.assignments}
                      subjectId={subject.subject_id}
                      canViewAll={canViewAll}
                    />
                  )}
                  {typeFilter !== "assignment" && (
                    <TypeGroup
                      label="Quizzes"
                      icon={<HelpCircle className="h-3.5 w-3.5" />}
                      group={subject.quizzes}
                      subjectId={subject.subject_id}
                      canViewAll={canViewAll}
                    />
                  )}
                </>
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
const TYPE_TABS = [
  { v: "all", l: "All" },
  { v: "assignment", l: "Assignments" },
  { v: "quiz", l: "Quizzes" },
] as const;

const SubmissionsPage: React.FC = () => {
  usePermissions();

  const [subjects, setSubjects] = useState<GroupedSubmissionsSubject[]>([]);
  const [allSubjects, setAllSubjects] = useState<
    { id: number; name: string; code: string | null }[]
  >([]);
  const [statusValues, setStatusValues] = useState<string[]>([]);
  const [totals, setTotals] = useState({ subjects: 0, submissions: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [scope, setScope] = useState("");
  const [canViewAll, setCanViewAll] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [type, setType] = useState<"all" | "assignment" | "quiz">("all");
  const [status, setStatus] = useState("all");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const fetchData = useCallback(
    async (opts?: { refresh?: boolean }) => {
      opts?.refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const data = await SubmissionsApiService.getGrouped({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          type,
          status,
          subjectId,
        });
        setSubjects(data.subjects);
        setAllSubjects(data.all_subjects);
        setStatusValues(data.status_values);
        setTotals(data.totals);
        setTotalPages(data.pagination.total_pages);
        setScope(data.scope);
        setCanViewAll(data.can_view_all);
      } catch (e: any) {
        console.error(e);
        setError(e?.response?.data?.message ?? "Could not load submissions.");
        setSubjects([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch, type, status, subjectId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, type, status, subjectId]);

  useEffect(
    () => onAcademicPeriodChanged(() => fetchData({ refresh: true })),
    [fetchData],
  );

  const toggleSection = (id: number) => {
    setCollapsed((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const scopeLabel =
    scope === "all"
      ? "all subjects"
      : scope === "assigned"
        ? "your assigned subjects"
        : scope === "enrolled"
          ? "your enrolled subjects"
          : "";

  const statusOptions = useMemo(() => ["all", ...statusValues], [statusValues]);
  const noAssessments = subjects.every((s) => s.assessment_count === 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-white/60 bg-card-light px-5 py-4 shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Submissions
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {totals.submissions} submission
              {totals.submissions === 1 ? "" : "s"} across {totals.subjects}{" "}
              subject{totals.subjects === 1 ? "" : "s"}
              {scopeLabel && ` — ${scopeLabel}`}
            </p>
          </div>
        </div>
      </div>

      {/* Type tabs */}
      <div className="flex rounded-2xl border border-white/60 bg-card-light p-1 shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        {TYPE_TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setType(t.v)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              type === t.v
                ? "bg-blue-600 text-white shadow-sm"
                : "text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="sticky top-2 z-10 flex flex-col gap-3 rounded-2xl border border-white/60 bg-card-light/95 p-3 shadow-sm backdrop-blur dark:border-border-dark/30 dark:bg-card-dark/50 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
          <input
            type="text"
            placeholder="Search by subject or assessment title…"
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
            <option key={o} value={o}>
              {o === "all"
                ? canViewAll
                  ? "All assessments"
                  : "All statuses"
                : STATUS_LABELS[o] ?? prettyStatus(o)}
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
      ) : subjects.length === 0 || noAssessments ? (
        <div className="rounded-2xl border border-white/60 bg-card-light py-16 text-center shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
          <AlertCircle className="mx-auto h-12 w-12 text-text-secondary-light/50 dark:text-text-secondary-dark/40" />
          <h3 className="mt-3 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {search || status !== "all" || subjectId || type !== "all"
              ? "No assessments match your filters"
              : "No assessments found"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            {search || status !== "all" || subjectId || type !== "all"
              ? "Try clearing the search or filters."
              : canViewAll
                ? "Quizzes and assignments appear here, grouped by subject. Open one to see its submissions."
                : "Assessments you've submitted to appear here, grouped by subject."}
          </p>
        </div>
      ) : (
        <>
          <motion.div layout className="space-y-3">
            {subjects.map((s) => (
              <SubjectSection
                key={s.subject_id}
                subject={s}
                collapsed={!!collapsed[s.subject_id]}
                onToggle={() => toggleSection(s.subject_id)}
                canViewAll={canViewAll}
                typeFilter={type}
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

export default SubmissionsPage;
