import React, { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { AlertTriangle, Archive, ArchiveRestore, Github, Loader2, Lock, Radio, Save, Trash2, UserMinus, UserPlus } from "lucide-react";
import Modal from "../ui/Modal";
import ConfirmDialog from "../ui/ConfirmDialog";
import {
  apiErrorMessage,
  projectsApi,
  type MemberRole,
  type ProjectDetail,
  type ProjectMember,
  type ProjectVisibility,
} from "../../services/projectsApi";
import { Avatar, Pill } from "./ProjectBadges";
import Select from "../ui/Select";

const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-text-primary-light placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200";
const GH_USER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

const ROLE_LABEL: Record<MemberRole, string> = { owner: "Owner", collaborator: "Collaborator", viewer: "Viewer" };

// ─── Members (GitHub projects only) ───────────────────────────────────────────

export const MembersTab: React.FC<{
  project: ProjectDetail;
  canEdit: boolean;
  onMembersChange: (members: ProjectMember[]) => void;
}> = ({ project, canEdit, onMembersChange }) => {
  const id = useId();
  const [who, setWho] = useState("");
  const [github, setGithub] = useState("");
  const [role, setRole] = useState<Exclude<MemberRole, "owner">>("collaborator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);

  const members = project.members.filter((m) => m.status !== "removed");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = who.trim();
    if (!target) return setError("Enter the member's email or Task Mentor user id.");
    if (!GH_USER.test(github.trim())) return setError("Enter a valid GitHub username.");
    setBusy(true);
    setError(null);
    try {
      const asId = /^\d+$/.test(target) ? Number(target) : null;
      const member = await projectsApi.addMember(project.id, {
        ...(asId ? { user_id: asId } : { email: target }),
        github_username: github.trim(),
        role,
      });
      onMembersChange([...project.members.filter((m) => m.user_id !== member.user_id), member]);
      setWho("");
      setGithub("");
      toast.success(`${member.user.name} added. TMCode invites them on GitHub the next time you open the project.`);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't add the member."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: ProjectMember) => {
    setRemoving(null);
    try {
      await projectsApi.removeMember(project.id, m.user_id);
      onMembersChange(project.members.filter((x) => x.user_id !== m.user_id));
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't remove the member."));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Members can open this GitHub project in TMCode. Collaborators get push access on GitHub; TMCode grants it with
        the owner&apos;s GitHub sign-in.
      </p>

      {canEdit && (
        <form onSubmit={add} className="grid gap-3 rounded-2xl border border-gray-200/70 bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30 md:grid-cols-[1fr_1fr_160px_auto] md:items-end" aria-label="Add a member">
          <div>
            <label htmlFor={`${id}-who`} className={labelCls}>Email or user id</label>
            <input id={`${id}-who`} value={who} onChange={(e) => setWho(e.target.value)} placeholder="student@nga.ac.rw" className={fieldCls} />
          </div>
          <div>
            <label htmlFor={`${id}-gh`} className={labelCls}>GitHub username</label>
            <div className="relative">
              <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input id={`${id}-gh`} value={github} onChange={(e) => setGithub(e.target.value)} placeholder="octocat" className={`${fieldCls} pl-9`} autoComplete="off" />
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-role`} className={labelCls}>Role</label>
            <Select id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value as "collaborator" | "viewer")} className={fieldCls}>
              <option value="collaborator">Collaborator</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            Add
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </p>
      )}

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200/70 bg-card-light dark:divide-white/5 dark:border-border-dark/30 dark:bg-card-dark/30" aria-label="Members">
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar name={project.owner.name} src={project.owner.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{project.owner.name}</p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{project.owner.email}</p>
          </div>
          <Pill tone="violet">Owner</Pill>
        </li>
        <AnimatePresence initial={false}>
          {members
            .filter((m) => m.role !== "owner")
            .map((m) => (
              <motion.li
                key={m.user_id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <Avatar name={m.user.name} src={m.user.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{m.user.name}</p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {m.user.email}
                    {m.github_username && (
                      <>
                        {" · "}
                        <a href={`https://github.com/${m.github_username}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
                          @{m.github_username}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                {m.status === "invited" && <Pill tone="amber">Invited</Pill>}
                <Pill tone={m.role === "collaborator" ? "blue" : "slate"}>{ROLE_LABEL[m.role]}</Pill>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setRemoving(m)}
                    aria-label={`Remove ${m.user.name}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </motion.li>
            ))}
        </AnimatePresence>
      </ul>

      <ConfirmDialog
        open={!!removing}
        danger
        title="Remove this member?"
        description={`${removing?.user.name ?? "They"} will lose access to this project in Task Mentor and TMCode.`}
        confirmLabel="Remove"
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const SettingsTab: React.FC<{
  project: ProjectDetail;
  onUpdated: (patch: Partial<ProjectDetail>) => void;
  onDeleted: () => void;
}> = ({ project, onUpdated, onDeleted }) => {
  const id = useId();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setVisibility(project.visibility);
  }, [project.name, project.description, project.visibility]);

  const submitted = project.links.some((l) => l.status === "submitted");
  const dirty = name.trim() !== project.name || description.trim() !== (project.description ?? "") || visibility !== project.visibility;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("The project needs a name.");
    setSaving(true);
    setError(null);
    try {
      const updated = await projectsApi.update(project.id, {
        name: name.trim(),
        description: description.trim(),
        visibility,
      });
      onUpdated({
        name: updated.name || name.trim(),
        description: updated.description ?? description.trim(),
        visibility: updated.visibility ?? visibility,
      });
      toast.success("Project settings saved.");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save the settings."));
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    setConfirmArchive(false);
    const archived = !project.archived_at;
    try {
      const updated = await projectsApi.update(project.id, { archived });
      onUpdated({ archived_at: archived ? (updated.archived_at ?? new Date().toISOString()) : null });
      toast.success(archived ? "Project archived." : "Project restored.");
    } catch (err) {
      setError(apiErrorMessage(err, archived ? "Couldn't archive the project." : "Couldn't restore the project."));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-gray-200/70 bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30" aria-label="Project settings">
        <div>
          <label htmlFor={`${id}-name`} className={labelCls}>Name</label>
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={fieldCls} />
        </div>
        <div>
          <label htmlFor={`${id}-desc`} className={labelCls}>Description</label>
          <textarea id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} className={`${fieldCls} resize-none`} />
        </div>
        <div>
          <label htmlFor={`${id}-vis`} className={labelCls}>Visibility</label>
          <Select id={`${id}-vis`} value={visibility} onChange={(e) => setVisibility(e.target.value as ProjectVisibility)} className={fieldCls}>
            <option value="private">Private — you, members and your teachers</option>
            <option value="course">Course — classmates can view</option>
          </Select>
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save changes
          </button>
        </div>
      </form>

      <ShareLiveStatus project={project} onUpdated={onUpdated} />

      <section className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50/40 p-4 dark:border-orange-900/40 dark:bg-orange-950/10" aria-label="Danger zone">
        <h3 className="flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-300">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Danger zone
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
            {project.archived_at
              ? "This project is archived. Restore it to work on it again."
              : "Archive hides the project from your list. Its files, revisions and submissions are kept."}
          </p>
          <button
            type="button"
            onClick={() => (project.archived_at ? toggleArchive() : setConfirmArchive(true))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/20"
          >
            {project.archived_at ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
            {project.archived_at ? "Restore" : "Archive"}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-200/70 pt-3 dark:border-orange-900/40">
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
            {submitted
              ? "This project was submitted to an activity, so it can't be deleted. Archive it instead."
              : "Delete the project and every revision for good."}
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={submitted}
            title={submitted ? "Submitted projects can't be deleted. Archive it instead." : undefined}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete project
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmArchive}
        danger
        title="Archive this project?"
        description="It disappears from your project list until you restore it. Nothing is deleted."
        confirmLabel="Archive"
        onConfirm={toggleArchive}
        onCancel={() => setConfirmArchive(false)}
      />
      <DeleteProjectDialog open={deleteOpen} project={project} onClose={() => setDeleteOpen(false)} onDeleted={onDeleted} />
    </div>
  );
};

/** Delete needs the project's name typed in, like GitHub does. */
const DeleteProjectDialog: React.FC<{
  open: boolean;
  project: ProjectDetail;
  onClose: () => void;
  onDeleted: () => void;
}> = ({ open, project, onClose, onDeleted }) => {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
    }
  }, [open]);

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      await projectsApi.remove(project.id);
      toast.success(`“${project.name}” deleted.`);
      onDeleted();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't delete the project."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Delete project" size="md">
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This permanently deletes <strong className="text-text-primary-light dark:text-text-primary-dark">{project.name}</strong>
          {project.kind === "tm" ? " and all of its revisions" : " from Task Mentor (the GitHub repository is not touched)"}. It can&apos;t be undone.
        </p>
        <div>
          <label htmlFor={`${id}-confirm`} className={labelCls}>
            Type <span className="font-mono">{project.name}</span> to confirm
          </label>
          <input id={`${id}-confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} className={fieldCls} autoComplete="off" />
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10">
            Cancel
          </button>
          <button
            type="button"
            onClick={del}
            disabled={typed.trim() !== project.name || busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Delete forever
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Share live status ────────────────────────────────────────────────────────

/**
 * "Share live status": whether teachers' monitors see that this project is
 * open in TMCode (which file, unsaved changes). Locked on for a workspace
 * while its assignment is open, so the teacher can follow the practical.
 */
export const ShareLiveStatus: React.FC<{
  project: ProjectDetail;
  onUpdated: (patch: Partial<ProjectDetail>) => void;
}> = ({ project, onUpdated }) => {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = project.share_presence;
  const locked = on && !project.can.share_presence;

  const toggle = async () => {
    if (locked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await projectsApi.update(project.id, { share_presence: !on });
      onUpdated({ share_presence: updated.share_presence });
      toast.success(updated.share_presence ? "Teachers can see your live status again." : "Removed from monitoring.");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't change live status sharing."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-2xl border border-gray-200/70 bg-card-light p-4 dark:border-border-dark/30 dark:bg-card-dark/30"
      data-testid="share-live-status"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Radio className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-title`} className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
            Share live status
          </h3>
          <p id={`${id}-desc`} className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Your teachers&apos; monitor shows when this project is open in TMCode, the file you&apos;re editing and unsaved
            changes. Turn it off to remove the project from monitoring; your saves and submissions are still visible.
          </p>
          {locked && (
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Locked on while {project.assignment ? `“${project.assignment.title}”` : "the assignment"} is open, so your
              teacher can follow the practical. You can turn it off once it&apos;s completed.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          data-track="tm.project.share_presence"
          aria-checked={on}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          aria-disabled={locked || busy}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
            on ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
          } ${locked || busy ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 600, damping: 35 }}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow ${on ? "ml-[22px]" : "ml-0.5"}`}
          >
            {locked ? <Lock className="h-3 w-3 text-emerald-600" aria-hidden="true" /> : busy ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" aria-hidden="true" /> : null}
          </motion.span>
        </button>
      </div>
    </section>
  );
};
