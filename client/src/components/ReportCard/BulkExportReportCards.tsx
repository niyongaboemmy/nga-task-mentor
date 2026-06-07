import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Loader2,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CourseApiService } from "../../services/courseApi";
import { ReportCardApiService } from "../../services/reportCardApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: number;
  title: string;
  code: string;
}

interface StudentItem {
  id: number;
  first_name: string;
  last_name: string;
}

type ExportStatus = "idle" | "pending" | "done" | "error";

interface ExportRow {
  student: StudentItem;
  status: ExportStatus;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchCourseStudents(courseId: number): Promise<StudentItem[]> {
  const res = await CourseApiService.getCourseStudents(courseId);
  return res.data as StudentItem[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, error }: { status: ExportStatus; error?: string }) {
  switch (status) {
    case "pending":
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Generating…
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Downloaded
        </span>
      );
    case "error":
      return (
        <span
          className="flex items-center gap-1.5 text-xs text-red-500 font-semibold"
          title={error}
        >
          <XCircle className="w-3.5 h-3.5" />
          Failed
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          Queued
        </span>
      );
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BulkExportReportCards() {
  const [courses, setCourses]           = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");
  const [term, setTerm]                 = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [students, setStudents]         = useState<StudentItem[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [rows, setRows]                 = useState<ExportRow[]>([]);
  const [isExporting, setIsExporting]   = useState(false);

  // Load courses on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await CourseApiService.getCourses();
        setCourses(res.data as Course[]);
      } catch {
        /* ignore */
      } finally {
        setCoursesLoading(false);
      }
    })();
  }, []);

  // Load students when course changes
  useEffect(() => {
    if (!selectedCourseId) {
      setStudents([]);
      setRows([]);
      return;
    }
    setStudentsLoading(true);
    fetchCourseStudents(Number(selectedCourseId))
      .then((list) => {
        setStudents(list);
        setRows(list.map((s) => ({ student: s, status: "idle" })));
      })
      .catch(() => {
        setStudents([]);
        setRows([]);
      })
      .finally(() => setStudentsLoading(false));
  }, [selectedCourseId]);

  const updateRow = useCallback(
    (studentId: number, patch: Partial<Omit<ExportRow, "student">>) => {
      setRows((prev) =>
        prev.map((r) => (r.student.id === studentId ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const exportSingleStudent = async (student: StudentItem): Promise<void> => {
    updateRow(student.id, { status: "pending", error: undefined });
    try {
      const res = await ReportCardApiService.getStudentReportCard(student.id, {
        term: term || undefined,
        academic_year: academicYear || undefined,
      });
      if (!res.success) throw new Error("Report card not found");
      const blob = await ReportCardApiService.generatePdf(res.data.report_card.id);
      const filename = `ReportCard-${student.first_name}_${student.last_name}-${res.data.report_card.term}-${res.data.report_card.academic_year}.pdf`;
      triggerBlobDownload(blob, filename);
      updateRow(student.id, { status: "done" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateRow(student.id, { status: "error", error: msg });
    }
  };

  const handleDownloadAll = async () => {
    if (!students.length) return;
    setIsExporting(true);
    // Reset all to idle first
    setRows(students.map((s) => ({ student: s, status: "idle" })));

    for (const student of students) {
      await exportSingleStudent(student);
      // Small delay to avoid hammering the server and allow browser to process downloads
      await new Promise((r) => setTimeout(r, 600));
    }
    setIsExporting(false);
  };

  const handleRetryFailed = async () => {
    const failed = rows.filter((r) => r.status === "error").map((r) => r.student);
    if (!failed.length) return;
    setIsExporting(true);
    for (const student of failed) {
      await exportSingleStudent(student);
      await new Promise((r) => setTimeout(r, 600));
    }
    setIsExporting(false);
  };

  const doneCount  = rows.filter((r) => r.status === "done").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const progress   = rows.length > 0 ? (doneCount / rows.length) * 100 : 0;

  const selectedCourse = courses.find((c) => c.id === Number(selectedCourseId));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white">
            Bulk Export Report Cards
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select a class and term, then download all student PDFs at once.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── Filter Controls ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Course / Class selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Class / Course
            </label>
            {coursesLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <select
                value={selectedCourseId}
                onChange={(e) =>
                  setSelectedCourseId(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={isExporting}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50"
              >
                <option value="">Select a class…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Term */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Term <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. Term 1"
              disabled={isExporting}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50"
            />
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Academic Year <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g. 2025-2026"
              disabled={isExporting}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                disabled:opacity-50"
            />
          </div>
        </div>

        {/* ── Student count & action buttons ── */}
        {selectedCourseId !== "" && (
          <AnimatePresence mode="wait">
            <motion.div
              key={String(selectedCourseId)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                {studentsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <Users className="w-4 h-4 text-indigo-500" />
                )}
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {studentsLoading
                    ? "Loading students…"
                    : `${students.length} student${students.length !== 1 ? "s" : ""} in ${selectedCourse?.code ?? "this class"}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {errorCount > 0 && !isExporting && (
                  <button
                    onClick={handleRetryFailed}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                      border border-red-200 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                      transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry {errorCount} failed
                  </button>
                )}

                <button
                  onClick={handleDownloadAll}
                  disabled={isExporting || studentsLoading || students.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm
                    bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                    hover:from-indigo-500 hover:to-purple-500
                    shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-200 active:scale-95"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExporting ? `Exporting (${doneCount}/${rows.length})…` : "Download All PDFs"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Progress bar ── */}
        {rows.length > 0 && (doneCount > 0 || isExporting) && (
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              <span>
                {doneCount} of {rows.length} exported
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            {errorCount > 0 && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errorCount} student{errorCount !== 1 ? "s" : ""} failed — report card may not exist yet.
              </p>
            )}
          </div>
        )}

        {/* ── Student roster skeleton while loading ── */}
        {studentsLoading && selectedCourseId !== "" && (
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex gap-4">
              {["w-32", "w-16", "w-20"].map((w) => (
                <div key={w} className={`h-3 ${w} rounded bg-gray-200 dark:bg-gray-700 animate-pulse`} />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 dark:border-gray-800/50"
                style={{ background: i % 2 === 0 ? undefined : "rgba(249,250,251,0.5)" }}
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
                <div className="h-3 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="ml-auto h-3 w-8 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* ── Student roster table ── */}
        {rows.length > 0 && !studentsLoading && (
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.student.id}
                    className={`border-b border-gray-50 dark:border-gray-800/50 transition-colors
                      ${row.status === "done" ? "bg-emerald-50/50 dark:bg-emerald-900/5" : ""}
                      ${row.status === "error" ? "bg-red-50/50 dark:bg-red-900/5" : ""}
                      ${i % 2 === 0 && row.status === "idle" ? "bg-white dark:bg-transparent" : ""}
                    `}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                          {row.student.first_name.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {row.student.first_name} {row.student.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      #{row.student.id}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={row.status} error={row.error} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {selectedCourseId === "" && (
          <div className="flex flex-col items-center py-12 text-center">
            <BookOpen className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" />
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
              Select a class above to load students and start exporting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
