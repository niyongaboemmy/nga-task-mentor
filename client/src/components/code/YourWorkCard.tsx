import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Circle, Loader2, Play, RefreshCw } from "lucide-react";
import { TmcodeDeepLinkButton } from "../Projects/OpenProjectInTmcode";
import { tmcodeAssignmentsApi, type AssignmentDetail } from "../../services/tmcodeAssignmentsApi";
import { apiErrorMessage } from "../../services/projectsApi";

/**
 * "Your work" on a code assignment (CODE_RUNNER_PLAN.md §7.1): where the
 * student is (Draft → Submitted → Graded) and one button — Start, Continue
 * or View — that opens the work page (/assignments/:id/work). TMCode stays
 * one click away as the other way to work on the same project.
 */

const STEPS = ["Draft", "Submitted", "Graded"] as const;

const timeAgo = (iso: string | null) => {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const YourWorkCard: React.FC<{ assignmentId: number }> = ({ assignmentId }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await tmcodeAssignmentsApi.get(assignmentId));
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load your work."));
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
    // Coming back from TMCode or another tab: refresh quietly.
    const onFocus = () => document.visibilityState === "visible" && void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (error && !data) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300" role="alert">
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{error}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </section>
    );
  }
  if (!data) {
    return <div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" aria-busy="true" aria-label="Loading your work" />;
  }

  const my = data.my;
  const state = my?.state ?? "not_started";
  const step = state === "graded" ? 2 : state === "submitted" ? 1 : 0;
  const started = state !== "not_started" && !!my?.project_id;
  const closed = data.read_only || data.status === "completed";
  const action = state === "not_started" ? "Start" : state === "in_progress" ? "Continue" : "View";

  const open = async () => {
    if (!started) {
      setStarting(true);
      try {
        await tmcodeAssignmentsApi.start(assignmentId);
      } catch (e) {
        setError(apiErrorMessage(e, "Couldn't start the assignment."));
        setStarting(false);
        return;
      }
    }
    navigate(`/assignments/${assignmentId}/work`);
  };

  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white p-5 dark:border-white/10 dark:bg-card-dark/40" aria-labelledby="your-work-title" data-testid="your-work">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="your-work-title" className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Your work
          </h2>
          <ol className="mt-3 flex items-center gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className={`h-px w-6 ${i <= step && started ? "bg-primary" : "bg-gray-300 dark:bg-white/15"}`} aria-hidden="true" />}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    started && i <= step ? "text-primary dark:text-blue-300" : "text-text-secondary-light dark:text-text-secondary-dark"
                  }`}
                  aria-current={started && i === step ? "step" : undefined}
                >
                  {started && i <= step ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                  {label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark" data-testid="your-work-status">
            {state === "not_started"
              ? closed
                ? "This assignment is closed."
                : data.starter
                  ? `Start copies the ${data.starter.file_count} starter file${data.starter.file_count === 1 ? "" : "s"} into your own project.`
                  : "Start creates your own project for this assignment."
              : state === "in_progress"
                ? "In progress — submit it from the work page when you're done."
                : state === "submitted"
                  ? `Submitted${my?.submitted_at ? ` ${timeAgo(my.submitted_at)}` : ""}${my?.revision_number ? ` (version #${my.revision_number})` : ""}. You can withdraw it until it's graded.`
                  : `Graded: ${my?.grade ?? "—"} / ${my?.max_points ?? data.points}`}
          </p>
          {state === "graded" && my?.feedback && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5">{my.feedback}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {started && my?.project_id && (
            <TmcodeDeepLinkButton getLink={() => tmcodeAssignmentsApi.openLink(assignmentId)} label="Open in TMCode" buttonClassName="!px-3 !py-2 !text-xs !rounded-xl !bg-white !text-text-primary-light !border !border-gray-200 dark:!bg-transparent dark:!text-white dark:!border-white/15" />
          )}
          {!(state === "not_started" && closed) && (
            <button
              type="button"
              onClick={() => void open()}
              disabled={starting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-60"
              data-testid="your-work-open"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" aria-hidden="true" />} {action}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default YourWorkCard;
