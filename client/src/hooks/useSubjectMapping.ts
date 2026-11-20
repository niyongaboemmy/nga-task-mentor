import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { ReportCardApiService, type AssessmentCategory, type AssessmentType, type SubjectMappingItem } from "../services/reportCardApi";
import { toBuilderCategory, useReportCardStructure } from "./useReportCardStructure";

/**
 * One subject's report card mapping for the current term (the set the
 * report card builder and the Grades page edit): read it, show where an
 * assessment counts, and change it. Saving replaces the subject's whole set,
 * as the server expects; a failed save puts the previous set back.
 */
export function useSubjectMapping(subjectId: number | null | undefined) {
  const { user } = useAuth();
  const term = user?.currentAcademicTerm?.name ?? "";
  const academicYear = user?.currentAcademicYear?.name ?? "";
  const { builder, structure } = useReportCardStructure();
  const [items, setItems] = useState<SubjectMappingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!subjectId || !term || !academicYear) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await ReportCardApiService.getSubjectMapping({ subject_id: subjectId, term, academic_year: academicYear });
      setItems(res.data.assessments ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [subjectId, term, academicYear]);
  useEffect(() => {
    void load();
  }, [load]);

  /** Where an assessment counts now (a category from the other builder is shown where it counts in this one). */
  const categoryOf = useCallback(
    (kind: AssessmentType, id: number): AssessmentCategory | null => {
      const m = items.find((x) => x.assessment_type === kind && x.assessment_id === id);
      return m ? toBuilderCategory(builder, m.category) : null;
    },
    [items, builder],
  );

  /** Saves a new set; resolves true when saved. */
  const save = useCallback(
    async (next: SubjectMappingItem[]): Promise<boolean> => {
      if (!subjectId || !term || !academicYear) {
        toast.error("There's no current term to map against.");
        return false;
      }
      const previous = items;
      setItems(next);
      setSaving(true);
      try {
        await ReportCardApiService.saveSubjectMapping({ subject_id: subjectId, term, academic_year: academicYear, assessments: next });
        return true;
      } catch (e) {
        setItems(previous);
        toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Couldn't update the report card mapping.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [subjectId, term, academicYear, items],
  );

  const setCategory = useCallback(
    (kind: AssessmentType, id: number, category: AssessmentCategory | null) => {
      const next = items.filter((m) => !(m.assessment_type === kind && m.assessment_id === id));
      if (category) next.push({ assessment_type: kind, assessment_id: id, category });
      return save(next);
    },
    [items, save],
  );

  const labelOf = useCallback((c: AssessmentCategory | null) => (c ? (structure.categories.find((x) => x.key === c)?.label ?? c) : null), [structure]);

  return { items, loading, error, saving, reload: load, categoryOf, setCategory, save, builder, structure, labelOf, term, academicYear };
}
