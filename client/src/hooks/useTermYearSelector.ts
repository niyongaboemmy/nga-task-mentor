import { useState, useEffect, useCallback } from "react";
import { getAcademicYears, getAcademicTerms } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";
import type { AcademicYear, AcademicTerm } from "../types/user.types";

export interface TermYearSelection {
  term: string;
  academicYear: string;
  academicTermId: number | undefined;
  academicYearId: number | undefined;
}

// Centralizes the "resolve academic_term_id/academic_year_id from the
// term/year NAME strings" dance that ReportCardBuilderPage/SubjectGradesPage
// each used to duplicate inline — quizzes/assignments/report-card endpoints
// scope by id and otherwise silently default to the caller's session-current
// term, so anything letting the user pick a *different* period needs the ids.
export function useTermYearSelector() {
  const { user } = useAuth();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);

  const [academicYear, setAcademicYear] = useState(
    user?.currentAcademicYear?.name ?? "",
  );
  const [term, setTerm] = useState(user?.currentAcademicTerm?.name ?? "");

  const selectedYear = years.find((y) => y.name === academicYear);
  const selectedTerm = terms.find((t) => t.name === term);

  // Load the year list once.
  useEffect(() => {
    (async () => {
      try {
        const list = await getAcademicYears();
        setYears(list);
        if (!academicYear) {
          const current = list.find((y) => y.is_current) ?? list[0];
          if (current) setAcademicYear(current.name);
        }
      } catch {
        // best-effort — callers fall back to the session-current period
      } finally {
        setLoading(false);
      }
    })();
    // Intentionally mount-once: `academicYear` is only ever set here as an
    // initial default, so re-running this on every subsequent change would
    // fight the user's own selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload terms whenever the selected year changes.
  useEffect(() => {
    if (!selectedYear) return;
    (async () => {
      try {
        const list = await getAcademicTerms(selectedYear.academic_year_id);
        setTerms(list);
        if (!list.some((t) => t.name === term)) {
          const current = list.find((t) => t.is_current) ?? list[0];
          if (current) setTerm(current.name);
        }
      } catch {
        // best-effort
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear?.academic_year_id]);

  const setAcademicYearByName = useCallback((name: string) => {
    setAcademicYear(name);
    setTerm(""); // force re-resolution against the new year's term list
  }, []);

  return {
    years,
    terms,
    loading,
    academicYear,
    term,
    academicYearId: selectedYear?.academic_year_id,
    academicTermId: selectedTerm?.academic_term_id,
    setAcademicYear: setAcademicYearByName,
    setTerm,
  };
}
