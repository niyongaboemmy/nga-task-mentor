import { judgeHas } from "./judgeInfo";

/**
 * What a project is, by tm-judge's catalog detection (POST /v1/detect): the
 * kind ("c/make", "java/single", "js/vite"…), what it can do (build, run,
 * test) and where it starts. One answer for every place that runs projects
 * (grading's Run tab, practice runs), so a React app is never "run" as a
 * TypeScript file and a C project is never cut down to one file.
 */

export interface DetectedProject {
  kind: string;
  label: string;
  language: string;
  entry: string | null;
  actions: string[];
  available: boolean;
  /** No "run" step: a web app (React, Vue, Angular…, a PHP website) that runs in a browser. */
  webApp: boolean;
}

export interface ProjectFile {
  path: string;
  content?: string;
}

const baseUrl = () => (process.env.TMJUDGE_URL || "http://127.0.0.1:5010").replace(/\/+$/, "");

/** Folders never sent (dependencies, build output, editor state). */
export const IGNORED_PATH = /(^|\/)(node_modules|dist|build|target|out|bin|obj|\.git|\.tmcode|\.nga|__pycache__|\.venv|venv|\.next|\.angular|coverage)\//;

export async function detectProject(files: ProjectFile[]): Promise<DetectedProject | null> {
  if (process.env.CODERUNNER_ENGINE !== "tmjudge" || !judgeHas("detect")) return null;
  const sent = files.filter((f) => !IGNORED_PATH.test(f.path)).slice(0, 400);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${baseUrl()}/v1/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.TMJUDGE_TOKEN ? { Authorization: `Bearer ${process.env.TMJUDGE_TOKEN}` } : {}) },
      body: JSON.stringify({ files: sent.map((f) => (f.content != null ? { path: f.path, content: f.content.slice(0, 200_000) } : { path: f.path })) }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const best = (Array.isArray(data?.kinds) ? data.kinds : []).find((k: any) => k?.kind === data?.best) ?? data?.kinds?.[0];
    if (!best?.kind) return null;
    const actions: string[] = Array.isArray(best.actions) ? best.actions.map(String) : [];
    return {
      kind: String(best.kind),
      label: String(best.label ?? best.kind),
      language: String(best.language ?? String(best.kind).split("/")[0]),
      entry: (best.entry ?? data.entry ?? null) || null,
      actions,
      available: best.available !== false,
      webApp: !actions.includes("run") && /^((js|ts|web)\/|php\/web$)/.test(String(best.kind)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Kinds that run one program file the teacher may choose (other kinds start from their build). */
export const choosesEntry = (kind: string) => /\/single$/.test(kind);
