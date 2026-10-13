import crypto from "crypto";
import { judgeHas } from "./judgeInfo";

/**
 * Server previews (CODE_RUNNER_PLAN.md phase 5): a student's web server
 * (Express, Flask, FastAPI, Spring…) runs in a container on tm-judge, and
 * the browser shows it in a sandboxed frame. The page is served from a
 * separate origin (JUDGE_PREVIEW_BASE, e.g. https://preview.amashuri.com,
 * proxied to the runner) through a short-lived signed path, so student code
 * never runs on Task Mentor's origin.
 *
 * Runner protocol (tm-judge PROTOCOL.md "Previews"):
 *   POST   /v1/previews            {language?, kind?, files, entry?} → 201 {id}
 *   GET    /v1/previews/:id/events text/event-stream: stage, log, ready, exit, error
 *   DELETE /v1/previews/:id
 *   ANY    /p/:id/:token/*         public path; token = "<exp>.<sig>",
 *          sig = base64url(HMAC-SHA256(JUDGE_PREVIEW_SECRET, "<id>.<exp>"))
 */

export interface PreviewRecord {
  id: string;
  runnerId: string;
  userId: number;
  createdAt: number;
  closed: boolean;
}

const byId = new Map<string, PreviewRecord>();
const MAX_AGE_MS = 15 * 60_000;
const TOKEN_TTL_S = 15 * 60;

const baseUrl = () => (process.env.TMJUDGE_URL || "http://127.0.0.1:5010").replace(/\/+$/, "");
const publicBase = () => (process.env.JUDGE_PREVIEW_BASE || "").replace(/\/+$/, "");
const headers = (json = true): Record<string, string> => {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (process.env.TMJUDGE_TOKEN) h.Authorization = `Bearer ${process.env.TMJUDGE_TOKEN}`;
  return h;
};

export class PreviewError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Previews need tm-judge with containers, a public preview origin and its secret. */
export const previewsAvailable = () =>
  process.env.CODERUNNER_ENGINE === "tmjudge" && judgeHas("previews") && !!publicBase() && (process.env.JUDGE_PREVIEW_SECRET ?? "").length >= 32;

/** The signed public address of a preview (the trailing slash keeps relative links working). */
export function previewUrl(runnerId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TOKEN_TTL_S;
  const sig = crypto.createHmac("sha256", process.env.JUDGE_PREVIEW_SECRET ?? "").update(`${runnerId}.${exp}`).digest("base64url");
  return `${publicBase()}/p/${encodeURIComponent(runnerId)}/${exp}.${sig}/`;
}

async function runner(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    return await fetch(`${baseUrl()}${path}`, { ...init, signal: init.signal ?? ctrl.signal });
  } catch {
    throw new PreviewError(503, "RUNNER_UNAVAILABLE", "The code runner can't be reached right now. Try again in a moment.");
  } finally {
    clearTimeout(t);
  }
}

function sweep() {
  const now = Date.now();
  for (const [id, p] of byId) if (p.closed || now - p.createdAt > MAX_AGE_MS) byId.delete(id);
}

export async function startPreview(
  userId: number,
  body: { language?: string | null; kind?: string | null; files: { path: string; content: string }[]; entry?: string | null },
): Promise<PreviewRecord> {
  if (!previewsAvailable()) throw new PreviewError(409, "PREVIEWS_UNAVAILABLE", "Running web servers isn't available here yet.");
  sweep();
  // One preview per person: a new one replaces the old.
  for (const p of byId.values()) if (p.userId === userId && !p.closed) void stopPreview(p);
  const res = await runner("/v1/previews", { method: "POST", headers: headers(), body: JSON.stringify(body), timeoutMs: 30_000 });
  if (res.status === 429 || res.status === 503) throw new PreviewError(503, "RUNNER_BUSY", "Lots of servers are running right now. Try again in a moment.");
  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    throw new PreviewError(422, data?.code ?? "RUNNER_REJECTED", data?.message ?? data?.error ?? "The code runner couldn't start this server.");
  }
  const data: any = await res.json();
  const record: PreviewRecord = { id: crypto.randomBytes(12).toString("hex"), runnerId: String(data.id), userId, createdAt: Date.now(), closed: false };
  byId.set(record.id, record);
  return record;
}

export function getPreview(id: string, userId: number): PreviewRecord {
  const p = byId.get(id);
  if (!p || p.userId !== userId) throw new PreviewError(404, "PREVIEW_NOT_FOUND", "This server has stopped. Start it again.");
  return p;
}

export async function stopPreview(p: PreviewRecord) {
  if (p.closed) return;
  p.closed = true;
  await runner(`/v1/previews/${encodeURIComponent(p.runnerId)}`, { method: "DELETE", headers: headers(false) }).catch(() => undefined);
}

export async function openPreviewEvents(p: PreviewRecord, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${baseUrl()}/v1/previews/${encodeURIComponent(p.runnerId)}/events`, {
    headers: { ...headers(false), Accept: "text/event-stream" },
    signal,
  }).catch(() => {
    throw new PreviewError(503, "RUNNER_UNAVAILABLE", "The code runner can't be reached right now.");
  });
  if (!res.ok || !res.body) throw new PreviewError(res.status === 404 ? 404 : 503, "PREVIEW_NOT_FOUND", "This server has stopped. Start it again.");
  return res.body;
}

/** Tests only. */
export function resetPreviews() {
  byId.clear();
}
