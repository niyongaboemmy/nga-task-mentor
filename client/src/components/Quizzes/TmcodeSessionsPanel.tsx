import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Laptop, RefreshCw } from "lucide-react";
import { practicalsApi, type QuizSessions, type TmcodeSessionRow } from "../../services/practicalsApi";
import { formatDateTime, timeAgo } from "../Projects/projectFormat";

/**
 * Teacher: the quiz's TMCode exam sessions (UX gap review E4), refreshed
 * every 15 s: per student active / offline / submitted, last sync, current
 * task, app version and flags, each with a one-line explanation. Renders
 * nothing until someone has opened the quiz in TMCode.
 */

const REFRESH_MS = 15_000;

const STATUS: Record<TmcodeSessionRow["status"], { label: string; cls: string; help: string }> = {
  active: {
    label: "Active",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    help: "TMCode is open and checked in within the last 90 seconds.",
  },
  offline: {
    label: "Offline",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    help: "No check-in for over 90 seconds: TMCode was closed, the computer slept or the connection dropped. Work saved offline uploads when it reconnects.",
  },
  submitted: {
    label: "Submitted",
    cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
    help: "The attempt is finished.",
  },
};

const TmcodeSessionsPanel: React.FC<{ quizId: number; className?: string }> = ({ quizId, className = "" }) => {
  const [data, setData] = useState<QuizSessions | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await practicalsApi.quizSessions(quizId));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void load();
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  if (failed || !data || data.sessions.length === 0) return null;
  const c = data.counts;

  return (
    <section
      aria-label="TMCode sessions"
      data-testid="tmcode-sessions-panel"
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <Laptop className="h-4 w-4 text-blue-600" aria-hidden="true" />
        <h2 className="text-sm font-semibold">TMCode sessions</h2>
        <p className="text-xs text-slate-500" data-testid="tmcode-sessions-counts">
          {c.active} active · {c.offline} offline · {c.submitted} submitted
          {c.flagged ? ` · ${c.flagged} flagged` : ""}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          aria-label="Refresh TMCode sessions"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          {timeAgo(data.generated_at)}
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Student</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold">Last saved</th>
              <th className="px-2 py-2 font-semibold">Working on</th>
              <th className="px-2 py-2 font-semibold">TMCode</th>
              <th className="px-4 py-2 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((s) => {
              const st = STATUS[s.status];
              return (
                <tr key={s.session_id} className="border-t border-slate-100 align-top dark:border-white/5" data-testid="tmcode-session-row">
                  <td className="px-4 py-2 font-medium">{s.student?.name ?? `Student ${s.submission_id}`}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`} title={st.help}>
                      {st.label}
                    </span>
                    {s.status !== "submitted" && s.last_heartbeat && (
                      <p className="mt-0.5 text-[11px] text-slate-500">seen {timeAgo(s.last_heartbeat)}</p>
                    )}
                  </td>
                  <td className="px-2 py-2" title={s.last_sync ? formatDateTime(s.last_sync) : undefined}>
                    {s.last_sync ? timeAgo(s.last_sync) : <span className="text-slate-400">nothing yet</span>}
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-2" title={s.current_task?.title}>
                    {s.current_task?.title ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-2 py-2 text-slate-500">
                    {s.app_version ? `v${s.app_version}` : "—"}
                    {s.os ? ` · ${s.os}` : ""}
                  </td>
                  <td className="px-4 py-2">
                    {s.flags.length === 0 ? (
                      <span className="text-slate-400">None</span>
                    ) : (
                      <ul className="space-y-1">
                        {s.flags.map((f, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <AlertTriangle
                              className={`mt-0.5 h-3 w-3 shrink-0 ${f.severity === "high" ? "text-rose-600" : "text-amber-600"}`}
                              aria-hidden="true"
                            />
                            <span>
                              <span className="font-mono font-semibold">{f.rule}</span>
                              <span className="text-slate-600 dark:text-slate-300">: {f.explanation}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default TmcodeSessionsPanel;
