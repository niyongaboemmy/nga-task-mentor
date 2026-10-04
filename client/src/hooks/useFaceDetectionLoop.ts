import { useEffect, useRef } from "react";
import faceDetectionService from "../utils/faceDetection";

/**
 * Runs `tick` (a face-detection pass) repeatedly while `enabled`:
 * - only after the models are loaded, and not at all if the step was left
 *   or disabled while they loaded (a start that finished late used to leave
 *   a loop running for the rest of the quiz);
 * - one pass at a time: the next starts `gapMs` after the last finished
 *   (a pass can outlast a fixed interval on a slow PC; overlapping passes
 *   piled up and froze the page);
 * - always the latest `tick`, so it never acts on stale state.
 */
export function useFaceDetectionLoop(
  enabled: boolean,
  gapMs: number,
  tick: () => Promise<void>,
  options: { onStart?: () => void; onLoadError?: (error: unknown) => void } = {},
) {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      if (cancelled) return;
      try {
        await tickRef.current();
      } catch {
        /* the tick reports its own errors */
      }
      if (!cancelled) timer = setTimeout(loop, gapMs);
    };
    (async () => {
      try {
        await faceDetectionService.loadModels();
      } catch (error) {
        if (!cancelled) optionsRef.current.onLoadError?.(error);
        return;
      }
      if (cancelled) return;
      optionsRef.current.onStart?.();
      timer = setTimeout(loop, gapMs);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, gapMs]);
}
