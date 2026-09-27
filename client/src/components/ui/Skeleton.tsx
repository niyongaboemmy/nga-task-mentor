import React from "react";

/**
 * Loading placeholders shared by pages that wait on the API.
 *
 * `Skeleton` is a neutral block with a soft sheen sweeping across it (the
 * sheen is dropped for users who prefer reduced motion). Shape it with
 * `className` (size, rounding) so the placeholder mirrors the real layout,
 * which avoids a jump when the content arrives.
 */
export const Skeleton: React.FC<{
  className?: string;
  style?: React.CSSProperties;
  /** Sit inside a line of text (inline-block) instead of as a block. */
  inline?: boolean;
}> = ({ className = "", style, inline = false }) => (
  // A <span> so it is valid anywhere, including inside text and headings.
  <span
    aria-hidden="true"
    style={style}
    className={`${inline ? "inline-block align-middle" : "block"} relative overflow-hidden ${
      // Only default the radius, so a passed rounded-* (e.g. a circle) can't lose to it.
      /\brounded(-|\b)/.test(className) ? "" : "rounded-md"
    } bg-gray-200/80 dark:bg-white/[0.06] ${className}`}
  >
    <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/[0.07] motion-reduce:hidden" />
  </span>
);

/** A few lines of placeholder text; the last line is shorter, like a paragraph. */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 2, className = "" }) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`} />
    ))}
  </div>
);

/**
 * Thin indeterminate bar for "refreshing what's already on screen": the
 * content stays readable while the bar signals that newer data is coming.
 * Always rendered (keeps height stable); visible only while `active`.
 */
export const TopProgressBar: React.FC<{ active: boolean; className?: string; label?: string }> = ({
  active,
  className = "",
  label = "Loading",
}) => (
  <div
    className={`relative h-0.5 w-full overflow-hidden rounded-full transition-opacity duration-300 ${
      active ? "opacity-100" : "opacity-0"
    } ${className}`}
    role={active ? "progressbar" : undefined}
    aria-label={active ? label : undefined}
    aria-hidden={!active}
  >
    <div className="absolute inset-0 bg-blue-500/15" />
    <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 animate-indeterminate motion-reduce:w-full motion-reduce:animate-pulse" />
  </div>
);

/** Screen-reader-only live announcement for loading state changes. */
export const LoadingAnnouncer: React.FC<{ loading: boolean; message: string }> = ({ loading, message }) => (
  <span className="sr-only" role="status" aria-live="polite">
    {loading ? message : ""}
  </span>
);

export default Skeleton;
