import api from "../utils/axiosConfig";
import { projectsApi } from "./projectsApi";

/** Practice runs and browser project editing (CODE_RUNNER_PLAN.md §17). */

export interface CodeFile {
  path: string;
  content: string;
}

export type RunVerdict =
  | "accepted"
  | "wrong-answer"
  | "ok"
  | "runtime-error"
  | "time-limit"
  | "memory-limit"
  | "output-limit"
  | "compile-error"
  | "package-not-available"
  | "internal-error";

export interface RunTestResult {
  id: string;
  verdict: RunVerdict;
  passed: boolean | null;
  stdout: string | null;
  stderr: string | null;
  exit_code?: number | null;
  time_ms: number | null;
  memory_kb: number | null;
  truncated?: boolean;
}

/** One unit test from the framework's report (pytest, JUnit, node:test, go test…). */
export interface UnitTestCase {
  id: string;
  name: string;
  group: string | null;
  file: string | null;
  line: number | null;
  status: "passed" | "failed" | "skipped" | "error";
  durationMs: number | null;
  message: string | null;
  details: string | null;
}

export interface UnitReport {
  framework: string | null;
  verdict: "passed" | "failed" | "error" | "time-limit" | "memory-limit" | "package-not-available" | "internal-error";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  time_ms: number | null;
  output: string;
  truncated: boolean;
  tests: UnitTestCase[];
}

export interface PracticeRunResult {
  engine: string;
  language: string;
  entry: string | null;
  /** The catalog project kind that ran ("java/maven"…), for projects. */
  kind?: string | null;
  files_sent: string[];
  compile: { ok: boolean; output: string; time_ms?: number } | null;
  tests: RunTestResult[];
  unit?: UnitReport | null;
  /** A dependency the runner doesn't have (projects). */
  error?: { code: string; manager?: string; package?: string | null; message: string } | null;
}

export interface CodeCapabilities {
  /** Programs can run with a live terminal. */
  interactive: boolean;
  /** Unit tests run here, for these languages. */
  unit_tests: boolean;
  unit_test_languages: string[];
  /** The live terminal is a real one (colours, cursor, Ctrl+C reaches the program). */
  pty: boolean;
  /** Web servers can run and show in a preview. */
  previews: boolean;
}

let capabilities: Promise<CodeCapabilities> | null = null;

const RUN_TIMEOUT_MS = 150_000;

export const codeApi = {
  async run(body: {
    files: CodeFile[];
    language?: string | null;
    entry?: string | null;
    tests: { id: string; input: string; expected_output?: string | null }[];
  }): Promise<PracticeRunResult> {
    const res = await api.post("/code/run", body, { timeout: RUN_TIMEOUT_MS });
    return res.data.data as PracticeRunResult;
  },

  async languages(): Promise<{ key: string; label: string; engine: string | null }[]> {
    const res = await api.get("/code/languages");
    return res.data.data;
  },

  /** A project's unit tests (only on a runner that has them; see capabilities). */
  async test(body: { files: CodeFile[]; language?: string | null; kind?: string | null; test_filter?: string | null }): Promise<PracticeRunResult> {
    const res = await api.post("/code/test", body, { timeout: RUN_TIMEOUT_MS });
    return res.data.data as PracticeRunResult;
  },

  /** What this server's runner can do (asked once per page load). */
  capabilities(): Promise<CodeCapabilities> {
    capabilities ??= api
      .get("/code/capabilities")
      .then((r) => ({
        interactive: !!r.data?.data?.interactive,
        unit_tests: !!r.data?.data?.unit_tests,
        unit_test_languages: Array.isArray(r.data?.data?.unit_test_languages) ? r.data.data.unit_test_languages : [],
        pty: !!r.data?.data?.pty,
        previews: !!r.data?.data?.previews,
      }))
      .catch(() => {
        capabilities = null;
        return { interactive: false, unit_tests: false, unit_test_languages: [], pty: false, previews: false };
      });
    return capabilities;
  },

  /** Forget a capability the server said is gone (e.g. interactive runs). */
  withoutInteractive() {
    capabilities = (capabilities ?? Promise.resolve({ interactive: false, unit_tests: false, unit_test_languages: [], pty: false, previews: false })).then((c) => ({ ...c, interactive: false, pty: false }));
  },
};

// ─── Project files in the browser ────────────────────────────────────────────

const BASE = "/tmcode";
const enc = new TextEncoder();

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function gzip(bytes: Uint8Array): Promise<Blob> {
  const stream = new Blob([bytes as unknown as ArrayBuffer]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

/** Every text file of a project at a revision (binary files are skipped and reported). */
export async function loadProjectFiles(projectId: number, rev: number | "head" = "head") {
  const manifest = await projectsApi.manifest(projectId, rev);
  const files: CodeFile[] = [];
  const skipped: string[] = [];
  const queue = [...manifest.files];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const { text, binary } = await projectsApi.fileContent(projectId, f.path, manifest.revision?.id ?? null);
      if (binary) skipped.push(f.path);
      else files.push({ path: f.path, content: text });
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, queue.length || 1) }, worker));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped, revision: manifest.revision };
}

/**
 * Saves the files as a new revision on top of `baseRevisionId`: uploads the
 * blobs Task Mentor doesn't have yet, then commits. Throws the server's
 * error (e.g. 409 when someone saved in between).
 */
export async function saveProjectFiles(projectId: number, baseRevisionId: number | null, files: CodeFile[], message = "Saved in the browser") {
  const entries = await Promise.all(
    files.map(async (f) => {
      const bytes = enc.encode(f.content);
      return { path: f.path, bytes, sha256: await sha256Hex(bytes), size: bytes.length };
    }),
  );
  const missingRes = await api.post(`${BASE}/projects/${projectId}/blobs/missing`, { sha256: [...new Set(entries.map((e) => e.sha256))] });
  const missing = new Set<string>(missingRes.data?.missing ?? []);
  const uploaded = new Set<string>();
  for (const e of entries) {
    if (!missing.has(e.sha256) || uploaded.has(e.sha256)) continue;
    uploaded.add(e.sha256);
    await api.put(`${BASE}/projects/${projectId}/blobs/${e.sha256}`, await gzip(e.bytes), {
      headers: { "Content-Type": "application/gzip", "X-Blob-Size": String(e.size) },
      transformRequest: (d) => d,
    });
  }
  const res = await api.post(`${BASE}/projects/${projectId}/revisions`, {
    base_revision_id: baseRevisionId,
    message,
    source: "save",
    files: entries.map((e) => ({ path: e.path, sha256: e.sha256, size: e.size })),
  });
  return res.data?.revision as { id: number; number: number };
}
