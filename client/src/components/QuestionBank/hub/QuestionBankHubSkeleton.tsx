import React from "react";
import { Skeleton, SkeletonText } from "../../ui/Skeleton";

/**
 * Placeholders that mirror the hub's real layout block for block, so the
 * page doesn't jump when the overview arrives.
 */

const CARD =
  "bg-card-light dark:bg-card-dark/30 rounded-2xl border border-gray-200/70 dark:border-border-dark/30 shadow-sm";

/** Fixed pseudo-random heights so the trend placeholder reads as a chart. */
const TREND_HEIGHTS = [18, 30, 22, 45, 28, 60, 38, 52, 74, 90, 48, 66];

const SectionShell: React.FC<{ children: React.ReactNode; className?: string; titleWidth?: string }> = ({
  children,
  className = "",
  titleWidth = "w-40",
}) => (
  <div className={`${CARD} p-5 ${className}`}>
    <div className="mb-5 flex items-center gap-2">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className={`h-4 ${titleWidth}`} />
    </div>
    {children}
  </div>
);

const BarRows: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3">
        <Skeleton className="h-3" style={{ width: `${60 + ((i * 17) % 40)}%` }} />
        <Skeleton className="h-2 rounded-full" style={{ width: `${90 - i * 12}%` }} />
        <Skeleton className="h-3 w-6 justify-self-end" />
      </div>
    ))}
  </div>
);

export const QuestionBankHubSkeleton: React.FC<{ showReport: boolean }> = ({ showReport }) => (
  <div className="space-y-5 animate-fadeIn" aria-busy="true">
    {/* Health + KPIs */}
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,22rem)_1fr]">
      <div className={`${CARD} flex items-center gap-4 p-5`}>
        <Skeleton className="h-[76px] w-[76px] shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <SkeletonText lines={2} />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${CARD} flex items-start gap-3 p-4`}>
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-2.5 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Alerts */}
    <SectionShell titleWidth="w-44">
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200/70 p-3 dark:border-gray-800/60">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5" style={{ width: `${70 - i * 12}%` }} />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="hidden h-7 w-32 rounded-lg sm:block" />
          </div>
        ))}
      </div>
    </SectionShell>

    {/* Subject report */}
    {showReport && (
      <SectionShell titleWidth="w-32">
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_3rem_minmax(0,1.5fr)_repeat(3,3rem)] items-center gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5" style={{ width: `${85 - i * 10}%` }} />
                <Skeleton className="h-2.5 w-16" />
              </div>
              <Skeleton className="h-3.5 w-8 justify-self-end" />
              <Skeleton className="h-2 rounded-full" />
              <Skeleton className="h-3 w-9 justify-self-end" />
              <Skeleton className="h-3 w-9 justify-self-end" />
              <Skeleton className="h-5 w-9 justify-self-end rounded-full" />
            </div>
          ))}
        </div>
      </SectionShell>
    )}

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <SectionShell titleWidth="w-48">
        <div className="flex h-40 items-end gap-1.5">
          {TREND_HEIGHTS.map((h, i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center">
              <Skeleton className="w-full max-w-[28px] rounded-b-none rounded-t" style={{ height: `${h}%` }} />
            </div>
          ))}
        </div>
      </SectionShell>
      <SectionShell titleWidth="w-36">
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3" style={{ width: `${40 + ((i * 13) % 25)}%` }} />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </SectionShell>
      <SectionShell titleWidth="w-44">
        <BarRows rows={6} />
      </SectionShell>
      <SectionShell titleWidth="w-32">
        <BarRows rows={4} />
      </SectionShell>
    </div>
  </div>
);

/** Questions tab before a subject is picked, while subjects load. */
export const SubjectChooserSkeleton: React.FC = () => (
  <div className="animate-fadeIn" aria-busy="true">
    <Skeleton className="mb-3 h-3.5 w-72" />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`${CARD} flex items-center gap-3 p-4`}>
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${80 - (i % 3) * 15}%` }} />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** Rows for the question table (shared by the hub and the subject page). */
export const QuestionRowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="divide-y divide-gray-100 dark:divide-gray-800" aria-busy="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-6 py-5 md:grid-cols-[minmax(0,3fr)_8rem_5rem_6rem_5rem]">
        <div className="space-y-2">
          <Skeleton className="h-3.5" style={{ width: `${92 - ((i * 23) % 35)}%` }} />
          {i % 2 === 0 && <Skeleton className="h-3.5 w-2/5" />}
          <Skeleton className="h-2.5 w-24" />
        </div>
        <div className="hidden space-y-2 md:block">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-14 rounded-xl" />
        </div>
        <Skeleton className="hidden h-6 w-14 justify-self-center rounded-full md:block" />
        <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="hidden h-7 w-7 rounded-lg md:block" />
        </div>
      </div>
    ))}
  </div>
);
