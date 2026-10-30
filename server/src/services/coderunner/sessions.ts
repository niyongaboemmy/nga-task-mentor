import crypto from "crypto";
import { judgeHas } from "./judgeInfo";

/**
 * Interactive runs (CODE_RUNNER_PLAN.md §16): a program runs on the code
 * runner with its stdin/stdout/stderr as pipes; the browser sees the output
 * as it comes (Server-Sent Events relayed by Task Mentor) and sends input
 * lines, Ctrl+C or end-of-input as small POSTs. No PTY: prompts, input(),
 * Scanner, cin and scanf work; curses-style programs don't.
 *
 * Runner protocol (tm-judge, docs/PROTOCOL.md "Sessions"):
 *   POST   /v1/sessions                 {language?, kind?, files, entry?, limits?} → 201 {id}
 *   GET    /v1/sessions/:id/events      text/event-stream: stage, stdout, stderr, exit, error
 *   POST   /v1/sessions/:id/stdin       {data}            → 204
 *   POST   /v1/sessions/:id/eof                           → 204
 *   POST   /v1/sessions/:id/signal      {name: "SIGINT"}  → 204
 *   DELETE /v1/sessions/:id                               → 204
 */

export interface SessionRecord {
  id: string;
  runnerId: string;
  userId: number;
  createdAt: number;
  closed: boolean;
}

/** One live session per person: starting another stops the previous one. */
const byId = new Map<string, SessionRecord>();
const MAX_AGE_MS = 15 * 60_000;

const baseUrl = () => (process.env.TMJUDGE_URL || "http://127.0.0.1:5010").replace(/\/+$/, "");
const headers = (json = true): Record<string, string> => {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (process.env.TMJUDGE_TOKEN) h.Authorization = `Bearer ${process.env.TMJUDGE_TOKEN}`;
  return h;
};

/** Interactive runs need our own runner (Judge0 runs in batches only). */
export const sessionsAvailable = () => process.env.CODERUNNER_ENGINE === "tmjudge" && process.env.CODE_SESSIONS !== "0";

/**
 * The runner must also say it supports sessions (GET /v1/health →
 * features: ["sessions"]), so an older tm-judge keeps the batch Run. The
 * answer is remembered for a minute.
 */
let ready: { at: number; ok: boolean } | null = null;
export async function sessionsReady(): Promise<boolean> {
  if (!sessionsAvailable()) return false;
  if (ready && Date.now() - ready.at < 60_000) return ready.ok;
  let ok = false;
  try {
    const res = await runner("/v1/health", { headers: headers(false), timeoutMs: 3000 });
    const data: any = res.ok ? await res.json() : null;
    ok = Array.isArray(data?.features) && data.features.includes("sessions");
  } catch {
    ok = false;
  }
  ready = { at: Date.now(), ok };
  return ok;
}

export class SessionError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function runner(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    return await fetch(`${baseUrl()}${path}`, { ...init, signal: init.signal ?? ctrl.signal });
  } catch (e: any) {
    throw new SessionError(503, "RUNNER_UNAVAILABLE", "The code runner can't be reached right now. Try again in a moment.");
  } finally {
    clearTimeout(t);
  }
}

function sweep() {
  const now = Date.now();
  for (const [id, s] of byId) if (s.closed || now - s.createdAt > MAX_AGE_MS) byId.delete(id);
}

export async function startSession(
  userId: number,
  body: { language?: string | null; kind?: string | null; files: { path: string; content: string }[]; entry?: string | null; pty?: boolean },
): Promise<SessionRecord> {
  if (!(await sessionsReady())) throw new SessionError(409, "INTERACTIVE_UNAVAILABLE", "Interactive runs aren't available here yet: use Run with input.");
  sweep();
  for (const s of byId.values()) if (s.userId === userId && !s.closed) void stopSession(s);
  // A real terminal only where the runner has one (containers).
  const { pty, ...given } = body;
  // Absent, not null: the runner takes a missing language/kind/entry as "detect it".
  const rest = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== null && v !== undefined)) as typeof given;
  const post = (payload: object) => runner("/v1/sessions", { method: "POST", headers: headers(), body: JSON.stringify(payload) });
  let res = await post(pty && judgeHas("pty") ? { ...rest, pty: true } : rest);
  // No terminal for this language (no container image, e.g. C): plain pipes then.
  if (res.status === 409 && pty) {
    const data: any = await res.clone().json().catch(() => ({}));
    if (data?.code === "PTY_UNAVAILABLE") res = await post(rest);
  }
  if (res.status === 429 || res.status === 503) throw new SessionError(503, "RUNNER_BUSY", "Lots of code is running right now. Try again in a moment.");
  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    throw new SessionError(422, data?.error_code ?? data?.code ?? "RUNNER_REJECTED", data?.message ?? data?.error ?? "The code runner refused to start this program.");
  }
  const data: any = await res.json();
  const record: SessionRecord = { id: crypto.randomBytes(12).toString("hex"), runnerId: String(data.id), userId, createdAt: Date.now(), closed: false };
  byId.set(record.id, record);
  return record;
}

export function getSession(id: string, userId: number): SessionRecord {
  const s = byId.get(id);
  if (!s || s.userId !== userId) throw new SessionError(404, "SESSION_NOT_FOUND", "This run has ended. Run your program again.");
  return s;
}

export async function sendInput(s: SessionRecord, input: { data?: string; eof?: boolean; signal?: "SIGINT" | "SIGTERM" }) {
  if (s.closed) throw new SessionError(409, "SESSION_ENDED", "This run has ended. Run your program again.");
  const id = encodeURIComponent(s.runnerId);
  if (typeof input.data === "string") {
    await runner(`/v1/sessions/${id}/stdin`, { method: "POST", headers: headers(), body: JSON.stringify({ data: input.data }) });
  }
  if (input.eof) await runner(`/v1/sessions/${id}/eof`, { method: "POST", headers: headers() });
  if (input.signal) await runner(`/v1/sessions/${id}/signal`, { method: "POST", headers: headers(), body: JSON.stringify({ name: input.signal }) });
}

export async function stopSession(s: SessionRecord) {
  if (s.closed) return;
  s.closed = true;
  await runner(`/v1/sessions/${encodeURIComponent(s.runnerId)}`, { method: "DELETE", headers: headers(false) }).catch(() => undefined);
}

/**
 * The runner's event stream for this session, as a web ReadableStream of
 * bytes (already SSE-formatted). `signal` aborts it when the browser leaves.
 */
export async function openEvents(s: SessionRecord, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${baseUrl()}/v1/sessions/${encodeURIComponent(s.runnerId)}/events`, {
    headers: { ...headers(false), Accept: "text/event-stream" },
    signal,
  }).catch(() => {
    throw new SessionError(503, "RUNNER_UNAVAILABLE", "The code runner can't be reached right now.");
  });
  if (!res.ok || !res.body) throw new SessionError(res.status === 404 ? 404 : 503, "SESSION_NOT_FOUND", "This run has ended. Run your program again.");
  return res.body;
}

/** Tests only. */
export function resetSessions() {
  byId.clear();
  ready = null;
}
