import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FolderCode, Loader2, Plus, Send } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Skeleton } from "../ui/Skeleton";
import { apiErrorMessage, projectsApi, type ProjectSummary } from "../../services/projectsApi";
import { LinkStatusBadge } from "./ProjectBadges";
import { formatDateTime, freezeTarget } from "./projectFormat";
import Select from "../ui/Select";

/**
 * "Submit a project" on an assignment whose submission_type allows `project`:
 * pick one of your TMCode projects, link it to the assignment and submit,
 * which freezes its latest revision (or last pushed commit). Shows the
 * submission once made.
 */
const SubmitProjectCard: React.FC<{
  assignmentId: number;
  assignmentTitle: string;
  /** The assignment is closed (overdue / not published): view only. */
  closed?: boolean;
  onSubmitted?: () => void;
}> = ({ assignmentId, assignmentTitle, closed = false, onSubmitted }) => {
  const id = useId();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | "">("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await projectsApi.list("mine");
      setProjects(list.projects.filter((p) => !p.archived_at));
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load your projects."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A project already linked to (or submitted for) this assignment.
  const existing = useMemo(() => {
    for (const p of projects ?? []) {
      const link = p.links.items.find((l) => l.activity_type === "assignment" && l.activity_id === assignmentId);
      if (link) return { project: p, link };
    }
    return null;
  }, [projects, assignmentId]);

  useEffect(() => {
    if (existing) setChoice(existing.project.id);
    else if (projects?.length === 1) setChoice(projects[0].id);
  }, [existing, projects]);

  const selected = projects?.find((p) => p.id === choice) ?? null;
  const target = selected ? freezeTarget(selected) : null;

  const submit = async () => {
    if (!selected) return;
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const linkId =
        existing && existing.project.id === selected.id
          ? existing.link.id
          : (await projectsApi.link(selected.id, "assignment", assignmentId)).id;
      const link = await projectsApi.submit(selected.id, linkId);
      toast.success(`“${selected.name}” submitted.`);
      setProjects((list) =>
        (list ?? []).map((p) =>
          p.id === selected.id
            ? {
                ...p,
                links: {
                  total: p.links.total + (p.links.items.some((l) => l.id === linkId) ? 0 : 1),
                  submitted: p.links.submitted + 1,
                  items: [
                    ...p.links.items.filter((l) => l.id !== linkId),
                    { id: linkId, activity_type: "assignment", activity_id: assignmentId, status: "submitted", submitted_at: link.submitted_at ?? new Date().toISOString(), activity_title: assignmentTitle },
                  ],
                },
              }
            : p,
        ),
      );
      onSubmitted?.();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't submit the project."));
    } finally {
      setBusy(false);
    }
  };

  const submittedLink = existing?.link.status === "submitted" ? existing : null;

  return (
    <section
      aria-label="Submit a project"
      data-testid="submit-project-card"
      className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <FolderCode className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Submit a project</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              This assignment accepts a TMCode project. Submitting freezes its latest saved version.
            </p>
          </div>

          {projects === null && !error ? (
            <Skeleton className="h-10 rounded-xl" />
          ) : submittedLink ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link to={`/projects/${submittedLink.project.id}?tab=links`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                {submittedLink.project.name}
              </Link>
              <LinkStatusBadge status="submitted" />
              {submittedLink.link.submitted_at && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(submittedLink.link.submitted_at)}</span>
              )}
            </div>
          ) : projects && projects.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              You don&apos;t have a project yet.
              <Link to="/projects" className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create one
              </Link>
            </div>
          ) : projects ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor={`${id}-project`} className="sr-only">
                Project to submit
              </label>
              <Select variant="outline"
                id={`${id}-project`}
                value={choice}
                onChange={(e) => setChoice(e.target.value ? Number(e.target.value) : "")}
                disabled={closed || busy}
                className="flex-1"
              >
                <option value="">Choose a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.kind === "tm" ? (p.head ? ` · revision #${p.head.number}` : " · not saved yet") : " · GitHub"}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={closed || busy || !selected || !target}
                data-track="tm.project.submit_click"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                Submit project
              </button>
            </div>
          ) : null}

          {selected && !target && !submittedLink && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {selected.kind === "tm"
                ? "This project has no saved version yet: open it in TMCode and Save to Task Mentor first."
                : "TMCode hasn't reported a commit for this project yet: push from TMCode first."}
            </p>
          )}
          {closed && !submittedLink && <p className="text-xs text-slate-500 dark:text-slate-400">This assignment is closed for submissions.</p>}
          {error && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Submit this project?"
        description={`This submits ${selected?.name ?? "the project"} (${target ?? ""}) to “${assignmentTitle}”. Later saves won't change what your teacher sees.`}
        confirmLabel="Submit"
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};

export default SubmitProjectCard;
