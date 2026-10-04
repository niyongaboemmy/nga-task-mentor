// The first detection blocks the page while the graphics card compiles; the
// indicator must already be on screen when that starts, and go away after.
import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import GpuWarmupIndicator from "../components/Proctoring/GpuWarmupIndicator";
import { withGpuWarmup } from "../utils/gpuWarmup";

describe("GPU warm-up indicator", () => {
  it("is on screen before the blocking work starts, and gone after", async () => {
    vi.useFakeTimers();
    try {
      render(<GpuWarmupIndicator />);
      expect(screen.queryByTestId("gpu-warmup")).toBeNull();
      let shownWhenWorkStarted = false;
      let done = false;
      const work = withGpuWarmup("Preparing camera checks…", () => {
        shownWhenWorkStarted = !!screen.queryByTestId("gpu-warmup");
      }).then(() => (done = true));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(shownWhenWorkStarted).toBe(true);
      expect(screen.getByRole("status")).toHaveTextContent("Preparing camera checks…");
      // Kept up briefly so a fast machine doesn't see a flash, then removed.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
        await work;
      });
      expect(done).toBe(true);
      expect(screen.queryByTestId("gpu-warmup")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes away even if the work fails", async () => {
    render(<GpuWarmupIndicator />);
    await expect(
      withGpuWarmup("Preparing camera checks…", () => {
        throw new Error("no GPU");
      }),
    ).rejects.toThrow("no GPU");
    expect(screen.queryByTestId("gpu-warmup")).toBeNull();
  });
});
