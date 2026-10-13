import React, { useState } from "react";
import { ExternalLink, Globe, Loader2, Play, RotateCw, Square } from "lucide-react";
import type { PreviewStatus } from "./usePreview";

/**
 * The Preview tab for web servers: Start, the server's output while it
 * builds, then the page in a sandboxed frame on the separate preview origin.
 */
const PreviewPanel: React.FC<{
  status: PreviewStatus;
  logs: string;
  url: string | null;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onReload: () => void;
}> = ({ status, logs, url, error, onStart, onStop, onReload }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const running = status === "starting" || status === "ready";

  return (
    <div className="flex h-full min-h-[14rem] flex-col gap-2" data-testid="preview-panel">
      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button type="button" onClick={onStart} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" data-testid="preview-start">
            <Play className="h-3.5 w-3.5" aria-hidden="true" /> {status === "ended" ? "Start again" : "Start server"}
          </button>
        ) : (
          <button type="button" onClick={onStop} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" data-testid="preview-stop">
            <Square className="h-3 w-3" aria-hidden="true" /> Stop
          </button>
        )}
        {status === "starting" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting your server…
          </span>
        )}
        {status === "ready" && url && (
          <>
            <button
              type="button"
              onClick={() => {
                onReload();
                setFrameKey((k) => k + 1);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Reload
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-gray-100 dark:hover:bg-white/10">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open in a new tab
            </a>
          </>
        )}
        <button type="button" onClick={() => setShowLogs((v) => !v)} aria-pressed={showLogs} className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/10">
          {showLogs ? "Hide server output" : "Server output"}
        </button>
      </div>
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          {error}
        </p>
      )}
      {(showLogs || (status !== "ready" && logs)) && (
        <pre className="max-h-40 shrink-0 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2.5 font-mono text-xs text-slate-100" data-testid="preview-logs">
          {logs || "No output yet."}
        </pre>
      )}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10">
        {status === "ready" && url ? (
          <iframe
            key={frameKey}
            src={url}
            title="Your web app"
            // A separate origin; same-origin lets the app call its own API.
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            referrerPolicy="no-referrer"
            className="h-full w-full"
            data-testid="preview-frame"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <Globe className="h-6 w-6 text-gray-400" aria-hidden="true" />
            {status === "starting" ? "Your page appears here when the server answers." : "Start the server to see your web app here. It stops when you leave or after 15 minutes."}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
