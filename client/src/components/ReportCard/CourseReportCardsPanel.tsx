import { Link } from "react-router-dom";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { useTermYearSelector } from "../../hooks/useTermYearSelector";
import TermYearSelect from "./TermYearSelect";
import SubjectReportCardDashboard from "./SubjectReportCardDashboard";

// ─── Course Details → "Report Cards" tab ──────────────────────────────────────
// Shows the live report-card dashboard for this subject right here (class
// average, progress, roster with preview/approve) — no need to leave Course
// Details to see it. The full drag-drop builder for (re)mapping assessments
// still lives on the Grades → Subject workspace, linked at the top.

interface CourseReportCardsPanelProps {
  courseId: number;
  courseName: string;
}

export default function CourseReportCardsPanel({ courseId, courseName }: CourseReportCardsPanelProps) {
  const { can } = usePermissions();
  const isAdmin = can("REPORT_CARDS_APPROVE");
  const {
    years, terms, academicYear, term,
    setAcademicYear, setTerm,
  } = useTermYearSelector();

  return (
    <div className="p-4 space-y-5">
      {/* Manage shortcut + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
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
        <TermYearSelect
          years={years}
          terms={terms}
          academicYear={academicYear}
          term={term}
          onAcademicYearChange={setAcademicYear}
          onTermChange={setTerm}
        />
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
          Loading academic periods…
        </div>
      )}
    </div>
  );
}
