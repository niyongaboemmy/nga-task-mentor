import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  HelpCircle,
  Search,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ListChecks,
  Award,
  Users,
  BarChart3,
  Trash2,
  Pencil,
  AlertCircle,
  Globe,
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import {
  QuizGroupedApiService,
  type GroupedQuizSubject,
  type GroupedQuiz,
  type QuizStatus,
} from "../services/quizGroupedApi";
import { QuizApiService } from "../services/quizApi";
import { formatDateTimeLocal } from "../utils/dateUtils";
import { onAcademicPeriodChanged } from "../utils/academicPeriodEvents";

const SUBJECT_HUES = [211, 262, 340, 24, 152, 190, 45, 288];
const hueFor = (id: number) => SUBJECT_HUES[Math.abs(id) % SUBJECT_HUES.length];

const STATUS_META: Record<QuizStatus, { label: string; cls: string }> = {
  draft: {
    label: "Draft",
    cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-800/50",
  },
  published: {
    label: "Published",
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800/50",
  },
  completed: {
    label: "Completed",
    cls: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-800/50",
  },
};

const TYPE_CLS: Record<string, string> = {
  Assessment: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
  Homework: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300",
  Quiz: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  Exam: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
};

const COLLAPSE_KEY = "tm.quizzes.collapsed";
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

/* ── quiz row ────────────────────────────────────────────────────────────── */

function QuizRow({
  q,
  onStatus,
  onDelete,
}: {
  q: GroupedQuiz;
  onStatus: (id: number, s: QuizStatus) => void;
  onDelete: (q: GroupedQuiz) => void;
}) {
  const meta = STATUS_META[q.status] ?? STATUS_META.draft;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="group flex flex-col gap-2 rounded-xl border border-transparent bg-surface-light px-3.5 py-3 transition-colors hover:border-blue-200 dark:bg-surface-dark/40 dark:hover:border-blue-900/50 lg:flex-row lg:items-center"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={`/quizzes/${q.id}`}
            className="truncate text-sm font-semibold text-text-primary-light hover:text-blue-600 dark:text-text-primary-dark dark:hover:text-blue-400"
          >
            {q.title}
          </Link>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_CLS[q.type] ?? TYPE_CLS.Quiz}`}
          >
            {q.type}
          </span>
          {q.is_public && (
            <span title="Public quiz">
              <Globe className="h-3 w-3 text-text-secondary-light dark:text-text-secondary-dark/60" />
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {q.total_questions} q
          </span>
          <span className="flex items-center gap-1">
            <Award className="h-3 w-3" />
            {q.total_points} pts
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {q.graded_count}/{q.submission_count} graded
          </span>
          {q.creator && (
            <span className="hidden sm:inline">
              by {q.creator.first_name} {q.creator.last_name}
              {q.is_own && " · you"}
            </span>
          )}
          {q.created_at && (
            <span className="hidden md:inline">{formatDateTimeLocal(q.created_at)}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {q.can_edit ? (
          <select
            value={q.status}
            onChange={(e) => onStatus(q.id, e.target.value as QuizStatus)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${meta.cls}`}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="completed">Completed</option>
          </select>
        ) : (
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
            {meta.label}
          </span>
        )}

        <Link
          to={`/quizzes/${q.id}/submissions`}
          className="rounded-full border border-border-light px-2.5 py-1 text-xs text-text-secondary-light transition-colors hover:bg-white dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:bg-surface-dark"
          title="Submissions"
        >
          Results
        </Link>
        {q.can_edit && (
          <>
            <Link
              to={`/quizzes/${q.id}/analytics`}
              className="hidden rounded-full border border-border-light p-1.5 text-text-secondary-light transition-colors hover:bg-white dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:bg-surface-dark sm:block"
              title="Analytics"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Link>
            <Link
              to={`/quizzes/${q.id}`}
              className="rounded-full border border-border-light p-1.5 text-text-secondary-light transition-colors hover:bg-white dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:bg-surface-dark"
              title="Manage / edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => onDelete(q)}
              className="rounded-full border border-border-light p-1.5 text-text-secondary-light transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:bg-red-900/20"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── subject section ─────────────────────────────────────────────────────── */

function SubjectSection({
  subject,
  canCreate,
  collapsed,
  onToggle,
  onStatus,
  onDelete,
}: {
  subject: GroupedQuizSubject;
  canCreate: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onStatus: (id: number, s: QuizStatus) => void;
  onDelete: (q: GroupedQuiz) => void;
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
            {subject.quiz_count} {subject.quiz_count === 1 ? "quiz" : "quizzes"}
            {subject.draft_count > 0 && ` · ${subject.draft_count} draft`}
          </span>
        </div>
        {canCreate && (
          <Link
            to={`/courses/${subject.subject_id}/quizzes/create`}
            onClick={(e) => e.stopPropagation()}
            className="hidden shrink-0 items-center gap-1 rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/20 sm:flex"
          >
            <Plus className="h-3 w-3" />
            New quiz
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
              {subject.quizzes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                    No quizzes in this subject yet.
                  </p>
                  {canCreate && (
                    <Link
                      to={`/courses/${subject.subject_id}/quizzes/create`}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <Plus className="h-3 w-3" />
                      Create quiz
                    </Link>
                  )}
                </div>
              ) : (
                <AnimatePresence>
                  {subject.quizzes.map((q) => (
                    <QuizRow
                      key={q.id}
                      q={q}
                      onStatus={onStatus}
                      onDelete={onDelete}
                    />
                  ))}
                </AnimatePresence>
              )}
              {subject.has_more && (
                <Link
                  to={`/courses/${subject.subject_id}/quizzes`}
                  className="block px-2 pt-1 text-center text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  View all {subject.quiz_count} in course →
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

const QuizzesPage: React.FC = () => {
  usePermissions();

  const [subjects, setSubjects] = useState<GroupedQuizSubject[]>([]);
  const [allSubjects, setAllSubjects] = useState<
    { id: number; name: string; code: string | null }[]
  >([]);
  const [totals, setTotals] = useState({ subjects: 0, quizzes: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [canCreate, setCanCreate] = useState(false);
  const [scope, setScope] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const fetchData = useCallback(
    async (opts?: { refresh?: boolean }) => {
      opts?.refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const data = await QuizGroupedApiService.getGrouped({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          status,
          type,
          subjectId,
        });
        setSubjects(data.subjects);
        setAllSubjects(data.all_subjects);
        setTotals(data.totals);
        setTotalPages(data.pagination.total_pages);
        setCanCreate(data.can_create);
        setScope(data.scope);
      } catch (e: any) {
        console.error(e);
        setError(e?.response?.data?.message ?? "Could not load quizzes.");
        setSubjects([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch, status, type, subjectId],
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
  }, [debouncedSearch, status, type, subjectId]);

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

  const patchLocal = (id: number, patch: Partial<GroupedQuiz>) =>
    setSubjects((prev) =>
      prev.map((s) => ({
        ...s,
        quizzes: s.quizzes.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      })),
    );

  const handleStatus = async (id: number, newStatus: QuizStatus) => {
    patchLocal(id, { status: newStatus });
    try {
      await QuizApiService.updateQuiz(id, { status: newStatus } as any);
    } catch {
      toast.error("Failed to update status");
      fetchData({ refresh: true });
    }
  };

  const handleDelete = async (q: GroupedQuiz) => {
    if (!window.confirm(`Delete "${q.title}"? This removes all its questions and submissions.`))
      return;
    try {
      await QuizApiService.deleteQuiz(q.id);
      toast.success("Quiz deleted");
      setSubjects((prev) =>
        prev.map((s) => ({
          ...s,
          quizzes: s.quizzes.filter((x) => x.id !== q.id),
          quiz_count: s.quizzes.some((x) => x.id === q.id)
            ? s.quiz_count - 1
            : s.quiz_count,
        })),
      );
    } catch {
      toast.error("Failed to delete quiz");
    }
  };

  const scopeLabel =
    scope === "all"
      ? "all subjects"
      : scope === "assigned"
        ? "your assigned subjects"
        : scope === "enrolled"
          ? "your enrolled subjects"
          : "";

  const noQuizzes = subjects.every((s) => s.quizzes.length === 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-white/60 bg-card-light px-5 py-4 shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                Quizzes
              </h1>
              <p className="mt-0.5 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {totals.quizzes} quiz{totals.quizzes === 1 ? "" : "zes"} across{" "}
                {totals.subjects} subject{totals.subjects === 1 ? "" : "s"}
                {scopeLabel && ` — ${scopeLabel}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-2 z-10 flex flex-col gap-3 rounded-2xl border border-white/60 bg-card-light/95 p-3 shadow-sm backdrop-blur dark:border-border-dark/30 dark:bg-card-dark/50 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
          <input
            type="text"
            placeholder="Search by subject, title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-transparent bg-surface-light py-2.5 pl-9 pr-4 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark"
          />
        </div>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}
          className="rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark lg:w-52"
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
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark lg:w-36"
        >
          <option value="all">All types</option>
          <option value="Quiz">Quiz</option>
          <option value="Assessment">Assessment</option>
          <option value="Homework">Homework</option>
          <option value="Exam">Exam</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-transparent bg-surface-light px-3 py-2.5 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-dark/50 dark:text-text-primary-dark lg:w-36"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
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

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-white/60 bg-card-light dark:border-border-dark/30 dark:bg-card-dark/30"
            />
          ))}
        </div>
      ) : subjects.length === 0 || noQuizzes ? (
        <div className="rounded-2xl border border-white/60 bg-card-light py-16 text-center shadow-sm dark:border-border-dark/30 dark:bg-card-dark/30">
          <AlertCircle className="mx-auto h-12 w-12 text-text-secondary-light/50 dark:text-text-secondary-dark/40" />
          <h3 className="mt-3 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {search || status !== "all" || type !== "all" || subjectId
              ? "No quizzes match your filters"
              : scope === "assigned"
                ? subjects.length === 0
                  ? "You have no assigned subjects this term"
                  : "No quizzes in your subjects yet"
                : "No quizzes yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            {search || status !== "all" || type !== "all" || subjectId
              ? "Try clearing the search or filters."
              : "Quizzes appear here, grouped by subject, for the selected academic term."}
          </p>
          {canCreate && subjects.length > 0 && !search && (
            <Link
              to={`/courses/${subjects[0].subject_id}/quizzes/create`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create a quiz
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
                canCreate={canCreate}
                collapsed={!!collapsed[s.subject_id]}
                onToggle={() => toggleSection(s.subject_id)}
                onStatus={handleStatus}
                onDelete={handleDelete}
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

export default QuizzesPage;
