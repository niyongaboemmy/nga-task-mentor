import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { loadProjectFiles, saveProjectFiles, type CodeFile } from "../../services/codeApi";
import { apiErrorCode, apiErrorMessage, projectsApi, type ProjectDetail } from "../../services/projectsApi";

/** Why a project opens read-only, by its status. */
export const READ_ONLY_REASON: Record<string, string> = {
  submitted: "Submitted: withdraw it to keep editing.",
  graded: "Graded: this project can't be changed any more.",
  removed: "Removed: restore it on the project page to edit.",
};

/**
 * A project's files in the browser: load the latest version, edit, save a
 * new version on top of it (CODE_RUNNER_PLAN.md §6.3). Shared by the project
 * editor and the assignment work page. Warns before leaving with unsaved
 * changes (browser close/refresh).
 */
export function useProjectFiles(projectId: number | null) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [files, setFiles] = useState<CodeFile[] | null>(null);
  const [saved, setSaved] = useState<CodeFile[]>([]);
  const [base, setBase] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [p, loaded] = await Promise.all([projectsApi.get(projectId), loadProjectFiles(projectId, "head")]);
      setProject(p);
      setFiles(loaded.files);
      setSaved(loaded.files);
      setBase(loaded.revision?.id ?? p.head_revision_id ?? null);
      setSkipped(loaded.skipped);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't open this project."));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Refresh only the project (status, permissions) — e.g. after submitting. */
  const reloadProject = useCallback(async () => {
    if (projectId) setProject(await projectsApi.get(projectId));
  }, [projectId]);

  const dirty = !!files && JSON.stringify(files) !== JSON.stringify(saved);
  const canSave = !!project?.can.save && project.kind === "tm";

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Saves when there's something to save; true when the files are saved after. */
  const save = useCallback(
    async (opts: { quiet?: boolean } = {}): Promise<boolean> => {
      if (!files || !projectId) return false;
      if (!dirty) return true;
      if (!canSave || saving) return false;
      setSaving(true);
      try {
        const rev = await saveProjectFiles(projectId, base, files);
        setBase(rev?.id ?? base);
        setSaved(files);
        setSavedAt(new Date());
        if (!opts.quiet) toast.success(rev?.number ? `Saved as version #${rev.number}.` : "Saved.");
        return true;
      } catch (e) {
        toast.error(
          apiErrorCode(e) === "REVISION_CONFLICT"
            ? "This project was saved somewhere else (TMCode?) since you opened it. Copy your changes, then reload."
            : apiErrorMessage(e, "Couldn't save."),
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [base, canSave, dirty, files, projectId, saving],
  );

  return { project, files, setFiles, dirty, canSave, save, saving, savedAt, skipped, error, reload: load, reloadProject };
}
