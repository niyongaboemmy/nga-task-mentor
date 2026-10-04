// Proctoring setup steps: leaving a step while the models still load must not
// leave a detection loop behind, and passes must never overlap.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";

const svc = vi.hoisted(() => ({ loadModels: vi.fn() }));
vi.mock("../utils/faceDetection", () => ({ default: svc }));

import { useFaceDetectionLoop } from "../hooks/useFaceDetectionLoop";

function Step({ enabled, tick }: { enabled: boolean; tick: () => Promise<void> }) {
  useFaceDetectionLoop(enabled, 300, tick);
  return null;
}

describe("useFaceDetectionLoop", () => {
  let finishLoading: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    svc.loadModels.mockReset().mockReturnValue(new Promise<void>((r) => (finishLoading = r)));
  });
  afterEach(() => vi.useRealTimers());

  it("starts nothing if the step was left while the models loaded", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<Step enabled tick={tick} />);
    unmount(); // next step, models still downloading
    await act(async () => finishLoading());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(tick).not.toHaveBeenCalled();
  });

  it("runs one pass at a time, and stops when disabled", async () => {
    let inFlight = 0, maxInFlight = 0;
    const tick = vi.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1_000)); // slower than the 300 ms gap
      inFlight--;
    });
    const { rerender } = render(<Step enabled tick={tick} />);
    await act(async () => finishLoading());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(maxInFlight).toBe(1);
    expect(tick.mock.calls.length).toBeGreaterThanOrEqual(4);
    rerender(<Step enabled={false} tick={tick} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    const calls = tick.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(tick.mock.calls.length).toBe(calls);
  });
});
