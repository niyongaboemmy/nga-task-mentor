import React, { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";

// ─── One shared clock ─────────────────────────────────────────────────────────
// Every countdown on a page reads the same 1-second ticker instead of running
// its own interval. It only runs while at least one countdown is mounted.

let nowMs = Date.now();
const listeners = new Set<() => void>();
let timer: number | null = null;

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (timer === null) {
    timer = window.setInterval(() => {
      nowMs = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}
const snapshot = () => nowMs;

/** Current time, re-rendering every second while mounted. */
// eslint-disable-next-line react-refresh/only-export-components
export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "12:05" under an hour (ticking), "3h 12m" under a day, "2d 4h" beyond.
 * Returns null once the target has passed.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function formatRemaining(ms: number): string | null {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (s < 3600) return `${pad(m)}:${pad(s % 60)}`;
  if (d === 0) return `${h}h ${pad(m)}m`;
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export type CountdownTone = "critical" | "warning" | "info" | "neutral";

// eslint-disable-next-line react-refresh/only-export-components
export function toneFor(ms: number, kind: "time_left" | "due" | "opens"): CountdownTone {
  if (kind === "opens") return "info";
  if (ms <= 0) return "neutral";
  if (kind === "time_left") return ms <= 5 * 60 * 1000 ? "critical" : "warning";
  if (ms <= 24 * 3600 * 1000) return "critical";
  if (ms <= 3 * 24 * 3600 * 1000) return "warning";
  return "neutral";
}

const TONE: Record<CountdownTone, string> = {
  critical: "bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300",
};

const PREFIX = { time_left: "", due: "Due in ", opens: "Opens in " } as const;
const SUFFIX = { time_left: " left", due: "", opens: "" } as const;
const PASSED = { time_left: "Time's up", due: "Closed", opens: "Open now" } as const;

/**
 * A live countdown chip: "Due in 3h 12m", "Opens in 2d 4h", "12:05 left".
 * Colour tracks urgency; the text always says what the time means, so colour
 * never carries the meaning alone.
 */
export const LiveCountdown: React.FC<{
  to: string;
  kind: "time_left" | "due" | "opens";
  className?: string;
  compact?: boolean;
}> = ({ to, kind, className = "", compact = false }) => {
  const now = useNow();
  const target = new Date(to).getTime();
  const left = target - now;
  const text = formatRemaining(left);
  const tone = toneFor(left, kind);
  const exact = new Date(to).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span
      title={`${kind === "opens" ? "Opens" : kind === "due" ? "Due" : "Ends"} ${exact}`}
      role="timer"
      aria-live={kind === "time_left" && left < 5 * 60 * 1000 ? "polite" : "off"}
      className={`inline-flex items-center gap-1 rounded-full font-medium tabular-nums whitespace-nowrap ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${TONE[tone]} ${className}`}
    >
      <Clock className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden />
      {text ? `${PREFIX[kind]}${text}${SUFFIX[kind]}` : PASSED[kind]}
    </span>
  );
};

export default LiveCountdown;
