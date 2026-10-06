import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  FolderCode,
  Lock,
  MessageSquareText,
  RefreshCw,
  Rocket,
  TerminalSquare,
} from "lucide-react";
import { Skeleton } from "../../ui/Skeleton";
import { Pill, LanguageBadge } from "../../Projects/ProjectBadges";
import { TmcodeDeepLinkButton } from "../../Projects/OpenProjectInTmcode";
import FilesTab from "../../Projects/FilesTab";
import { formatDateTime } from "../../Projects/projectFormat";
import { apiErrorMessage, projectsApi, type RevisionSummary } from "../../../services/projectsApi";
import {
  KIND_LABEL,
  STATE_META,
  tmcodeAssignmentsApi,
  type AssignmentDetail,
} from "../../../services/tmcodeAssignmentsApi";
import { dueCountdown } from "./tmcodeFormat";

/**
 * A student's TMCode practical or case study on the assignment page:
 * Open in TMCode (tmcode://assignment?id=…, download page if nothing opens),
 * where their workspace is at, what they submitted (with a code viewer at
 * the submitted revision) and the grade and feedback.
 */
const TmcodeStudentPanel: React.FC<{ assignmentId: number }> = ({ assignmentId }) => {
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await tmcodeAssignmentsApi.get(assignmentId));
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load your TMCode workspace."));
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back from TMCode: refresh the state quietly.
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (error && !data) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300" role="alert">
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{error}</span>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="space-y-3 rounded-2xl border border-gray-200/70 bg-card-light p-5 dark:border-border-dark/30 dark:bg-card-dark/30" aria-busy="true" aria-label="Loading your TMCode workspace">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-10 w-40 rounded-xl sm:block" />
        </div>
        <Skeleton className="h-16 rounded-xl" />
      </section>
    );
  }

  const my = data.my;
  const state = my?.state ?? "not_started";
  const meta = STATE_META[state];
  const due = dueCountdown(data.due_date);
  const fileCount = data.starter?.file_count ?? 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="TMCode workspace"
      data-testid="tmcode-student-panel"
      className="overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 shadow-sm dark:border-blue-900/40 dark:from-blue-950/30 dark:via-gray-900/40 dark:to-indigo-950/20"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <TerminalSquare className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              TMCode {data.kind ? KIND_LABEL[data.kind].toLowerCase() : "practical"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={meta.tone} testId="work-state">
                {meta.label}
              </Pill>
              {data.read_only && (
                <Pill tone="amber" icon={<Lock className="h-3 w-3" aria-hidden="true" />}>
                  Read-only
                </Pill>
              )}
              <LanguageBadge language={data.language} />
              {due && !data.read_only && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${due.tone}`}>
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {due.text}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center md:flex-col md:items-end">
          <TmcodeDeepLinkButton
            getLink={() => tmcodeAssignmentsApi.openLink(assignmentId)}
            label={state === "not_started" && !data.read_only ? "Open in TMCode" : data.read_only ? "View in TMCode" : "Continue in TMCode"}
            fallback="download"
            trackKey="tm.assignment.open_in_tmcode"
            testId="open-assignment-in-tmcode"
            buttonClassName="w-full sm:w-auto"
          />
          <Link to="/tmcode" className="text-center text-[11px] font-medium text-slate-500 hover:text-blue-600 hover:underline dark:text-slate-400">
            Don&apos;t have TMCode? Download it
          </Link>
        </div>
      </div>

      <div className="space-y-3 border-t border-blue-100/80 bg-white/60 p-4 dark:border-blue-900/30 dark:bg-gray-900/30 sm:p-5">
        {data.read_only && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Your teacher marked this assignment completed. You can still open your work, but it can&apos;t be saved or submitted any more.
          </p>
        )}

        <WorkspaceSteps data={data} fileCount={fileCount} />

        {data.instructions && (
          <div className="rounded-xl border border-gray-200/80 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Instructions</p>
            <p className="whitespace-pre-wrap text-sm text-text-primary-light dark:text-text-primary-dark">{data.instructions}</p>
          </div>
        )}

        {my?.state === "graded" && (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:flex-row" data-testid="tmcode-grade">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Award className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Grade</p>
                <p className="text-xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                  {my.grade ?? "—"}
                  <span className="text-sm font-semibold text-emerald-700/80 dark:text-emerald-300/80"> / {my.max_points}</span>
                </p>
              </div>
            </div>
            {my.feedback && (
              <p className="flex flex-1 items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100 sm:border-l sm:border-emerald-200 sm:pl-3 dark:sm:border-emerald-900/40">
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="whitespace-pre-wrap">{my.feedback}</span>
              </p>
            )}
          </div>
        )}

        {my?.project_id && (my.state === "submitted" || my.state === "graded") && my.revision_number && (
          <SubmittedCode projectId={my.project_id} revisionNumber={my.revision_number} />
        )}
      </div>
    </motion.section>
  );
};

/** Where the student is: three steps with the current one highlighted. */
const WorkspaceSteps: React.FC<{ data: AssignmentDetail; fileCount: number }> = ({ data, fileCount }) => {
  const my = data.my;
  const state = my?.state ?? "not_started";
  const done = { started: state !== "not_started", submitted: state === "submitted" || state === "graded" };
  const steps = [
    {
      key: "start",
      icon: Rocket,
      title: done.started ? "Workspace ready" : "Start in TMCode",
      body: done.started ? (
        my?.project_id ? (
          <Link to={`/projects/${my.project_id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
            Open your workspace project
          </Link>
        ) : (
          "Your project is linked."
        )
      ) : fileCount ? (
        `Start copies ${fileCount} starter file${fileCount === 1 ? "" : "s"} into your own workspace.`
      ) : (
        "Start creates your own workspace for this assignment."
      ),
      done: done.started,
    },
    {
      key: "save",
      icon: Code2,
      title: "Work and save",
      body: "Save to Task Mentor as you go; your teacher can follow along.",
      done: done.submitted,
    },
    {
      key: "submit",
      icon: CheckCircle2,
      title: done.submitted ? "Submitted" : "Submit",
      body: done.submitted
        ? `Revision #${my?.revision_number ?? "?"}${my?.submitted_at ? ` · ${formatDateTime(my.submitted_at)}` : ""}`
        : "Submit from TMCode when you're done. You can resubmit until it's graded.",
      done: done.submitted,
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Progress" data-testid="tmcode-steps">
      {steps.map((s, i) => {
        const active = i === current && !data.read_only;
        return (
          <li
            key={s.key}
            aria-current={active ? "step" : undefined}
            className={`flex items-start gap-2.5 rounded-xl border p-3 ${
              s.done
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10"
                : active
                  ? "border-blue-300 bg-white shadow-sm dark:border-blue-800 dark:bg-gray-900/60"
                  : "border-gray-200/80 bg-white/50 dark:border-gray-800 dark:bg-gray-900/30"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                s.done
                  ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {s.done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <s.icon className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{s.title}</span>
              <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">{s.body}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/** The submitted revision in a read-only code viewer (opens on demand). */
const SubmittedCode: React.FC<{ projectId: number; revisionNumber: number }> = ({ projectId, revisionNumber }) => {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  useEffect(() => {
    if (!open || revisions) return;
    projectsApi
      .revisions(projectId, 200)
      .then(setRevisions)
      .catch(() => setRevisions([]));
  }, [open, revisions, projectId]);
  const submitted = revisions?.find((r) => r.number === revisionNumber) ?? null;
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-text-primary-light hover:bg-gray-50 dark:text-text-primary-dark dark:hover:bg-white/5"
      >
        <FolderCode className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="flex-1">What you submitted · revision #{revisionNumber}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-gray-100 dark:border-white/5"
          >
            <div className="p-3" data-testid="submitted-code">
              {revisions === null ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : submitted ? (
                <FilesTab projectId={projectId} revisions={[submitted]} revisionId={submitted.id} onRevisionChange={() => {}} />
              ) : (
                <p className="text-sm text-slate-500">That revision isn&apos;t available.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TmcodeStudentPanel;
