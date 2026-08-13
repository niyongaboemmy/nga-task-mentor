import React, { useCallback, useEffect, useState } from "react";
import { Download, Loader2, AlertTriangle, GraduationCap } from "lucide-react";
import Modal from "../ui/Modal";
import {
  ReportCardApiService,
  scoreToLetterGrade,
  type AnnualReportCardData,
} from "../../services/reportCardApi";

export interface AnnualReportCardPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  academicYear: string;
  /** Needed to resolve the canonical term list for "missing term" flagging — omit if unknown. */
  academicYearId?: number;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/**
 * Read-only, computed-on-demand rollup of every term report card in one
 * academic year. There is no "annual" ReportCard row to build/edit here —
 * this just fetches and displays the average of whichever term cards
 * already exist, matching the backend's GET /report-cards/annual/:studentId.
 */
export default function AnnualReportCardPreview({
  isOpen,
  onClose,
  studentId,
  studentName,
  academicYear,
  academicYearId,
}: AnnualReportCardPreviewProps) {
  const [data, setData] = useState<AnnualReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ReportCardApiService.getAnnualReportCard(studentId, {
        academic_year: academicYear,
        academic_year_id: academicYearId,
      });
      if (res.success) {
        setData(res.data);
      } else {
        setError("Could not load the annual summary.");
      }
    } catch {
      setError(
        "Failed to load the annual summary. The student may not have any report cards yet for this academic year.",
      );
    } finally {
      setLoading(false);
    }
  }, [studentId, academicYear, academicYearId]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await ReportCardApiService.generateAnnualPdf({
        student_id: studentId,
        academic_year: academicYear,
        academic_year_id: academicYearId,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AnnualReport-${studentName.replace(/\s+/g, "_")}-${academicYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const terms = data?.per_term.map((t) => t.term) ?? [];
  const attributeNames = Array.from(
    new Set(data?.per_term.flatMap((t) => t.attributes.map((a) => a.attribute_name)) ?? []),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Annual Summary — ${studentName}`}
      subtitle={academicYear}
      size="xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{error}</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {data.missing_terms.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {data.missing_terms.join(", ")}{" "}
                {data.missing_terms.length === 1 ? "has" : "have"} no report card yet — the
                annual average below reflects only the {terms.length} term(s) completed so far.
              </span>
            </div>
          )}

          {/* Annual grades table */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark mb-3">
              <GraduationCap className="w-4 h-4" /> Annual Academic Performance
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-border-light dark:border-border-dark/30">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-light dark:bg-surface-dark/50 text-text-secondary-light dark:text-text-secondary-dark">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    {terms.map((t) => (
                      <th key={t} className="px-4 py-2.5 font-medium text-center">{t}</th>
                    ))}
                    <th className="px-4 py-2.5 font-medium text-center">Annual</th>
                    <th className="px-4 py-2.5 font-medium text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark/30">
                  {data.annual_grades.length === 0 ? (
                    <tr>
                      <td
                        colSpan={terms.length + 3}
                        className="px-4 py-6 text-center text-text-secondary-light dark:text-text-secondary-dark/70"
                      >
                        No grades recorded yet.
                      </td>
                    </tr>
                  ) : (
                    data.annual_grades.map((g) => {
                      const byTerm = new Map(g.contributing_terms.map((c) => [c.term, c.total_score]));
                      const { letter } = scoreToLetterGrade(g.annual_score);
                      return (
                        <tr key={g.subject_id}>
                          <td className="px-4 py-2.5 text-text-primary-light dark:text-text-primary-dark">
                            {data.subject_names?.[g.subject_id] ?? `Subject #${g.subject_id}`}
                          </td>
                          {terms.map((t) => (
                            <td key={t} className="px-4 py-2.5 text-center text-text-secondary-light dark:text-text-secondary-dark">
                              {byTerm.has(t) ? fmt(byTerm.get(t)!) : "—"}
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-center font-semibold text-text-primary-light dark:text-text-primary-dark">
                            {fmt(g.annual_score)}
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold text-blue-600 dark:text-blue-400">
                            {letter}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance by term */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark mb-3">
              Attendance by Term
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-border-light dark:border-border-dark/30">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-light dark:bg-surface-dark/50 text-text-secondary-light dark:text-text-secondary-dark">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    {terms.map((t) => (
                      <th key={t} className="px-4 py-2.5 font-medium text-center">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark/30">
                  {(["present", "absent", "late"] as const).map((key) => (
                    <tr key={key}>
                      <td className="px-4 py-2.5 capitalize text-text-primary-light dark:text-text-primary-dark">{key}</td>
                      {data.per_term.map((t) => (
                        <td key={t.term} className="px-4 py-2.5 text-center text-text-secondary-light dark:text-text-secondary-dark">
                          {t.attendance[key] ? "Yes" : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Behavioral attributes by term */}
          {attributeNames.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark mb-3">
                Behavioral Attributes by Term
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-border-light dark:border-border-dark/30">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-light dark:bg-surface-dark/50 text-text-secondary-light dark:text-text-secondary-dark">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Attribute</th>
                      {terms.map((t) => (
                        <th key={t} className="px-4 py-2.5 font-medium text-center">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark/30">
                    {attributeNames.map((name) => (
                      <tr key={name}>
                        <td className="px-4 py-2.5 text-text-primary-light dark:text-text-primary-dark">{name}</td>
                        {data.per_term.map((t) => (
                          <td key={t.term} className="px-4 py-2.5 text-center text-text-secondary-light dark:text-text-secondary-dark">
                            {t.attributes.find((a) => a.attribute_name === name)?.rating ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading || data.annual_grades.length === 0}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download Annual PDF
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
