import { useCallback, useEffect, useRef, useState } from "react";
import { buildPageDocument, listenToRun, newRunId, resolvePath, type NavRequest, type PlayFile } from "../../vendor/nga-webrun";

/**
 * Web pages shown the way the MIS Code Playground shows them (nga-webrun): an
 * .html file as it is, a .php file run on the code runner, its output the
 * page. The page sits in a sandboxed srcdoc frame (no allow-same-origin); its
 * links and forms come back here and open the next page the same way, with
 * Back and the current path for an address bar. Shared by the grading
 * Preview and the Run tab's "view as a page".
 */

/** What the code runner answered for one PHP page. */
export interface PhpPageRun {
  verdict: string;
  stdout: string;
  stderr: string | null;
}

export type RunPhpPage = (script: string, method: "GET" | "POST", query: string, fields: [string, string][]) => Promise<PhpPageRun>;

export interface PageMessage {
  level: "error" | "warn" | "info";
  text: string;
}

const VERDICT_TEXT: Record<string, string> = {
  "runtime-error": "stopped with an error",
  "time-limit": "took too long (time limit)",
  "memory-limit": "ran out of memory",
  "output-limit": "printed too much",
  "internal-error": "couldn't be run (runner error)",
};

/**
 * Media of the page (img, video, audio…) load from `base`, a URL that serves
 * the project's files: a srcdoc frame has no address of its own to load them
 * from. Links and forms are left alone (the frame hands them back).
 */
export function linkAssets(doc: string, page: string, base: string): string {
  return doc.replace(/(<(?:img|source|video|audio|track|embed)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']*)\2/gi, (whole, before: string, q: string, ref: string) => {
    if (!ref || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return whole;
    const { path } = resolvePath(page, ref);
    return `${before}${q}${base}${path.split("/").map(encodeURIComponent).join("/")}${q}`;
  });
}

interface State {
  doc: string | null;
  runId: string | null;
  /** The project path of the page shown. */
  page: string | null;
  /** Pages visited before it (Back). */
  history: string[];
  loading: boolean;
  messages: PageMessage[];
}

const EMPTY: State = { doc: null, runId: null, page: null, history: [], loading: false, messages: [] };
const MAX_MESSAGES = 50;
const add = (s: State, more: PageMessage[]) => (more.length ? [...s.messages, ...more].slice(-MAX_MESSAGES) : s.messages);

export function usePagePreview({ files, runPhp, assetBase }: { files: PlayFile[] | null; runPhp: RunPhpPage; assetBase?: string | null }) {
  const [state, setState] = useState<State>(EMPTY);
  const ctx = useRef({ files, runPhp, assetBase });
  ctx.current = { files, runPhp, assetBase };
  /** The latest request: an older page's late answer is dropped. */
  const latest = useRef(0);

  const show = useCallback((html: string, path: string, more: PageMessage[], history: (s: State) => string[]) => {
    const runId = newRunId();
    const { doc, missing } = buildPageDocument(html, path, ctx.current.files ?? [], runId, "");
    const base = ctx.current.assetBase;
    setState((s) => ({
      ...s,
      doc: base ? linkAssets(doc, path, base) : doc,
      runId,
      page: path,
      history: history(s),
      loading: false,
      messages: add(s, [...more, ...missing.map((m) => ({ level: "warn" as const, text: `${path} links to ${m}, which isn't one of the files.` }))]),
    }));
  }, []);

  /** Opens a page of the project: `from` is the page it was opened from (for Back). */
  const open = useCallback(
    async (path: string, method: "GET" | "POST" = "GET", query = "", fields: [string, string][] = [], from: string | null = null) => {
      const req = ++latest.current;
      const history = (s: State) => (from ? [...s.history, from].slice(-30) : s.history);
      if (/\.html?$/i.test(path)) {
        const file = ctx.current.files?.find((f) => f.path === path);
        if (!file) return setState((s) => ({ ...s, messages: add(s, [{ level: "error", text: `Page not found: ${path}` }]) }));
        return show(file.content, path, [], history);
      }
      if (!/\.php$/i.test(path)) {
        return setState((s) => ({ ...s, messages: add(s, [{ level: "warn", text: `${path} isn't a page (only .html and .php files open here).` }]) }));
      }
      setState((s) => ({ ...s, loading: true }));
      try {
        const r = await ctx.current.runPhp(path, method, query, fields);
        if (req !== latest.current) return;
        const more: PageMessage[] = [];
        if (r.stderr) more.push({ level: r.verdict === "ok" ? "warn" : "error", text: `${path}: ${r.stderr.replace(/\n$/, "")}` });
        else if (r.verdict !== "ok") more.push({ level: "error", text: `${path} ${VERDICT_TEXT[r.verdict] ?? `ended with "${r.verdict}"`}.` });
        show(r.stdout || "", path, more, history);
      } catch (e) {
        if (req !== latest.current) return;
        const text = e instanceof Error && e.message ? e.message : "The page couldn't be run.";
        setState((s) => ({ ...s, loading: false, messages: add(s, [{ level: "error", text: `${path}: ${text}` }]) }));
      }
    },
    [show],
  );

  /** Shows a page a program already printed (the Run tab's output): its links and forms work. */
  const showOutput = useCallback((html: string, path: string) => {
    ++latest.current;
    setState(EMPTY);
    show(html, path, [], () => []);
  }, [show]);

  const navigate = useCallback(
    (nav: NavRequest) => {
      const from = state.page ?? "index.html";
      const { path, query } = resolvePath(from, nav.href || from);
      void open(path, nav.method, query, nav.fields, from);
    },
    [state.page, open],
  );

  const back = useCallback(() => {
    const prev = state.history[state.history.length - 1];
    if (!prev) return;
    setState((s) => ({ ...s, history: s.history.slice(0, -1) }));
    void open(prev);
  }, [state.history, open]);

  /** The page shown, asked for again (a plain GET). */
  const reload = useCallback(() => {
    if (state.page) void open(state.page);
  }, [state.page, open]);

  const reset = useCallback(() => {
    ++latest.current;
    setState(EMPTY);
  }, []);

  // The page's console errors, and its links and forms, for as long as it is shown.
  const navRef = useRef(navigate);
  navRef.current = navigate;
  useEffect(() => {
    if (!state.runId) return;
    return listenToRun(
      state.runId,
      (entry) => {
        if (entry.level === "error" || entry.level === "warn" || entry.level === "info") {
          const level = entry.level;
          setState((s) => ({ ...s, messages: add(s, [{ level, text: entry.text }]) }));
        }
      },
      () => undefined,
      (nav) => navRef.current(nav),
    );
  }, [state.runId]);

  return { ...state, open, showOutput, back, reload, reset };
}
