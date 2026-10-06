import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { CalendarClock, ClipboardList, HelpCircle, Link2, Loader2, PencilLine, Plus, Search, Send, Unlink } from "lucide-react";
import Modal from "../ui/Modal";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Skeleton } from "../ui/Skeleton";
import {
  ACTIVITY_TYPE_LABEL,
  apiErrorMessage,
  projectsApi,
  type ActivityType,
  type LinkableActivity,
  type ProjectDetail,
  type ProjectLink,
} from "../../services/projectsApi";
import { LinkStatusBadge, Pill } from "./ProjectBadges";
import { formatDateTime, freezeTarget } from "./projectFormat";

const TYPE_ICON: Record<ActivityType, React.ElementType> = {
  quiz: HelpCircle,
  assignment: ClipboardList,
  manual_assessment: PencilLine,
};

/**
 * Links tab: the activities this project is linked to, with Submit (which
 * freezes the head revision or the git commit) and Unlink; plus "Link to an
 * activity" from GET /activities/linkable.
 */
const LinksTab: React.FC<{
  project: ProjectDetail;
  canEdit: boolean;
  onLinksChange: (links: ProjectLink[]) => void;
}> = ({ project, canEdit, onLinksChange }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState<ProjectLink | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<ProjectLink | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const links = project.links;
  const target = freezeTarget(project);

  const replace = (link: ProjectLink) => onLinksChange(links.map((l) => (l.id === link.id ? { ...l, ...link } : l)));

  const doSubmit = async (link: ProjectLink) => {
    setConfirmSubmit(null);
    setBusyId(link.id);
    setError(null);
    try {
      const updated = await projectsApi.submit(project.id, link.id);
      replace({
        ...link,
        ...updated,
        status: "submitted",
        activity_title: updated.activity_title ?? link.activity_title,
        course: updated.course ?? link.course,
      });
      toast.success(`Submitted to ${link.activity_title ?? "the activity"}.`);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't submit the project."));
    } finally {
      setBusyId(null);
    }
  };

  const doUnlink = async (link: ProjectLink) => {
    setConfirmUnlink(null);
    setBusyId(link.id);
    setError(null);
    try {
      await projectsApi.unlink(project.id, link.id);
      onLinksChange(links.filter((l) => l.id !== link.id));
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't unlink the activity."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Link this project to a quiz, an assignment or a recorded assessment. Submitting freezes{" "}
          {project.kind === "tm" ? "the latest revision" : "the last reported commit"}, so your teacher sees exactly that version.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Link to an activity
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </p>
      )}

      {links.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <Link2 className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Not linked to any activity yet.</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Linked activities">
          <AnimatePresence initial={false}>
            {links.map((l) => {
              const Icon = TYPE_ICON[l.activity_type] ?? ClipboardList;
              const busy = busyId === l.id;
              return (
                <motion.li
                  key={l.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200/70 bg-card-light px-4 py-3 dark:border-border-dark/30 dark:bg-card-dark/30"
                  data-testid={`link-row-${l.id}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {l.activity_title ?? `${ACTIVITY_TYPE_LABEL[l.activity_type]} #${l.activity_id}`}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{ACTIVITY_TYPE_LABEL[l.activity_type]}</span>
                      {l.course && <span>· {l.course.code ? `${l.course.code} — ` : ""}{l.course.title}</span>}
                      {l.status === "submitted" && l.submitted_at ? (
                        <span>· submitted {formatDateTime(l.submitted_at)}</span>
                      ) : l.due_date ? (
                        <span className="inline-flex items-center gap-1">
                          · <CalendarClock className="h-3 w-3" aria-hidden="true" /> due {formatDateTime(l.due_date)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <LinkStatusBadge status={l.status} revisionNumber={l.revision_number} gitCommit={l.git_commit} />
                  {canEdit && l.status === "linked" && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmUnlink(l)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-gray-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        <Unlink className="h-3.5 w-3.5" aria-hidden="true" /> Unlink
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmSubmit(l)}
                        disabled={busy || !target}
                        title={target ? undefined : project.kind === "tm" ? "Save to Task Mentor from TMCode first" : "Push from TMCode first"}
                        data-track="tm.project.submit_click"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                        Submit
                      </button>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {canEdit && !target && links.some((l) => l.status === "linked") && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {project.kind === "tm"
            ? "There is nothing to submit yet: open the project in TMCode and Save to Task Mentor."
            : "TMCode hasn't reported a commit yet: commit and push from TMCode, then submit."}
        </p>
      )}

      <ConfirmDialog
        open={!!confirmSubmit}
        title="Submit this project?"
        description={`This submits ${target ?? "the project"} to “${confirmSubmit?.activity_title ?? "the activity"}”. Later saves won't change what your teacher sees, and you can't unlink it afterwards.`}
        confirmLabel="Submit"
        onConfirm={() => confirmSubmit && doSubmit(confirmSubmit)}
        onCancel={() => setConfirmSubmit(null)}
      />
      <ConfirmDialog
        open={!!confirmUnlink}
        danger
        title="Unlink this activity?"
        description={`“${confirmUnlink?.activity_title ?? "The activity"}” will no longer be linked to this project.`}
        confirmLabel="Unlink"
        onConfirm={() => confirmUnlink && doUnlink(confirmUnlink)}
        onCancel={() => setConfirmUnlink(null)}
      />
      <LinkActivityDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exclude={links}
        onPick={async (a) => {
          const link = await projectsApi.link(project.id, a.activity_type, a.activity_id);
          onLinksChange([
            ...links,
            {
              ...link,
              project_id: link.project_id || project.id,
              activity_title: link.activity_title ?? a.title,
              course: link.course ?? a.course ?? null,
              due_date: link.due_date ?? a.due_date ?? null,
            },
          ]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
};

/** Picks one of the caller's open activities (GET /activities/linkable). */
export const LinkActivityDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  exclude: Pick<ProjectLink, "activity_type" | "activity_id">[];
  onPick: (activity: LinkableActivity) => Promise<void>;
}> = ({ open, onClose, exclude, onPick }) => {
  const [items, setItems] = useState<LinkableActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ActivityType | "">("");
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    setError(null);
    setChoice(null);
    setQuery("");
    projectsApi
      .linkable()
      .then((list) => !cancelled && setItems(list))
      .catch((e) => !cancelled && setError(apiErrorMessage(e, "Couldn't load your activities.")));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const keyOf = (a: Pick<LinkableActivity, "activity_type" | "activity_id">) => `${a.activity_type}:${a.activity_id}`;
  const taken = useMemo(() => new Set(exclude.map(keyOf)), [exclude]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (a) =>
        !taken.has(keyOf(a)) &&
        (!type || a.activity_type === type) &&
        (!q || a.title.toLowerCase().includes(q) || a.course?.title.toLowerCase().includes(q) || a.course?.code?.toLowerCase().includes(q)),
    );
  }, [items, query, type, taken]);

  const picked = visible.find((a) => keyOf(a) === choice) ?? null;

  const confirm = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await onPick(picked);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't link the activity."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Link to an activity"
      subtitle="Your open quizzes, assignments and recorded assessments"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 border-t border-border-light p-4 dark:border-gray-700/30 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!picked || busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Link
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search activities</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activities or subjects"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
            />
          </label>
          <select
            aria-label="Activity type"
            value={type}
            onChange={(e) => setType(e.target.value as ActivityType | "")}
            className="rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
          >
            <option value="">All types</option>
            <option value="assignment">Assignments</option>
            <option value="quiz">Quizzes</option>
            <option value="manual_assessment">Recorded assessments</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </p>
        )}

        {items === null && !error ? (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-slate-500 dark:border-gray-700 dark:text-slate-400">
            {items?.length ? "No activities match." : "You have no open activities to link."}
          </p>
        ) : (
          <div role="radiogroup" aria-label="Activities" className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {visible.map((a) => {
              const Icon = TYPE_ICON[a.activity_type] ?? ClipboardList;
              const checked = keyOf(a) === choice;
              return (
                <button
                  key={keyOf(a)}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setChoice(keyOf(a))}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    checked
                      ? "border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-900/20"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{a.title}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {a.course ? `${a.course.code ? `${a.course.code} — ` : ""}${a.course.title}` : ACTIVITY_TYPE_LABEL[a.activity_type]}
                      {a.due_date ? ` · due ${formatDateTime(a.due_date)}` : ""}
                    </span>
                  </span>
                  <Pill tone="slate">{ACTIVITY_TYPE_LABEL[a.activity_type]}</Pill>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default LinksTab;
