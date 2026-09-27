import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Award, BookOpen, Mail, Trophy, UserPlus } from "lucide-react";
import { getProfileImageUrl } from "../../../utils/imageUrl";
import type { UserFullData } from "../../../types/user.types";
import type { StandingResult } from "../../../services/studentStandingApi";
import { Pct } from "./profileParts";

// ─── Student profile header ───────────────────────────────────────────────────
// One compact row: identity on the left, the three numbers a teacher opens this
// page for (average, class rank, what needs attention) and the actions on the
// right. The per-kind counts that used to sit here live on the tab bar.

interface Props {
  student: UserFullData;
  fullName: string;
  average: number | null;
  standing: StandingResult | null;
  standingLoading: boolean;
  attentionCount: number;
  subjectCount: number;
  period: string | null;
  canEnroll: boolean;
  canViewReportCards: boolean;
  onEnroll: () => void;
  onReportCard: () => void;
  onAttention: () => void;
}

export default function StudentProfileHeader({
  student,
  fullName,
  average,
  standing,
  standingLoading,
  attentionCount,
  subjectCount,
  period,
  canEnroll,
  canViewReportCards,
  onEnroll,
  onReportCard,
  onAttention,
}: Props) {
  const initials =
    `${student.profile?.first_name?.[0] ?? student.user?.first_name?.[0] ?? "U"}${
      student.profile?.last_name?.[0] ?? student.user?.last_name?.[0] ?? ""
    }`.toUpperCase();
  const image = student.user?.profile_image ? getProfileImageUrl(student.user.profile_image) : null;

  return (
    <header className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Link
            to="/students"
            aria-label="Back to Students"
            title="Back to Students"
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {image ? (
            <img src={image} alt={fullName} className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg sm:text-xl">{initials}</span>
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark truncate">
              {fullName || "Unnamed student"}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-secondary-light dark:text-text-secondary-dark/80">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{student.user?.email || "No email"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {subjectCount} subject{subjectCount === 1 ? "" : "s"}
              </span>
              {period && <span className="hidden sm:inline">{period}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <dl className="flex items-stretch divide-x divide-gray-200 dark:divide-gray-800 rounded-xl bg-gray-50 dark:bg-white/5">
            <div className="px-3 sm:px-4 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                Average
              </dt>
              <dd className="text-base sm:text-lg font-bold" data-testid="header-average">
                <Pct value={average} />
              </dd>
            </div>
            <div className="px-3 sm:px-4 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                Class rank
              </dt>
              <dd className="text-base sm:text-lg font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums flex items-center gap-1">
                {standingLoading ? (
                  <span className="inline-block w-10 h-4 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                ) : standing?.rank ? (
                  <>
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    {standing.rank}
                    <span className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark/60">
                      /{standing.rankedCount}
                    </span>
                  </>
                ) : (
                  <span className="text-text-secondary-light dark:text-text-secondary-dark/50">—</span>
                )}
              </dd>
            </div>
            <button
              type="button"
              onClick={onAttention}
              disabled={attentionCount === 0}
              className="px-3 sm:px-4 py-2 text-left rounded-r-xl enabled:hover:bg-gray-100 dark:enabled:hover:bg-white/10 transition-colors"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                Attention
              </span>
              <span
                className={`flex items-center gap-1 text-base sm:text-lg font-bold tabular-nums ${
                  attentionCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {attentionCount > 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                {attentionCount > 0 ? attentionCount : "None"}
              </span>
            </button>
          </dl>

          <div className="flex items-center gap-2">
            {canEnroll && (
              <button
                type="button"
                onClick={onEnroll}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Enroll
              </button>
            )}
            {canViewReportCards && (
              <button
                type="button"
                onClick={onReportCard}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-sm font-semibold transition-colors"
              >
                <Award className="w-4 h-4" /> Report card
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
