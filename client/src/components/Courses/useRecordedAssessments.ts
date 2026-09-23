import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSubjectReport,
  fetchSubjectGrades,
  type AssessmentStat,
  type SubjectReport,
} from "../../services/subjectReportApi";

// Loading the recorded marks for one subject. Kept out of the panel so the
// course page can hold the state (and show the count on the tab label) without
// the tab having been opened — and so the panel file exports components only,
// which React Fast Refresh requires.

export interface RecordedAssessmentsState {
  report: SubjectReport | null;
  recorded: AssessmentStat[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  reload: () => void;
}

export function useRecordedAssessments(courseId?: string): RecordedAssessmentsState {
  const [report, setReport] = useState<SubjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!courseId) return;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        setReport(buildSubjectReport(await fetchSubjectGrades(courseId)));
      } catch {
        setError("Could not load recorded marks for this subject.");
        setReport(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [courseId],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const recorded = useMemo(
    () => (report?.assessments ?? []).filter((a) => a.kind === "manual"),
    [report],
  );

  return {
    report,
    recorded,
    loading,
    refreshing,
    error,
    reload: () => load("refresh"),
  };
}
