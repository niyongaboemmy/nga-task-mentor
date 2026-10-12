import { useCallback, useEffect, useRef, useState } from "react";
import api, { API_BASE_URL } from "../../utils/axiosConfig";
import { codeApi, type CodeFile, type RunVerdict } from "../../services/codeApi";
import { runErrorMessage } from "../../utils/runErrors";

/**
 * An interactive run (CODE_RUNNER_PLAN.md §16): the program's output arrives
 * as it is printed (Server-Sent Events read with fetch, so the usual token
 * is sent), and each line typed goes to its input.
 */

export type TranscriptLine = { kind: "out" | "err" | "in" | "info"; text: string };
export interface RunExit {
  code: number | null;
  signal: string | null;
  verdict: RunVerdict;
  time_ms: number | null;
  memory_kb: number | null;
}
export type InteractiveStatus = "idle" | "starting" | "running" | "ended";

/** Whether this server runs programs interactively (asked once). */
export const interactiveAvailable = () => codeApi.capabilities().then((c) => c.interactive);

/** Parses an SSE byte stream into {event, data} messages. */
async function* sse(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) {
        try {
          yield { event, data: JSON.parse(data.join("\n")) };
        } catch {
          yield { event, data: data.join("\n") };
        }
      }
    }
  }
}

export function useInteractiveRun() {
  const [status, setStatus] = useState<InteractiveStatus>("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [exit, setExit] = useState<RunExit | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The server said interactive runs aren't available: fall back to batch runs. */
  const [unavailable, setUnavailable] = useState(false);
  const session = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const append = (kind: TranscriptLine["kind"], text: string) =>
    setLines((ls) => {
      // Join consecutive output of the same kind, so prompts and answers read naturally.
      const last = ls[ls.length - 1];
      if (last && last.kind === kind && kind !== "in" && kind !== "info") return [...ls.slice(0, -1), { kind, text: last.text + text }];
      return [...ls, { kind, text }];
    });

  const stop = useCallback(async () => {
    abort.current?.abort();
    const id = session.current;
    session.current = null;
    if (id) await api.delete(`/code/sessions/${id}`).catch(() => undefined);
    setStatus((s) => (s === "idle" ? s : "ended"));
  }, []);

  useEffect(() => () => void stop(), [stop]);

  const start = useCallback(
    async (body: { files: CodeFile[]; language?: string | null; entry?: string | null }) => {
      await stop();
      setLines([]);
      setExit(null);
      setError(null);
      setStatus("starting");
      try {
        const res = await api.post("/code/sessions", body);
        const id = String(res.data.data.id);
        session.current = id;
        setStatus("running");
        const ctrl = new AbortController();
        abort.current = ctrl;
        const token = localStorage.getItem("tm_auth_token");
        const stream = await fetch(`${API_BASE_URL}/code/sessions/${id}/events`, {
          headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
          signal: ctrl.signal,
        });
        if (!stream.ok || !stream.body) throw new Error("The run couldn't be started.");
        for await (const { event, data } of sse(stream.body)) {
          if (event === "stage" && data?.name === "build") append("info", "Building…\n");
          else if (event === "stdout") append("out", String(data?.data ?? ""));
          else if (event === "stderr") append("err", String(data?.data ?? ""));
          else if (event === "exit") setExit(data as RunExit);
          else if (event === "error") setError(String(data?.message ?? "The run failed."));
        }
      } catch (e) {
        const res = (e as { response?: { status?: number; data?: { error_code?: string; code?: string } } })?.response;
        const code = res?.data;
        // Not available here (or not allowed for this person): the batch Run takes over.
        if (code?.error_code === "INTERACTIVE_UNAVAILABLE" || code?.code === "INTERACTIVE_UNAVAILABLE" || res?.status === 403) {
          codeApi.withoutInteractive();
          setUnavailable(true);
          setError("Live runs aren't available right now: type the input in the box and press Run.");
        } else if ((e as Error)?.name !== "AbortError") setError(runErrorMessage(e, "The run couldn't be started."));
      } finally {
        session.current = null;
        setStatus("ended");
      }
    },
    [stop],
  );

  const post = (payload: object) => {
    const id = session.current;
    if (!id) return Promise.resolve();
    return api.post(`/code/sessions/${id}/input`, payload).then(
      () => undefined,
      () => undefined,
    );
  };

  const send = useCallback((line: string) => {
    append("in", `${line}\n`);
    return post({ data: `${line}\n` });
  }, []);
  const interrupt = useCallback(() => post({ signal: "SIGINT" }), []);
  const endInput = useCallback(() => post({ eof: true }), []);

  return { status, lines, exit, error, unavailable, start, send, interrupt, endInput, stop };
}
