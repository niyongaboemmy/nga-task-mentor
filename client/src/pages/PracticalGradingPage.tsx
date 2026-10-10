import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UserAvatar from "../components/ui/UserAvatar";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  ExternalLink,
  Eye,
  FileText,
  Keyboard,
  Loader2,
  MessageSquarePlus,
  Monitor,
  MonitorUp,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  Tablet,
  Undo2,
  X,
} from "lucide-react";
import {
  practicalsApi,
  type CriterionScore,
  type GradingRoster,
  type GradingRow,
  type PracticalActivity,
  type PracticalCriterion,
} from "../services/practicalsApi";
import { apiErrorCode, apiErrorMessage, projectsApi, type RevisionSummary } from "../services/projectsApi";
import FilesTab from "../components/Projects/FilesTab";
import ReturnForChangesDialog from "../components/Projects/ReturnForChangesDialog";
import { TmcodeDeepLinkButton } from "../components/Projects/OpenProjectInTmcode";
import Select from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { formatDateTime, timeAgo } from "../components/Projects/projectFormat";

/**
 * Grading workspace for TMCode practicals (an assignment, or a quiz's
 * practical question), shown full screen over the app: the student switcher
 * in the top bar, the submitted project (code, live preview, details) using
 * all the room it can, and the criteria scorer beside it. The frame is fixed;
 * only the panes scroll. Unsaved scores are kept as a per-student draft.
 */

type Filter = "to_grade" | "graded" | "all";
type Pane = "code" | "preview" | "details";

const STATE_META: Record<GradingRow["state"], { label: string; dot: string; pill: string }> = {
  submitted: {
    label: "To grade",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  graded: {
    label: "Graded",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  in_progress: {
    label: "Working",
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  },
  not_started: {
    label: "Not started",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400",
  },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

// ─── Small local stores (per browser) ───────────────────────────────────────

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked: drafts are a convenience
    }
  },
};

interface Draft {
  scores: { score: string; comment: string }[];
  overall: string;
  feedback: string;
  at: string;
}
const draftKey = (type: string, id: number, questionId: number | null | undefined, studentId: number | null | undefined) =>
  `tm.grading.draft.${type}.${id}.${questionId ?? 0}.${studentId ?? 0}`;

/** Projects the teacher opened in TMCode from here: projectId → when, which revision. */
const OPENED_KEY = "tm.grading.openedInTmcode";
type OpenedMap = Record<string, { at: string; revision: number | null; student: string }>;

const SNIPPETS_KEY = "tm.grading.snippets";
const DEFAULT_SNIPPETS = [
  "Well structured and easy to follow.",
  "Check the layout on small screens.",
  "Use more meaningful names.",
  "Remove unused code and comments.",
  "Great attention to detail!",
];

// ─── Scores ─────────────────────────────────────────────────────────────────

/**
 * The saved scores and notes per criterion. The server sends
 * { index, score, comment }; older servers sent an index→score map for
 * assignments, with the notes only in the feedback's "Criteria notes" block,
 * so missing comments are read back from there (else Save would wipe them).
 */
function scoresOf(row: GradingRow | null, rubric: { criteria: string }[]): { score: string; comment: string }[] {
  const raw = row?.grade?.rubric_scores as unknown;
  const out = Array.from({ length: rubric.length }, () => ({ score: "", comment: "" }));
  if (Array.isArray(raw)) {
    for (const s of raw as CriterionScore[]) {
      if (out[s.index]) out[s.index] = { score: s.score == null ? "" : String(s.score), comment: s.comment ?? "" };
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const i = Number(k);
      if (out[i] && v != null) out[i] = { score: String(v), comment: "" };
    }
  }
  const notes = criteriaNotes(row?.grade?.feedback, rubric);
  return out.map((s, i) => (s.comment ? s : { ...s, comment: notes.get(i) ?? "" }));
}

/** Strip the "Criteria notes" block the server composes into the feedback. */
const overallFeedback = (f: string | null | undefined) => String(f ?? "").split(/\n*Criteria notes:\n/)[0] ?? "";

/** The notes in that block ("• <criterion>: <note>", a note may span lines), by criterion index. */
function criteriaNotes(feedback: string | null | undefined, rubric: { criteria: string }[]): Map<number, string> {
  const out = new Map<number, string>();
  const text = String(feedback ?? "");
  const m = /\n*Criteria notes:\n/.exec(text);
  if (!m) return out;
  const prefixes = rubric
    .map((c, index) => ({ index, prefix: `• ${c.criteria}: ` }))
    .sort((x, y) => y.prefix.length - x.prefix.length);
  let current: number | null = null;
  for (const line of text.slice(m.index + m[0].length).split("\n")) {
    const hit = prefixes.find((p) => line.startsWith(p.prefix));
    if (hit && !out.has(hit.index)) {
      current = hit.index;
      out.set(current, line.slice(hit.prefix.length));
    } else if (current != null) {
      out.set(current, `${out.get(current)}\n${line}`);
    }
  }
  for (const [k, v] of out) out.set(k, v.trim());
  return out;
}

/** Quick score buttons: every value for a small whole-number maximum, else quarters. */
function quickScores(max: number): { label: string; value: number }[] {
  if (Number.isInteger(max) && max > 0 && max <= 6) {
    return Array.from({ length: max + 1 }, (_, v) => ({ label: String(v), value: v }));
  }
  const q = (f: number) => Math.round(max * f * 2) / 2;
  return [
    { label: "0", value: 0 },
    { label: "¼", value: q(0.25) },
    { label: "½", value: q(0.5) },
    { label: "¾", value: q(0.75) },
    { label: "Full", value: max },
  ];
}

// ─── Page ───────────────────────────────────────────────────────────────────

const PracticalGradingPage: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const type = (params.type === "quiz" ? "quiz" : "assignment") as PracticalActivity;
  const activityId = Number(params.id);
  const [search, setSearch] = useSearchParams();
  const questionParam = search.get("question") ? Number(search.get("question")) : null;
  const studentParam = search.get("student") ? Number(search.get("student")) : null;

  const [roster, setRoster] = useState<GradingRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileView, setMobileView] = useState<"project" | "grade">("project");
  const [showKeys, setShowKeys] = useState(false);
  const [opened, setOpened] = useState<OpenedMap>(() => store.get<OpenedMap>(OPENED_KEY, {}));

  const backHref = type === "quiz" ? `/quizzes/${activityId}/submissions` : `/assignments/${activityId}`;
  const close = useCallback(() => navigate(backHref), [navigate, backHref]);

  const load = useCallback(async () => {
    try {
      const r = await practicalsApi.roster(type, activityId, questionParam);
      setRoster(r);
      setError(null);
      return r;
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load the grading roster."));
      return null;
    }
  }, [type, activityId, questionParam]);

  useEffect(() => {
    setRoster(null);
    load();
  }, [load]);

  // Full screen: the page behind doesn't scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const rows = useMemo(() => roster?.rows ?? [], [roster]);
  const filtered = useMemo(
    () =>
      rows.filter((r) => (filter === "to_grade" ? r.state === "submitted" : filter === "graded" ? r.state === "graded" : true)),
    [rows, filter],
  );
  const current = useMemo(
    () => rows.find((r) => r.student?.id === studentParam) ?? rows.find((r) => r.state === "submitted") ?? rows[0] ?? null,
    [rows, studentParam],
  );
  // Prev/next walk the filtered list (or everyone when the current student isn't in it).
  const nav = filtered.some((r) => r === current) ? filtered : rows;
  const navIndex = current ? nav.indexOf(current) : -1;
  const prevRow = navIndex > 0 ? nav[navIndex - 1]! : null;
  const nextRow = navIndex >= 0 && navIndex < nav.length - 1 ? nav[navIndex + 1]! : null;
  // "Save & next" goes to the next student still waiting to be graded.
  const nextToGrade = useMemo(() => {
    if (!current) return null;
    const i = rows.indexOf(current);
    return [...rows.slice(i + 1), ...rows.slice(0, i)].find((r) => r.state === "submitted") ?? null;
  }, [rows, current]);

  const select = useCallback(
    (studentId: number | null | undefined) => {
      if (!studentId) return;
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("student", String(studentId));
          return next;
        },
        { replace: true },
      );
    },
    [setSearch],
  );

  const markOpened = useCallback((row: GradingRow) => {
    if (!row.project) return;
    setOpened((prev) => {
      const next = {
        ...prev,
        [row.project!.id]: { at: new Date().toISOString(), revision: row.link?.revision_number ?? null, student: row.student?.name ?? "" },
      };
      store.set(OPENED_KEY, next);
      return next;
    });
  }, []);

  // Alt+↑/↓ or J/K switch students, [ toggles the grading panel, ? shows the keys, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const go = (r: GradingRow | null) => {
        if (!r) return;
        e.preventDefault();
        select(r.student?.id);
      };
      if (e.altKey && e.key === "ArrowUp") return go(prevRow);
      if (e.altKey && e.key === "ArrowDown") return go(nextRow);
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "k") return go(prevRow);
      if (e.key === "j") return go(nextRow);
      if (e.key === "[") setPanelOpen((o) => !o);
      if (e.key === "?") setShowKeys((o) => !o);
      // Esc closes the workspace, unless a modal (ui/Modal, z-[99999]) is open over it.
      if (e.key === "Escape" && !document.querySelector('[class*="z-[99999]"]')) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevRow, nextRow, select, close]);

  const a = roster?.activity;
  const [releasing, setReleasing] = useState(false);
  const releaseAll = useCallback(async () => {
    if (!a) return;
    setReleasing(true);
    try {
      const r = await practicalsApi.releaseDrafts(type, activityId, a.question?.id ?? null);
      toast.success(
        `Released ${r.released} grade${r.released === 1 ? "" : "s"}: students can see ${r.released === 1 ? "it" : "them"} now.` +
          (r.skipped.length ? ` ${r.skipped.length} changed meanwhile and were left as drafts.` : ""),
      );
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't release the drafts."));
    } finally {
      setReleasing(false);
    }
  }, [a, type, activityId, load]);
  const pct = roster && roster.counts.total ? Math.round((roster.counts.graded / roster.counts.total) * 100) : 0;
  const hasDraft = useCallback(
    (r: GradingRow) => !!a && !!store.get<Draft | null>(draftKey(type, activityId, a.question?.id, r.student?.id), null),
    [a, type, activityId],
  );

  const shell = (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-slate-50 text-text-primary-light dark:bg-slate-950 dark:text-text-primary-dark"
      role="dialog"
      aria-modal="true"
      aria-label="Grading workspace"
      data-testid="practical-grading"
    >
      {/* Top bar */}
      <header className="relative flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 py-2 dark:border-white/10 dark:bg-slate-900 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={close}
          aria-label="Close the grading workspace"
          title="Close (Esc)"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="hidden min-w-0 max-w-[30%] md:block">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {type === "quiz" ? "Quiz practical" : "Assignment practical"} · grading
          </p>
          <h1 className="truncate text-sm font-semibold" title={a?.title}>
            {a ? a.title : <Skeleton className="h-4 w-48" />}
          </h1>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => select(prevRow?.student?.id)}
            disabled={!prevRow}
            aria-label="Previous student"
            title="Previous student (K or Alt+↑)"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <StudentSwitcher
            rows={rows}
            filtered={filtered}
            filter={filter}
            onFilter={setFilter}
            counts={roster?.counts ?? null}
            current={current}
            maxPoints={a?.max_points ?? 0}
            position={navIndex >= 0 ? `${navIndex + 1} of ${nav.length}` : null}
            onSelect={select}
            opened={opened}
            hasDraft={hasDraft}
          />
          <button
            type="button"
            onClick={() => select(nextRow?.student?.id)}
            disabled={!nextRow}
            aria-label="Next student"
            title="Next student (J or Alt+↓)"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {a?.questions && a.questions.length > 1 && (
          <div className="hidden w-56 xl:block">
            <Select
              size="sm"
              aria-label="Practical question"
              value={String(a.question?.id ?? "")}
              onChange={(e) => setSearch(new URLSearchParams({ question: e.target.value }), { replace: true })}
            >
              {a.questions.map((q, i) => (
                <option key={q.question_id} value={q.question_id}>
                  Q{i + 1}. {q.title} ({q.points} pts)
                </option>
              ))}
            </Select>
          </div>
        )}

        {roster && (
          <div className="hidden items-center gap-2.5 lg:flex" aria-label="Grading progress">
            <div className="text-right text-[11px] leading-tight">
              <p className="font-semibold">
                {roster.counts.graded}/{roster.counts.total} graded
              </p>
              <p className="text-slate-500">{roster.counts.to_grade} waiting</p>
            </div>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        {roster && a?.can_grade && (roster.counts.drafts ?? 0) > 0 && (
          <button
            type="button"
            onClick={releaseAll}
            disabled={releasing}
            data-testid="release-drafts"
            title="Students see a grade only once it is released"
            className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:inline-flex"
          >
            {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Release {roster.counts.drafts} draft{roster.counts.drafts === 1 ? "" : "s"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowKeys((o) => !o)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 sm:inline-flex"
        >
          <Keyboard className="h-4 w-4" />
        </button>
        {showKeys && <ShortcutsCard onClose={() => setShowKeys(false)} />}
      </header>

      {/* Phones and tablets: one pane at a time */}
      <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900 lg:hidden" role="tablist" aria-label="Workspace view">
        {(
          [
            ["project", "Project", Code2],
            ["grade", "Grade", CheckCircle2],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mobileView === k}
            onClick={() => setMobileView(k)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
              mobileView === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {error && !roster ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="text-sm text-rose-600">{error}</p>
          <Link to={backHref} className="text-sm font-semibold text-blue-600 hover:underline">
            Back
          </Link>
        </div>
      ) : roster && current ? (
        <StudentWorkspace
          key={`${a!.question?.id ?? 0}-${current.student?.id}`}
          type={type}
          activityId={activityId}
          roster={roster}
          row={current}
          nextRow={nextToGrade ?? nextRow}
          onSelect={select}
          onSaved={load}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((o) => !o)}
          mobileView={mobileView}
          opened={current.project ? opened[current.project.id] ?? null : null}
          onOpenedInTmcode={() => markOpened(current)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
          {roster ? "No students to grade yet." : <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
        </div>
      )}
    </div>
  );

  return createPortal(shell, document.body);
};

// ─── Student switcher ───────────────────────────────────────────────────────

const StudentSwitcher: React.FC<{
  rows: GradingRow[];
  filtered: GradingRow[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  counts: GradingRoster["counts"] | null;
  current: GradingRow | null;
  maxPoints: number;
  position: string | null;
  onSelect: (id: number | null | undefined) => void;
  opened: OpenedMap;
  hasDraft: (r: GradingRow) => boolean;
}> = ({ rows, filtered, filter, onFilter, counts, current, maxPoints, position, onSelect, opened, hasDraft }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const list = filtered.filter((r) => !q || (r.student?.name ?? "").toLowerCase().includes(q));
  const meta = current ? STATE_META[current.state] : null;

  return (
    <div ref={ref} className="relative min-w-0 max-w-md flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="student-switcher"
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 text-left transition hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-slate-800 dark:hover:border-blue-500/50"
      >
        {current ? (
          <>
            <UserAvatar decorative src={current.student?.avatar_url} userId={current.student?.id} name={current.student?.name ?? "?"} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold" data-testid="current-student">
                {current.student?.name ?? "Unknown student"}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${meta!.dot}`} aria-hidden="true" />
                {meta!.label}
                {current.late && <span className="font-semibold text-rose-600">· Late</span>}
                {position && <span className="hidden sm:inline">· {position}</span>}
              </span>
            </span>
            {current.grade?.score != null && (
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {round2(current.grade.score)}
                <span className="text-xs font-medium text-slate-400">/{maxPoints}</span>
              </span>
            )}
          </>
        ) : (
          <span className="flex-1 text-sm text-slate-500">Choose a student</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-2 w-[min(26rem,calc(100vw-1rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
          <div className="space-y-2 border-b border-slate-100 p-2.5 dark:border-white/5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a student"
                aria-label="Find a student"
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800"
              />
            </label>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-white/5" role="tablist" aria-label="Filter students">
              {(
                [
                  ["all", `All ${rows.length}`],
                  ["to_grade", `To grade ${counts?.to_grade ?? 0}`],
                  ["graded", `Graded ${counts?.graded ?? 0}`],
                ] as [Filter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={filter === k}
                  onClick={() => onFilter(k)}
                  className={`flex-1 rounded-lg px-2 py-1.5 transition ${
                    filter === k ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="max-h-[min(60vh,28rem)] overflow-y-auto p-1.5" role="listbox" aria-label="Students">
            {list.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-slate-500">No students here.</li>
            ) : (
              list.map((r) => {
                const sel = r === current;
                const m = STATE_META[r.state];
                const was = r.project ? opened[r.project.id] : null;
                return (
                  <li key={r.student?.id ?? r.project?.id} role="option" aria-selected={sel}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(r.student?.id);
                        setOpen(false);
                      }}
                      data-testid="roster-row"
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                        sel ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30" : "hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <UserAvatar decorative src={r.student?.avatar_url} userId={r.student?.id} name={r.student?.name ?? "?"} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.student?.name ?? "Unknown student"}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${m.pill}`}>{m.label}</span>
                          {r.late && <span className="text-[10px] font-semibold text-rose-600">Late</span>}
                          {hasDraft(r) && <span className="text-[10px] font-semibold text-blue-600">Draft</span>}
                          {was && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500" title={`Opened in TMCode ${timeAgo(was.at)}`}>
                              <MonitorUp className="h-3 w-3" aria-hidden="true" /> TMCode
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm font-bold tabular-nums" data-testid="roster-score">
                        {r.grade?.score != null ? (
                          <>
                            {round2(r.grade.score)}
                            <span className="text-xs font-medium text-slate-400">/{maxPoints}</span>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">—/{maxPoints}</span>
                        )}
                      </span>
                      {sel && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const ShortcutsCard: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="absolute right-3 top-full z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-2xl dark:border-white/10 dark:bg-slate-900" role="note">
    <div className="mb-2 flex items-center justify-between">
      <p className="font-semibold">Keyboard shortcuts</p>
      <button type="button" onClick={onClose} aria-label="Close shortcuts" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
        <X className="h-4 w-4" />
      </button>
    </div>
    <dl className="space-y-1.5 text-xs">
      {[
        ["J / K", "Next / previous student"],
        ["Alt + ↓ / ↑", "Same, while typing"],
        ["Ctrl/⌘ + Enter", "Save, then the next to grade"],
        ["Ctrl/⌘ + S", "Save"],
        ["[", "Show / hide the grading panel"],
        ["Esc", "Close the workspace"],
      ].map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <dt>
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] dark:border-white/10 dark:bg-white/5">{k}</kbd>
          </dt>
          <dd className="text-right text-slate-500">{v}</dd>
        </div>
      ))}
    </dl>
  </div>
);

// ─── One student's submission ───────────────────────────────────────────────

const StudentWorkspace: React.FC<{
  type: PracticalActivity;
  activityId: number;
  roster: GradingRoster;
  row: GradingRow;
  nextRow: GradingRow | null;
  onSelect: (studentId: number | null | undefined) => void;
  onSaved: () => Promise<unknown>;
  panelOpen: boolean;
  onTogglePanel: () => void;
  mobileView: "project" | "grade";
  opened: OpenedMap[string] | null;
  onOpenedInTmcode: () => void;
}> = ({ type, activityId, roster, row, nextRow, onSelect, onSaved, panelOpen, onTogglePanel, mobileView, opened, onOpenedInTmcode }) => {
  const a = roster.activity;
  const [pane, setPane] = useState<Pane>("code");
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [revisionId, setRevisionId] = useState<number | null>(row.link?.revision_id ?? null);
  const [returnOpen, setReturnOpen] = useState(false);

  const projectId = row.project?.id ?? null;
  const gradable = !!row.link && (row.state === "submitted" || row.state === "graded");
  const name = row.student?.name ?? "Student";

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    projectsApi
      .revisions(projectId)
      .then((r) => !cancelled && setRevisions(r))
      .catch(() => !cancelled && setRevisions([]));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const tabCls = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
      on ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
    }`;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Project */}
      <section className={`min-h-0 min-w-0 flex-1 flex-col ${mobileView === "project" ? "flex" : "hidden"} lg:flex`} aria-label={`${name}'s project`}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="tablist" aria-label="View">
            {(
              [
                ["code", "Code", Code2],
                ["preview", "Preview", Eye],
                ["details", "Details", FileText],
              ] as [Pane, string, React.ElementType][]
            ).map(([k, label, Icon]) => (
              <button key={k} type="button" role="tab" aria-selected={pane === k} onClick={() => setPane(k)} disabled={!projectId} className={tabCls(pane === k)}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <p className="hidden min-w-0 flex-1 truncate text-xs text-slate-500 md:block">
            <span className="font-medium text-slate-700 dark:text-slate-300">{row.project ? row.project.name : "No project yet"}</span>
            {row.link?.revision_number ? ` · submitted revision #${row.link.revision_number}` : ""}
            {row.submitted_at ? ` · ${formatDateTime(row.submitted_at)}` : ""}
            {row.late && <span className="font-semibold text-rose-600"> · Late</span>}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {projectId && (
              <>
                {opened && (
                  <span
                    className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 sm:inline-flex"
                    data-testid="opened-in-tmcode"
                    title={`You opened ${opened.student || name}'s project in TMCode`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    Opened in TMCode {timeAgo(opened.at)}
                    {opened.revision ? ` · rev #${opened.revision}` : ""}
                  </span>
                )}
                <TmcodeDeepLinkButton
                  // Lands in TMCode's grading view on this student (G9), not an editable copy.
                  getLink={() => practicalsApi.gradingLink(type, activityId, { questionId: a.question?.id ?? null, studentId: row.student?.id ?? null })}
                  label="Open in TMCode"
                  trackKey="tm.grading.open_in_tmcode"
                  testId="grading-open-tmcode"
                  onOpened={onOpenedInTmcode}
                  buttonClassName="!px-3 !py-1.5 !text-xs !rounded-lg"
                />
              </>
            )}
            <button
              type="button"
              onClick={onTogglePanel}
              aria-label={panelOpen ? "Hide the grading panel" : "Show the grading panel"}
              title={panelOpen ? "Hide grading ([)" : "Show grading ([)"}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 lg:inline-flex"
            >
              {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
          {!projectId ? (
            <EmptyState text={`${name} hasn't started a project for this practical yet.`} />
          ) : pane === "code" ? (
            <FilesTab projectId={projectId} revisions={revisions} revisionId={revisionId} onRevisionChange={setRevisionId} fill />
          ) : pane === "preview" ? (
            <PreviewPane projectId={projectId} revisionId={revisionId} />
          ) : (
            <div className="h-full overflow-y-auto">
              <DetailsPane row={row} />
            </div>
          )}
        </div>
      </section>

      {/* Grading */}
      <aside
        className={`min-h-0 w-full shrink-0 flex-col border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 lg:w-[400px] lg:border-l xl:w-[440px] ${
          mobileView === "grade" ? "flex" : "hidden"
        } ${panelOpen ? "lg:flex" : "lg:hidden"}`}
        aria-label="Grading"
      >
        <CriteriaScorer
          key={`${row.student?.id}-${row.grade?.graded_at ?? ""}`}
          type={type}
          activityId={activityId}
          roster={roster}
          row={row}
          gradable={gradable && a.can_grade}
          nextRow={nextRow}
          onSelect={onSelect}
          onSaved={onSaved}
          onReturn={() => setReturnOpen(true)}
        />
      </aside>

      {!panelOpen && (
        <button
          type="button"
          onClick={onTogglePanel}
          className="fixed bottom-5 right-5 z-[101] hidden items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl hover:bg-blue-700 lg:inline-flex"
        >
          <PanelRightOpen className="h-4 w-4" /> Grade
        </button>
      )}

      <ReturnForChangesDialog
        open={returnOpen}
        projectId={projectId}
        studentName={name}
        allowResubmission={row.state === "graded"}
        onClose={() => setReturnOpen(false)}
        onReturned={() => void onSaved()}
      />
    </div>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10">
    {text}
  </div>
);

const DEVICES = [
  { key: "desktop", label: "Desktop", width: "100%", Icon: Monitor },
  { key: "tablet", label: "Tablet", width: "768px", Icon: Tablet },
  { key: "mobile", label: "Phone", width: "390px", Icon: Smartphone },
] as const;

/** Runs the submitted site in a sandboxed iframe (scripts on, no same-origin). */
const PreviewPane: React.FC<{ projectId: number; revisionId: number | null }> = ({ projectId, revisionId }) => {
  const [state, setState] = useState<{ url: string; entry: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [nonce, setNonce] = useState(0);
  const [needsBuild, setNeedsBuild] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setError(null);
    practicalsApi
      .preview(projectId, revisionId)
      .then((r) => !cancelled && setState(r))
      .catch(
        (e) =>
          !cancelled &&
          setError(
            apiErrorCode(e) === "NO_HTML"
              ? "This project has no HTML page to preview. Read the code, or open it in TMCode to run it."
              : apiErrorMessage(e, "Couldn't start the preview."),
          ),
      );
    // A package.json project (React, Vite…) needs a build step the static preview can't do.
    projectsApi
      .manifest(projectId, revisionId ?? "head")
      .then((m) => !cancelled && setNeedsBuild(m.files.some((f) => f.path === "package.json")))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, revisionId, nonce]);

  if (error) return <EmptyState text={error} />;
  const width = DEVICES.find((d) => d.key === device)!.width;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-500 dark:bg-white/5">
          {state ? state.entry : "Starting preview…"}
        </span>
        <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-white/5" role="group" aria-label="Device size">
          {DEVICES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-pressed={device === key}
              aria-label={label}
              title={label}
              className={`rounded-md p-1.5 ${device === key ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setNonce((n) => n + 1)} aria-label="Reload preview" title="Reload" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        {state && (
          <a href={state.url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab" title="Open in a new tab" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {needsBuild && (
        <p className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" data-testid="preview-needs-build">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            This project has a package.json (React, Vite…), so it needs a build step and this preview may be blank. Use <strong>Open in TMCode</strong> to run it.
          </span>
        </p>
      )}
      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-slate-100 dark:bg-slate-950">
        {state ? (
          <iframe
            key={`${state.url}-${nonce}`}
            title="Project preview"
            src={state.url}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            className="h-full bg-white shadow-sm transition-[width] duration-300"
            style={{ width, maxWidth: "100%" }}
            data-testid="practical-preview"
          />
        ) : (
          <Loader2 className="m-auto h-5 w-5 animate-spin text-blue-600" />
        )}
      </div>
    </div>
  );
};

const DetailsPane: React.FC<{ row: GradingRow }> = ({ row }) => {
  const items: [string, React.ReactNode][] = [
    ["Student", row.student?.name ?? "—"],
    ["Status", STATE_META[row.state].label],
    ["Submitted", row.submitted_at ? formatDateTime(row.submitted_at) : "Not yet"],
    ["On time", row.submitted_at ? (row.late ? <span className="font-semibold text-rose-600">Late</span> : "Yes") : "—"],
    ["Revision", row.link?.revision_number ? `#${row.link.revision_number}` : "—"],
    ["Git commit", row.link?.git_commit ? <code className="text-xs">{row.link.git_commit.slice(0, 10)}</code> : "—"],
    ["Language", row.project?.language ?? "—"],
    ["Project status", row.project?.status ?? "—"],
    ["Last graded", row.grade?.graded_at ? formatDateTime(row.grade.graded_at) : "—"],
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-1">
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-1 text-sm">{v}</dd>
          </div>
        ))}
      </dl>
      {row.project && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/projects/${row.project.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-white/5"
          >
            <ExternalLink className="h-4 w-4" /> Open the project page
          </Link>
          {row.project.repo_url && (
            <a
              href={row.project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-white/5"
            >
              <ExternalLink className="h-4 w-4" /> Repository
            </a>
          )}
        </div>
      )}
      {row.grade?.feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Feedback sent</p>
          <p className="whitespace-pre-wrap">{row.grade.feedback}</p>
        </div>
      )}
    </div>
  );
};

// ─── Criteria scoring ───────────────────────────────────────────────────────

const ScoreRing: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = pct >= 70 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-rose-500";
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden="true">
      <circle cx="28" cy="28" r={r} className="fill-none stroke-slate-200 dark:stroke-white/10" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        className={`fill-none stroke-current transition-all duration-500 ${tone}`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
      />
    </svg>
  );
};

const CriterionCard: React.FC<{
  c: PracticalCriterion;
  index: number;
  value: { score: string; comment: string };
  disabled: boolean;
  onScore: (v: string) => void;
  onComment: (v: string) => void;
}> = ({ c, index, value, disabled, onScore, onComment }) => {
  const [showMore, setShowMore] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!value.comment);
  const val = value.score === "" ? null : Number(value.score);
  const over = val != null && (val > c.max_score || val < 0);
  const long = (c.description ?? "").length > 110;

  return (
    <fieldset
      disabled={disabled}
      className={`rounded-2xl border p-3 transition ${
        over
          ? "border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-500/5"
          : val != null
            ? "border-blue-200 bg-blue-50/40 dark:border-blue-500/30 dark:bg-blue-500/5"
            : "border-slate-200 dark:border-white/10"
      }`}
      data-testid="criterion"
    >
      <legend className="sr-only">{c.criteria}</legend>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            val != null && !over ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
          }`}
          aria-hidden="true"
        >
          {val != null && !over ? <Check className="h-3.5 w-3.5" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{c.criteria}</p>
          {c.description && (
            <p className={`mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 ${showMore ? "" : "line-clamp-2"}`}>{c.description}</p>
          )}
          {long && (
            <button type="button" onClick={() => setShowMore((s) => !s)} className="mt-0.5 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
              {showMore ? "Less" : "More"}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={c.max_score}
            step="0.5"
            value={value.score}
            onChange={(e) => onScore(e.target.value)}
            aria-label={`${c.criteria} score out of ${c.max_score}`}
            aria-invalid={over || undefined}
            placeholder="–"
            className="h-9 w-14 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs text-slate-500">/ {c.max_score}</span>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1 pl-9">
        {quickScores(c.max_score).map(({ label, value: v }) => (
          <button
            key={label}
            type="button"
            onClick={() => onScore(String(v))}
            aria-pressed={val === v}
            title={v === c.max_score ? "Full marks" : `${v} of ${c.max_score}`}
            className={`h-7 min-w-[2rem] rounded-lg px-2 text-xs font-semibold transition ${
              val === v ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setNoteOpen((o) => !o)}
          aria-label={`Comment on ${c.criteria}`}
          aria-expanded={noteOpen}
          className={`ml-auto inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold ${
            value.comment ? "text-blue-600 dark:text-blue-400" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
          }`}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{value.comment ? "Note" : "Add note"}</span>
        </button>
      </div>
      {noteOpen && (
        <textarea
          value={value.comment}
          onChange={(e) => onComment(e.target.value)}
          rows={2}
          placeholder={`A note on ${c.criteria.toLowerCase()}…`}
          aria-label={`Note on ${c.criteria}`}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800"
        />
      )}
    </fieldset>
  );
};

const CriteriaScorer: React.FC<{
  type: PracticalActivity;
  activityId: number;
  roster: GradingRoster;
  row: GradingRow;
  gradable: boolean;
  nextRow: GradingRow | null;
  onSelect: (studentId: number | null | undefined) => void;
  onSaved: () => Promise<unknown>;
  onReturn: () => void;
}> = ({ type, activityId, roster, row, gradable, nextRow, onSelect, onSaved, onReturn }) => {
  const a = roster.activity;
  const rubric = a.rubric;
  const hasRubric = rubric.length > 0;
  const key = draftKey(type, activityId, a.question?.id, row.student?.id);

  // A draft newer than the saved grade wins.
  const [initial] = useState(() => {
    const draft = store.get<Draft | null>(key, null);
    const savedAt = row.grade?.graded_at ? Date.parse(row.grade.graded_at) : 0;
    if (draft && Date.parse(draft.at) > savedAt && draft.scores.length === rubric.length) return { ...draft, restored: true };
    return {
      scores: scoresOf(row, rubric),
      overall: !hasRubric && row.grade?.score != null ? String(row.grade.score) : "",
      feedback: overallFeedback(row.grade?.feedback),
      restored: false,
    };
  });

  const [scores, setScores] = useState(initial.scores);
  const [overall, setOverall] = useState<string>(initial.overall);
  const [feedback, setFeedback] = useState(initial.feedback);
  const [restored, setRestored] = useState(initial.restored);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(initial.restored);
  const [error, setError] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<string[]>(() => store.get<string[]>(SNIPPETS_KEY, DEFAULT_SNIPPETS));

  // Keep unsaved work as a draft for this student.
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => store.set(key, { scores, overall, feedback, at: new Date().toISOString() } satisfies Draft), 400);
    return () => window.clearTimeout(t);
  }, [dirty, key, scores, overall, feedback]);

  const rubricMax = rubric.reduce((n, c) => n + (Number(c.max_score) || 0), 0);
  const total = hasRubric ? round2(scores.reduce((n, s) => n + (Number(s.score) || 0), 0)) : Number(overall) || 0;
  const max = hasRubric ? rubricMax : a.max_points;
  const scored = hasRubric ? scores.filter((s) => s.score !== "").length : overall === "" ? 0 : 1;
  const needed = hasRubric ? rubric.length : 1;
  const pct = max ? Math.min(100, Math.round((total / max) * 100)) : 0;

  const touch = () => {
    setDirty(true);
    setRestored(false);
  };
  const setScore = (i: number, value: string) => {
    touch();
    setScores((prev) => prev.map((s, j) => (j === i ? { ...s, score: value } : s)));
  };
  const setComment = (i: number, value: string) => {
    touch();
    setScores((prev) => prev.map((s, j) => (j === i ? { ...s, comment: value } : s)));
  };
  const discardDraft = () => {
    store.set(key, null);
    setScores(scoresOf(row, rubric));
    setOverall(!hasRubric && row.grade?.score != null ? String(row.grade.score) : "");
    setFeedback(overallFeedback(row.grade?.feedback));
    setDirty(false);
    setRestored(false);
  };
  const addSnippet = (text: string) => {
    touch();
    setFeedback((f) => (f.trim() ? `${f.trim()} ${text}` : text));
  };
  const saveSnippet = () => {
    const t = feedback.trim();
    if (!t || snippets.includes(t)) return;
    const next = [t, ...snippets].slice(0, 12);
    setSnippets(next);
    store.set(SNIPPETS_KEY, next);
    toast.success("Saved to your quick comments.");
  };
  const removeSnippet = (t: string) => {
    const next = snippets.filter((s) => s !== t);
    setSnippets(next);
    store.set(SNIPPETS_KEY, next);
  };

  const save = async (advance: boolean, release = true) => {
    if (!row.student || !gradable) return;
    setError(null);
    for (let i = 0; i < scores.length; i++) {
      const v = scores[i]!.score;
      if (v !== "" && (Number(v) < 0 || Number(v) > rubric[i]!.max_score)) {
        setError(`"${rubric[i]!.criteria}" must be between 0 and ${rubric[i]!.max_score}.`);
        return;
      }
    }
    if (scored < needed) {
      setError(hasRubric ? "Score every criterion before saving." : "Enter a score before saving.");
      return;
    }
    setSaving(true);
    try {
      const saved = await practicalsApi.saveGrade(a.type, a.id, row.student.id, {
        question_id: a.question?.id ?? null,
        rubric_scores: hasRubric ? scores.map((s, index) => ({ index, score: Number(s.score), comment: s.comment.trim() || null })) : [],
        score: hasRubric ? null : Number(overall),
        feedback: feedback.trim(),
        release,
        if_version: row.grade?.version ?? null,
      });
      store.set(key, null);
      setDirty(false);
      if (!release) toast.success(`Draft saved for ${row.student.name}: ${total}/${max}. They won't see it until you release it.`);
      else if (saved?.locks_student) toast.success(`Released ${row.student.name}'s grade: ${total}/${max}. Their project is now read-only.`);
      else toast.success(`Released ${row.student.name}'s grade: ${total}/${max}. They can see it now.`);
      await onSaved();
      if (advance && nextRow) onSelect(nextRow.student?.id);
    } catch (e) {
      if (apiErrorCode(e) === "GRADE_CHANGED") {
        // Keep this teacher's scores as a local draft, show the newer grade.
        store.set(key, { scores, overall, feedback, at: new Date().toISOString() } satisfies Draft);
        toast.error("Someone else changed this grade. Their version is shown; your scores are kept as a draft on this device.");
        await onSaved();
      } else {
        setError(apiErrorMessage(e, "Couldn't save the grade."));
      }
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/⌘+Enter saves and moves on, Ctrl/⌘+S saves.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !gradable) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void saveRef.current(true);
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gradable]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="criteria-scorer">
      {/* Total */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="relative">
          <ScoreRing pct={pct} />
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-2xl font-bold tabular-nums leading-tight" data-testid="grade-total">
            {total}
            <span className="text-sm font-semibold text-slate-400"> / {max}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            {scored}/{needed} {hasRubric ? "criteria scored" : "score entered"}
            {hasRubric && a.type === "quiz" && rubricMax !== a.max_points ? ` · question worth ${a.max_points} pts` : ""}
          </p>
        </div>
        {row.grade?.status === "draft" && !dirty ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            data-testid="grade-draft-badge"
            title="Saved as a draft: the student doesn't see it yet"
          >
            <Save className="h-3.5 w-3.5" /> Draft
          </span>
        ) : (
          row.state === "graded" &&
          !dirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Graded
            </span>
          )
        )}
      </div>
      {(row.grade?.graded_by || row.grade?.status === "draft") && (
        <p className="shrink-0 border-b border-slate-200 px-4 py-1.5 text-[11px] text-slate-500 dark:border-white/10" data-testid="graded-by">
          {row.grade?.status === "draft" ? "Draft saved" : "Graded"}
          {row.grade?.graded_by ? ` by ${row.grade.graded_by.name}` : ""}
          {row.grade?.graded_at ? ` · ${formatDateTime(row.grade.graded_at)}` : ""}
          {row.grade?.status === "draft"
            ? row.grade.released_score != null
              ? ` · the student still sees ${row.grade.released_score}/${max}`
              : " · not released to the student"
            : ""}
        </p>
      )}

      {!gradable && (
        <p className="mx-4 mt-3 flex shrink-0 items-start gap-1.5 rounded-xl bg-slate-100 p-2.5 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {!a.can_grade ? "You can view this practical but not grade it." : "Nothing to grade yet: the student hasn't submitted a project."}
        </p>
      )}
      {restored && (
        <div className="mx-4 mt-3 flex shrink-0 items-center gap-2 rounded-xl bg-blue-50 p-2.5 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-200" data-testid="draft-restored">
          <Save className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Restored your unsaved scores for this student.</span>
          <button type="button" onClick={discardDraft} className="font-semibold underline">
            Discard
          </button>
        </div>
      )}

      {/* Criteria + feedback: the only part that scrolls */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {hasRubric ? (
          rubric.map((c, i) => (
            <CriterionCard
              key={i}
              c={c}
              index={i}
              value={scores[i]!}
              disabled={!gradable || saving}
              onScore={(v) => setScore(i, v)}
              onComment={(v) => setComment(i, v)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <p className="text-sm font-semibold">Score</p>
            <p className="mb-2 text-xs text-slate-500">No grading criteria were set; give one overall score.</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={a.max_points}
                step="0.5"
                value={overall}
                disabled={!gradable || saving}
                onChange={(e) => {
                  touch();
                  setOverall(e.target.value);
                }}
                aria-label={`Score out of ${a.max_points}`}
                className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-semibold dark:border-white/10 dark:bg-slate-800"
              />
              <span className="text-sm text-slate-500">/ {a.max_points}</span>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
          <label className="block">
            <span className="text-sm font-semibold">Feedback to the student</span>
            <textarea
              value={feedback}
              onChange={(e) => {
                touch();
                setFeedback(e.target.value);
              }}
              disabled={!gradable || saving}
              rows={4}
              placeholder="What went well, and what to improve…"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800"
            />
          </label>
          {gradable && (
            <div className="mt-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quick comments</p>
              <div className="flex flex-wrap gap-1.5" data-testid="quick-comments">
                {snippets.map((t) => (
                  <span key={t} className="group inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 text-xs dark:border-white/10 dark:bg-white/5">
                    <button type="button" onClick={() => addSnippet(t)} className="truncate py-1 pl-2.5 pr-1.5 text-slate-700 hover:text-blue-700 dark:text-slate-200" title="Add to the feedback">
                      {t}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSnippet(t)}
                      aria-label={`Remove quick comment "${t}"`}
                      className="mr-1 inline-flex rounded-full p-0.5 text-slate-400 opacity-0 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {feedback.trim() && !snippets.includes(feedback.trim()) && (
                  <button
                    type="button"
                    onClick={saveSnippet}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-blue-300 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  >
                    <Plus className="h-3 w-3" /> Save as quick comment
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {(row.grade?.annotations?.length ?? 0) > 0 && (
        <div className="max-h-32 shrink-0 overflow-y-auto border-t border-slate-200 px-4 py-2 dark:border-white/10" data-testid="grade-annotations">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Line comments ({row.grade!.annotations!.length}) · added in TMCode, kept when you save here
          </p>
          <ul className="space-y-0.5 text-xs">
            {row.grade!.annotations!.map((n, i) => (
              <li key={i} className="truncate" title={n.text}>
                <span className="font-mono text-slate-500">
                  {n.path}:{n.line}
                </span>{" "}
                {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions: fixed at the bottom */}
      <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => save(false, false)}
            disabled={!gradable || saving}
            data-testid="save-draft"
            title="Save without showing it to the student"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={!gradable || saving}
            title="Save and release to the student (Ctrl/⌘ + S)"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Release
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={!gradable || saving}
            data-testid="save-next"
            title="Ctrl/⌘ + Enter"
            className="inline-flex flex-[1.5] items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {nextRow ? "Release & next" : "Release grade"}
          </button>
        </div>
        <div className="flex min-h-[1rem] items-center justify-between gap-2 text-[11px]">
          {(row.state === "submitted" || row.state === "graded") && a.can_grade && row.project && a.type === "assignment" && a.can_return !== false ? (
            <button type="button" onClick={onReturn} className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline dark:text-amber-300">
              <Undo2 className="h-3.5 w-3.5" /> {row.state === "graded" ? "Allow resubmission" : "Return for changes"}
            </button>
          ) : (
            <span />
          )}
          {dirty ? (
            <span className="text-blue-600 dark:text-blue-400">Draft kept on this device</span>
          ) : nextRow ? (
            <span className="truncate text-slate-500">Next: {nextRow.student?.name}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PracticalGradingPage;
