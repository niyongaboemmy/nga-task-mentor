import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle, Clock3, Download, Eye, FileText, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../../contexts/AuthContext";
import ReportCardPreview from "../../ReportCard/ReportCardPreview";
import AnnualReportCardPreview from "../../ReportCard/AnnualReportCardPreview";
import { ReportCardApiService } from "../../../services/reportCardApi";

const periodField = (p: unknown, key: string): string | number | undefined =>
  p && typeof p === "object" && key in p ? ((p as Record<string, unknown>)[key] as string | number) : undefined;

/**
 * The student's term report card: whether it's published, view, PDF and the
 * annual summary. Availability is checked up front so the buttons never look
 * clickable and then fail.
 */
const ReportCardPanel: React.FC = () => {
  const { user } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  const [showAnnual, setShowAnnual] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [available, setAvailable] = useState<"checking" | "yes" | "no">("checking");
  const [reportCardId, setReportCardId] = useState<number | null>(null);

  const term = periodField(user?.currentAcademicTerm, "name") as string | undefined;
  const year = periodField(user?.currentAcademicYear, "name") as string | undefined;
  const studentId = user?.id ? parseInt(String(user.id), 10) : null;
  const studentName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setAvailable("checking");
    ReportCardApiService.getStudentReportCard(studentId, { term, academic_year: year })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.report_card) {
          setReportCardId(res.data.report_card.id);
          setAvailable("yes");
        } else setAvailable("no");
      })
      .catch(() => !cancelled && setAvailable("no"));
    return () => {
      cancelled = true;
    };
  }, [studentId, term, year]);

  const download = useCallback(async () => {
    if (!reportCardId) return;
    setDownloading(true);
    try {
      const blob = await ReportCardApiService.generatePdf(reportCardId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ReportCard-${studentName.replace(/\s+/g, "_")}-${term ?? "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not generate the PDF. Please try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }, [reportCardId, studentName, term]);

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-indigo-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Term report card</p>
            {available === "yes" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="w-3 h-3" /> Ready
              </span>
            )}
            {available === "no" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                <Clock3 className="w-3 h-3" /> Not yet published
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {term ?? "—"} · {year ?? "—"}
          </p>
        </div>
      </div>

      {available === "no" ? (
        <p className="mt-3 text-xs text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
          Your class teacher hasn't published this term's report card yet. It will appear here as soon as it is.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={available !== "yes"}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {available === "checking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            View
          </button>
          <button
            type="button"
            onClick={download}
            disabled={available !== "yes" || downloading}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Generating…" : "Download PDF"}
          </button>
        </div>
      )}
      {year && (
        <button
          type="button"
          onClick={() => setShowAnnual(true)}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 text-sm font-medium"
        >
          <GraduationCap className="w-4 h-4" /> Annual summary
        </button>
      )}

      {showPreview && studentId && (
        <ReportCardPreview
          studentId={studentId}
          studentName={studentName}
          term={term}
          academicYear={year}
          onClose={() => setShowPreview(false)}
        />
      )}
      {showAnnual && studentId && year && (
        <AnnualReportCardPreview
          isOpen={showAnnual}
          onClose={() => setShowAnnual(false)}
          studentId={studentId}
          studentName={studentName}
          academicYear={year}
          academicYearId={periodField(user?.currentAcademicYear, "academic_year_id") as number | undefined}
        />
      )}
    </div>
  );
};

export default ReportCardPanel;
