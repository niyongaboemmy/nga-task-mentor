import { useCallback, useEffect, useRef, useState } from "react";
import api, { API_BASE_URL } from "../../utils/axiosConfig";
import type { CodeFile } from "../../services/codeApi";
import { runErrorMessage } from "../../utils/runErrors";
import { sse } from "./useInteractiveRun";

/**
 * A web server running from the student's files (CODE_RUNNER_PLAN.md phase
 * 5): start it, follow its build and log output, and get its signed address
 * on the separate preview origin once it answers.
 */

export type PreviewStatus = "idle" | "starting" | "ready" | "ended";

export function usePreview() {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [logs, setLogs] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const stop = useCallback(async () => {
    abort.current?.abort();
    const current = id.current;
    id.current = null;
    if (current) await api.delete(`/code/previews/${current}`).catch(() => undefined);
    setStatus((s) => (s === "idle" ? s : "ended"));
  }, []);

  useEffect(() => () => void stop(), [stop]);

  const start = useCallback(
    async (body: { files: CodeFile[]; language?: string | null; entry?: string | null }) => {
      await stop();
      setLogs("");
      setUrl(null);
      setError(null);
      setStatus("starting");
      let address: string | null = null;
      let ready = false;
      let ended = false;
      try {
        const res = await api.post("/code/previews", body);
        id.current = String(res.data.data.id);
        address = String(res.data.data.url);
        const ctrl = new AbortController();
        abort.current = ctrl;
        const token = localStorage.getItem("tm_auth_token");
        const stream = await fetch(`${API_BASE_URL}/code/previews/${id.current}/events`, {
          headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
          signal: ctrl.signal,
        });
        if (!stream.ok || !stream.body) throw new Error("The server couldn't be started.");
        for await (const { event, data } of sse(stream.body)) {
          if (event === "stage" && data?.name === "build") setLogs((l) => l + "Building…\n");
          else if (event === "log") setLogs((l) => (l + String(data?.data ?? "")).slice(-64_000));
          else if (event === "ready") {
            ready = true;
            setUrl(address);
            setStatus("ready");
          } else if (event === "exit") {
            ended = true;
            setLogs((l) => l + `\nThe server stopped${data?.code != null ? ` (exit ${data.code})` : ""}.\n`);
          } else if (event === "error") {
            ended = true;
            setError(String(data?.message ?? "The server failed."));
          }
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        ended = true;
        setError(runErrorMessage(e, "The server couldn't be started."));
      }
      // The output stream can close while the server keeps running (it stops
      // itself after 15 minutes, or with Stop): only an exit or error ends it.
      if (ended || !ready) {
        id.current = null;
        setStatus("ended");
      }
    },
    [stop],
  );

  /** A fresh signed address (they last 15 minutes). */
  const refreshUrl = useCallback(async () => {
    if (!id.current) return;
    const res = await api.get(`/code/previews/${id.current}/url`).catch(() => null);
    if (res?.data?.data?.url) setUrl(String(res.data.data.url));
  }, []);

  return { status, logs, url, error, start, stop, refreshUrl };
}
