import React, { useEffect, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { getAcademicTerms, getAcademicYears } from "../../services/authService";
import type { AcademicTerm, AcademicYear } from "../../types/user.types";

export interface SelectedPeriod {
  academicYearId: number;
  academicTermId: number;
  yearName: string;
  termName: string;
}

interface AcademicPeriodPickerProps {
  /** Called with null when the user picks "Current Term". */
  onChange: (period: SelectedPeriod | null) => void;
  className?: string;
}

/**
 * A page-scoped year/term selector for viewing historical data (e.g. a past
 * academic year's course roster or marks) without changing the requester's
 * session-wide current period (that's what AcademicPeriodSwitcher in the nav
 * does, via switchAcademicPeriod). Reuses the same getAcademicYears/
 * getAcademicTerms calls that switcher uses.
 */
const AcademicPeriodPicker: React.FC<AcademicPeriodPickerProps> = ({
  onChange,
  className = "",
}) => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<number | "">("");
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<number | "">("");

  useEffect(() => {
    setLoadingYears(true);
    getAcademicYears()
      .then((data) => {
        const sorted = [...data].sort((a, b) =>
          b.start_date.localeCompare(a.start_date),
        );
        setYears(sorted);
      })
      .catch((err) => console.error("Failed to load academic years:", err))
      .finally(() => setLoadingYears(false));
  }, []);

  const handleYearChange = (value: string) => {
    setSelectedTermId("");
    setTerms([]);
    if (value === "") {
      setSelectedYearId("");
      onChange(null);
      return;
    }
    const yearId = Number(value);
    setSelectedYearId(yearId);
    setLoadingTerms(true);
    getAcademicTerms(yearId)
      .then(setTerms)
      .catch((err) => console.error("Failed to load academic terms:", err))
      .finally(() => setLoadingTerms(false));
  };

  const handleTermChange = (value: string) => {
    if (value === "" || selectedYearId === "") {
      setSelectedTermId("");
      onChange(null);
      return;
    }
    const termId = Number(value);
    setSelectedTermId(termId);
    const year = years.find((y) => y.academic_year_id === selectedYearId);
    const term = terms.find((t) => t.academic_term_id === termId);
    if (year && term) {
      onChange({
        academicYearId: year.academic_year_id,
        academicTermId: term.academic_term_id,
        yearName: year.name,
        termName: term.name,
      });
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <select
        value={selectedYearId}
        onChange={(e) => handleYearChange(e.target.value)}
        disabled={loadingYears}
        className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <option value="">Current Term</option>
        {years.map((y) => (
          <option key={y.academic_year_id} value={y.academic_year_id}>
            {y.name}
          </option>
        ))}
      </select>
      {selectedYearId !== "" && (
        <select
          value={selectedTermId}
          onChange={(e) => handleTermChange(e.target.value)}
          disabled={loadingTerms}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Select term...</option>
          {terms.map((t) => (
            <option key={t.academic_term_id} value={t.academic_term_id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      {loadingTerms && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
    </div>
  );
};

export default AcademicPeriodPicker;
