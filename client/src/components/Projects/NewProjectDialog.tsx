import React, { useEffect, useId, useState } from "react";
import { Cloud, GitBranch, Loader2 } from "lucide-react";
import Modal from "../ui/Modal";
import {
  apiErrorMessage,
  projectsApi,
  type ProjectKind,
  type ProjectVisibility,
} from "../../services/projectsApi";
import { isGithubRepoUrl, LANGUAGE_CHOICES } from "./projectFormat";

const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-text-primary-light placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200";

/**
 * New project: a Task Mentor project (files saved to TM from TMCode) or a
 * GitHub project (files on GitHub, TM keeps the link and the git status).
 */
const NewProjectDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: (project: { id: number; name: string }) => void;
}> = ({ open, onClose, onCreated }) => {
  const id = useId();
  const [kind, setKind] = useState<ProjectKind>("tm");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [repoUrl, setRepoUrl] = useState("");
  const [visibility, setVisibility] = useState<ProjectVisibility>("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind("tm");
    setName("");
    setDescription("");
    setLanguage("cpp");
    setRepoUrl("");
    setVisibility("private");
    setError(null);
    setTouched(false);
  }, [open]);

  // A repo URL names the project when the name is still empty.
  const repoName = isGithubRepoUrl(repoUrl) ? repoUrl.trim().replace(/\.git\/?$|\/$/g, "").split("/").pop() ?? "" : "";

  const nameError = touched && !name.trim() && !(kind === "github" && repoName) ? "Give the project a name." : null;
  const repoError =
    touched && kind === "github" && !isGithubRepoUrl(repoUrl)
      ? "Enter the repository's https://github.com/owner/repo address."
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const finalName = name.trim() || (kind === "github" ? repoName : "");
    if (!finalName || (kind === "github" && !isGithubRepoUrl(repoUrl))) return;
    setBusy(true);
    setError(null);
    try {
      const project = await projectsApi.create({
        name: finalName,
        description: description.trim() || undefined,
        language: language.trim() || undefined,
        kind,
        visibility,
        ...(kind === "github" ? { repo_url: repoUrl.trim() } : {}),
      });
      onCreated(project);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't create the project."));
    } finally {
      setBusy(false);
    }
  };

  const kindButton = (value: ProjectKind, icon: React.ReactNode, title: string, caption: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={kind === value}
      onClick={() => setKind(value)}
      className={`flex flex-1 items-start gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        kind === value
          ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-900/20"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          kind === value ? "bg-blue-600 text-white" : "bg-gray-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{caption}</span>
      </span>
    </button>
  );

  return (
    <Modal isOpen={open} onClose={onClose} title="New project" subtitle="Work on it in TMCode" size="lg">
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="New project">
        <div role="radiogroup" aria-label="Where the files live" className="flex flex-col gap-2 sm:flex-row">
          {kindButton("tm", <Cloud className="h-4 w-4" />, "Task Mentor", "Save files to Task Mentor from TMCode")}
          {kindButton("github", <GitBranch className="h-4 w-4" />, "GitHub", "Files stay on GitHub; push and pull as usual")}
        </div>

        {kind === "github" && (
          <div>
            <label htmlFor={`${id}-repo`} className={labelCls}>
              Repository URL
            </label>
            <input
              id={`${id}-repo`}
              type="url"
              inputMode="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              aria-invalid={!!repoError}
              aria-describedby={repoError ? `${id}-repo-err` : undefined}
              className={fieldCls}
              autoFocus
            />
            {repoError && (
              <p id={`${id}-repo-err`} className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {repoError}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor={`${id}-name`} className={labelCls}>
            Name
          </label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "github" && repoName ? repoName : "e.g. Sorting algorithms"}
            maxLength={120}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `${id}-name-err` : undefined}
            className={fieldCls}
            autoFocus={kind === "tm"}
          />
          {nameError && (
            <p id={`${id}-name-err`} className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {nameError}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-lang`} className={labelCls}>
              Language
            </label>
            <input
              id={`${id}-lang`}
              list={`${id}-langs`}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="cpp, python, react…"
              className={fieldCls}
            />
            <datalist id={`${id}-langs`}>
              {LANGUAGE_CHOICES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor={`${id}-vis`} className={labelCls}>
              Visibility
            </label>
            <select
              id={`${id}-vis`}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ProjectVisibility)}
              className={fieldCls}
            >
              <option value="private">Private — you and your teachers</option>
              <option value="course">Course — classmates can view</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-desc`} className={labelCls}>
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id={`${id}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            className={`${fieldCls} resize-none`}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            data-track="tm.project.create"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NewProjectDialog;
