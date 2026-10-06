import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileCode2, GitBranch, Laptop, Play, TriangleAlert } from "lucide-react";
import { isPresenceLive, type ProjectPresence } from "../../services/projectsApi";
import type { LiveStatus } from "../../hooks/useEventSource";
import { LiveDot, LiveIndicator, Pill, SyncBadge } from "./ProjectBadges";
import { dirtyCount, presenceLine, timeAgo } from "./projectFormat";

/**
 * Live status of a project, fed by the SSE stream: one row per device that
 * has it open in TMCode ("Open in TMCode on MacBook · editing src/main.cpp ·
 * 2 unsaved · branch main ↑1"), plus the stream's own state.
 */
const LivePanel: React.FC<{
  presence: ProjectPresence[];
  status: LiveStatus;
  onRetry?: () => void;
  now?: number;
}> = ({ presence, status, onRetry, now = Date.now() }) => {
  const live = presence.filter((p) => isPresenceLive(p, now));
  const lastSeen = presence
    .map((p) => p.last_seen_at)
    .sort()
    .pop();

  return (
    <section
      aria-label="Live status"
      className="rounded-2xl border border-gray-200/60 bg-white/80 p-4 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50"
      data-testid="live-panel"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
          <LiveDot live={live.length > 0} />
          {live.length > 0 ? `Open in TMCode now` : "Not open in TMCode"}
        </h2>
        <LiveIndicator status={status} onRetry={onRetry} />
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {live.length === 0 ? (
          <motion.p
            key="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-slate-500 dark:text-slate-400"
          >
            {lastSeen && new Date(lastSeen).getTime() > 0
              ? `Last open ${timeAgo(lastSeen, now)}.`
              : "It hasn't been opened in TMCode yet."}
          </motion.p>
        ) : (
          live.map((p) => {
            const dirty = dirtyCount(p.state.dirty);
            const run = p.state.last_run;
            return (
              <motion.div
                key={`${p.user_id}-${p.device_id}`}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="mb-2 rounded-xl bg-emerald-50/70 p-3 last:mb-0 dark:bg-emerald-900/10"
              >
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200" data-testid="presence-line">
                  {presenceLine(p)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  {p.user && (
                    <span className="inline-flex items-center gap-1">
                      <Laptop className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.user.name}
                    </span>
                  )}
                  {p.state.file && (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.state.file}
                    </span>
                  )}
                  {dirty > 0 && (
                    <Pill tone="amber" icon={<TriangleAlert className="h-3 w-3" aria-hidden="true" />}>
                      {dirty} unsaved
                    </Pill>
                  )}
                  {p.state.branch && (
                    <Pill tone="slate" icon={<GitBranch className="h-3 w-3" aria-hidden="true" />}>
                      {p.state.branch}
                      {p.state.changes ? ` · ${p.state.changes} changed` : ""}
                    </Pill>
                  )}
                  <SyncBadge sync={p.state.sync} />
                  {run?.at && (
                    <Pill
                      tone={run.status === "error" ? "rose" : run.status === "running" ? "violet" : "emerald"}
                      icon={<Play className="h-3 w-3" aria-hidden="true" />}
                    >
                      Ran {timeAgo(run.at, now)}
                      {run.status === "error" ? " · failed" : run.status === "running" ? " · running" : ""}
                    </Pill>
                  )}
                  <span className="ml-auto">
                    seen {timeAgo(p.last_seen_at, now)}
                    {p.app_version ? ` · TMCode ${p.app_version}` : ""}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
    </section>
  );
};

export default LivePanel;
