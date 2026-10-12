import { Request, Response } from "express";

/**
 * Relays a runner's Server-Sent Events stream to the browser unbuffered.
 * `onBrowserLeft` runs when the browser goes away before the stream ends.
 */
export async function relaySse(req: Request, res: Response, open: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>, onBrowserLeft: () => void, onEnded?: () => void) {
  const abort = new AbortController();
  let finished = false;
  req.on("close", () => {
    abort.abort();
    if (!finished) onBrowserLeft();
  });
  const stream = await open(abort.signal);
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    finished = true;
    onEnded?.();
  } catch {
    // aborted: the browser left
  } finally {
    res.end();
  }
}
