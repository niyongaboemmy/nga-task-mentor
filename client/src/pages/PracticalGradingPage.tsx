import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  ExternalLink,
  Eye,
  FileText,
  Laptop,
  Loader2,
  MessageSquarePlus,
  Monitor,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import {
  practicalsApi,
  type CriterionScore,
  type GradingRoster,
  type GradingRow,
  type PracticalActivity,
} from "../services/practicalsApi";
import { apiErrorCode, apiErrorMessage, projectsApi, type RevisionSummary } from "../services/projectsApi";
import FilesTab from "../components/Projects/FilesTab";
import ReturnForChangesDialog from "../components/Projects/ReturnForChangesDialog";
import Select from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { formatDateTime } from "../components/Projects/projectFormat";

/**
 * Full-page grading workspace for TMCode practicals (assignment or quiz
 * question): roster on the left, the submitted project (code, live preview,
 * details) in the middle, criteria scoring on the right.
 */

type Filter = "to_grade" | "graded" | "all";
type Pane = "code" | "preview" | "details";

const STATE_META: Record<GradingRow["state"], { label: string; cls: string }> = {
  submitted: { label: "To grade", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
  graded: { label: "Graded", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" },
  in_progress: { label: "Working", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
  not_started: { label: "Not started", cls: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400" },
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The server's rubric_scores may be a list or an index→score map (assignments). */
function scoresOf(row: GradingRow | null, count: number): { score: string; comment: string }[] {
  const raw = row?.grade?.rubric_scores as unknown;
  const out = Array.from({ length: count }, () => ({ score: "", comment: "" }));
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
  return out;
}

/** Strip the "Criteria notes" block the server composes into the feedback. */
const overallFeedback = (f: string | null | undefined) => String(f ?? "").split(/\n*Criteria notes:\n/)[0] ?? "";

const PracticalGradingPage: React.FC = () => {
  const params = useParams();
  const type = (params.type === "quiz" ? "quiz" : "assignment") as PracticalActivity;
  const activityId = Number(params.id);
  const [search, setSearch] = useSearchParams();
  const questionParam = search.get("question") ? Number(search.get("question")) : null;
  const studentParam = search.get("student") ? Number(search.get("student")) : null;

  const [roster, setRoster] = useState<GradingRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("to_grade");
  const [query, setQuery] = useState("");

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
    load().then((r) => {
      // Nothing to grade: show everyone instead of an empty list.
      if (r && r.counts.to_grade === 0) setFilter("all");
    });
  }, [load]);

  const visibleRows = useMemo(() => {
    const rows = roster?.rows ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "to_grade" && r.state !== "submitted") return false;
      if (filter === "graded" && r.state !== "graded") return false;
      if (q && !(r.student?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roster, filter, query]);

  const current = useMemo(() => {
    const rows = roster?.rows ?? [];
    return rows.find((r) => r.student?.id === studentParam) ?? visibleRows[0] ?? rows[0] ?? null;
  }, [roster, studentParam, visibleRows]);

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

  const navIndex = visibleRows.findIndex((r) => r.student?.id === current?.student?.id);
  const prevRow = navIndex > 0 ? visibleRows[navIndex - 1] : null;
  const nextRow = navIndex >= 0 && navIndex < visibleRows.length - 1 ? visibleRows[navIndex + 1] : visibleRows[navIndex === -1 ? 0 : -1] ?? null;

  const backHref = type === "quiz" ? `/quizzes/${activityId}/submissions` : `/assignments/${activityId}`;

  if (error && !roster) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-sm text-rose-600">{error}</p>
        <Link to={backHref} className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline">
          Back
        </Link>
      </div>
    );
  }

  const a = roster?.activity;
  const pct = roster && roster.counts.total ? Math.round((roster.counts.graded / roster.counts.total) * 100) : 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[560px] flex-col" data-testid="practical-grading">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <Link
          to={backHref}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-slate-600 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-white/5"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
            {type === "quiz" ? "Quiz practical" : "Assignment practical"} · grading
          </p>
          <h1 className="truncate text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            {a ? a.title : <Skeleton className="h-5 w-56" />}
          </h1>
        </div>
        {a?.questions && a.questions.length > 1 && (
          <div className="w-64">
            <Select
              aria-label="Practical question"
              value={String(a.question?.id ?? "")}
              onChange={(e) =>
                setSearch(new URLSearchParams({ question: e.target.value }), { replace: true })
              }
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
          <div className="flex items-center gap-3" aria-label="Grading progress">
            <div className="hidden text-right text-xs sm:block">
              <p className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                {roster.counts.graded}/{roster.counts.total} graded
              </p>
              <p className="text-slate-500">{roster.counts.to_grade} waiting</p>
            </div>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Roster */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/40 lg:flex">
          <div className="space-y-2 p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a student"
                aria-label="Find a student"
                className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800"
              />
            </label>
            <div className="flex gap-1 rounded-xl bg-gray-200/70 p-1 text-xs font-semibold dark:bg-gray-800" role="tablist" aria-label="Filter students">
              {(
                [
                  ["to_grade", `To grade${roster ? ` ${roster.counts.to_grade}` : ""}`],
                  ["graded", `Graded${roster ? ` ${roster.counts.graded}` : ""}`],
                  ["all", "All"],
                ] as [Filter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={filter === k}
                  onClick={() => setFilter(k)}
                  className={`flex-1 rounded-lg px-2 py-1.5 transition ${
                    filter === k ? "bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-label="Students">
            {!roster
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
              : visibleRows.length === 0
                ? <li className="px-3 py-6 text-center text-sm text-slate-500">No students here.</li>
                : visibleRows.map((r) => {
                    const sel = r.student?.id === current?.student?.id;
                    const meta = STATE_META[r.state];
                    return (
                      <li key={r.student?.id ?? r.project?.id}>
                        <button
                          type="button"
                          onClick={() => select(r.student?.id)}
                          aria-current={sel ? "true" : undefined}
                          data-testid="roster-row"
                          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                            sel ? "bg-white shadow-sm ring-1 ring-violet-300 dark:bg-gray-800 dark:ring-violet-700" : "hover:bg-white/70 dark:hover:bg-white/5"
                          }`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-bold text-white">
                            {initials(r.student?.name ?? "?")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                              {r.student?.name ?? "Unknown student"}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5">
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
                              {r.late && <span className="text-[10px] font-semibold text-rose-600">Late</span>}
                            </span>
                          </span>
                          {r.grade?.score != null && (
                            <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
                              {round2(r.grade.score)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
          </ul>
        </aside>

        {roster && current ? (
          <StudentWorkspace
            key={`${a!.question?.id ?? 0}-${current.student?.id}`}
            roster={roster}
            row={current}
            prevRow={prevRow}
            nextRow={nextRow === current ? null : nextRow}
            onSelect={select}
            onSaved={load}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
            {roster ? "No students to show." : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        )}
      </div>
    </div>
  );
};

const StudentWorkspace: React.FC<{
  roster: GradingRoster;
  row: GradingRow;
  prevRow: GradingRow | null;
  nextRow: GradingRow | null;
  onSelect: (studentId: number | null | undefined) => void;
  onSaved: () => Promise<unknown>;
}> = ({ roster, row, prevRow, nextRow, onSelect, onSaved }) => {
  const a = roster.activity;
  const [pane, setPane] = useState<Pane>("code");
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [revisionId, setRevisionId] = useState<number | null>(row.link?.revision_id ?? null);
  const [returnOpen, setReturnOpen] = useState(false);

  const projectId = row.project?.id ?? null;
  const gradable = !!row.link && (row.state === "submitted" || row.state === "graded");

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

  // Alt+↑/↓ switch students.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      const target = e.key === "ArrowUp" ? prevRow : nextRow;
      if (!target) return;
      e.preventDefault();
      onSelect(target.student?.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevRow, nextRow, onSelect]);

  const name = row.student?.name ?? "Student";

  return (
    <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
      {/* Submission */}
      <section className="flex min-h-[420px] min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <p className="truncate text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{name}</p>
            <p className="truncate text-xs text-slate-500">
              {row.project ? row.project.name : "No project yet"}
              {row.link?.revision_number ? ` · submitted revision #${row.link.revision_number}` : ""}
              {row.submitted_at ? ` · ${formatDateTime(row.submitted_at)}` : ""}
            </p>
          </div>
          <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold dark:bg-gray-800" role="tablist" aria-label="View">
            {(
              [
                ["code", "Code", Code2],
                ["preview", "Preview", Eye],
                ["details", "Details", FileText],
              ] as [Pane, string, React.ElementType][]
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={pane === k}
                onClick={() => setPane(k)}
                disabled={!projectId}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition disabled:opacity-40 ${
                  pane === k ? "bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(prevRow?.student?.id)}
              disabled={!prevRow}
              aria-label="Previous student"
              title="Previous student (Alt+↑)"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-slate-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelect(nextRow?.student?.id)}
              disabled={!nextRow}
              aria-label="Next student"
              title="Next student (Alt+↓)"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-slate-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto p-3">
          {!projectId ? (
            <EmptyState text={`${name} hasn't started a project for this practical yet.`} />
          ) : pane === "code" ? (
            <FilesTab projectId={projectId} revisions={revisions} revisionId={revisionId} onRevisionChange={setRevisionId} />
          ) : pane === "preview" ? (
            <PreviewPane projectId={projectId} revisionId={revisionId} />
          ) : (
            <DetailsPane row={row} />
          )}
        </div>
      </section>

      {/* Scoring */}
      <aside className="flex w-full shrink-0 flex-col border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 xl:w-[400px] xl:border-l xl:border-t-0">
        <CriteriaScorer
          key={`${row.student?.id}-${row.grade?.graded_at ?? ""}`}
          roster={roster}
          row={row}
          gradable={gradable && a.can_grade}
          nextRow={nextRow}
          onSelect={onSelect}
          onSaved={onSaved}
          onReturn={() => setReturnOpen(true)}
        />
      </aside>

      <ReturnForChangesDialog
        open={returnOpen}
        projectId={projectId}
        studentName={name}
        onClose={() => setReturnOpen(false)}
        onReturned={() => void onSaved()}
      />
    </div>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-slate-500 dark:border-gray-700">
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
              ? "This project has no HTML page to preview. Read the code instead; running other languages comes in a later update."
              : apiErrorMessage(e, "Couldn't start the preview."),
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [projectId, revisionId, nonce]);

  if (error) return <EmptyState text={error} />;
  const width = DEVICES.find((d) => d.key === device)!.width;

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-1 font-mono text-xs text-slate-500 dark:bg-gray-900">
          {state ? state.entry : "Starting preview…"}
        </span>
        <div className="flex rounded-lg bg-gray-200/70 p-0.5 dark:bg-gray-700" role="group" aria-label="Device size">
          {DEVICES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-pressed={device === key}
              aria-label={label}
              title={label}
              className={`rounded-md p-1.5 ${device === key ? "bg-white text-slate-900 shadow-sm dark:bg-gray-600 dark:text-white" : "text-slate-500"}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setNonce((n) => n + 1)} aria-label="Reload preview" title="Reload" className="rounded-md p-1.5 text-slate-500 hover:bg-gray-200 dark:hover:bg-gray-700">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        {state && (
          <a href={state.url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab" title="Open in a new tab" className="rounded-md p-1.5 text-slate-500 hover:bg-gray-200 dark:hover:bg-gray-700">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] dark:bg-gray-950 dark:bg-none">
        {state ? (
          <iframe
            key={`${state.url}-${nonce}`}
            title="Project preview"
            src={state.url}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            className="h-full bg-white transition-[width] duration-300"
            style={{ width, maxWidth: "100%" }}
            data-testid="practical-preview"
          />
        ) : (
          <Loader2 className="m-auto h-5 w-5 animate-spin text-slate-400" />
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
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-1 text-sm text-text-primary-light dark:text-text-primary-dark">{v}</dd>
          </div>
        ))}
      </dl>
      {row.project && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/projects/${row.project.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-white/5"
          >
            <Laptop className="h-4 w-4" /> Open the project page
          </Link>
          {row.project.repo_url && (
            <a
              href={row.project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <ExternalLink className="h-4 w-4" /> Repository
            </a>
          )}
        </div>
      )}
      {row.grade?.feedback && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-950/20">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Feedback sent</p>
          <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{row.grade.feedback}</p>
        </div>
      )}
    </div>
  );
};

const CriteriaScorer: React.FC<{
  roster: GradingRoster;
  row: GradingRow;
  gradable: boolean;
  nextRow: GradingRow | null;
  onSelect: (studentId: number | null | undefined) => void;
  onSaved: () => Promise<unknown>;
  onReturn: () => void;
}> = ({ roster, row, gradable, nextRow, onSelect, onSaved, onReturn }) => {
  const a = roster.activity;
  const rubric = a.rubric;
  const hasRubric = rubric.length > 0;
  const [scores, setScores] = useState(() => scoresOf(row, rubric.length));
  const [openNotes, setOpenNotes] = useState<Set<number>>(
    () => new Set(scoresOf(row, rubric.length).flatMap((s, i) => (s.comment ? [i] : []))),
  );
  const [overall, setOverall] = useState<string>(!hasRubric && row.grade?.score != null ? String(row.grade.score) : "");
  const [feedback, setFeedback] = useState(overallFeedback(row.grade?.feedback));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rubricMax = rubric.reduce((n, c) => n + (Number(c.max_score) || 0), 0);
  const total = hasRubric ? round2(scores.reduce((n, s) => n + (Number(s.score) || 0), 0)) : Number(overall) || 0;
  const max = hasRubric ? rubricMax : a.max_points;
  const missing = hasRubric ? scores.filter((s) => s.score === "").length : overall === "" ? 1 : 0;
  const pct = max ? Math.min(100, Math.round((total / max) * 100)) : 0;

  const setScore = (i: number, value: string) => {
    setDirty(true);
    setScores((prev) => prev.map((s, j) => (j === i ? { ...s, score: value } : s)));
  };
  const setComment = (i: number, value: string) => {
    setDirty(true);
    setScores((prev) => prev.map((s, j) => (j === i ? { ...s, comment: value } : s)));
  };

  const save = async (advance: boolean) => {
    if (!row.student) return;
    setError(null);
    for (let i = 0; i < scores.length; i++) {
      const v = scores[i]!.score;
      if (v !== "" && (Number(v) < 0 || Number(v) > rubric[i]!.max_score)) {
        setError(`"${rubric[i]!.criteria}" must be between 0 and ${rubric[i]!.max_score}.`);
        return;
      }
    }
    if (missing) {
      setError(hasRubric ? "Score every criterion before saving." : "Enter a score before saving.");
      return;
    }
    setSaving(true);
    try {
      await practicalsApi.saveGrade(a.type, a.id, row.student.id, {
        question_id: a.question?.id ?? null,
        rubric_scores: hasRubric ? scores.map((s, index) => ({ index, score: Number(s.score), comment: s.comment.trim() || null })) : [],
        score: hasRubric ? null : Number(overall),
        feedback: feedback.trim(),
      });
      setDirty(false);
      toast.success(`Saved ${row.student.name}'s grade: ${total}/${max}.`);
      await onSaved();
      if (advance && nextRow) onSelect(nextRow.student?.id);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't save the grade."));
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+Enter saves and moves on.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && gradable) {
        e.preventDefault();
        void saveRef.current(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gradable]);

  // Unsaved scores: confirm before leaving the page.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="criteria-scorer">
      {/* Total */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="text-3xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark" data-testid="grade-total">
              {total}
              <span className="text-base font-semibold text-slate-400"> / {max}</span>
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              pct >= 70 ? "bg-emerald-100 text-emerald-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {pct}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {hasRubric && a.type === "quiz" && rubricMax !== a.max_points && (
          <p className="mt-2 text-[11px] text-slate-500">The question is worth {a.max_points} points; the criteria total {rubricMax}.</p>
        )}
        {!gradable && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!a.can_grade ? "You can view this practical but not grade it." : "Nothing to grade yet: the student hasn't submitted a project."}
          </p>
        )}
      </div>

      {/* Criteria */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {hasRubric ? (
          rubric.map((c, i) => {
            const s = scores[i]!;
            const val = s.score === "" ? null : Number(s.score);
            const over = val != null && (val > c.max_score || val < 0);
            return (
              <fieldset
                key={i}
                disabled={!gradable || saving}
                className={`rounded-2xl border p-3 transition ${
                  over ? "border-rose-300 bg-rose-50/50" : val != null ? "border-violet-200 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/10" : "border-gray-200 dark:border-gray-700"
                }`}
                data-testid="criterion"
              >
                <legend className="sr-only">{c.criteria}</legend>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{c.criteria}</p>
                    {c.description && <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={c.max_score}
                      step="0.5"
                      value={s.score}
                      onChange={(e) => setScore(i, e.target.value)}
                      aria-label={`${c.criteria} score out of ${c.max_score}`}
                      aria-invalid={over || undefined}
                      className="h-9 w-16 rounded-lg border border-gray-200 bg-white px-2 text-right text-sm font-semibold tabular-nums outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800"
                    />
                    <span className="text-xs text-slate-500">/ {c.max_score}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {[
                    ["0", 0],
                    ["½", round2(c.max_score / 2)],
                    ["Full", c.max_score],
                  ].map(([label, v]) => (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={() => setScore(i, String(v))}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        val === v ? "bg-violet-600 text-white" : "bg-gray-100 text-slate-600 hover:bg-gray-200 dark:bg-white/5 dark:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <input
                    type="range"
                    min={0}
                    max={c.max_score}
                    step={0.5}
                    value={val ?? 0}
                    onChange={(e) => setScore(i, e.target.value)}
                    aria-hidden="true"
                    tabIndex={-1}
                    className="ml-1 h-1.5 flex-1 accent-violet-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setOpenNotes((prev) => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })
                    }
                    aria-label={`Comment on ${c.criteria}`}
                    aria-expanded={openNotes.has(i)}
                    className={`rounded-lg p-1 ${s.comment ? "text-violet-600" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>
                </div>
                {openNotes.has(i) && (
                  <textarea
                    value={s.comment}
                    onChange={(e) => setComment(i, e.target.value)}
                    rows={2}
                    placeholder={`A note on ${c.criteria.toLowerCase()}…`}
                    aria-label={`Comment on ${c.criteria}`}
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800"
                  />
                )}
              </fieldset>
            );
          })
        ) : (
          <div className="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
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
                  setDirty(true);
                  setOverall(e.target.value);
                }}
                aria-label={`Score out of ${a.max_points}`}
                className="h-9 w-24 rounded-lg border border-gray-200 bg-white px-2 text-right text-sm font-semibold dark:border-gray-700 dark:bg-gray-800"
              />
              <span className="text-sm text-slate-500">/ {a.max_points}</span>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Feedback to the student</span>
          <textarea
            value={feedback}
            onChange={(e) => {
              setDirty(true);
              setFeedback(e.target.value);
            }}
            disabled={!gradable || saving}
            rows={4}
            placeholder="What went well, and what to improve…"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800"
          />
        </label>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-gray-200 p-4 dark:border-gray-800">
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={!gradable || saving}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-white/5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={!gradable || saving}
            data-testid="save-next"
            title="Ctrl/⌘ + Enter"
            className="inline-flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {nextRow ? "Save & next" : "Save grade"}
          </button>
        </div>
        {row.state === "submitted" && a.can_grade && row.project && (
          <button
            type="button"
            onClick={onReturn}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/20"
          >
            <Undo2 className="h-3.5 w-3.5" /> Return for changes
          </button>
        )}
        {dirty && <p className="text-center text-[11px] text-amber-600">Unsaved changes</p>}
      </div>
    </div>
  );
};

export default PracticalGradingPage;
