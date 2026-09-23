import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { bandMeta, type BandKey } from "../../services/subjectReportApi";
import { itemVariants } from "./reportMotion";

// ─── Grade-report building blocks ─────────────────────────────────────────────
// Shared by the subject assessment report (/grades/subjects/:id/report) and the
// course report (/courses/:id/reports) so the two read as one product: same
// surfaces (card/surface/border tokens — never raw gray-800/900, which sits
// lighter than the rest of the dark theme), same motion, same KPI anatomy.

/** Counts from the previous value to the new one — makes a re-fetch visible. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const duration = 650;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round((from + (value - from) * eased) * 10) / 10);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="tabular-nums">
      {Number.isInteger(value) ? Math.round(shown) : shown}
      {suffix}
    </span>
  );
}

/** A KPI tile. With `onClick` it becomes a real filter toggle, not a readout. */
export function KpiCard({
  icon,
  label,
  value,
  suffix,
  caption,
  accent,
  progress,
  progressColor = "bg-blue-600",
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  caption: string;
  accent: string;
  progress?: number;
  progressColor?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Wrapper = onClick ? motion.button : motion.div;
  return (
    <Wrapper
      variants={itemVariants}
      {...(onClick ? { onClick, type: "button" as const, "aria-pressed": active } : {})}
      whileHover={onClick ? { y: -3 } : undefined}
      className={`text-left bg-card-light dark:bg-card-dark/30 rounded-2xl border p-4 sm:p-5 transition-colors ${
        active
          ? "border-blue-500/60 ring-2 ring-blue-500/20"
          : "border-white dark:border-border-dark/30"
      } ${onClick ? "hover:border-blue-400/50 cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
          {icon}
        </span>
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60">
          {label}
        </span>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
        <CountUp value={value} suffix={suffix} />
      </p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${progressColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
      <p className="mt-2 text-[11px] sm:text-xs text-text-secondary-light dark:text-text-secondary-dark/60 leading-relaxed">
        {caption}
      </p>
    </Wrapper>
  );
}

export function Panel({
  title,
  icon,
  hint,
  action,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={itemVariants}
      className={`bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-4 sm:p-5 ${className}`}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
              {title}
            </h2>
            {hint && (
              <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                {hint}
              </p>
            )}
          </div>
        </div>
        {action}
      </header>
      {children}
    </motion.section>
  );
}

/** A marks-recorded bar — green only once every student has a mark. */
export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark/70 w-12 text-right">
        {done}/{total}
      </span>
    </div>
  );
}

/** Band identity is never color-alone — the label always rides along. */
export function BandPill({ band }: { band: BandKey }) {
  const meta = bandMeta(band);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Loading placeholder that keeps the page's shape instead of a bare spinner. */
export function ReportSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading report">
      <div className="h-24 rounded-2xl bg-card-light dark:bg-card-dark/30" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-card-light dark:bg-card-dark/30" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-card-light dark:bg-card-dark/30" />
        <div className="h-72 rounded-2xl bg-card-light dark:bg-card-dark/30" />
      </div>
    </div>
  );
}
