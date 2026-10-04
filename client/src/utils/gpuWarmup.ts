// The first face / object detection compiles the graphics card's programs
// (1–3 s), and the page's main thread is blocked while it does. Detection
// runs that first frame through `withGpuWarmup`, which first puts up the
// indicator (GpuWarmupIndicator) and lets it paint; its animation is pure
// CSS transform, which the browser keeps running off the blocked thread.

type Listener = () => void;
let active = 0;
let label = "";
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export const gpuWarmup = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** What's being prepared, or "" when nothing is. */
  snapshot: () => (active > 0 ? label : ""),
};

/** Resolves once the indicator has been painted (with a fallback for hidden tabs, where frames don't run). */
export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    const fallback = setTimeout(done, 150);
    if (typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(fallback);
        // One more task, so the frame is actually on screen first.
        setTimeout(done, 0);
      }),
    );
  });
}

/** Shown at least this long, so a fast machine doesn't get a flash. */
const MIN_VISIBLE_MS = 700;

export async function withGpuWarmup<T>(what: string, run: () => T | Promise<T>): Promise<T> {
  active++;
  label = what;
  const shownAt = Date.now();
  notify();
  try {
    await afterNextPaint();
    return await run();
  } finally {
    const left = MIN_VISIBLE_MS - (Date.now() - shownAt);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    active--;
    notify();
  }
}
