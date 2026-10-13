import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { AlertTriangle, CalendarClock, Loader2, Lock, Play, Save, Send, Undo2 } from "lucide-react";
import CodeWorkspace, { type CodeWorkspaceHandle } from "../../components/code/CodeWorkspace";
import FocusHeader from "../../components/code/FocusHeader";
import { READ_ONLY_REASON, useProjectFiles } from "../../components/code/useProjectFiles";
import RichTextDisplay from "../../components/Common/RichTextDisplay";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Badge from "../../components/ui/Badge";
import { TmcodeDeepLinkButton } from "../../components/Projects/OpenProjectInTmcode";
import { tmcodeAssignmentsApi, type AssignmentDetail } from "../../services/tmcodeAssignmentsApi";
import { apiErrorMessage, projectsApi } from "../../services/projectsApi";

/**
 * Working on a code assignment in the browser (CODE_RUNNER_PLAN.md §7.1,
 * assignment mode): the task on the left, the student's project in the
 * editor, Run and Tests below, and the one Submit in the header. Opening it
 * before starting starts the assignment (copies the starter files).
 */

const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "attention" }> = {
  draft: { label: "Draft", tone: "attention" },
  submitted: { label: "Submitted", tone: "info" },
  graded: { label: "Graded", tone: "success" },
  removed: { label: "Removed", tone: "neutral" },
};

const fmtDue = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

const AssignmentWorkPage: React.FC = () => {
  const { assignmentId: idParam } = useParams();
  const assignmentId = Number(idParam);
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"submit" | "withdraw" | null>(null);
  const [busy, setBusy] = useState(false);
  const workspace = useRef<CodeWorkspaceHandle>(null);
  const { project, files, setFiles, dirty, canSave, save, saving, savedAt, error, reloadProject } = useProjectFiles(projectId);

  const loadAssignment = useCallback(async () => {
    try {
      let a = await tmcodeAssignmentsApi.get(assignmentId);
      if (!a.my?.project_id) {
        if (a.read_only || a.status === "completed") {
          setAssignment(a);
          setLoadError("This assignment is closed, and you haven't started it.");
          return;
        }
        // Opening the work page starts the assignment (copies the starter).
        await tmcodeAssignmentsApi.start(assignmentId);
        a = await tmcodeAssignmentsApi.get(assignmentId);
      }
      setAssignment(a);
      setProjectId(a.my?.project_id ?? null);
    } catch (e) {
      setLoadError(apiErrorMessage(e, "Couldn't open this assignment."));
    }
  }, [assignmentId]);

  useEffect(() => {
    void loadAssignment();
  }, [loadAssignment]);

  const parent = `/assignments/${assignmentId}`;
  const status = project?.status ?? "draft";
  const readOnly = !canSave;
  const reason = project && readOnly ? READ_ONLY_REASON[status] ?? "You can read this project but not change it." : null;

  const submit = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      if (dirty && !(await save({ quiet: true }))) return;
      await projectsApi.submitProject(projectId);
      toast.success("Submitted. Your teacher can grade it now.");
      await Promise.all([reloadProject(), loadAssignment()]);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't submit."));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const withdraw = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      await projectsApi.withdraw(projectId);
      toast.success("Withdrawn: you can keep working on it.");
      await reloadProject();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't withdraw."));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const leave = (e: React.MouseEvent) => {
    if (dirty && !window.confirm("Leave without saving your changes?")) e.preventDefault();
  };

  const task = assignment && (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-text-primary-light dark:text-text-primary-dark">{assignment.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          {assignment.due_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Due {fmtDue(assignment.due_date)}
            </span>
          )}
          <span>{assignment.points} points</span>
        </p>
      </div>
      {assignment.description_html && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <RichTextDisplay content={assignment.description_html} />
        </div>
      )}
      {assignment.instructions && <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/5">{assignment.instructions}</p>}
      {assignment.attachments.length > 0 && (
        <ul className="space-y-1 text-xs">
          {assignment.attachments.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {f.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {assignment.rubric.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light">Marking guide</p>
          <ul className="space-y-1 text-xs">
            {assignment.rubric.map((c, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{c.criteria}</span>
                <span className="font-semibold tabular-nums">{c.max_score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const meta = STATUS[status] ?? STATUS.draft;

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950" data-testid="assignment-work">
      <FocusHeader
        backTo={parent}
        backLabel="Assignment"
        onBack={leave}
        title={assignment?.title ?? "Assignment"}
        status={
          project && (
            <>
              <Badge tone={meta.tone} testId="work-status">
                {meta.label}
              </Badge>
              {readOnly ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Read-only
                </span>
              ) : saving ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </span>
              ) : dirty ? (
                <span className="font-semibold text-amber-700 dark:text-amber-300" data-testid="editor-unsaved">Unsaved changes</span>
              ) : savedAt ? (
                <span data-testid="editor-saved">Saved</span>
              ) : null}
            </>
          )
        }
      >
        {projectId && <TmcodeDeepLinkButton getLink={() => tmcodeAssignmentsApi.openLink(assignmentId)} label="Open in TMCode" buttonClassName="!px-3 !py-1.5 !text-xs !rounded-lg" className="hidden md:block" />}
        {canSave && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
          >
            <Save className="h-4 w-4" aria-hidden="true" /> Save
          </button>
        )}
        <button
          type="button"
          onClick={() => workspace.current?.run()}
          disabled={!files}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Run
        </button>
        {status === "draft" && canSave && (
          <button
            type="button"
            onClick={() => setConfirm("submit")}
            disabled={busy || !files}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            data-testid="work-submit"
          >
            <Send className="h-4 w-4" aria-hidden="true" /> Submit
          </button>
        )}
        {status === "submitted" && (
          <button
            type="button"
            onClick={() => setConfirm("withdraw")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/5"
            data-testid="work-withdraw"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" /> Withdraw
          </button>
        )}
      </FocusHeader>

      {reason && (
        <p className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {reason}
        </p>
      )}

      <div className="min-h-0 flex-1">
        {loadError || error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">
              {loadError ?? error}
            </p>
            <button type="button" onClick={() => navigate(parent)} className="text-sm font-semibold text-primary hover:underline">
              Back to the assignment
            </button>
          </div>
        ) : !files ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <CodeWorkspace
            ref={workspace}
            files={files}
            onFilesChange={setFiles}
            readOnly={readOnly}
            task={task}
            language={assignment?.language ?? project?.language ?? null}
            onSave={canSave ? () => void save() : undefined}
            storageKey="assignment"
          />
        )}
      </div>

      <ConfirmDialog
        open={confirm === "submit"}
        title="Submit your work?"
        description={`Your teacher will grade the version you submit.${dirty ? " Your unsaved changes are saved first." : ""} You can withdraw it until it's graded.`}
        confirmLabel="Submit"
        onConfirm={() => void submit()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "withdraw"}
        title="Withdraw your submission?"
        description="It goes back to a draft so you can keep working on it. Submit it again when you're done."
        confirmLabel="Withdraw"
        onConfirm={() => void withdraw()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default AssignmentWorkPage;
