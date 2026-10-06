import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Server-Sent Events with reconnects, for the TMCode Projects live views
 * (/api/tmcode/projects/:id/live and /api/tmcode/monitor/live).
 *
 *   connecting    first attempt, nothing received yet
 *   live          the stream is open
 *   reconnecting  the stream dropped; the browser (network error) or this
 *                 hook (the server closed it, e.g. a deploy or a 5xx) is
 *                 trying again, with exponential backoff up to `maxBackoffMs`
 *   offline       the device has no network; retried as soon as it's back
 *
 * Named events (`event: presence`) go to the handler of that name; unnamed
 * ones (`message`) go to `message`, or to the handler named by their `type`
 * field. Data is parsed as JSON when it can be.
 */
export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SseHandler = (data: any, event: MessageEvent) => void;

export interface UseEventSourceOptions {
  withCredentials?: boolean;
  /** First retry delay after the server closed the stream. */
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface UseEventSourceResult {
  status: LiveStatus;
  /** Reconnect attempts since the last successful open. */
  attempts: number;
  lastEventAt: number | null;
  /** Drop the current stream (if any) and connect again now. */
  reconnect: () => void;
}

const parse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export function backoffDelay(attempt: number, initial = 1000, max = 30_000): number {
  return Math.min(max, initial * 2 ** Math.max(0, attempt - 1));
}

export function useEventSource(
  url: string | null,
  handlers: Record<string, SseHandler>,
  options: UseEventSourceOptions = {},
): UseEventSourceResult {
  const { withCredentials = true, initialBackoffMs = 1000, maxBackoffMs = 30_000 } = options;
  const [status, setStatus] = useState<LiveStatus>(url ? "connecting" : "idle");
  const [attempts, setAttempts] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  // Listeners are attached per event name, so a new name needs a new stream.
  const eventNames = Object.keys(handlers).sort().join(",");

  const reconnect = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    if (!url || typeof window === "undefined" || typeof window.EventSource === "undefined") {
      setStatus("idle");
      return;
    }

    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;
    let everOpened = false;

    const deliver = (name: string, ev: MessageEvent) => {
      setLastEventAt(Date.now());
      const data = parse(typeof ev.data === "string" ? ev.data : "");
      const byName = handlersRef.current[name];
      if (byName) {
        byName(data, ev);
        return;
      }
      if (name === "message" && data && typeof data === "object" && "type" in data) {
        const byType = handlersRef.current[String((data as { type: unknown }).type)];
        byType?.((data as { data?: unknown }).data ?? data, ev);
      }
    };

    const schedule = () => {
      if (disposed) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus("offline");
        return; // the `online` listener reconnects
      }
      attempt += 1;
      setAttempts(attempt);
      setStatus("reconnecting");
      timer = setTimeout(open, backoffDelay(attempt, initialBackoffMs, maxBackoffMs));
    };

    function open() {
      if (disposed) return;
      timer = null;
      es?.close();
      const source = new window.EventSource(url!, { withCredentials });
      es = source;
      setStatus(everOpened || attempt > 0 ? "reconnecting" : "connecting");

      source.onopen = () => {
        if (disposed || es !== source) return;
        everOpened = true;
        attempt = 0;
        setAttempts(0);
        setStatus("live");
      };
      source.onerror = () => {
        if (disposed || es !== source) return;
        if (source.readyState === 2 /* CLOSED */) {
          // The server ended the stream (or refused it): the browser won't
          // retry on its own, so back off and open a new one.
          source.close();
          es = null;
          schedule();
        } else {
          // CONNECTING: the browser is already retrying a dropped connection.
          setStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "reconnecting");
        }
      };
      source.onmessage = (ev) => deliver("message", ev);
      for (const name of eventNames.split(",")) {
        if (!name || name === "message") continue;
        source.addEventListener(name, (ev) => deliver(name, ev as MessageEvent));
      }
    }

    const onOnline = () => {
      if (disposed) return;
      if (!es || es.readyState === 2) {
        if (timer) clearTimeout(timer);
        attempt = 0;
        open();
      }
    };
    const onOffline = () => !disposed && setStatus("offline");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    open();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      es?.close();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [url, eventNames, withCredentials, initialBackoffMs, maxBackoffMs, generation]);

  return { status, attempts, lastEventAt, reconnect };
}
