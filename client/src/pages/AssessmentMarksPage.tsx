import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Loader2,
  Save,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
  type ManualAssessmentScore,
} from "../services/manualAssessmentApi";

interface StudentRow {
  student_id: number;
  name: string;
  reg_number: string;
  score: string;
}

export default function AssessmentMarksPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate         = useNavigate();

  const [assessment, setAssessment]   = useState<ManualAssessment | null>(null);
  const [rows, setRows]               = useState<StudentRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState("");
  const [sortAsc, setSortAsc]         = useState(true);
  const [courseName, setCourseName]   = useState("");

  const id = parseInt(assessmentId ?? "", 10);

  // ── Load assessment + students + scores ───────────────────────────────────
  useEffect(() => {
    if (!id || isNaN(id)) return;

    (async () => {
      setLoading(true);
      try {
        // 1. Fetch all manual assessments for the current course by listing
        //    We fetch the assessment by searching through list endpoint filtered by the known id
        //    Since there is no single GET /manual-assessments/:id we get from scores endpoint
        //    and infer from context. Instead, use list with broad params + client filter.
        //
        //    Practical: we don't have a single-resource endpoint, so we'll get the
        //    assessment's course from the scores endpoint context after fetching scores.
        //    But first we need the course_id to fetch students.
        //
        //    Best path: fetch scores first (which includes manual_assessment_id),
        //    then use a separate call to get the assessment details.
        //    Since we only have list (requiring course_id), we use a workaround:
        //    store assessment details in session or navigate with state.

        // Fallback: get all courses and find which one has this assessment
        const [coursesRes, scoresRes] = await Promise.all([
          CourseApiService.getCourses(),
          ManualAssessmentApiService.getScores(id),
        ]);

        const allCourses = coursesRes.data ?? [];
        const courseIds  = allCourses.map((c) => c.id);

        if (courseIds.length === 0) {
          toast.error("No courses found.");
          setLoading(false);
          return;
        }

        // Fetch assessments across all courses to find this one
        const listRes = await ManualAssessmentApiService.list({
          course_ids: courseIds,
        });

        const found = (listRes.data ?? []).find((a) => a.id === id);
        if (!found) {
          toast.error("Assessment not found.");
          setLoading(false);
          return;
        }

        setAssessment(found);

        const course = allCourses.find((c) => c.id === found.course_id);
        setCourseName(course?.title ?? `Course #${found.course_id}`);

        // Fetch enrolled students
        const studentsRes = await CourseApiService.getCourseStudents(found.course_id);
        const rawStudents: any[] = studentsRes.data ?? [];

        const existingScores: ManualAssessmentScore[] = scoresRes.data ?? [];
        const scoreMap = new Map(existingScores.map((s) => [s.student_id, s.score]));

        const studentRows: StudentRow[] = rawStudents.map((s: any) => {
          const uid  = s.user?.id ?? s.user?.user_id ?? s.student_id ?? s.id ?? 0;
          const fn   = s.profile?.first_name ?? s.user?.first_name ?? s.first_name ?? "";
          const ln   = s.profile?.last_name  ?? s.user?.last_name  ?? s.last_name  ?? "";
          const reg  = s.profile?.registration_number ?? s.user?.registration_number ?? s.reg_number ?? s.registration_number ?? "";
          const existingScore = scoreMap.get(uid);
          return {
            student_id: uid,
            name: `${fn} ${ln}`.trim() || `Student #${uid}`,
            reg_number: reg,
            score: existingScore !== undefined ? String(existingScore) : "",
          };
        });

        setRows(studentRows);
      } catch {
        toast.error("Failed to load assessment data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Score update ──────────────────────────────────────────────────────────
  const updateScore = (studentId: number, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, score: value } : r)),
    );
  };

  // ── Save all scores ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!assessment) return;
    const entries = rows
      .filter((r) => r.score.trim() !== "")
      .map((r) => ({ student_id: r.student_id, score: parseFloat(r.score) }))
      .filter((r) => !isNaN(r.score));

    if (entries.length === 0) {
      toast.info("No scores to save.");
      return;
    }

    const invalid = entries.find((e) => e.score > assessment.max_score);
    if (invalid) {
      toast.error(`Score exceeds maximum (${assessment.max_score}).`);
      return;
    }

    setSaving(true);
    try {
      const res = await ManualAssessmentApiService.upsertScores(assessment.id, { scores: entries });
      if (res.success) {
        toast.success(`Saved scores for ${res.data.saved} student(s).`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to save scores.");
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered + sorted rows ────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.reg_number.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
    return result;
  }, [rows, search, sortAsc]);

  const typeLabel = assessment ? ManualAssessmentApiService.getTypeLabel(assessment) : "—";

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Assessment not found.</p>
        <button
          onClick={() => navigate("/grades")}
          className="mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Back to Grades
        </button>
      </div>
    );
  }

  const filledCount = rows.filter((r) => r.score.trim() !== "").length;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <button
        onClick={() => navigate("/grades")}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Grades
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {ManualAssessmentApiService.getTypeLabel(assessment)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Class name:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{courseName}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {assessment.assessment_date ?? "—"} | {typeLabel}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Type / to search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-52 bg-gray-50 dark:bg-gray-800/50"
            />
          </div>
          <button
            onClick={() => setSortAsc((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: rows.length ? `${(filledCount / rows.length) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{filledCount} / {rows.length} scored</span>
      </div>

      {/* Marks table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-12 px-5 py-4 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">#</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Reg Number</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Score</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Maximum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayRows.map((row, idx) => (
              <tr key={row.student_id} className="hover:bg-gray-50/40 transition-colors">
                <td className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">{idx + 1}</td>
                <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{row.name}</td>
                <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{row.reg_number || "—"}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={assessment.max_score}
                      step="0.01"
                      value={row.score}
                      onChange={(e) => updateScore(row.student_id, e.target.value)}
                      placeholder="—"
                      className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center tabular-nums"
                    />
                    {row.score !== "" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">{assessment.max_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {displayRows.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              {search ? "No students match your search." : "No students enrolled in this course."}
            </p>
          </div>
        )}
      </div>

      {/* Save button */}
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Scores"}
          </button>
        </div>
      )}
    </div>
  );
}
