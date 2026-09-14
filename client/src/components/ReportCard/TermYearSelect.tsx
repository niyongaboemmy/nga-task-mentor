import { Calendar } from "lucide-react";
import type { AcademicYear, AcademicTerm } from "../../types/user.types";

export interface TermYearSelectProps {
  years: AcademicYear[];
  terms: AcademicTerm[];
  academicYear: string;
  term: string;
  onAcademicYearChange: (name: string) => void;
  onTermChange: (name: string) => void;
  disabled?: boolean;
}

const selectClass =
  "border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-text-primary-light dark:text-text-primary-dark bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50";

// Two dropdowns backed by useTermYearSelector — replaces the old free-text
// term/year inputs (no validation, easy to typo) that CourseReportCardsPanel
// used to have.
export default function TermYearSelect({
  years,
  terms,
  academicYear,
  term,
  onAcademicYearChange,
  onTermChange,
  disabled,
}: TermYearSelectProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60 flex-shrink-0" />
      <select
        value={academicYear}
        onChange={(e) => onAcademicYearChange(e.target.value)}
        disabled={disabled || years.length === 0}
        className={selectClass}
        aria-label="Academic year"
      >
        {years.length === 0 && <option value="">—</option>}
        {years.map((y) => (
          <option key={y.academic_year_id} value={y.name}>
            {y.name}
          </option>
        ))}
      </select>
      <select
        value={term}
        onChange={(e) => onTermChange(e.target.value)}
        disabled={disabled || terms.length === 0}
        className={selectClass}
        aria-label="Term"
      >
        {terms.length === 0 && <option value="">—</option>}
        {terms.map((t) => (
          <option key={t.academic_term_id} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
