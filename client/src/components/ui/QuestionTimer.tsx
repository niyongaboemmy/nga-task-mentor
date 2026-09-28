import { useEffect, useRef, useState } from "react";
import { Clock, Pause } from "lucide-react";
import { formatClock, timerTone, type TimerTone } from "../../utils/quizTimer";

interface QuestionTimerProps {
  /** Starting/total seconds. Also the progress-ring denominator unless `totalTime` is given. */
  timeLeft: number;
  /**
   * Controlled mode: remaining seconds owned by the parent. The component
   * then only renders — it never counts down or calls `onTimeout`, so a timer
   * can't fire twice from two places.
   */
  currentTime?: number;
  /** Denominator for the progress ring (defaults to `timeLeft`). */
  totalTime?: number;
  /** Uncontrolled mode only: called once when the internal countdown reaches 0. */
  onTimeout?: () => void;
  /** Freeze the uncontrolled countdown and show a paused state. */
  paused?: boolean;
  /** "quiz" warns earlier (5 min / 1 min) than "question" (60 s / 30 s). */
  variant?: "question" | "quiz";
  /** Short caption, e.g. "Time left" or "Question". */
  label?: string;
  className?: string;
}

const TONE_CLASSES: Record<TimerTone, { pill: string; ring: string }> = {
  normal: {
    pill: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300",
    ring: "text-blue-500",
  },
  warning: {
    pill: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300",
    ring: "text-amber-500",
  },
  critical: {
    pill: "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300 animate-pulse",
    ring: "text-red-500",
  },
};

const RING_R = 9;
const RING_C = 2 * Math.PI * RING_R;

export const QuestionTimer: React.FC<QuestionTimerProps> = ({
  timeLeft: initialTimeLeft,
  currentTime,
  totalTime,
  onTimeout,
  paused = false,
  variant = "question",
  label,
  className = "",
}) => {
  const controlled = currentTime !== undefined;
  const [internal, setInternal] = useState(() =>
    Math.max(0, Math.floor(initialTimeLeft)),
  );

  // Keep the latest callback without restarting the countdown when the
  // parent passes a new function identity each render.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const firedRef = useRef(false);

  // Uncontrolled: restart when the starting value changes.
  useEffect(() => {
    if (controlled) return;
    setInternal(Math.max(0, Math.floor(initialTimeLeft)));
    firedRef.current = false;
  }, [initialTimeLeft, controlled]);

  // Uncontrolled: tick.
  useEffect(() => {
    if (controlled || paused || internal <= 0) return;
    const t = setTimeout(() => setInternal((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [controlled, paused, internal]);

  // Uncontrolled: fire the timeout exactly once, outside any state updater.
  useEffect(() => {
    if (controlled || internal > 0 || firedRef.current) return;
    firedRef.current = true;
    onTimeoutRef.current?.();
  }, [controlled, internal]);

  const remaining = Math.max(0, Math.floor(controlled ? currentTime! : internal));
  const total = Math.max(1, Math.floor(totalTime ?? initialTimeLeft));
  const tone = timerTone(remaining, total, variant);
  const fraction = Math.min(1, remaining / total);
  const toneClasses = TONE_CLASSES[tone];
  const clock = formatClock(remaining);

  return (
    <div
      role="timer"
      aria-label={`${label ?? "Time left"}: ${clock}${paused ? " (paused)" : ""}`}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 shadow-sm transition-colors ${toneClasses.pill} ${className}`}
    >
      <span className="relative inline-flex h-6 w-6 items-center justify-center" aria-hidden>
        <svg viewBox="0 0 24 24" className="absolute inset-0 h-6 w-6 -rotate-90">
          <circle cx="12" cy="12" r={RING_R} fill="none" strokeWidth="3" className="stroke-current opacity-15" />
          <circle
            cx="12"
            cy="12"
            r={RING_R}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className={`stroke-current ${toneClasses.ring} transition-[stroke-dashoffset] duration-1000 ease-linear`}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - fraction)}
          />
        </svg>
        {paused ? <Pause className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      </span>
      <span className="flex flex-col leading-none">
        {label && (
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
            {label}
          </span>
        )}
        <span className="font-mono text-sm font-semibold tabular-nums">{clock}</span>
      </span>
    </div>
  );
};

export default QuestionTimer;
