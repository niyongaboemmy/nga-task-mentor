import React, { useEffect, useMemo, useState } from "react";
import { Bot, ClipboardPaste, Copy, FileText, FolderGit2, History, Loader2, Play, Puzzle, Sparkles, Terminal } from "lucide-react";
import { apiErrorMessage, projectsApi, type ActivityEvent, type ActivitySummary } from "../../../services/projectsApi";

/**
 * The grading workspace's Activity tab: what the student did in TMCode while working on this
 * project (TMCode records everything but typing) — files, copy and paste (and where pasted text
 * came from), runs, terminal commands — and every use of AI, named: TMCode AI's answers and
 * accepted suggestions, and AI extensions such as Claude Code or Gemini.
 */

type Filter = "all" | "ai" | "file" | "clipboard" | "work";
const FILTERS: { id: Filter; label: string; match: (e: ActivityEvent) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "ai", label: "AI", match: (e) => !!e.ai },
  { id: "file", label: "Files", match: (e) => e.kind === "file" },
  { id: "clipboard", label: "Copy & paste", match: (e) => e.kind === "clipboard" },
  { id: "work", label: "Runs & terminal", match: (e) => e.kind === "run" || e.kind === "terminal" },
];

const iconOf = (e: ActivityEvent): React.ElementType => {
  if (e.ai) return Sparkles;
  if (e.action === "paste") return ClipboardPaste;
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
  const [data, setData] = useState<{ events: ActivityEvent[]; summary: ActivitySummary } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-200 p-3 sm:grid-cols-5 dark:border-white/10">
        <Card label="AI use" value={s.ai_events} tone={s.ai_events ? "ai" : "plain"} hint="Questions, answers, suggestions and edits by AI" testid="activity-ai-events" />
        <Card
          label="AI tools"
          value={s.ai_tools.length ? <span className="text-sm">{s.ai_tools.map((t) => `${t.by} (${t.count})`).join(", ")}</span> : "None"}
          tone={s.ai_tools.length ? "ai" : "plain"}
          testid="activity-ai-tools"
        />
        <Card label="Pasted from outside" value={s.pastes_outside} tone={s.pastes_outside ? "warn" : "plain"} hint="Text pasted that wasn't copied inside TMCode" />
        <Card label="Pasted AI code" value={s.pastes_from_ai} tone={s.pastes_from_ai ? "ai" : "plain"} />
        <Card label="File changes" value={s.by_kind.file ?? 0} />
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
                          <dt className="text-slate-400">{k.replace(/_/g, " ")}</dt>
                          <dd className="break-words">{String(v)}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
};

export default ActivityPane;
