// The quiz page froze on a student's first open: while the proctoring models
// were still downloading, every re-render (the quiz clock, every second)
// started another camera detection loop, and they all ran once loaded.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";

const svc = vi.hoisted(() => ({
  loadModels: vi.fn(),
  checkProctoringCompliance: vi.fn(),
  detectFaces: vi.fn(),
}));
vi.mock("../utils/faceDetection", () => ({ default: svc }));

import FloatingCameraComponent from "../components/Proctoring/FloatingCameraComponent";

const result = {
  faceDetected: true,
  faceCount: 1,
  faceConfidence: 90,
  objectsDetected: [],
  warnings: [],
  lookingAway: false,
  lookingAwayDuration: 0,
  attentionScore: 100,
  faceDetails: [],
};

const settings = () => ({
  enableFaceDetection: true,
  faceDetectionSensitivity: 50,
  enableObjectDetection: true,
  objectDetectionSensitivity: 50,
});

describe("FloatingCameraComponent detection loop", () => {
  let finishLoading: () => void;
  const video = document.createElement("video");
  const stream = {} as MediaStream;

  beforeEach(() => {
    vi.useFakeTimers();
    svc.loadModels.mockReset().mockReturnValue(new Promise<void>((r) => (finishLoading = r)));
    svc.checkProctoringCompliance.mockReset().mockResolvedValue(result);
    svc.detectFaces.mockReset().mockResolvedValue({ hasFace: true, faceCount: 1, faceDetails: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("runs one loop however often the page re-renders while models load", async () => {
    const { rerender } = render(<FloatingCameraComponent videoElement={video} stream={stream} settings={settings()} />);
    // The quiz clock re-renders the page (and a fresh settings object) every second.
    for (let i = 0; i < 15; i++) {
      rerender(<FloatingCameraComponent videoElement={video} stream={stream} settings={settings()} />);
    }
    await act(async () => finishLoading());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    // One check per second for 5 s from ONE loop (16 stacked loops gave ~80).
    expect(svc.checkProctoringCompliance.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(svc.checkProctoringCompliance.mock.calls.length).toBeLessThanOrEqual(6);
    // Borders come from the same detection: no second face pass per tick.
    expect(svc.detectFaces).not.toHaveBeenCalled();
  });

  it("never overlaps checks when one takes longer than a second", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    svc.checkProctoringCompliance.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 3_000)); // a slow PC without a GPU
      inFlight--;
      return result;
    });
    render(<FloatingCameraComponent videoElement={video} stream={stream} settings={settings()} />);
    await act(async () => finishLoading());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(maxInFlight).toBe(1);
  });

  it("stops checking when it leaves the page", async () => {
    const { unmount } = render(<FloatingCameraComponent videoElement={video} stream={stream} settings={settings()} />);
    await act(async () => finishLoading());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    unmount();
    const calls = svc.checkProctoringCompliance.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(svc.checkProctoringCompliance.mock.calls.length).toBe(calls);
  });
});
