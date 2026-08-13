import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  CheckCircle2,
  Eye,
  ThumbsUp,
  AlertCircle,
  Loader2,
  RotateCcw,
  FileText,
  Users,
  BookOpen,
  ChevronRight,
  Info,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  ReportCardApiService,
  STATUS_META,
  type ReportCardStatus,
  type StudentReportCardStatus,
} from "../../services/reportCardApi";
import ReportCardPreview from "./ReportCardPreview";
import AnnualReportCardPreview from "./AnnualReportCardPreview";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrolledStudent {
  id: number;
  name: string;
}

interface CourseReportCardsPanelProps {
  courseId: number;
  courseName: string;
  students: EnrolledStudent[];
  currentTerm?: string;
  currentYear?: string;
  isAdmin: boolean;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReportCardStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        bg-gray-100 dark:bg-gray-800/80 text-text-secondary-light dark:text-text-secondary-dark/60 border border-gray-200 dark:border-gray-700/60">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        Not started
      </span>
    );
  }
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.color} ${m.bg} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${status !== "approved" ? "" : "animate-pulse"}`} />
      {m.label}
    </span>
  );
}

// ─── Progress summary bar ─────────────────────────────────────────────────────

function ProgressSummary({
  total,
  statusMap,
}: {
  total: number;
  statusMap: Map<number, ReportCardStatus | null>;
}) {
  const counts = { notStarted: 0, draft: 0, saved: 0, approved: 0 };
  statusMap.forEach((s) => {
    if (!s) counts.notStarted++;
    else counts[s]++;
  });

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const bars = [
    { label: "Not started", count: counts.notStarted, color: "bg-gray-300 dark:bg-gray-600",       textColor: "text-gray-400" },
    { label: "Draft",       count: counts.draft,       color: "bg-amber-400",                       textColor: "text-amber-500" },
    { label: "Saved",       count: counts.saved,       color: "bg-blue-400",                        textColor: "text-blue-500" },
    { label: "Approved",    count: counts.approved,    color: "bg-emerald-500",                     textColor: "text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          Class Progress — {total} student{total !== 1 ? "s" : ""}
        </h3>
        <span className={`text-xs font-bold ${counts.approved === total && total > 0 ? "text-emerald-500" : "text-text-secondary-light dark:text-text-secondary-dark/60"}`}>
          {counts.approved}/{total} approved
        </span>
      </div>

      {/* Stacked progress bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px bg-gray-100 dark:bg-gray-800">
        {bars.map((b) =>
          b.count > 0 ? (
            <motion.div
              key={b.label}
              className={`${b.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct(b.count)}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              title={`${b.label}: ${b.count}`}
            />
          ) : null,
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {bars.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${b.color}`} />
            {b.label}: <strong className={`${b.textColor} font-semibold`}>{b.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Guided callout ───────────────────────────────────────────────────────────

function WorkflowCallout({ isAdmin }: { isAdmin: boolean }) {
  const steps = isAdmin
    ? [
        { icon: ClipboardList, color: "text-violet-500", bg: "bg-violet-100 dark:bg-violet-900/30", label: "Instructors build", desc: "Each instructor maps their course assessments to CW / HW / MD / EOT for each student" },
        { icon: FileText,      color: "text-blue-500",   bg: "bg-blue-100 dark:bg-blue-900/30",     label: "Class teacher saves", desc: "Class teacher fills attendance, behavior attributes, and marks the card as Saved" },
        { icon: ThumbsUp,      color: "text-emerald-500",bg: "bg-emerald-100 dark:bg-emerald-900/30",label: "Admin approves", desc: "You review and approve — the student can now view and download their report card" },
      ]
    : [
        { icon: ClipboardList, color: "text-violet-500", bg: "bg-violet-100 dark:bg-violet-900/30", label: "You build your subject", desc: "Click Build on any student to map your course assessments to CW / HW / MD / EOT categories" },
        { icon: FileText,      color: "text-blue-500",   bg: "bg-blue-100 dark:bg-blue-900/30",     label: "Other instructors do the same", desc: "Each instructor adds their own subject — all contributions roll into one report card" },
        { icon: ThumbsUp,      color: "text-emerald-500",bg: "bg-emerald-100 dark:bg-emerald-900/30",label: "Class teacher saves, admin approves", desc: "Once all subjects are in, the class teacher saves and an admin approves for student access" },
      ];

  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">How this works</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0 border border-indigo-100 dark:border-indigo-800/40`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 mt-1.5 bg-indigo-200 dark:bg-indigo-800/50 hidden sm:block" />
              )}
            </div>
            <div className="pb-2">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {i + 1}. {s.label}
              </p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Student row (desktop) ────────────────────────────────────────────────────

function StudentDesktopRow({
  student,
  row,
  status,
  loadingOverview,
  isAdmin,
  builderBase,
  term,
  year,
  approvingId,
  revertingId,
  markingCompleteId,
  onPreview,
  onAnnualView,
  onMarkComplete,
  onApprove,
  onRevert,
}: {
  student: EnrolledStudent;
  row: StudentReportCardStatus | undefined;
  status: ReportCardStatus | null;
  loadingOverview: boolean;
  isAdmin: boolean;
  builderBase: string;
  term: string;
  year: string;
  approvingId: number | null;
  revertingId: number | null;
  markingCompleteId: number | null;
  onPreview: () => void;
  onAnnualView: () => void;
  onMarkComplete: () => void;
  onApprove: () => void;
  onRevert: (toStatus: ReportCardStatus) => void;
}) {
  const subjectsMapped = row?.subjects_mapped ?? 0;
  const hasAttrs       = row?.has_attributes ?? false;
  const rcId           = row?.report_card_id ?? null;

  const isApproving       = approvingId === student.id;
  const isReverting       = revertingId === student.id;
  const isMarkingComplete = markingCompleteId === student.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3
        hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
    >
      {/* Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{student.name}</p>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
            {subjectsMapped > 0 || hasAttrs
              ? `${subjectsMapped} subject${subjectsMapped !== 1 ? "s" : ""} mapped${hasAttrs ? " · attrs ✓" : ""}`
              : status ? "No subjects mapped yet" : "Not started"}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="hidden sm:flex justify-center w-32">
        {loadingOverview ? (
          <div className="h-6 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ) : (
          <StatusBadge status={status} />
        )}
      </div>

      {/* Subjects */}
      <div className="hidden md:flex flex-col items-center w-20 gap-0.5">
        {loadingOverview ? (
          <div className="h-2 w-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ) : (
          <>
            <div className="flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-gray-400" />
              <span className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">{subjectsMapped}</span>
            </div>
            {hasAttrs && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <Link
          to={`${builderBase}?studentId=${student.id}&name=${encodeURIComponent(student.name)}${term && year ? `&term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}` : ""}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
            bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300
            hover:bg-violet-200 dark:hover:bg-violet-800/50 transition-colors"
          title="Open Report Card Builder"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{status ? "Edit" : "Build"}</span>
        </Link>

        {rcId && (
          <button
            onClick={onPreview}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
              bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark
              hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Preview report card"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onAnnualView}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
            bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300
            hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
          title="View annual summary (all terms combined)"
        >
          <GraduationCap className="w-3.5 h-3.5" />
        </button>

        {status === "draft" && rcId && (subjectsMapped > 0 || hasAttrs) && (
          <button
            onClick={onMarkComplete}
            disabled={isMarkingComplete}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
              bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
              hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50 transition-colors"
            title="Mark as complete"
          >
            {isMarkingComplete ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Done</span>
          </button>
        )}

        {isAdmin && status === "saved" && (
          <button
            onClick={onApprove}
            disabled={isApproving}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
              bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300
              hover:bg-emerald-200 dark:hover:bg-emerald-800/50 disabled:opacity-50 transition-colors"
            title="Approve"
          >
            {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Approve</span>
          </button>
        )}

        {isAdmin && status === "approved" && (
          <button
            onClick={() => onRevert("saved")}
            disabled={isReverting}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
              bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300
              hover:bg-orange-200 dark:hover:bg-orange-800/50 disabled:opacity-50 transition-colors"
            title="Revert to Saved"
          >
            {isReverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          </button>
        )}

        <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
      </div>
    </motion.div>
  );
}

// ─── Student card (mobile) ────────────────────────────────────────────────────

function StudentMobileCard({
  student,
  row,
  status,
  loadingOverview,
  isAdmin,
  builderBase,
  term,
  year,
  approvingId,
  revertingId,
  markingCompleteId,
  onPreview,
  onAnnualView,
  onMarkComplete,
  onApprove,
  onRevert,
}: {
  student: EnrolledStudent;
  row: StudentReportCardStatus | undefined;
  status: ReportCardStatus | null;
  loadingOverview: boolean;
  isAdmin: boolean;
  builderBase: string;
  term: string;
  year: string;
  approvingId: number | null;
  revertingId: number | null;
  markingCompleteId: number | null;
  onPreview: () => void;
  onAnnualView: () => void;
  onMarkComplete: () => void;
  onApprove: () => void;
  onRevert: (toStatus: ReportCardStatus) => void;
}) {
  const subjectsMapped = row?.subjects_mapped ?? 0;
  const hasAttrs       = row?.has_attributes ?? false;
  const rcId           = row?.report_card_id ?? null;

  const isApproving       = approvingId === student.id;
  const isReverting       = revertingId === student.id;
  const isMarkingComplete = markingCompleteId === student.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3
        hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-colors"
    >
      {/* Top row: avatar + name + status */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary-light dark:text-text-primary-dark text-sm truncate">{student.name}</p>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-0.5">
            {subjectsMapped > 0 ? `${subjectsMapped} subject${subjectsMapped !== 1 ? "s" : ""} mapped` : "No subjects yet"}
            {hasAttrs ? " · Attributes ✓" : ""}
          </p>
        </div>
        {loadingOverview ? (
          <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ) : (
          <StatusBadge status={status} />
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100 dark:border-gray-800/60">
        <Link
          to={`${builderBase}?studentId=${student.id}&name=${encodeURIComponent(student.name)}${term && year ? `&term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}` : ""}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
            bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300
            hover:bg-violet-200 dark:hover:bg-violet-800/50 transition-colors"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          {status ? "Edit" : "Build"}
        </Link>

        {rcId && (
          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark
              hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        )}

        <button
          onClick={onAnnualView}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
            bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300
            hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Annual
        </button>

        {status === "draft" && rcId && (subjectsMapped > 0 || hasAttrs) && (
          <button
            onClick={onMarkComplete}
            disabled={isMarkingComplete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
              hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50 transition-colors"
          >
            {isMarkingComplete ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Mark Done
          </button>
        )}

        {isAdmin && status === "saved" && (
          <button
            onClick={onApprove}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300
              hover:bg-emerald-200 dark:hover:bg-emerald-800/50 disabled:opacity-50 transition-colors"
          >
            {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
            Approve
          </button>
        )}

        {isAdmin && status === "approved" && (
          <button
            onClick={() => onRevert("saved")}
            disabled={isReverting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300
              hover:bg-orange-200 dark:hover:bg-orange-800/50 disabled:opacity-50 transition-colors"
          >
            {isReverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Revert
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CourseReportCardsPanel({
  courseId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  courseName: _courseName,
  students,
  currentTerm,
  currentYear,
  isAdmin,
}: CourseReportCardsPanelProps) {
  const [term, setTerm] = useState(currentTerm ?? "");
  const [year, setYear] = useState(currentYear ?? "");

  const [overviewMap,    setOverviewMap]    = useState<Map<number, StudentReportCardStatus>>(new Map());
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError,  setOverviewError]  = useState<string | null>(null);

  const [approvingId,       setApprovingId]       = useState<number | null>(null);
  const [revertingId,       setRevertingId]       = useState<number | null>(null);
  const [markingCompleteId, setMarkingCompleteId] = useState<number | null>(null);

  const [previewStudent, setPreviewStudent] = useState<{ id: number; name: string } | null>(null);
  const [annualStudent, setAnnualStudent] = useState<{ id: number; name: string } | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!term || !year || students.length === 0) return;
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const res = await ReportCardApiService.getCourseOverview({
        term,
        academic_year: year,
        student_ids: students.map((s) => s.id),
      });
      const map = new Map<number, StudentReportCardStatus>();
      res.data.forEach((row) => map.set(row.student_id, row));
      setOverviewMap(map);
    } catch {
      setOverviewError("Failed to load report card statuses.");
    } finally {
      setLoadingOverview(false);
    }
  }, [term, year, students]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const handleMarkComplete = async (studentId: number) => {
    const row = overviewMap.get(studentId);
    if (!row?.report_card_id) return;
    setMarkingCompleteId(studentId);
    try {
      await ReportCardApiService.updateStatus(row.report_card_id, "saved");
      toast.success("Report card marked as complete — ready for admin review.");
      setOverviewMap((prev) => {
        const next = new Map(prev);
        next.set(studentId, { ...row, status: "saved" });
        return next;
      });
    } catch {
      toast.error("Failed to mark as complete.");
    } finally {
      setMarkingCompleteId(null);
    }
  };

  const handleApprove = async (studentId: number) => {
    const row = overviewMap.get(studentId);
    if (!row?.report_card_id) return;
    setApprovingId(studentId);
    try {
      await ReportCardApiService.updateStatus(row.report_card_id, "approved");
      toast.success("Report card approved — student can now view it.");
      setOverviewMap((prev) => {
        const next = new Map(prev);
        next.set(studentId, { ...row, status: "approved" });
        return next;
      });
    } catch {
      toast.error("Failed to approve report card.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRevert = async (studentId: number, toStatus: ReportCardStatus) => {
    const row = overviewMap.get(studentId);
    if (!row?.report_card_id) return;
    setRevertingId(studentId);
    try {
      await ReportCardApiService.updateStatus(row.report_card_id, toStatus);
      toast.success(`Status reverted to ${STATUS_META[toStatus].label}.`);
      setOverviewMap((prev) => {
        const next = new Map(prev);
        next.set(studentId, { ...row, status: toStatus });
        return next;
      });
    } catch {
      toast.error("Failed to revert status.");
    } finally {
      setRevertingId(null);
    }
  };

  const statusSummaryMap = new Map<number, ReportCardStatus | null>(
    students.map((s) => [s.id, overviewMap.get(s.id)?.status ?? null]),
  );

  const builderBase = `/courses/${courseId}/report-card-builder`;
  const attrBase    = `/courses/${courseId}/report-card-attributes`;
  const termYearQs  = term && year ? `?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}` : "";

  const sharedRowProps = {
    loadingOverview,
    isAdmin,
    builderBase,
    term,
    year,
    approvingId,
    revertingId,
    markingCompleteId,
  };

  return (
    <div className="p-4 space-y-5">

      {/* ── Term / year filter ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 mb-1.5 uppercase tracking-wide">
            Term
          </label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Term 3"
            className="w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-900 text-text-primary-light dark:text-text-primary-dark
              focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400
              transition-all"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 mb-1.5 uppercase tracking-wide">
            Academic Year
          </label>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2025-2026"
            className="w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-900 text-text-primary-light dark:text-text-primary-dark
              focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400
              transition-all"
          />
        </div>
        <button
          onClick={fetchOverview}
          disabled={!term || !year || loadingOverview}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
            bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-all
            shadow-sm hover:shadow-md hover:shadow-indigo-500/20 active:scale-95"
        >
          {loadingOverview ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* ── Workflow guide ── */}
      <WorkflowCallout isAdmin={isAdmin} />

      {/* ── Progress summary ── */}
      {!loadingOverview && students.length > 0 && (
        <ProgressSummary total={students.length} statusMap={statusSummaryMap} />
      )}

      {/* ── Error ── */}
      {overviewError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {overviewError}
        </div>
      )}

      {/* ── Student list ── */}
      {students.length === 0 ? (
        <div className="text-center py-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 font-medium">No students enrolled in this course.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards (hidden md+) */}
          <div className="md:hidden space-y-3">
            <AnimatePresence>
              {students.map((student) => {
                const row    = overviewMap.get(student.id);
                const status = row?.status ?? null;
                return (
                  <StudentMobileCard
                    key={student.id}
                    student={student}
                    row={row}
                    status={status}
                    onPreview={() => setPreviewStudent({ id: student.id, name: student.name })}
                    onAnnualView={() => setAnnualStudent({ id: student.id, name: student.name })}
                    onMarkComplete={() => handleMarkComplete(student.id)}
                    onApprove={() => handleApprove(student.id)}
                    onRevert={(toStatus) => handleRevert(student.id, toStatus)}
                    {...sharedRowProps}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          {/* Desktop table (hidden below md) */}
          <div className="hidden md:block rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3
              bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Student</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 hidden sm:block w-32 text-center">Status</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 hidden md:block w-20 text-center">Subjects</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">Actions</span>
            </div>

            <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
              <AnimatePresence>
                {students.map((student) => {
                  const row    = overviewMap.get(student.id);
                  const status = row?.status ?? null;
                  return (
                    <StudentDesktopRow
                      key={student.id}
                      student={student}
                      row={row}
                      status={status}
                      onPreview={() => setPreviewStudent({ id: student.id, name: student.name })}
                      onAnnualView={() => setAnnualStudent({ id: student.id, name: student.name })}
                      onMarkComplete={() => handleMarkComplete(student.id)}
                      onApprove={() => handleApprove(student.id)}
                      onRevert={(toStatus) => handleRevert(student.id, toStatus)}
                      {...sharedRowProps}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}

      {/* ── Class attributes shortcut ── */}
      {students.length > 0 && term && year && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
          p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30
          border border-blue-200 dark:border-blue-800/60">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 border border-blue-200 dark:border-blue-700/40">
              <FileText className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Class Teacher Attributes</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 leading-relaxed">
                Fill attendance, behavior ratings and teacher comments for all students at once
              </p>
            </div>
          </div>
          <Link
            to={`${attrBase}${termYearQs}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm hover:shadow-md
              hover:shadow-blue-500/20 active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            Open <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ── Preview modal ── */}
      <AnimatePresence>
        {previewStudent && (
          <ReportCardPreview
            studentId={previewStudent.id}
            studentName={previewStudent.name}
            term={term}
            academicYear={year}
            onClose={() => setPreviewStudent(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Annual summary modal ── */}
      {annualStudent && (
        <AnnualReportCardPreview
          isOpen={!!annualStudent}
          onClose={() => setAnnualStudent(null)}
          studentId={annualStudent.id}
          studentName={annualStudent.name}
          academicYear={year}
        />
      )}
    </div>
  );
}
