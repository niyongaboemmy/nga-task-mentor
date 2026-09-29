import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProctoringStream,
  releaseProctoringMedia,
  streamHasCamera,
} from "../utils/proctoringMedia";

type FakeTrack = { kind: "video" | "audio"; readyState: string; stop: () => void };

const track = (kind: "video" | "audio") => {
  const t: FakeTrack = { kind, readyState: "live", stop: () => undefined };
  t.stop = vi.fn(() => {
    t.readyState = "ended";
  });
  return t;
};

type ProctoringGlobals = {
  proctoringStream?: unknown;
  proctoringPeerConnection?: unknown;
  proctoringSocket?: unknown;
  instructorAudio?: unknown;
};
const globals = () => window as unknown as ProctoringGlobals;

const fakeStream = (...tracks: ReturnType<typeof track>[]) =>
  ({
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
  }) as unknown as MediaStream;

describe("proctoringMedia", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const w = globals();
    w.proctoringStream = null;
    w.proctoringPeerConnection = null;
    w.proctoringSocket = null;
    w.instructorAudio = null;
  });

  it("detects whether a stream has a live camera", () => {
    expect(streamHasCamera(null)).toBe(false);
    expect(streamHasCamera(fakeStream(track("audio")))).toBe(false);
    expect(streamHasCamera(fakeStream(track("video"), track("audio")))).toBe(true);
  });

  it("turns off every camera/mic track and drops the live connections", () => {
    const cam = track("video");
    const mic = track("audio");
    const other = track("video");
    const shownInVideo = track("video");
    const w = globals();
    w.proctoringStream = fakeStream(cam, mic);
    const pc = { close: vi.fn() };
    const socket = { disconnect: vi.fn() };
    const audio = { pause: vi.fn(), srcObject: {} };
    w.proctoringPeerConnection = pc;
    w.proctoringSocket = socket;
    w.instructorAudio = audio;
    const video = document.createElement("video");
    Object.defineProperty(video, "srcObject", {
      value: fakeStream(shownInVideo),
      writable: true,
    });
    document.body.appendChild(video);

    releaseProctoringMedia([fakeStream(other), null]);

    for (const t of [cam, mic, other, shownInVideo]) expect(t.stop).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(audio.pause).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(w.proctoringStream).toBeNull();
    expect(w.proctoringPeerConnection).toBeNull();

    // Safe to call again (e.g. submit, then unmount).
    expect(() => releaseProctoringMedia()).not.toThrow();
  });

  it("asks for the microphone only when the student has no camera", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(track("audio")));
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    await getProctoringStream(true);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it("asks for camera + mic, and falls back to the mic if the camera fails", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("none"), { name: "NotFoundError" }))
      .mockResolvedValueOnce(fakeStream(track("audio")));
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const stream = await getProctoringStream(false);
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ video: expect.anything(), audio: true });
    expect(getUserMedia.mock.calls[1][0]).toEqual({ audio: true });
    expect(streamHasCamera(stream)).toBe(false);
  });
});
