import { Request, Response } from "express";
import { sseHeartbeatMs } from "./limits";

/**
 * In-process pub/sub behind the Projects live streams (PROJECTS_PLAN.md §3
 * "Live updates"). Task Mentor runs as a single pm2 process, so a Map of
 * listeners is enough; nothing leaves the process.
 *
 * Topics: `project:<id>` (GET /projects/:id/live) and `monitor`
 * (GET /monitor/live, filtered per subscriber by course scope).
 */

export type BusListener = (event: string, data: any) => void;

export class ProjectsBus {
  private topics = new Map<string, Set<BusListener>>();

  /** Returns the unsubscribe function. */
  subscribe(topic: string, fn: BusListener): () => void {
    let set = this.topics.get(topic);
    if (!set) this.topics.set(topic, (set = new Set()));
    set.add(fn);
    return () => {
      const s = this.topics.get(topic);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.topics.delete(topic);
    };
  }

  /** Delivers to every listener of the topic; returns how many got it. */
  publish(topic: string, event: string, data: unknown): number {
    const set = this.topics.get(topic);
    if (!set) return 0;
    let n = 0;
    for (const fn of [...set]) {
      try {
        fn(event, data);
        n++;
      } catch (e) {
        console.warn("[projects bus] listener failed:", (e as Error)?.message);
      }
    }
    return n;
  }

  listenerCount(topic?: string): number {
    if (topic) return this.topics.get(topic)?.size ?? 0;
    let n = 0;
    for (const s of this.topics.values()) n += s.size;
    return n;
  }

  /** Tests only. */
  clear() {
    this.topics.clear();
  }
}

export const projectsBus = new ProjectsBus();
export const projectTopic = (projectId: number) => `project:${projectId}`;
export const MONITOR_TOPIC = "monitor";

export interface SseStream {
  send(event: string, data: unknown): void;
  /** Runs when the client goes away (or close() is called). */
  onClose(fn: () => void): void;
  close(): void;
  readonly closed: boolean;
}

/**
 * Turn the response into a Server-Sent Events stream: no buffering (also
 * for nginx: X-Accel-Buffering), a `: ping` comment every
 * PROJECTS_SSE_HEARTBEAT_MS (25 s), and every cleanup run once when the
 * client disconnects.
 */
export function openSse(_req: Request, res: Response, heartbeatMs = sseHeartbeatMs()): SseStream {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  (res as any).flushHeaders?.();
  res.write("retry: 5000\n\n");

  const cleanups: Array<() => void> = [];
  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, heartbeatMs);
  (heartbeat as any).unref?.();

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    for (const fn of cleanups.splice(0)) {
      try {
        fn();
      } catch {
        /* a cleanup must not stop the others */
      }
    }
    if (!res.writableEnded) res.end();
  };
  // res "close", not req: since Node 16 a GET's request emits "close" as
  // soon as its (empty) body is read, which would end the stream at once.
  res.on("close", close);

  return {
    send(event, data) {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    onClose(fn) {
      if (closed) fn();
      else cleanups.push(fn);
    },
    close,
    get closed() {
      return closed;
    },
  };
}
