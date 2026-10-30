import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, ExternalLink, Laptop, Loader2, Maximize2, Monitor, RefreshCw, RotateCw, Smartphone, Tablet, X } from "lucide-react";
import { practicalsApi, type PreviewInfo } from "../../../services/practicalsApi";
import { apiErrorCode, apiErrorMessage, projectsApi } from "../../../services/projectsApi";
import { loadProjectFiles, type CodeFile } from "../../../services/codeApi";
import { usePagePreview, type RunPhpPage } from "../../code/usePagePreview";
import PageMessages from "../../code/PageMessages";
import { fitScale } from "./previewFit";

/**
 * The grading workspace's Preview tab: the submitted site in a sandboxed
 * frame, shown at a real screen size (desktop 1440×900, phone 390×844…) and
 * scaled to fit, so the page looks the way students and users see it, never
 * squeezed into the panel. Full screen gives it the whole window.
 * A PHP website runs one page at a time on the code runner, the way the MIS
 * Code Playground runs it: its links and forms open the next page, with Back.
 */

const DEVICES = [
  { key: "desktop", label: "Desktop", w: 1440, h: 900, Icon: Monitor, rotates: false },
  { key: "laptop", label: "Laptop", w: 1280, h: 800, Icon: Laptop, rotates: false },
  { key: "tablet", label: "Tablet", w: 768, h: 1024, Icon: Tablet, rotates: true },
  { key: "phone", label: "Phone", w: 390, h: 844, Icon: Smartphone, rotates: true },
] as const;
type DeviceKey = (typeof DEVICES)[number]["key"];

/** An iframe (a URL, or a page's document) at a fixed page size, scaled down to fit its container, centred. */
const ScaledFrame: React.FC<{ src?: string; srcDoc?: string; page: { w: number; h: number }; frameKey: string; onScale?: (s: number) => void }> = ({ src, srcDoc, page, frameKey, onScale }) => {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      // Leave a small margin so the device edge stays visible.
      const s = fitScale(page, { w: el.clientWidth - 24, h: el.clientHeight - 24 });
      setScale(s);
      onScale?.(s);
    };
    measure();
    // Older embedded browsers (and test DOMs) have no ResizeObserver: window resizes then.
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [page, onScale]);

  return (
    <div ref={box} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div style={{ width: page.w * scale, height: page.h * scale }} className="relative shrink-0 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/10">
        <iframe
          key={frameKey}
          title="Project preview"
          src={src}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          style={{ width: page.w, height: page.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}
          className="absolute left-0 top-0 border-0 bg-white"
          data-testid="practical-preview"
        />
      </div>
    </div>
  );
};

const PreviewPane: React.FC<{ projectId: number; revisionId: number | null }> = ({ projectId, revisionId }) => {
  const [state, setState] = useState<PreviewInfo | null>(null);
  const [files, setFiles] = useState<CodeFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [landscape, setLandscape] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [needsBuild, setNeedsBuild] = useState(false);
  const [full, setFull] = useState(false);
  const [scale, setScale] = useState(1);
  const overlay = useRef<HTMLDivElement>(null);

  // A PHP website: each page is a request to the code runner.
  const runPhp = useCallback<RunPhpPage>(
    (script, method, query, fields) =>
      practicalsApi.page(projectId, { rev: revisionId, script, method, query, fields }).catch((e) => {
        throw new Error(apiErrorMessage(e, "The page couldn't be run."));
      }),
    [projectId, revisionId],
  );
  const pages = usePagePreview({ files, runPhp, assetBase: state?.base ?? null });
  const { reset: resetPages, open: openPage } = pages;

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setFiles(null);
    resetPages();
    setError(null);
    practicalsApi
      .preview(projectId, revisionId)
      .then((r) => {
        if (cancelled) return;
        setState(r);
        // Its pages are built here from the project's files (styles and scripts inlined).
        if (r.php) {
          loadProjectFiles(projectId, revisionId ?? "head")
            .then(({ files }) => !cancelled && setFiles(files))
            .catch((e) => !cancelled && setError(apiErrorMessage(e, "Couldn't read this revision's files.")));
        }
      })
      .catch(
        (e) =>
          !cancelled &&
          setError(
            apiErrorCode(e) === "NO_HTML"
              ? "This project has no HTML or PHP page to preview. Read the code, or open it in TMCode to run it."
              : apiErrorMessage(e, "Couldn't start the preview."),
          ),
      );
    // A package.json project (React, Vite…) needs a build step the static preview can't do.
    projectsApi
      .manifest(projectId, revisionId ?? "head")
      .then((m) => !cancelled && setNeedsBuild(m.files.some((f) => f.path === "package.json")))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, revisionId, nonce, resetPages]);

  // The first page, once the files are here.
  useEffect(() => {
    if (state?.php && files) void openPage(state.entry);
  }, [state, files, openPage]);

  const d = DEVICES.find((x) => x.key === device)!;
  const page = landscape && d.rotates ? { w: d.h, h: d.w } : { w: d.w, h: d.h };

  const closeFull = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  // Full screen: the overlay asks the browser for real full screen too; Esc closes it.
  useEffect(() => {
    if (!full) return;
    overlay.current?.requestFullscreen?.().catch(() => undefined);
    // Captured first: Esc closes the full screen only, never the grading workspace behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeFull();
    };
    const onFsChange = () => !document.fullscreenElement && setFull(false);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [full, closeFull]);

  if (error) {
    return <p className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">{error}</p>;
  }

  const toolbar = (inFull: boolean) => (
    <div className={`flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 ${inFull ? "border-b border-white/10 bg-slate-900 text-slate-200" : "border-b border-slate-200 dark:border-white/10"}`}>
      {state?.php && (
        <button
          type="button"
          onClick={pages.back}
          disabled={!pages.history.length || pages.loading}
          aria-label="Back"
          title="Back"
          className={`rounded-md p-1.5 disabled:opacity-40 ${inFull ? "text-slate-300 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"}`}
          data-testid="preview-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      )}
      <span
        className={`inline-flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-lg px-2.5 py-1 font-mono text-xs ${inFull ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}
        data-testid="preview-address"
      >
        {state ? (state.php ? pages.page ?? state.entry : state.entry) : "Starting preview…"}
        {pages.loading && <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-label="Running the page" />}
      </span>
      <div className={`flex rounded-lg p-0.5 ${inFull ? "bg-white/10" : "bg-slate-100 dark:bg-white/5"}`} role="group" aria-label="Screen size">
        {DEVICES.map(({ key, label, Icon, w, h }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDevice(key)}
            aria-pressed={device === key}
            aria-label={`${label} (${w}×${h})`}
            title={`${label} · ${w}×${h}`}
            className={`rounded-md p-1.5 ${device === key ? (inFull ? "bg-white/20 text-white" : "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-white") : inFull ? "text-slate-400 hover:text-white" : "text-slate-500"}`}
            data-testid={`preview-device-${key}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      {d.rotates && (
        <button type="button" onClick={() => setLandscape((v) => !v)} aria-pressed={landscape} aria-label="Rotate" title="Rotate" className={`rounded-md p-1.5 ${inFull ? "text-slate-300 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      )}
      <span className={`whitespace-nowrap text-right font-mono text-[11px] tabular-nums ${inFull ? "text-slate-400" : "text-slate-500"}`} data-testid="preview-size">
        {page.w}×{page.h} · {Math.round(scale * 100)}%
      </span>
      <button type="button" onClick={() => (state?.php && pages.page ? pages.reload() : setNonce((n) => n + 1))} aria-label="Reload preview" title="Reload" className={`rounded-md p-1.5 ${inFull ? "text-slate-300 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      {state && !state.php && (
        <a href={state.url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab" title="Open in a new tab" className={`rounded-md p-1.5 ${inFull ? "text-slate-300 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {inFull ? (
        <button type="button" onClick={closeFull} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20" data-testid="preview-close-full">
          <X className="h-3.5 w-3.5" aria-hidden="true" /> Close (Esc)
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setFull(true)}
          disabled={!state}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="preview-full-screen"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Full screen
        </button>
      )}
    </div>
  );

  const frame = (inFull: boolean) =>
    state?.php ? (
      pages.doc !== null ? (
        <ScaledFrame srcDoc={pages.doc} page={page} frameKey={`${pages.runId}-${inFull ? "full" : "pane"}`} onScale={setScale} />
      ) : pages.loading || !files ? (
        <Loader2 className="m-auto h-5 w-5 animate-spin text-blue-600" />
      ) : (
        <p className="m-auto p-6 text-center text-xs text-slate-500">The page couldn't be shown: see the messages above.</p>
      )
    ) : state ? (
      <ScaledFrame src={state.url} page={page} frameKey={`${state.url}-${nonce}-${inFull ? "full" : "pane"}`} onScale={setScale} />
    ) : (
      <Loader2 className="m-auto h-5 w-5 animate-spin text-blue-600" />
    );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" data-testid="preview-pane">
      {toolbar(false)}
      <PageMessages messages={pages.messages} />
      {needsBuild && (
        <p className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" data-testid="preview-needs-build">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            This project has a package.json (React, Vite…), so it needs a build step and this preview may be blank. Use <strong>Open in TMCode</strong> to run it.
          </span>
        </p>
      )}
      <div className="flex min-h-0 flex-1 bg-slate-100 dark:bg-slate-950">{full ? <p className="m-auto text-xs text-slate-500">Showing in full screen…</p> : frame(false)}</div>
      {full &&
        createPortal(
          <div ref={overlay} className="fixed inset-0 z-[100001] flex flex-col bg-slate-950" role="dialog" aria-modal="true" aria-label="Project preview, full screen" data-testid="preview-full">
            {toolbar(true)}
            <PageMessages messages={pages.messages} dark />
            <div className="flex min-h-0 flex-1">{frame(true)}</div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default PreviewPane;
