import React from "react";
import { motion } from "framer-motion";

interface ScoreRingProps {
  /** Earned points; null/undefined renders the "not graded" state. */
  value: number | null | undefined;
  max: number;
  /** Outer diameter in px. */
  size?: number;
  strokeWidth?: number;
  /** Small caption under the percentage, e.g. "of 10". */
  caption?: string;
  className?: string;
}

/**
 * Circular score indicator. The track is drawn in a visible neutral so the
 * ring reads as a ring even at 0%, and an ungraded score shows a dashed track
 * with "—" rather than a misleading 0%.
 */
const ScoreRing: React.FC<ScoreRingProps> = ({
  value,
  max,
  size = 112,
  strokeWidth = 10,
  caption,
  className = "",
}) => {
  const graded = value !== null && value !== undefined && !Number.isNaN(value);
  const ratio = graded && max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const percent = Math.round(ratio * 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const progressColor = !graded
    ? "stroke-transparent"
    : percent >= 80
      ? "stroke-emerald-500"
      : percent >= 50
        ? "stroke-blue-600 dark:stroke-blue-500"
        : "stroke-amber-500";

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={graded ? `${percent}% (${value} of ${max})` : "Not graded yet"}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="-rotate-90 overflow-visible"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={graded ? undefined : "4 6"}
          className="stroke-gray-300 dark:stroke-gray-600"
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={progressColor}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-2xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">
          {graded ? `${percent}%` : "—"}
        </span>
        {(caption || !graded) && (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {graded ? caption : "Not graded"}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScoreRing;
