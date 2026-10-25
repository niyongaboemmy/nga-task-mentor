import React, { useEffect, useMemo, useState } from "react";
import { Bot, ClipboardPaste, Clock, Copy, FileText, FolderGit2, History, Loader2, Play, Puzzle, Sparkles, Terminal } from "lucide-react";
import { apiErrorMessage, projectsApi, type ActivityEvent, type ActivitySummary } from "../../../services/projectsApi";

/**
 * The grading workspace's Activity tab: what the student did in TMCode while working on this
 * project (TMCode records everything but typing) — files, every copy, cut and paste (and where
 * pasted text came from), files brought in, runs, terminal commands, time spent in other apps —
 * and every use of AI, named: TMCode AI's answers and accepted suggestions, AI extensions such as
 * Claude Code or Gemini, and AI tools run (or stopped) in the terminal. The cards count the whole
 * log; the list loads older entries on demand.
 */

type Filter = "all" | "ai" | "file" | "clipboard" | "work" | "other";
const isOther = (e: ActivityEvent) => !e.ai && !["file", "clipboard", "run", "terminal"].includes(e.kind);
const FILTERS: { id: Filter; label: string; match: (e: ActivityEvent) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "ai", label: "AI", match: (e) => !!e.ai },
  { id: "clipboard", label: "Copy & paste", match: (e) => e.kind === "clipboard" },
  { id: "file", label: "Files", match: (e) => e.kind === "file" },
  { id: "work", label: "Runs & terminal", match: (e) => e.kind === "run" || e.kind === "terminal" },
  { id: "other", label: "Away, outside changes & more", match: isOther },
];

/** "4 min", "1 h 20 min". */
const minutes = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** Readable names for an entry's details. */
const DETAIL_LABELS: Record<string, string> = {
  chars: "Characters",
  lines: "Lines",
  where: "Where",
  origin: "Came from",
  from_ai: "From AI",
  count: "How many",
  files: "Files",
  seconds: "Seconds",
  from: "Since",
  command: "Command",
  tool: "Tool",
};
const ORIGIN_LABELS: Record<string, string> = { inside: "copied inside TMCode", outside: "outside TMCode (another app)", ai: "an AI's answer" };

const iconOf = (e: ActivityEvent): React.ElementType => {
  if (e.ai) return Sparkles;
  if (e.action === "paste" || e.action === "drop") return ClipboardPaste;
  if (e.action === "away") return Clock;
  if (e.kind === "clipboard") return Copy;
  if (e.kind === "run") return Play;
  if (e.kind === "terminal") return Terminal;
  if (e.kind === "git" || e.kind === "project") return FolderGit2;
  if (e.kind === "extension") return Puzzle;
  return FileText;
};

const dayLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const Card: React.FC<{ label: string; value: React.ReactNode; tone?: "ai" | "warn" | "plain"; hint?: string; testid?: string }> = ({ label, value, tone = "plain", hint, testid }) => (
  <div
    title={hint}
    data-testid={testid}
    className={`rounded-xl border px-3 py-2 ${
      tone === "ai"
        ? "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900"
    }`}
  >
    <div className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</div>
    <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
  </div>
);

const ActivityPane: React.FC<{ projectId: number }> = ({ projectId }) => {
  const [data, setData] = useState<{ events: ActivityEvent[]; summary: ActivitySummary; next_before: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    projectsApi
      .activity(projectId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(apiErrorMessage(e, "Couldn't load the activity.")));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadOlder = async () => {
    if (!data?.next_before || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await projectsApi.activity(projectId, 1000, data.next_before);
      setData((d) => (d ? { ...d, events: [...d.events, ...more.events], next_before: more.next_before } : d));
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load older activity."));
    } finally {
      setLoadingMore(false);
    }
  };

  const shown = useMemo(() => (data ? data.events.filter(FILTERS.find((f) => f.id === filter)!.match) : []), [data, filter]);

  if (error) return <p className="p-6 text-center text-sm text-slate-500">{error}</p>;
  if (!data) return <Loader2 className="m-auto mt-10 h-5 w-5 animate-spin text-blue-600" />;
  const s = data.summary;
  if (!s.total) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500" data-testid="activity-empty">
        <History className="h-6 w-6" aria-hidden="true" />
        No activity recorded yet. TMCode records it while the student works in a folder linked to this project.
      </div>
    );
  }

  const groups: { day: string; items: ActivityEvent[] }[] = [];
  for (const e of shown) {
    const d = dayLabel(e.t);
    if (groups[groups.length - 1]?.day !== d) groups.push({ day: d, items: [] });
    groups[groups.length - 1].items.push(e);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950" data-testid="activity-pane">
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-200 p-3 sm:grid-cols-4 dark:border-white/10" data-testid="activity-summary">
        <Card
          label="AI use"
          value={s.ai_events}
          tone={s.ai_events ? "ai" : "plain"}
          hint={`Questions, answers, suggestions and edits by AI${s.ai_blocked ? `; ${s.ai_blocked} blocked attempt${s.ai_blocked === 1 ? "" : "s"} while AI was off` : ""}`}
          testid="activity-ai-events"
        />
        <Card
          label="AI tools"
          value={s.ai_tools.length ? <span className="text-sm">{s.ai_tools.map((t) => `${t.by} (${t.count})`).join(", ")}</span> : "None"}
          tone={s.ai_tools.length ? "ai" : "plain"}
          testid="activity-ai-tools"
        />
        <Card
          label="Copied · cut · pasted"
          value={
            <span className="text-sm">
              {s.copies ?? 0} · {s.cuts ?? 0} · {(s.pastes ?? 0) + (s.drops ?? 0)}
            </span>
          }
          hint={`Text copied ${s.copies ?? 0}×, cut ${s.cuts ?? 0}×, pasted ${s.pastes ?? 0}× and dragged in ${s.drops ?? 0}×. Files copied ${s.files_copied ?? 0}, cut ${s.files_cut ?? 0} in the Explorer.`}
          testid="activity-clipboard"
        />
        <Card
          label="Pasted from outside"
          value={
            <span>
              {s.pastes_outside}
              {s.chars_pasted_outside ? <span className="ml-1 text-xs font-normal opacity-70">({s.chars_pasted_outside.toLocaleString()} chars)</span> : null}
            </span>
          }
          tone={s.pastes_outside ? "warn" : "plain"}
          hint="Text pasted or dragged in that wasn't copied inside TMCode (another app, a website, a document)"
          testid="activity-pastes-outside"
        />
        <Card label="Pasted AI code" value={s.pastes_from_ai} tone={s.pastes_from_ai ? "ai" : "plain"} testid="activity-pastes-ai" />
        <Card
          label="Files from outside"
          value={s.files_imported ?? 0}
          tone={s.files_imported ? "warn" : "plain"}
          hint={`Files brought into the project from Finder / File Explorer. ${s.outside_changes ?? 0} change${s.outside_changes === 1 ? "" : "s"} made on disk by something other than TMCode.`}
          testid="activity-files-imported"
        />
        <Card
          label="Time in other apps"
          value={s.away_count ? <span className="text-sm">{s.away_count}× · {minutes(s.away_seconds ?? 0)}</span> : "None"}
          hint="Times the student left TMCode for another app for 30 seconds or more, and how long in all"
          testid="activity-away"
        />
        <Card label="File changes" value={s.by_kind.file ?? 0} hint={`${s.runs ?? 0} runs, ${s.terminal_commands ?? 0} terminal commands`} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === f.id ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200" : "border-slate-200 text-slate-600 hover:bg-white dark:border-white/10 dark:text-slate-300"}`}
            data-testid={`activity-filter-${f.id}`}
          >
            {f.id === "ai" && <Bot className="mr-1 inline h-3 w-3" aria-hidden="true" />}
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{s.first_at && s.last_at ? `${new Date(s.first_at).toLocaleDateString()} – ${new Date(s.last_at).toLocaleDateString()}` : ""}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" role="list" aria-label="Activity">
        {!shown.length && <p className="p-4 text-center text-sm text-slate-500">Nothing of this kind.</p>}
        {groups.map((g) => (
          <section key={g.day}>
            <h3 className="sticky top-0 bg-slate-50 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950">{g.day}</h3>
            {g.items.map((e, i) => {
              const Icon = iconOf(e);
              const key = e.t * 1000 + i;
              return (
                <div key={key} role="listitem" className={`mb-1 rounded-lg border-l-2 ${e.ai ? "border-violet-500 bg-violet-50/70 dark:bg-violet-500/10" : "border-transparent bg-white dark:bg-slate-900"}`}>
                  <button type="button" onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm" aria-expanded={open === key}>
                    <span className="w-11 shrink-0 font-mono text-[11px] tabular-nums text-slate-500">{time(e.t)}</span>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${e.ai ? "text-violet-600 dark:text-violet-300" : e.action === "paste" ? "text-amber-600" : "text-slate-400"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                      {e.text}
                      {e.count && e.count > 1 ? <span className="ml-1 text-slate-500">×{e.count}</span> : null}
                    </span>
                    {e.ai && <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">{e.ai.by}</span>}
                  </button>
                  {open === key && (
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 px-3 pb-2 pl-[3.6rem] text-xs text-slate-600 dark:text-slate-300">
                      <dt className="text-slate-400">When</dt>
                      <dd>{new Date(e.t).toLocaleString()}</dd>
                      {e.ai && (
                        <>
                          <dt className="text-slate-400">AI</dt>
                          <dd>
                            {e.ai.by}: {e.ai.how}
                            {e.ai.model ? ` · ${e.ai.model}` : ""}
                          </dd>
                        </>
                      )}
                      {e.path && (
                        <>
                          <dt className="text-slate-400">File</dt>
                          <dd className="font-mono">
                            {e.path}
                            {e.to ? ` → ${e.to}` : ""}
                          </dd>
                        </>
                      )}
                      {Object.entries(e.data ?? {}).map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt className="text-slate-400">{DETAIL_LABELS[k] ?? k.replace(/_/g, " ")}</dt>
                          <dd className="break-words">{k === "origin" ? (ORIGIN_LABELS[String(v)] ?? String(v)) : String(v)}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
          </section>
        ))}
        {data.next_before && (
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={loadingMore}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-60 dark:border-white/10 dark:text-slate-300"
            data-testid="activity-load-older"
          >
            {loadingMore && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Load older activity
          </button>
        )}
      </div>
    </div>
  );
};

export default ActivityPane;
