import React from "react";
import { CheckCircle2, Cloud, GitBranch, GraduationCap, Link2, Loader2, Lock, WifiOff } from "lucide-react";
import type { LinkStatus, ProjectAssignment, ProjectKind, SyncState } from "../../services/projectsApi";
import type { LiveStatus } from "../../hooks/useEventSource";
import { initials, languageMeta, syncMeta, TONE_CLASSES, type Tone } from "./projectFormat";

/** Small rounded label used across the Projects pages. */
export const Pill: React.FC<{
  tone?: Tone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
  testId?: string;
}> = ({ tone = "slate", icon, children, className = "", title, testId }) => (
  <span
    title={title}
    data-testid={testId}
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONE_CLASSES[tone]} ${className}`}
  >
    {icon}
    {children}
  </span>
);

export const LanguageBadge: React.FC<{ language?: string | null }> = ({ language }) => {
  const meta = languageMeta(language);
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">
      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

export const KindBadge: React.FC<{ kind: ProjectKind }> = ({ kind }) =>
  kind === "github" ? (
    <Pill tone="slate" icon={<GitBranch className="h-3 w-3" aria-hidden="true" />} testId="kind-badge">
      GitHub
    </Pill>
  ) : (
    <Pill tone="sky" icon={<Cloud className="h-3 w-3" aria-hidden="true" />} testId="kind-badge">
      Task Mentor
    </Pill>
  );

/** "Practical" / "Case study" on a student's assignment workspace (lock when completed). */
export const AssignmentBadge: React.FC<{ assignment: ProjectAssignment; withTitle?: boolean }> = ({ assignment, withTitle = false }) => {
  const kind = assignment.kind === "case_study" ? "Case study" : assignment.kind === "practical" ? "Practical" : "Assignment";
  const closed = assignment.status === "completed";
  return (
    <Pill
      tone={closed ? "slate" : "violet"}
      icon={closed ? <Lock className="h-3 w-3" aria-hidden="true" /> : <GraduationCap className="h-3 w-3" aria-hidden="true" />}
      title={`${kind}: ${assignment.title}${closed ? " (completed, read-only)" : ""}`}
      testId="assignment-badge"
      className="max-w-full"
    >
      <span className="truncate">{withTitle ? `${kind} · ${assignment.title}` : kind}</span>
    </Pill>
  );
};

/** Green pulsing dot while the project is open in TMCode somewhere. */
export const LiveDot: React.FC<{ live: boolean; className?: string; label?: string }> = ({
  live,
  className = "",
  label,
}) => (
  <span
    className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`}
    role="img"
    aria-label={label ?? (live ? "Open in TMCode now" : "Not open in TMCode")}
    title={label ?? (live ? "Open in TMCode now" : "Not open in TMCode")}
  >
    {live && (
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
    )}
    <span
      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
        live ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
      }`}
    />
  </span>
);

export const SyncBadge: React.FC<{ sync?: SyncState | null }> = ({ sync }) => {
  const meta = syncMeta(sync);
  if (!meta) return null;
  return (
    <Pill tone={meta.tone} testId="sync-badge">
      {sync === "saving" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {meta.label}
    </Pill>
  );
};

export const LinkStatusBadge: React.FC<{
  status: LinkStatus;
  revisionNumber?: number | null;
  gitCommit?: string | null;
}> = ({ status, revisionNumber, gitCommit }) =>
  status === "submitted" ? (
    <Pill tone="emerald" icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />} testId="link-status">
      Submitted
      {revisionNumber ? ` · rev ${revisionNumber}` : gitCommit ? ` · ${gitCommit.slice(0, 7)}` : ""}
    </Pill>
  ) : (
    <Pill tone="blue" icon={<Link2 className="h-3 w-3" aria-hidden="true" />} testId="link-status">
      Linked
    </Pill>
  );

const LIVE_META: Record<LiveStatus, { label: string; tone: Tone }> = {
  idle: { label: "Not connected", tone: "slate" },
  connecting: { label: "Connecting…", tone: "slate" },
  live: { label: "Live", tone: "emerald" },
  reconnecting: { label: "Reconnecting…", tone: "amber" },
  offline: { label: "Offline", tone: "rose" },
};

/** State of an SSE stream: "Live" with a pulse, or "Reconnecting…". */
export const LiveIndicator: React.FC<{ status: LiveStatus; onRetry?: () => void }> = ({ status, onRetry }) => {
  const meta = LIVE_META[status];
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite" data-testid="live-indicator">
      <Pill tone={meta.tone}>
        {status === "live" ? (
          <LiveDot live className="mr-0.5 !h-2 !w-2" label="Live updates on" />
        ) : status === "offline" ? (
          <WifiOff className="h-3 w-3" aria-hidden="true" />
        ) : status === "idle" ? null : (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        )}
        {meta.label}
      </Pill>
      {onRetry && (status === "reconnecting" || status === "offline") && (
        <button
          type="button"
          onClick={onRetry}
          className="text-[11px] font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Retry now
        </button>
      )}
    </span>
  );
};

export const Avatar: React.FC<{ name: string; src?: string | null; size?: "sm" | "md" }> = ({
  name,
  src,
  size = "sm",
}) => {
  const cls = size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs";
  return src ? (
    <img src={src} alt="" className={`${cls} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`}
    >
      {initials(name)}
    </span>
  );
};
