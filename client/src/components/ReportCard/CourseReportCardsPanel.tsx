import { Link } from "react-router-dom";
import { ClipboardCheck, ChevronRight, CalendarDays } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../contexts/AuthContext";
import SubjectReportCardDashboard from "./SubjectReportCardDashboard";

// ─── Course Details → "Report Cards" tab ──────────────────────────────────────
// Shows the live report-card dashboard for this subject right here (class
// average, progress, roster with preview/approve) — no need to leave Course
// Details to see it. The full drag-drop builder for (re)mapping assessments
// still lives on the Grades → Subject workspace, linked at the top.
//
// The academic period is the one picked in the app bar (AcademicPeriodSwitcher):
// switching it remounts this page, so there is no local term/year picker here
// to drift out of sync with the rest of Course Details.

interface CourseReportCardsPanelProps {
  courseId: number;
  courseName: string;
}

export default function CourseReportCardsPanel({ courseId, courseName }: CourseReportCardsPanelProps) {
  const { can } = usePermissions();
  const isAdmin = can("REPORT_CARDS_APPROVE");
  const { user } = useAuth();
  const academicYear: string = user?.currentAcademicYear?.name ?? "";
  const term: string = user?.currentAcademicTerm?.name ?? "";

  return (
    <div className="p-1 sm:p-4 space-y-5">
      {/* Manage shortcut + the period in view */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 break-words">
              Report card dashboard — {courseName}
            </p>
            <Link
              to={`/grades/subjects/${courseId}`}
              className="text-xs text-blue-500 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Open Report Card Builder <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        {term && academicYear && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-white/5 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300"
            title="Change the period from the academic year/term switcher in the top bar"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {academicYear} · {term}
          </span>
        )}
      </div>

      {term && academicYear ? (
        <SubjectReportCardDashboard
          courseId={courseId}
          term={term}
          academicYear={academicYear}
          isAdmin={isAdmin}
        />
      ) : (
        <div className="text-center py-10 text-sm text-text-secondary-light dark:text-text-secondary-dark/60">
          No academic term is selected. Pick one from the switcher in the top bar.
        </div>
      )}
    </div>
  );
}
