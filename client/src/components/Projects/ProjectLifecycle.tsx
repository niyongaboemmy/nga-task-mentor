import React, { useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, CheckCircle2, Loader2, Lock, PencilLine, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";
import { apiErrorMessage, projectsApi, type ProjectStatus } from "../../services/projectsApi";
import { formatDateTime, submitPreview } from "./projectFormat";

/**
 * The project's lifecycle for its owner: Draft -> Submitted -> Graded (or
 * Removed), where it is now, and the one or two things they can do next.
 * Submitting hands it in for its assignment and locks saving; Withdraw takes
 * it back (while the assignment is open and it isn't graded). Before a
 * Submit it says which version goes in ("Submitting version 4, saved
 * 14:02") and warns when TMCode reports unsaved changes on a device.
 */

const STEPS: { key: Exclude<ProjectStatus, "removed">; label: string; icon: React.ElementType }[] = [
  { key: "draft", label: "Draft", icon: PencilLine },
  { key: "submitted", label: "Submitted", icon: Send },
  { key: "graded", label: "Graded", icon: CheckCircle2 },
];

type Action = "submit" | "withdraw" | "remove" | "restore" | "delete";

const CONFIRM: Record<Action, { title: string; description: string; label: string; danger?: boolean }> = {
  submit: {
    title: "Submit this project?",
    description:
      "Your latest saved version is handed in for the assignment and the project is locked. You can withdraw it to keep working until it's graded or the assignment closes.",
    label: "Submit",
  },
  withdraw: {
    title: "Withdraw the submission?",
    description: "The project goes back to Draft so you can keep working. Remember to submit it again before the due date.",
    label: "Withdraw",
  },
  remove: {
    title: "Remove this project?",
    description: "It's hidden from your projects but kept, and you can restore it later.",
    label: "Remove",
    danger: true,
  },
  restore: { title: "Restore this project?", description: "It comes back to your projects as a draft.", label: "Restore" },
  delete: {
    title: "Delete for good?",
    description: "The project, its history and its files are deleted. This can't be undone.",
    label: "Delete for good",
    danger: true,
  },
};

const ProjectLifecycle: React.FC<{
  projectId: number;
  status: ProjectStatus;
  statusChangedAt?: string | null;
  /** Owner actions are shown only to the owner. */
  isOwner: boolean;
  /** The project is linked to an assignment (needed to submit). */
  hasAssignment: boolean;
  /** Something to save first (tm: a saved revision; github: a reported commit). */
  canSubmitNow: boolean;
  /** The assignment is closed or completed: no submit / withdraw. */
  assignmentClosed?: boolean;
  onChanged: (status: ProjectStatus | "deleted") => void;
  compact?: boolean;
}> = ({ projectId, status, statusChangedAt, isOwner, hasAssignment, canSubmitNow, assignmentClosed = false, onChanged, compact = false }) => {
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof submitPreview> | null>(null);

  // Submit: look at the project first (head version, live TMCode windows).
  const ask = async (a: Action) => {
    if (a !== "submit") return setConfirm(a);
    setPreview(null);
    setBusy("submit");
    try {
      setPreview(submitPreview(await projectsApi.get(projectId)));
    } catch {
      // Unknown: the dialog falls back to the general wording.
    } finally {
      setBusy(null);
    }
    setConfirm("submit");
  };

  const run = async (a: Action) => {
    setConfirm(null);
    setBusy(a);
    try {
      if (a === "submit") {
        const r = await projectsApi.submitProject(projectId);
        toast.success("Project submitted — it's locked until graded or withdrawn.");
        onChanged(r.status);
      } else if (a === "withdraw") {
        onChanged(await projectsApi.withdraw(projectId));
        toast.info("Submission withdrawn — you can keep working.");
      } else if (a === "remove") {
        await projectsApi.remove(projectId);
        onChanged("removed");
        toast.info("Project removed. You can restore it from Removed.");
      } else if (a === "restore") {
        onChanged(await projectsApi.restore(projectId));
        toast.success("Project restored.");
      } else {
        await projectsApi.deleteForGood(projectId);
        onChanged("deleted");
        toast.success("Project deleted.");
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, "That didn't work — try again."));
    } finally {
      setBusy(null);
    }
  };

  const btn = (a: Action, label: string, Icon: React.ElementType, tone: "primary" | "plain" | "danger", disabled = false, title?: string) => (
    <button
      type="button"
      onClick={() => ask(a)}
      disabled={!!busy || disabled}
      title={title}
      data-testid={`lifecycle-${a}`}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "primary"
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : tone === "danger"
            ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
            : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
      }`}
    >
      {busy === a ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );

  const removed = status === "removed";
  const current = STEPS.findIndex((s) => s.key === status);

  return (
    <section
      aria-label="Project status"
      data-testid="project-lifecycle"
      className={`rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03] ${compact ? "p-3" : "p-4"}`}
    >
      {removed ? (
        <div className="flex flex-wrap items-center gap-3">
          <Trash2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
            This project was removed{statusChangedAt ? ` on ${formatDateTime(statusChangedAt)}` : ""}. It's kept for the record.
          </p>
          {isOwner && (
            <div className="flex gap-2">
              {btn("restore", "Restore", RotateCcw, "primary")}
              {btn("delete", "Delete for good", Trash2, "danger")}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ol className="flex items-center gap-1.5" aria-label="Status">
            {STEPS.map((s, i) => {
              const done = i < current;
              const here = i === current;
              return (
                <li key={s.key} className="flex items-center gap-1.5" aria-current={here ? "step" : undefined}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      here
                        ? s.key === "graded"
                          ? "bg-emerald-600 text-white"
                          : s.key === "submitted"
                            ? "bg-blue-600 text-white"
                            : "bg-amber-500 text-white"
                        : done
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <s.icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <span className={`h-px w-4 ${i < current ? "bg-emerald-400" : "bg-slate-200 dark:bg-white/10"}`} aria-hidden="true" />}
                </li>
              );
            })}
          </ol>

          {isOwner && (
            <div className="flex flex-wrap items-center gap-2">
              {status === "draft" &&
                btn(
                  "submit",
                  "Submit",
                  Send,
                  "primary",
                  !hasAssignment || !canSubmitNow || assignmentClosed,
                  !hasAssignment
                    ? "Link the project to an assignment first"
                    : !canSubmitNow
                      ? "Save to Task Mentor first"
                      : assignmentClosed
                        ? "The assignment is closed"
                        : "Hand it in for the assignment",
                )}
              {status === "submitted" &&
                btn("withdraw", "Withdraw", Undo2, "plain", assignmentClosed, assignmentClosed ? "The assignment is closed" : undefined)}
              {status === "draft" && btn("remove", "Remove", Trash2, "danger")}
            </div>
          )}
        </div>
      )}

      {!removed && (status === "submitted" || status === "graded") && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          {status === "graded"
            ? "Graded — the project is locked."
            : "Locked while submitted: saving from TMCode is paused until it's withdrawn or returned."}
          {statusChangedAt && <span>· {formatDateTime(statusChangedAt)}</span>}
        </p>
      )}
      {!removed && status === "draft" && isOwner && !hasAssignment && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Not linked to an assignment yet — link it from the Links tab to be able to submit it.
        </p>
      )}

      {confirm && (
        <ConfirmDialog
          open
          title={CONFIRM[confirm].title}
          description={
            confirm === "submit" && preview ? (
              <>
                {preview.what && (
                  <span className="mb-1 block font-semibold text-text-primary-light dark:text-text-primary-dark" data-testid="submit-what">
                    {preview.what}.
                  </span>
                )}
                {preview.unsavedOn.length > 0 && (
                  <span
                    role="alert"
                    data-testid="submit-unsaved-warning"
                    className="mb-1 flex items-start gap-1 font-semibold text-amber-700 dark:text-amber-400"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      TMCode on {preview.unsavedOn.join(" and ")} has unsaved changes. Save in TMCode first, or they won&apos;t be
                      included.
                    </span>
                  </span>
                )}
                {CONFIRM.submit.description}
              </>
            ) : (
              CONFIRM[confirm].description
            )
          }
          confirmLabel={CONFIRM[confirm].label}
          danger={CONFIRM[confirm].danger}
          onConfirm={() => run(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </section>
  );
};

export default ProjectLifecycle;
