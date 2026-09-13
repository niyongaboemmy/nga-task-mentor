import { Link } from "react-router-dom";
import { ClipboardCheck, ArrowRight } from "lucide-react";

// ─── Course Details → "Report Cards" tab shortcut ─────────────────────────────
// The full report-card workflow (builder, class progress, per-student
// preview/approve) now lives on the Grades → Subject dashboard
// (/grades/subjects/:courseId), reachable from anywhere without going
// through a specific subject's Course Details page. This tab just hands off
// to it, one click away, per the "shortcut from subject details" requirement.

interface CourseReportCardsPanelProps {
  courseId: number;
  courseName: string;
}

export default function CourseReportCardsPanel({ courseId, courseName }: CourseReportCardsPanelProps) {
  return (
    <div className="p-4">
      <Link
        to={`/grades/subjects/${courseId}`}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl
          bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40
          hover:bg-blue-100/70 dark:hover:bg-blue-900/30 transition-colors group"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Manage report cards for {courseName}
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 leading-relaxed max-w-md">
              Build the CW/HW/MD/EOT mapping, track class progress, and preview or approve student
              report cards — all on the Grades dashboard for this subject.
            </p>
          </div>
        </div>
        <span
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
            bg-blue-600 group-hover:bg-blue-700 text-white transition-colors shadow-sm
            whitespace-nowrap flex-shrink-0"
        >
          Open Report Cards <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
    </div>
  );
}
