import React, { useEffect, useMemo, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext";
import { loadProjectFiles } from "../../../services/codeApi";
import { apiErrorMessage } from "../../../services/projectsApi";
import { monacoLanguage } from "../../code/languages";
import { diffFiles, type Change } from "./diffSinceStarter";

/**
 * "Changes since starter" in Grading (CODE_RUNNER_PLAN.md §7.6): what the
 * student added, changed and deleted compared with the starter files, with a
 * side-by-side diff of the chosen file — the student's own work at a glance.
 */

const KIND = {
  added: { label: "Added", cls: "text-emerald-700 dark:text-emerald-300" },
  changed: { label: "Changed", cls: "text-amber-700 dark:text-amber-300" },
  deleted: { label: "Deleted", cls: "text-rose-700 dark:text-rose-300" },
} as const;

const lineCount = (s: string) => (s ? s.split("\n").length : 0);

const StarterDiff: React.FC<{
  projectId: number;
  revisionId: number | null;
  starter: { project_id: number; revision_id: number | null };
}> = ({ projectId, revisionId, starter }) => {
  const { theme } = useTheme();
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChanges(null);
    setError(null);
    Promise.all([loadProjectFiles(starter.project_id, starter.revision_id ?? "head"), loadProjectFiles(projectId, revisionId ?? "head")])
      .then(([s, w]) => {
        if (cancelled) return;
        const list = diffFiles(s.files, w.files);
        setChanges(list);
        setActive(list[0]?.path ?? null);
      })
      .catch((e) => !cancelled && setError(apiErrorMessage(e, "Couldn't compare with the starter files.")));
    return () => {
      cancelled = true;
    };
  }, [projectId, revisionId, starter.project_id, starter.revision_id]);

  const current = useMemo(() => changes?.find((c) => c.path === active) ?? null, [changes, active]);

  if (error) return <p className="p-4 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>;
  if (!changes) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (changes.length === 0) {
    return <p className="p-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">No changes: this is still the starter code.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 md:flex-row" data-testid="starter-diff">
      <ul className="max-h-40 shrink-0 overflow-y-auto border-b border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/[0.02] md:max-h-none md:w-64 md:border-b-0 md:border-r" aria-label="Changed files">
        {changes.map((c) => (
          <li key={c.path}>
            <button
              type="button"
              onClick={() => setActive(c.path)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${c.path === active ? "bg-white shadow-sm dark:bg-white/10" : "hover:bg-white/60 dark:hover:bg-white/5"}`}
              data-testid="diff-file"
            >
              <span className={`w-14 shrink-0 font-semibold ${KIND[c.kind].cls}`}>{KIND[c.kind].label}</span>
              <span className="min-w-0 flex-1 truncate font-mono">{c.path}</span>
              <span className="shrink-0 text-[10px] text-text-secondary-light">
                {c.kind === "deleted" ? `−${lineCount(c.before)}` : c.kind === "added" ? `+${lineCount(c.after)}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-h-[300px] min-w-0 flex-1">
        {current && (
          <DiffEditor
            original={current.before}
            modified={current.after}
            language={monacoLanguage(current.path)}
            theme={theme === "dark" ? "vs-dark" : "light"}
            options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false }}
          />
        )}
      </div>
    </div>
  );
};

export default StarterDiff;
