/** Messages between the page and the in-browser runner worker. */
export type Runtime = "python" | "javascript" | "sql";

export type WorkerRequest =
  | { id: number; type: "load"; runtime: Runtime }
  | { id: number; type: "run"; runtime: Runtime; files: Record<string, string>; entry: string; stdin: string };

export type WorkerResponse =
  | { id: number; ok: true; stdout: string; stderr: string; exit_code: number; time_ms: number }
  | { id: number; ok: true; loaded: true }
  | { id: number; ok: false; reason: "unsupported" | "unavailable"; message: string };
