// COCO-SSD is the heaviest proctoring model: it must not load for quizzes that
// don't use it, and the two proctoring loops must share one result.
import { describe, it, expect, vi, beforeEach } from "vitest";

const coco = vi.hoisted(() => ({ load: vi.fn(), detect: vi.fn() }));
vi.mock("@tensorflow-models/coco-ssd", () => ({ load: coco.load }));
vi.mock("@tensorflow/tfjs-core", () => ({
  env: () => ({ set: vi.fn() }),
  getBackend: () => "webgl",
  setBackend: vi.fn(),
  ready: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tensorflow/tfjs-backend-webgl", () => ({}));
// The warm-up indicator has its own test (gpuWarmup.test.tsx).
vi.mock("../utils/gpuWarmup", () => ({ withGpuWarmup: (_: string, run: () => unknown) => Promise.resolve(run()) }));
vi.mock("@tensorflow/tfjs-backend-cpu", () => ({}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  FaceDetector: {
    createFromOptions: vi.fn().mockResolvedValue({
      detectForVideo: () => ({ detections: [{ categories: [{ score: 0.9 }], boundingBox: {} }] }),
    }),
  },
}));

import faceDetectionService, { OBJECT_DETECTION_REUSE_MS } from "../utils/faceDetection";

const video = { readyState: 4 } as unknown as HTMLVideoElement;
const withObjects = {
  enableFaceDetection: true,
  faceDetectionSensitivity: 50,
  enableObjectDetection: true,
  objectDetectionSensitivity: 50,
};

describe("faceDetection model loading", () => {
  beforeEach(() => {
    coco.detect.mockReset().mockResolvedValue([{ class: "cell phone", score: 0.9 }]);
    coco.load.mockReset().mockResolvedValue({ detect: coco.detect });
  });

  it("doesn't load COCO-SSD until object detection is used", async () => {
    await faceDetectionService.loadModels();
    expect(coco.load).not.toHaveBeenCalled();
    const r = await faceDetectionService.checkProctoringCompliance(video, { ...withObjects, enableObjectDetection: false });
    expect(r.faceCount).toBe(1);
    expect(r.faceDetails).toHaveLength(1);
    expect(coco.load).not.toHaveBeenCalled();
  });

  it("shares one object detection between both loops, and still reports a phone", async () => {
    vi.useFakeTimers();
    try {
      const [a, b] = await Promise.all([
        faceDetectionService.checkProctoringCompliance(video, withObjects),
        faceDetectionService.checkProctoringCompliance(video, withObjects),
      ]);
      // One warm-up frame (first use compiles the GPU programs) + one real detection.
      expect(coco.detect).toHaveBeenCalledTimes(2);
      expect(a.warnings.join()).toMatch(/Mobile phone/);
      expect(b.warnings.join()).toMatch(/Mobile phone/);
      await faceDetectionService.checkProctoringCompliance(video, withObjects);
      expect(coco.detect).toHaveBeenCalledTimes(2); // reused
      vi.advanceTimersByTime(OBJECT_DETECTION_REUSE_MS + 1);
      await faceDetectionService.checkProctoringCompliance(video, withObjects);
      expect(coco.detect).toHaveBeenCalledTimes(3); // fresh after the reuse window
    } finally {
      vi.useRealTimers();
    }
  });
});
