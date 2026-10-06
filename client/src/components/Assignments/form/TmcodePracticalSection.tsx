import React, { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  File as FileIcon,
  FlaskConical,
  FolderCode,
  FolderOpen,
  Loader2,
  PowerOff,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import Select from "../../ui/Select";
import { Skeleton } from "../../ui/Skeleton";
import {
  apiErrorMessage,
  projectsApi,
  type ManifestFile,
  type ProjectSummary,
  type RevisionSummary,
} from "../../../services/projectsApi";
import { KIND_LABEL, type TmcodeKind, type TmcodeSettings } from "../../../services/tmcodeAssignmentsApi";
import { LanguageBadge } from "../../Projects/ProjectBadges";
import { formatBytes, LANGUAGE_CHOICES, timeAgo } from "../../Projects/projectFormat";

/**
 * "TMCode practical" section of the assignment form (ASSIGNMENTS_PLAN.md
 * "Task Mentor web"): off / practical / case study, the language, a starter
 * project of the teacher's (latest saved version or a fixed revision) with a
 * preview of its files, and instructions shown beside the code in TMCode.
 * Saved by the page through PUT /api/tmcode/assignments/:id/tmcode.
 */

const KINDS: { value: TmcodeKind | null; label: string; hint: string; icon: React.ElementType }[] = [
  { value: null, label: "Off", hint: "A regular assignment", icon: PowerOff },
  { value: "practical", label: KIND_LABEL.practical, hint: "Graded coding task", icon: FlaskConical },
  { value: "case_study", label: KIND_LABEL.case_study, hint: "A problem to work on", icon: Sparkles },
];

const PREVIEW_MAX = 12;

/** The teacher's own TM projects that can be a starter (not archived, not a student workspace). */
export const starterCandidates = (projects: ProjectSummary[]) =>
  projects.filter((p) => p.kind === "tm" && !p.archived_at && !p.assignment && p.my_role === "owner");

const TmcodePracticalSection: React.FC<{
  value: TmcodeSettings;
  onChange: (next: TmcodeSettings) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => {
  const id = useId();
  const on = value.kind !== null;
  const set = (patch: Partial<TmcodeSettings>) => onChange({ ...value, ...patch });

  // ── The teacher's projects (loaded once TMCode is on) ──
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const loadProjects = async () => {
    setProjectsError(null);
    try {
      setProjects(starterCandidates((await projectsApi.list("mine")).projects));
    } catch (e) {
      setProjectsError(apiErrorMessage(e, "Couldn't load your projects."));
    }
  };
  useEffect(() => {
    if (on && projects === null && !projectsError) loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const starter = projects?.find((p) => p.id === value.starter_project_id) ?? null;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects ?? [];
    return q ? list.filter((p) => [p.name, p.description, p.language].some((s) => s?.toLowerCase().includes(q))) : list;
  }, [projects, query]);

  // ── Revisions and files of the chosen starter ──
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [files, setFiles] = useState<ManifestFile[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  useEffect(() => {
    setRevisions(null);
    if (!on || !value.starter_project_id) return;
    let cancelled = false;
    projectsApi
      .revisions(value.starter_project_id)
      .then((r) => !cancelled && setRevisions(r))
      .catch(() => !cancelled && setRevisions([]));
    return () => {
      cancelled = true;
    };
  }, [on, value.starter_project_id]);
  useEffect(() => {
    setFiles(null);
    setFilesError(null);
    if (!on || !value.starter_project_id) return;
    let cancelled = false;
    projectsApi
      .manifest(value.starter_project_id, value.starter_revision_id ?? "head")
      .then((m) => !cancelled && setFiles(m.files))
      .catch((e) => {
        if (cancelled) return;
        const status = (e as { response?: { status?: number } })?.response?.status;
        setFiles([]);
        if (status !== 404) setFilesError(apiErrorMessage(e, "Couldn't load the starter's files."));
      });
    return () => {
      cancelled = true;
    };
  }, [on, value.starter_project_id, value.starter_revision_id]);

  const pickStarter = (p: ProjectSummary | null) =>
    set({
      starter_project_id: p?.id ?? null,
      starter_revision_id: null,
      // Fill the language from the starter when the teacher hasn't chosen one.
      language: value.language || p?.language || null,
    });

  const totalSize = files?.reduce((n, f) => n + f.size, 0) ?? 0;

  return (
    <div className="space-y-5" data-testid="tmcode-section">
      {/* Kind */}
      <div>
        <p id={`${id}-kind`} className="mb-1.5 text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
          Work in TMCode
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-kind`}
          className="grid grid-cols-1 gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800 sm:inline-grid sm:grid-cols-3"
        >
          {KINDS.map((k) => {
            const active = value.kind === k.value;
            return (
              <button
                key={k.label}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => set({ kind: k.value })}
                className={`relative flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active ? "text-text-primary-light dark:text-text-primary-dark" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`${id}-kind-pill`}
                    className="absolute inset-0 rounded-xl bg-white shadow dark:bg-gray-900"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <k.icon className={`relative h-4 w-4 shrink-0 ${active && k.value ? "text-blue-600 dark:text-blue-400" : ""}`} aria-hidden="true" />
                <span className="relative">
                  <span className="block text-sm font-semibold">{k.label}</span>
                  <span className="block text-[11px] leading-tight text-gray-500 dark:text-gray-400">{k.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {on && (
          <motion.div
            key="on"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-5 pt-1">
              <p className="flex items-start gap-2 rounded-xl bg-blue-50/70 px-3 py-2 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                <FolderCode className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Students open it in TMCode, start from your starter files, save as they work and submit their project.
                Setting the assignment to Completed makes it read-only.
              </p>

              {/* Language */}
              <div className="max-w-xs">
                <label htmlFor={`${id}-lang`} className="mb-1.5 block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  Language
                </label>
                <Select
                  id={`${id}-lang`}
                  variant="outline"
                  className="w-full"
                  value={value.language ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ language: e.target.value || null })}
                >
                  <option value="">Not set</option>
                  {LANGUAGE_CHOICES.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                  {value.language && !LANGUAGE_CHOICES.some(([v]) => v === value.language) && (
                    <option value={value.language}>{value.language}</option>
                  )}
                </Select>
              </div>

              {/* Starter */}
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">Starter files</p>
                  <Link to="/projects" target="_blank" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                    Manage projects
                  </Link>
                </div>
                <StarterPicker
                  projects={projects}
                  shown={shown}
                  error={projectsError}
                  onRetry={loadProjects}
                  query={query}
                  onQuery={setQuery}
                  selectedId={value.starter_project_id}
                  onPick={pickStarter}
                  disabled={disabled}
                />
              </div>

              {value.starter_project_id && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label htmlFor={`${id}-rev`} className="mb-1.5 block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                      Version students start from
                    </label>
                    <Select
                      id={`${id}-rev`}
                      variant="outline"
                      className="w-full"
                      value={value.starter_revision_id ?? ""}
                      disabled={disabled || revisions === null}
                      onChange={(e) => set({ starter_revision_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">Latest saved version (when each student starts)</option>
                      {(revisions ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {`Revision #${r.number}${r.message ? ` · ${r.message}` : ""} · ${timeAgo(r.created_at)}`}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {value.starter_revision_id
                        ? "Fixed: later saves to the starter won't reach students."
                        : "Keep improving the starter until students start; each gets the newest save."}
                    </p>
                  </div>
                  <StarterPreview
                    files={files}
                    error={filesError}
                    name={starter?.name ?? null}
                    totalSize={totalSize}
                  />
                </div>
              )}

              {/* Instructions */}
              <div>
                <label htmlFor={`${id}-instr`} className="mb-1.5 block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  Instructions in TMCode
                </label>
                <textarea
                  id={`${id}-instr`}
                  rows={4}
                  maxLength={20000}
                  disabled={disabled}
                  value={value.instructions ?? ""}
                  onChange={(e) => set({ instructions: e.target.value })}
                  placeholder="e.g. Run main.py, make the tests in tests/ pass, then Submit from TMCode."
                  className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  Shown beside the code, under the brief. Plain text.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StarterPicker: React.FC<{
  projects: ProjectSummary[] | null;
  shown: ProjectSummary[];
  error: string | null;
  onRetry: () => void;
  query: string;
  onQuery: (q: string) => void;
  selectedId: number | null;
  onPick: (p: ProjectSummary | null) => void;
  disabled: boolean;
}> = ({ projects, shown, error, onRetry, query, onQuery, selectedId, onPick, disabled }) => {
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{error}</span>
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </button>
      </div>
    );
  }
  if (projects === null) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading your projects">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
  const option = (p: ProjectSummary | null) => {
    const active = (p?.id ?? null) === selectedId;
    return (
      <li key={p?.id ?? "none"}>
        <button
          type="button"
          role="radio"
          aria-checked={active}
          disabled={disabled}
          onClick={() => onPick(p)}
          data-testid={p ? `starter-${p.id}` : "starter-none"}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            active
              ? "border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-900/20"
              : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              p ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {p ? <FolderCode className="h-4 w-4" aria-hidden="true" /> : <FolderOpen className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {p ? p.name : "No starter files"}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
              {p ? (
                <>
                  <LanguageBadge language={p.language} />
                  <span>
                    {p.file_count} file{p.file_count === 1 ? "" : "s"} · {formatBytes(p.size_bytes)}
                  </span>
                  <span>{p.head ? `saved ${timeAgo(p.head.created_at)} · rev ${p.head.number}` : "not saved yet"}</span>
                </>
              ) : (
                "Students start with an empty folder"
              )}
            </span>
          </span>
          {active && <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
        </button>
      </li>
    );
  };
  return (
    <div className="space-y-2">
      {projects.length > 5 && (
        <label className="relative block">
          <span className="sr-only">Search your projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search your projects"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </label>
      )}
      <ul role="radiogroup" aria-label="Starter project" className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-0.5 md:grid-cols-2">
        {option(null)}
        {shown.map((p) => option(p))}
      </ul>
      {projects.length === 0 && (
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          You have no Task Mentor projects yet. Create one on the Projects page, add the starter files in TMCode and
          Save to Task Mentor.
        </p>
      )}
      {projects.length > 0 && shown.length === 0 && (
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">No project matches “{query}”.</p>
      )}
    </div>
  );
};

const StarterPreview: React.FC<{
  files: ManifestFile[] | null;
  error: string | null;
  name: string | null;
  totalSize: number;
}> = ({ files, error, name, totalSize }) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/40" data-testid="starter-preview">
    <p className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
      <span className="truncate">Students get{name ? ` (${name})` : ""}</span>
      {files && files.length > 0 && (
        <span className="shrink-0 font-normal">
          {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(totalSize)}
        </span>
      )}
    </p>
    {files === null ? (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading files…
      </div>
    ) : error ? (
      <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
        {error}
      </p>
    ) : files.length === 0 ? (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        This project has no saved files yet. Open it in TMCode and Save to Task Mentor.
      </p>
    ) : (
      <ul className="space-y-0.5">
        {files.slice(0, PREVIEW_MAX).map((f) => (
          <li key={f.path} className="flex items-center gap-2 text-xs">
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-mono text-text-primary-light dark:text-text-primary-dark">{f.path}</span>
            <span className="shrink-0 tabular-nums text-gray-500">{formatBytes(f.size)}</span>
          </li>
        ))}
        {files.length > PREVIEW_MAX && (
          <li className="pt-1 text-xs text-gray-500">and {files.length - PREVIEW_MAX} more…</li>
        )}
      </ul>
    )}
  </div>
);

export default TmcodePracticalSection;
