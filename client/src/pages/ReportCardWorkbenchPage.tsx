import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileClock,
  FileText,
  History,
  Lock,
  MessageSquareText,
  RefreshCw,
  Send,
  UserCheck,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { Drawer } from "../components/ui/Drawer";
import { Skeleton } from "../components/ui/Skeleton";
import Tooltip from "../components/ui/Tooltip";
import ReportCardPreview from "../components/ReportCard/ReportCardPreview";
import SubmitMarksDialog from "../components/ReportCard/SubmitMarksDialog";
import MarkCell from "../components/ReportCard/MarkCell";
import ClassPdfPreview from "../components/ReportCard/ClassPdfPreview";
import ApprovalFlow, { type FlowStep } from "../components/ReportCard/ApprovalFlow";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { CycleDatesModal, ProgressBar } from "./ReportCardsPage";
import { statusMeta, ReportCardApiService } from "../services/reportCardApi";
import {
  ACTION_FROM,
  ACTION_LABEL,
  REASON_ACTIONS,
  ReportCardWorkflowApi,
  apiMessage,
  type DiffData,
  type HistoryData,
  type TransitionResult,
  type WorkbenchData,
  type WorkbenchStudent,
  type WorkbenchSubject,
  type WorkflowAction,
} from "../services/reportCardWorkflowApi";
import { useAuth } from "../contexts/AuthContext";

/**
 * One class's report cards for one term (docs/REPORTS_AND_REPORT_CARD_REVIEW.md §6.6):
 * what blocks the class, each subject's sign-off, a students x subjects
 * matrix, and bulk actions — review, return, approve, publish (now or at a
 * time), unpublish, reopen. Each card is checked by the server on its own;
 * a partial result says which cards were refused and why.
 */

type View = "all" | "draft" | "ready" | "blocked" | "reviewed" | "approved" | "published" | "changed";

const VIEWS: Array<[View, string]> = [
  ["all", "All"],
  ["ready", "Ready to review"],
  ["blocked", "Has blockers"],
  ["draft", "Draft"],
  ["reviewed", "Reviewed"],
  ["approved", "Approved"],
  ["published", "Published"],
  ["changed", "Changed since approval"],
];

const ACTION_ORDER: WorkflowAction[] = ["review", "approve", "publish", "return", "unpublish", "reopen"];

function StatusPill({ status, scheduled }: { status: string; scheduled?: string | null }) {
  const m = statusMeta(status);
  return (
    <span
      title={m.hint}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.bg} ${m.color} ${m.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
      {scheduled && status === "approved" && <FileClock className="h-3 w-3" aria-label="Scheduled" />}
    </span>
  );
}

export default function ReportCardWorkbenchPage() {
  const { classGroupId: cgParam } = useParams();
  const classGroupId = Number(cgParam);
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const term = params.get("term") || user?.currentAcademicTerm?.name || "";
  const year = params.get("year") || user?.currentAcademicYear?.name || "";
  const view = (params.get("view") as View) || "all";

  const [data, setData] = useState<WorkbenchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busyAction, setBusyAction] = useState<WorkflowAction | null>(null);
  const [reasonFor, setReasonFor] = useState<WorkflowAction | null>(null);
  const [reason, setReason] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [results, setResults] = useState<{ action: WorkflowAction; items: TransitionResult[] } | null>(null);
  const [signoff, setSignoff] = useState<WorkbenchSubject | null>(null);
  const [drawer, setDrawer] = useState<WorkbenchStudent | null>(null);
  const [preview, setPreview] = useState<WorkbenchStudent | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!classGroupId || !term || !year) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ReportCardWorkflowApi.workbench({ class_group_id: classGroupId, term, academic_year: year });
      setData(res.data);
      setPicked((p) => new Set([...p].filter((id) => res.data.students.some((s) => s.card.id === id))));
    } catch (e) {
      const msg = apiMessage(e, "Couldn't load this class's report cards.");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [classGroupId, term, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const students = useMemo(() => data?.students ?? [], [data]);
  const shown = useMemo(
    () =>
      students.filter((s) => {
        switch (view) {
          case "ready":
            return s.card.status === "draft" && s.blockers.length === 0;
          case "blocked":
            return s.blockers.length > 0;
          case "changed":
            return s.changed_since_approval > 0;
          case "all":
            return true;
          default:
            return s.card.status === view;
        }
      }),
    [students, view],
  );
  const selected = students.filter((s) => picked.has(s.card.id));

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("view");
    else next.set("view", v);
    setParams(next, { replace: true });
  };
  const toggle = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShownPicked = shown.length > 0 && shown.every((s) => picked.has(s.card.id));
  const toggleAll = () =>
    setPicked((p) => {
      const n = new Set(p);
      if (allShownPicked) shown.forEach((s) => n.delete(s.card.id));
      else shown.forEach((s) => n.add(s.card.id));
      return n;
    });

  const allowed = (a: WorkflowAction) => {
    if (!data) return false;
    if (a === "review" || a === "return") return data.can.review || data.can.approve;
    if (a === "approve" || a === "reopen") return data.can.approve;
    return data.can.publish;
  };
  const applicable = (a: WorkflowAction) => selected.filter((s) => ACTION_FROM[a].includes(s.card.status));

  const run = async (action: WorkflowAction, extra: { reason?: string; publish_at?: string | null } = {}, explicit?: WorkbenchStudent[]) => {
    const cards = explicit ?? applicable(action);
    if (cards.length === 0) return;
    setBusyAction(action);
    try {
      const res = await ReportCardWorkflowApi.transition({ card_ids: cards.map((c) => c.card.id), action, ...extra });
      const failed = res.data.results.filter((r) => !r.ok);
      if (res.data.ok > 0) toast.success(res.message);
      if (failed.length) {
        if (res.data.ok === 0) toast.error(res.message);
        setResults({ action, items: res.data.results });
      }
      setPicked(new Set());
      await load();
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't ${ACTION_LABEL[action].toLowerCase()} the selected cards.`));
    } finally {
      setBusyAction(null);
    }
  };

  const onAction = (a: WorkflowAction) => {
    if (REASON_ACTIONS.includes(a)) {
      setReason("");
      setReasonFor(a);
    } else if (a === "publish") {
      setScheduleAt("");
      setScheduleOpen(true);
    } else void run(a);
  };

  const importAttendance = async () => {
    if (!data) return;
    setImporting(true);
    try {
      const res = await ReportCardWorkflowApi.importAttendance({ class_group_id: classGroupId, term, academic_year: year });
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't import attendance."));
    } finally {
      setImporting(false);
    }
  };

  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const subjectHasMarks = (sid: number) => students.some((st) => st.subjects[sid]?.total != null || (st.subjects[sid]?.missing ?? 0) > 0);
  const matrixSubjects = useMemo(
    () => (data?.subjects ?? []).filter((sub) => showAllSubjects || subjectHasMarks(sub.subject_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, showAllSubjects, students],
  );
  const hiddenSubjects = (data?.subjects.length ?? 0) - matrixSubjects.length;
  const nameById = useMemo(() => new Map((data?.subjects ?? []).map((s) => [s.subject_id, s.name])), [data]);
  const total = students.length;

  // ── Approval flow: steps, their progress and one-click next actions ──────
  const navigate = useNavigate();
  const subjectsRef = useRef<HTMLElement>(null);
  const [flashSubjects, setFlashSubjects] = useState(false);
  const [confirmFlow, setConfirmFlow] = useState<{ action: "review" | "approve"; cards: WorkbenchStudent[] } | null>(null);
  const commentsUrl = `/report-cards/${classGroupId}/comments?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}`;
  const goToSubjects = () => {
    subjectsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashSubjects(true);
    window.setTimeout(() => setFlashSubjects(false), 1600);
  };
  // Arriving from the report cards list with ?focus=subjects ("Collect marks"):
  // land on the subjects sign-off once the data is in, then drop the param.
  const focusSubjects = params.get("focus") === "subjects";
  useEffect(() => {
    if (!data || !focusSubjects) return;
    // Not cleared on cleanup: dropping the param re-runs this effect.
    window.setTimeout(goToSubjects, 150);
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("focus");
        return n;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, focusSubjects]);
  const flowSteps = useMemo<FlowStep[]>(() => {
    if (!data) return [];
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const mapped = data.subjects.filter((s) => s.mapped_cards > 0);
    const open = mapped.filter((s) => s.signoff.status !== "submitted");
    const mine = open.filter((s) => s.i_teach);
    const missing = open.reduce((a, s) => a + s.missing_marks, 0);
    const attrs = data.scheme.attributes.length;
    const commented = students.filter((s) => s.has_comment && s.attributes_rated >= attrs).length;
    const readyCards = students.filter((s) => s.card.status === "draft" && s.blockers.length === 0);
    const reviewedCards = students.filter((s) => s.card.status === "reviewed");
    const approvedCards = students.filter((s) => s.card.status === "approved" && !s.card.publish_at);
    const blocked = students.filter((s) => s.card.status === "draft" && s.blockers.length > 0).length;
    const c = data.counts;
    return [
      {
        key: "marks",
        title: "Marks submitted",
        done: mapped.length - open.length,
        total: mapped.length,
        detail: !mapped.length
          ? "No subject has assessments mapped yet."
          : open.length
            ? `${plural(open.length, "subject")} still open${missing ? ` · ${plural(missing, "mark")} missing` : ""}.`
            : "Every subject teacher has submitted.",
        action: mine.length
          ? { label: `Submit ${mine[0].name}${mine.length > 1 ? ` (+${mine.length - 1})` : ""}`, onClick: () => setSignoff(mine[0]), primary: true }
          : open.length
            ? { label: "See open subjects", onClick: goToSubjects }
            : null,
        onSelect: goToSubjects,
      },
      {
        key: "comments",
        title: "Comments & attributes",
        done: commented,
        total,
        detail: commented < total ? `${plural(total - commented, "card")} without a full comment and ${attrs} attributes.` : "Every card has its comment and attributes.",
        action: data.can.comment && commented < total ? { label: "Write comments", to: commentsUrl, primary: true } : null,
        onSelect: commented < total ? () => setView("blocked") : undefined,
      },
      {
        key: "review",
        title: "Reviewed",
        done: total - c.draft,
        total,
        detail: readyCards.length
          ? `${plural(readyCards.length, "card")} ready to review${blocked ? `, ${blocked} still blocked` : ""}.`
          : blocked
            ? `${plural(blocked, "card")} blocked: finish the steps before.`
            : c.draft
              ? "Waiting for cards to be ready."
              : "All cards reviewed.",
        action:
          readyCards.length && (data.can.review || data.can.approve)
            ? { label: `Review ${readyCards.length} ready`, onClick: () => setConfirmFlow({ action: "review", cards: readyCards }), busy: busyAction === "review", primary: true }
            : blocked
              ? { label: "Show blocked cards", onClick: () => setView("blocked") }
              : null,
        onSelect: () => setView(readyCards.length ? "ready" : "draft"),
      },
      {
        key: "approve",
        title: "Approved",
        done: c.approved + c.published,
        total,
        detail: reviewedCards.length
          ? `${plural(reviewedCards.length, "card")} waiting for approval${data.can.approve ? "" : " by the head of school"}.`
          : c.approved + c.published === total
            ? "All cards approved and locked."
            : "Approved cards are locked until returned to draft.",
        action:
          reviewedCards.length && data.can.approve
            ? { label: `Approve ${reviewedCards.length}`, onClick: () => setConfirmFlow({ action: "approve", cards: reviewedCards }), busy: busyAction === "approve", primary: true }
            : null,
        onSelect: () => setView("reviewed"),
      },
      {
        key: "publish",
        title: "Published",
        done: c.published,
        total,
        detail: approvedCards.length
          ? `${plural(approvedCards.length, "card")} approved, not yet visible to students.`
          : c.scheduled
            ? `${plural(c.scheduled, "card")} scheduled to publish.`
            : c.published === total
              ? "Students and parents can see every card."
              : "Students see a card only once it's published.",
        action:
          approvedCards.length && data.can.publish
            ? {
                label: `Publish ${approvedCards.length}`,
                onClick: () => {
                  setPicked(new Set(approvedCards.map((s) => s.card.id)));
                  setScheduleAt("");
                  setScheduleOpen(true);
                },
                busy: busyAction === "publish",
                primary: true,
              }
            : null,
        onSelect: () => setView(approvedCards.length ? "approved" : "published"),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, students, busyAction, total, commentsUrl]);

  /** Where each kind of blocker gets fixed. */
  const fixBlocker = (code: string): { label: string; go: () => void } => {
    switch (code) {
      case "SUBJECT_NOT_SUBMITTED":
      case "MISSING_MARKS":
      case "SUBJECT_EMPTY":
        return { label: "Go to subjects", go: goToSubjects };
      case "NO_COMMENT":
      case "ATTRIBUTES_INCOMPLETE":
        return { label: "Write comments", go: () => navigate(commentsUrl) };
      case "NO_ATTENDANCE":
        return { label: "Import attendance", go: () => void importAttendance() };
      default:
        return { label: "Show students", go: () => setView("blocked") };
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 pb-28 sm:p-6 sm:pb-28">
      <PageHeader
        breadcrumb={[{ label: "Report cards", to: `/report-cards` }, { label: data?.class_group.name ?? "Class" }]}
        title={data?.class_group.name ?? (loading ? "Loading…" : "Class")}
        icon={<ClipboardCheck className="h-6 w-6 text-blue-600" />}
        description={
          data
            ? `${[data.class_group.grade_name, data.class_group.program_name].filter(Boolean).join(" · ")} — ${term} ${year}`
            : `${term} ${year}`
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPdfOpen(true)} disabled={!data || !data.students.length}>
              <FileText className="h-4 w-4" /> Preview PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={importAttendance} loading={importing} disabled={!data}>
              <Download className="h-4 w-4" /> Import attendance
            </Button>
            {data?.can.edit_settings && (
              <Button variant="secondary" size="sm" onClick={() => setDatesOpen(true)} disabled={!data}>
                <CalendarDays className="h-4 w-4" /> Dates
              </Button>
            )}
          </>
        }
      />

      {error && !data ? (
        <EmptyState
          title="Couldn't load this class"
          description={error}
          action={
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : !data ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-16 w-full rounded-3xl" />
          <Skeleton className="h-80 w-full rounded-3xl" />
        </div>
      ) : (
        <>
          {/* Progress + blockers */}
          <ApprovalFlow steps={flowSteps} />

          <section className="grid items-start gap-3 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-panel-line dark:bg-panel-dark">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {data.counts.published}/{total} published
                </p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  {data.counts.ready} ready to review · {data.counts.reviewed} to approve · {data.counts.approved} to publish
                  {data.counts.scheduled ? ` (${data.counts.scheduled} scheduled)` : ""}
                </p>
              </div>
              <ProgressBar counts={data.counts} total={total} className="mt-3 h-2.5" />
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["draft", "reviewed", "approved", "published"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setView(k)}
                    className="rounded-2xl border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 dark:border-panel-line dark:hover:bg-panel-raised"
                  >
                    <dt className="flex items-center gap-1.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusMeta(k).dot}`} /> {statusMeta(k).label}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">{data.counts[k]}</dd>
                  </button>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {data.cycle.marks_due_at && <span>Marks due {new Date(data.cycle.marks_due_at).toLocaleString()}</span>}
                {data.cycle.review_due_at && <span>Review due {new Date(data.cycle.review_due_at).toLocaleString()}</span>}
                {data.cycle.next_term_begins_on && <span>Next term {new Date(data.cycle.next_term_begins_on).toLocaleDateString()}</span>}
                {!data.roster_complete && <span className="text-amber-700 dark:text-amber-300">Roster may be incomplete (MIS)</span>}
              </div>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-panel-line dark:bg-panel-dark">
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">What still needs doing</p>
              {data.blockers.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Nothing is blocking this class.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.blockers.map((b) => {
                    const fix = fixBlocker(b.code);
                    return (
                    <li key={b.code}>
                      <button
                        onClick={fix.go}
                        data-testid={`blocker-${b.code}`}
                        className="group flex w-full items-start gap-2 rounded-xl px-2 py-1 text-left text-sm hover:bg-gray-50 dark:hover:bg-panel-raised"
                      >
                        <AlertTriangle
                          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${["SUBJECT_EMPTY", "NO_ATTENDANCE"].includes(b.code) ? "text-gray-400" : "text-amber-600"}`}
                        />
                        <span className="min-w-0 text-text-primary-light dark:text-text-primary-dark">
                          <span className="font-semibold">{b.students} student{b.students === 1 ? "" : "s"}</span> — {b.example}
                        </span>
                        <span className="ml-auto flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-blue-700 opacity-70 transition-opacity group-hover:bg-blue-50 group-hover:opacity-100 dark:text-blue-300 dark:group-hover:bg-blue-500/10">
                          {fix.label} →
                        </span>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Subjects and their sign-off */}
          <section
            ref={subjectsRef}
            data-testid="subjects-section"
            className={`scroll-mt-4 rounded-3xl border bg-white p-4 transition-colors duration-500 dark:bg-panel-dark ${
              flashSubjects ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-200 dark:border-panel-line"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Subjects</p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {data.subjects.filter((s) => s.signoff.status === "submitted").length}/{data.subjects.length} submitted
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.subjects.map((s) => {
                const submitted = s.signoff.status === "submitted";
                const total = s.total_cards ?? students.length;
                const unmapped = s.mapped_cards === 0;
                const partial = !unmapped && s.mapped_cards < total;
                const canOpen = s.i_teach || data.can.review || data.can.approve;
                const tone = submitted
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                  : s.signoff.returned_reason
                    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200"
                    : unmapped
                      ? "border-dashed border-gray-300 text-text-secondary-light dark:border-white/15 dark:text-text-secondary-dark"
                      : "border-gray-200 text-text-primary-light dark:border-panel-line dark:text-text-primary-dark";
                const status = submitted
                  ? `Submitted${s.signoff.submitted_by ? ` by ${s.signoff.submitted_by}` : ""}`
                  : unmapped
                    ? "No assessments mapped"
                    : partial
                      ? `Mapped for ${s.mapped_cards} of ${total}`
                      : s.missing_marks
                        ? `${s.missing_marks} mark${s.missing_marks === 1 ? "" : "s"} missing`
                        : "Ready to submit";
                const body = (
                  <>
                    {submitted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    ) : unmapped ? (
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                    ) : (
                      <Send className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="block truncate opacity-80">
                        {status}
                        {s.i_teach ? " · you teach" : s.teachers.length ? ` · ${s.teachers[0]}` : ""}
                      </span>
                    </span>
                  </>
                );
                const cls = `flex max-w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs transition-colors ${tone}`;
                const title = s.signoff.returned_reason ? `Returned: ${s.signoff.returned_reason}` : s.teachers.join(", ") || undefined;
                if (unmapped) {
                  return s.i_teach ? (
                    <Link
                      key={s.subject_id}
                      to={`/grades/subjects/${s.subject_id}`}
                      data-testid={`subject-${s.subject_id}`}
                      title="Map this subject's assessments to CW / HW / MD / EOT"
                      className={`${cls} hover:bg-gray-50 dark:hover:bg-panel-raised`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={s.subject_id} data-testid={`subject-${s.subject_id}`} title={title} className={cls}>
                      {body}
                    </div>
                  );
                }
                return canOpen ? (
                  <button
                    key={s.subject_id}
                    type="button"
                    onClick={() => setSignoff(s)}
                    data-testid={`subject-${s.subject_id}`}
                    title={title}
                    className={`${cls} hover:brightness-[0.98] hover:bg-gray-50 dark:hover:bg-panel-raised`}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={s.subject_id} data-testid={`subject-${s.subject_id}`} title={title} className={cls}>
                    {body}
                  </div>
                );
              })}
              {data.subjects.length === 0 && (
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">No subjects are assigned to this class in MIS.</p>
              )}
            </div>
          </section>

          {/* Views */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter students">
            {VIEWS.map(([v, label]) => {
              const n = students.filter((s) =>
                v === "all"
                  ? true
                  : v === "ready"
                    ? s.card.status === "draft" && s.blockers.length === 0
                    : v === "blocked"
                      ? s.blockers.length > 0
                      : v === "changed"
                        ? s.changed_since_approval > 0
                        : s.card.status === v,
              ).length;
              if (v === "changed" && n === 0) return null;
              return (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    view === v
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 text-text-secondary-light hover:bg-gray-50 dark:border-panel-line dark:text-text-secondary-dark dark:hover:bg-panel-raised"
                  }`}
                >
                  {label} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>

          {/* How to read the marks */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-white px-4 py-3 text-xs text-text-secondary-light dark:border-panel-line dark:bg-panel-dark dark:text-text-secondary-dark">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2" data-testid="marks-legend">
              <span>
                <strong className="text-text-primary-light dark:text-text-primary-dark">73%</strong> mark out of 100, over the work assessed so far
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-9 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                  <span className="block h-full w-1/2 rounded-full bg-blue-500/80" />
                </span>
                share of the term assessed (CW {data.scheme.category_weights?.CW ?? 15} · HW {data.scheme.category_weights?.HW ?? 10} · MD{" "}
                {data.scheme.category_weights?.MD ?? 25} · EOT {data.scheme.category_weights?.EOT ?? 50})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  1
                </span>
                marks not recorded yet
              </span>
              <span>
                <strong className="text-red-700 dark:text-red-400">48%</strong> not yet competent
                {data.scheme.competence_thresholds
                  ? ` (specific < ${data.scheme.competence_thresholds.specific}%, general/complementary < ${data.scheme.competence_thresholds.general}%)`
                  : ""}
              </span>
              <span>Click a mark for its breakdown.</span>
            </div>
            {hiddenSubjects > 0 || showAllSubjects ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-text-primary-light dark:text-text-primary-dark">
                <input
                  type="checkbox"
                  checked={showAllSubjects}
                  onChange={(e) => setShowAllSubjects(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Show modules with no marks{hiddenSubjects > 0 ? ` (${hiddenSubjects})` : ""}
              </label>
            ) : null}
          </div>

          {/* Matrix */}
          {shown.length === 0 ? (
            <EmptyState title="No students in this view" description="Pick another filter above." />
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white dark:border-panel-line dark:bg-panel-dark">
              <table className="min-w-full text-sm" data-testid="workbench-matrix">
                <thead className="bg-gray-50 text-xs text-text-secondary-light dark:bg-panel-raised dark:text-text-secondary-dark">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left dark:bg-panel-raised">
                      <input
                        type="checkbox"
                        checked={allShownPicked}
                        onChange={toggleAll}
                        aria-label="Select all shown"
                        className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 align-middle"
                      />
                      Student
                    </th>
                    <th className="px-2 py-2 text-left">Status</th>
                    {matrixSubjects.map((s) => (
                      <th
                        key={s.subject_id}
                        className="max-w-[104px] px-2 py-2 text-center align-bottom font-medium"
                        title={`${s.name}${s.code ? ` (${s.code})` : ""} — mark in % (out of 100)${s.threshold != null ? `, competent from ${s.threshold}%` : ""}`}
                      >
                        {s.code && <span className="block text-[10px] font-semibold text-blue-700 dark:text-blue-300">{s.code}</span>}
                        <span className="line-clamp-2 leading-tight">{s.name}</span>
                        <span className="mt-0.5 block text-[10px] font-normal opacity-70">%{s.threshold != null ? ` · ≥${s.threshold}` : ""}</span>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center align-bottom" title="Average of the module marks, in %">
                      Avg
                      <span className="mt-0.5 block text-[10px] font-normal opacity-70">%</span>
                    </th>
                    <th className="px-2 py-2 text-center" title="Class teacher's comment">
                      <MessageSquareText className="mx-auto h-4 w-4" />
                    </th>
                    <th className="px-2 py-2 text-center">Attributes</th>
                    <th className="px-2 py-2 text-center">Days</th>
                    <th className="px-2 py-2 text-left">Issues</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {shown.map((s) => (
                    <tr
                      key={s.card.id}
                      className={`group ${picked.has(s.card.id) ? "bg-blue-50 dark:bg-[#0e1626]" : "bg-white hover:bg-gray-50 dark:bg-panel-dark dark:hover:bg-panel-raised"}`}
                    >
                      <td
                        className={`sticky left-0 z-10 px-3 py-2 ${
                          picked.has(s.card.id)
                            ? "bg-blue-50 dark:bg-[#0e1626]"
                            : "bg-white group-hover:bg-gray-50 dark:bg-panel-dark dark:group-hover:bg-panel-raised"
                        }`}
                      >
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={picked.has(s.card.id)}
                            onChange={() => toggle(s.card.id)}
                            aria-label={`Select ${s.name}`}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="min-w-0">
                            <span className="block max-w-[180px] truncate font-medium text-text-primary-light dark:text-text-primary-dark">{s.name}</span>
                            <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark">{s.registration_number ?? "—"}</span>
                          </span>
                        </label>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <StatusPill status={s.card.status} scheduled={s.card.publish_at} />
                          {!s.card.editable && <Lock className="h-3 w-3 text-text-secondary-light" aria-label="Locked" />}
                        </div>
                      </td>
                      {matrixSubjects.map((sub) => (
                        <td key={sub.subject_id} className="px-1 py-1.5 text-center">
                          <MarkCell
                            cell={s.subjects[sub.subject_id]}
                            studentName={s.name}
                            moduleName={sub.name}
                            moduleCode={sub.code}
                            threshold={sub.threshold}
                            weights={data.scheme.category_weights}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                        {s.average != null ? String(Number(s.average.toFixed(2))) : "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {s.has_comment ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" aria-label="Comment written" /> : <span className="text-text-secondary-light/60">—</span>}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                        {s.attributes_rated}/{data.scheme.attributes.length}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums text-text-secondary-light dark:text-text-secondary-dark" title={s.attendance_source === "imported" ? "Imported from attendance" : "Entered by hand"}>
                        {s.attendance_days || "—"}
                      </td>
                      <td className="px-2 py-2">
                        {s.blockers.length > 0 ? (
                          <Tooltip label={s.blockers.map((b) => b.message).join(" · ")}>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5" /> {s.blockers.length}
                            </span>
                          </Tooltip>
                        ) : s.changed_since_approval > 0 ? (
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{s.changed_since_approval} changed</span>
                        ) : s.card.returned_reason && s.card.status === "draft" ? (
                          <Tooltip label={s.card.returned_reason}>
                            <span className="text-xs text-amber-700 dark:text-amber-300">Returned</span>
                          </Tooltip>
                        ) : (
                          <span className="text-text-secondary-light/60">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <Tooltip label="Preview card">
                          <button onClick={() => setPreview(s)} className="rounded-xl p-1.5 hover:bg-gray-100 dark:hover:bg-white/10" aria-label={`Preview ${s.name}`}>
                            <Eye className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip label="History">
                          <button onClick={() => setDrawer(s)} className="rounded-xl p-1.5 hover:bg-gray-100 dark:hover:bg-white/10" aria-label={`History of ${s.name}`}>
                            <History className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Comments, attributes and attendance are entered on the{" "}
            <Link to={`/report-cards/${classGroupId}/comments?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}`} className="font-medium text-blue-700 underline dark:text-blue-300">
              class teacher page
            </Link>
            . Only draft cards can be changed.
          </p>
        </>
      )}

      {/* Bulk bar */}
      {selected.length > 0 && data && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-panel-line dark:bg-panel-dark">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {selected.length} selected
              <button onClick={() => setPicked(new Set())} className="ml-2 text-xs text-blue-700 underline dark:text-blue-300">
                Clear
              </button>
            </p>
            <div className="flex flex-wrap gap-2" data-testid="bulk-actions">
              {ACTION_ORDER.map((a) => {
                const n = applicable(a).length;
                if (!allowed(a)) return null;
                const why = n === 0 ? `None of the selected cards is ${ACTION_FROM[a].join(" or ")}` : undefined;
                return (
                  <Tooltip key={a} label={why ?? `${ACTION_LABEL[a]} ${n} card${n === 1 ? "" : "s"}`}>
                    <span>
                      <Button
                        size="sm"
                        variant={a === "approve" || a === "publish" || a === "review" ? "primary" : "secondary"}
                        disabled={n === 0 || busyAction != null}
                        loading={busyAction === a}
                        onClick={() => onAction(a)}
                      >
                        {a === "review" && <UserCheck className="h-4 w-4" />}
                        {ACTION_LABEL[a]} {n > 0 ? `(${n})` : ""}
                      </Button>
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reason prompt */}
      <Modal
        isOpen={reasonFor != null}
        onClose={() => setReasonFor(null)}
        title={reasonFor ? `${ACTION_LABEL[reasonFor]} — why?` : ""}
        subtitle="Saved in each card's history and shown to the people who fix it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReasonFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                const a = reasonFor!;
                setReasonFor(null);
                void run(a, { reason: reason.trim() });
              }}
            >
              {reasonFor ? ACTION_LABEL[reasonFor] : ""}
            </Button>
          </div>
        }
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          autoFocus
          placeholder="e.g. Physics EOT marks were entered for the wrong class"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-panel-line dark:bg-panel-dark"
        />
        {reasonFor === "reopen" && (
          <p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            The approved version is kept in the history and its QR code will report it as withdrawn. Re-approving issues a new version.
          </p>
        )}
      </Modal>

      {/* Publish now / schedule */}
      <Modal
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Publish report cards"
        subtitle="Students and parents can see a card once it is published."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={!scheduleAt}
              onClick={() => {
                setScheduleOpen(false);
                void run("publish", { publish_at: new Date(scheduleAt).toISOString() });
              }}
            >
              <FileClock className="h-4 w-4" /> Schedule
            </Button>
            <Button
              onClick={() => {
                setScheduleOpen(false);
                void run("publish");
              }}
            >
              Publish now
            </Button>
          </div>
        }
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary-light dark:text-text-primary-dark">Or release at</span>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-panel-line dark:bg-panel-dark"
          />
        </label>
      </Modal>

      {/* Per-card results */}
      <Modal
        isOpen={results != null}
        onClose={() => setResults(null)}
        size="lg"
        title={results ? `${ACTION_LABEL[results.action]}: ${results.items.filter((r) => r.ok).length} done, ${results.items.filter((r) => !r.ok).length} not` : ""}
      >
        <ul className="divide-y divide-gray-100 dark:divide-white/5">
          {results?.items
            .filter((r) => !r.ok)
            .map((r) => {
              const s = students.find((x) => x.card.id === r.report_card_id);
              return (
                <li key={r.report_card_id} className="py-2 text-sm">
                  <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{s?.name ?? `Card #${r.report_card_id}`}</p>
                  <p className="text-text-secondary-light dark:text-text-secondary-dark">{r.message}</p>
                  {r.blockers && r.blockers.length > 1 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {r.blockers.map((b) => (
                        <li key={b.code}>{b.message}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
        </ul>
      </Modal>

      {signoff && data && (
        <SubmitMarksDialog
          open
          onClose={() => setSignoff(null)}
          onChanged={() => void load()}
          classGroupId={classGroupId}
          className={data.class_group.name}
          subjectId={signoff.subject_id}
          subjectName={signoff.name}
          term={term}
          academicYear={year}
          canReopen={data.can.review || data.can.approve || signoff.i_teach}
        />
      )}

      {preview && (
        <ReportCardPreview
          studentId={preview.student_id}
          studentName={preview.name}
          term={term}
          academicYear={year}
          onClose={() => setPreview(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmFlow}
        title={confirmFlow?.action === "approve" ? `Approve ${confirmFlow.cards.length} report card${confirmFlow.cards.length === 1 ? "" : "s"}?` : `Mark ${confirmFlow?.cards.length ?? 0} card${confirmFlow?.cards.length === 1 ? "" : "s"} as reviewed?`}
        description={
          confirmFlow?.action === "approve"
            ? "Approving locks each card and saves the version students will get: marks, comments and attributes can't change unless the card is returned to draft. Students see it only after it's published."
            : `These cards have no blockers: marks submitted, comment and attributes done. Reviewing sends them for approval. ${(confirmFlow?.cards ?? []).slice(0, 4).map((s) => s.name).join(", ")}${(confirmFlow?.cards.length ?? 0) > 4 ? ` and ${(confirmFlow?.cards.length ?? 0) - 4} more` : ""}.`
        }
        confirmLabel={confirmFlow?.action === "approve" ? "Approve and lock" : "Mark reviewed"}
        onConfirm={() => {
          const f = confirmFlow;
          setConfirmFlow(null);
          if (f) void run(f.action, {}, f.cards);
        }}
        onCancel={() => setConfirmFlow(null)}
      />

      <CardHistoryDrawer student={drawer} onClose={() => setDrawer(null)} subjectName={(id) => nameById.get(id) ?? `Subject #${id}`} />

      {data && (
        <ClassPdfPreview
          isOpen={pdfOpen}
          onClose={() => setPdfOpen(false)}
          classGroupId={classGroupId}
          className={data.class_group.name}
          term={term}
          academicYear={year}
          students={data.students.length}
        />
      )}

      {data && (
        <CycleDatesModal
          open={datesOpen}
          onClose={() => setDatesOpen(false)}
          classIds={[classGroupId]}
          term={term}
          academicYear={year}
          initial={data.cycle}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}

function CardHistoryDrawer({
  student,
  onClose,
}: {
  student: WorkbenchStudent | null;
  onClose: () => void;
  subjectName: (id: number) => string;
}) {
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    setHistory(null);
    setDiff(null);
    Promise.all([ReportCardWorkflowApi.history(student.card.id), ReportCardWorkflowApi.diff(student.card.id)])
      .then(([h, d]) => {
        setHistory(h.data);
        setDiff(d.data);
      })
      .catch((e) => toast.error(apiMessage(e, "Couldn't load this card's history.")))
      .finally(() => setLoading(false));
  }, [student]);

  const download = async () => {
    if (!student) return;
    setDownloading(true);
    try {
      const blob = await ReportCardApiService.generatePdf(student.card.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ReportCard-${student.name.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded.");
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't download the PDF."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Drawer
      open={student != null}
      onClose={onClose}
      title={student ? `${student.name} — card history` : ""}
      footer={
        <Button variant="secondary" size="sm" onClick={download} loading={downloading}>
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      }
    >
      {loading || !history ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <StatusPill status={history.status} scheduled={history.publish_at} />
            {history.version > 0 && <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">version {history.version}</span>}
            {history.publish_at && (
              <span className="text-xs text-blue-700 dark:text-blue-300">publishes {new Date(history.publish_at).toLocaleString()}</span>
            )}
          </div>

          {diff?.frozen && (
            <section>
              <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Changed since approval</h3>
              {diff.changes.length === 0 ? (
                <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">No mark has changed since version {diff.version} was approved.</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    The issued card still shows the approved figures. Reopen it to draft to issue the new ones.
                  </p>
                  <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-white/5 dark:border-panel-line">
                    {diff.changes.map((c) => (
                      <li key={c.subject_id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-text-primary-light dark:text-text-primary-dark">{c.name}</span>
                        <span className="tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                          {c.approved != null ? String(Number(c.approved.toFixed(2))) : "—"} → <strong>{c.now != null ? String(Number(c.now.toFixed(2))) : "—"}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">History</h3>
            {history.transitions.length === 0 ? (
              <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">No status changes yet.</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {history.transitions.map((t) => (
                  <li key={t.id} className="rounded-2xl border border-gray-200 px-3 py-2 text-sm dark:border-panel-line">
                    <p className="text-text-primary-light dark:text-text-primary-dark">
                      <strong>{ACTION_LABEL[t.action as WorkflowAction] ?? t.action}</strong>{" "}
                      <span className="text-text-secondary-light dark:text-text-secondary-dark">
                        {statusMeta(t.from_status).label} → {t.to_status.endsWith("@scheduled") ? "scheduled" : statusMeta(t.to_status).label}
                      </span>
                    </p>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {t.actor_name ?? "Someone"} · {new Date(t.at).toLocaleString()}
                      {t.version ? ` · v${t.version}` : ""}
                    </p>
                    {t.reason && <p className="mt-1 text-xs italic text-text-secondary-light dark:text-text-secondary-dark">“{t.reason}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {history.versions.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Issued versions</h3>
              <ul className="mt-2 space-y-1.5">
                {history.versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between rounded-2xl border border-gray-200 px-3 py-2 text-xs dark:border-panel-line">
                    <span className="text-text-primary-light dark:text-text-primary-dark">
                      v{v.version} · {new Date(v.approved_at).toLocaleDateString()}
                      {v.backfilled ? " · recorded after the fact" : ""}
                    </span>
                    <span className={v.superseded_at ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
                      {v.superseded_at ? "withdrawn" : "current"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
