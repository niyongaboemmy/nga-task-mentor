import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { practicalsApi } from "../../../services/practicalsApi";
import { apiErrorMessage } from "../../../services/projectsApi";
import { loadProjectFiles, type CodeFile } from "../../../services/codeApi";
import { usePagePreview, type RunPhpPage } from "../../code/usePagePreview";
import PageMessages from "../../code/PageMessages";

/**
 * A PHP program's output that is a web page, shown as one (the Run tab's
 * "View as a page", as the MIS Code Playground does): in a sandboxed frame,
 * with the project's styles and scripts, and its links and forms opening the
 * project's next page on the code runner.
 */
const OutputPage: React.FC<{ projectId: number; revisionId: number | null; html: string; page: string }> = ({ projectId, revisionId, html, page }) => {
  const [files, setFiles] = useState<CodeFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runPhp = useCallback<RunPhpPage>(
    (script, method, query, fields) =>
      practicalsApi.page(projectId, { rev: revisionId, script, method, query, fields }).catch((e) => {
        throw new Error(apiErrorMessage(e, "The page couldn't be run."));
      }),
    [projectId, revisionId],
  );
  const view = usePagePreview({ files, runPhp });
  const { showOutput } = view;

  useEffect(() => {
    let cancelled = false;
    loadProjectFiles(projectId, revisionId ?? "head")
      .then(({ files }) => !cancelled && setFiles(files))
      .catch((e) => !cancelled && setError(apiErrorMessage(e, "Couldn't read this revision's files.")));
    return () => {
      cancelled = true;
    };
  }, [projectId, revisionId]);

  useEffect(() => {
    if (files) showOutput(html, page);
  }, [files, html, page, showOutput]);

  if (error) return <p className="mt-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>;
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10" data-testid="run-output-page">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1 dark:border-white/10 dark:bg-white/5">
        <button type="button" onClick={view.back} disabled={!view.history.length || view.loading} aria-label="Back" title="Back" className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-white/10">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500">{view.page ?? page}</span>
        {view.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-label="Running the page" />}
      </div>
      <PageMessages messages={view.messages} />
      {view.doc !== null ? (
        <iframe
          key={view.runId}
          title="Output as a page"
          srcDoc={view.doc}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          className="h-80 w-full border-0 bg-white"
          data-testid="run-output-frame"
        />
      ) : (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
};

export default OutputPage;
