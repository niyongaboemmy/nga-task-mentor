import React, { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, Lock, Play, Save } from "lucide-react";
import CodeWorkspace, { type CodeWorkspaceHandle } from "../../components/code/CodeWorkspace";
import FocusHeader from "../../components/code/FocusHeader";
import { READ_ONLY_REASON, useProjectFiles } from "../../components/code/useProjectFiles";
import { TmcodeDeepLinkButton } from "../../components/Projects/OpenProjectInTmcode";
import { projectsApi } from "../../services/projectsApi";

/**
 * Editing a project in the browser (CODE_RUNNER_PLAN.md §6.3, project mode):
 * the latest saved version opens in the code workspace; Save (Ctrl/⌘+S)
 * stores a new version, Run works on what's on screen. Read-only when the
 * caller can't save (someone else's project, or submitted/graded work).
 */

const ProjectEditorPage: React.FC = () => {
  const { id } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { project, files, setFiles, dirty, canSave, save, saving, savedAt, skipped, error } = useProjectFiles(projectId);
  const workspace = useRef<CodeWorkspaceHandle>(null);
  const readOnly = !canSave;

  const leave = (e: React.MouseEvent) => {
    if (dirty && !window.confirm("Leave without saving your changes?")) e.preventDefault();
  };

  const parent = `/code/projects/${projectId}`;
  const reason = project && readOnly ? (project.kind !== "tm" ? "GitHub projects are edited on GitHub or in TMCode." : READ_ONLY_REASON[project.status] ?? "You can read this project but not change it.") : null;

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950" data-testid="project-editor">
      <FocusHeader
        backTo={parent}
        backLabel="Project"
        onBack={leave}
        title={project?.name ?? "Project"}
        status={
          project &&
          (readOnly ? (
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
          ) : null)
        }
      >
        {project && <TmcodeDeepLinkButton getLink={() => projectsApi.openLink(projectId)} label="Open in TMCode" buttonClassName="!px-3 !py-1.5 !text-xs !rounded-lg" className="hidden md:block" />}
        {canSave && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
            data-testid="editor-save"
          >
            <Save className="h-4 w-4" aria-hidden="true" /> Save
          </button>
        )}
        <button
          type="button"
          onClick={() => workspace.current?.run()}
          disabled={!files}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Run
        </button>
      </FocusHeader>

      {(reason || skipped.length > 0) && (
        <p className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {reason ??
            `${skipped.length} binary file${skipped.length === 1 ? " isn't" : "s aren't"} shown here (${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}); saving keeps only the text files.`}
        </p>
      )}

      <div className="min-h-0 flex-1">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">
              {error}
            </p>
            <button type="button" onClick={() => navigate(parent)} className="text-sm font-semibold text-primary hover:underline">
              Back to the project
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
            language={project?.language ?? null}
            onSave={canSave ? () => void save() : undefined}
            storageKey="project"
          />
        )}
      </div>
    </div>
  );
};

export default ProjectEditorPage;
