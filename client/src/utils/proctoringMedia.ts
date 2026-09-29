/**
 * Proctoring keeps its live media on `window` so the setup wizard, the quiz
 * page and the instructor-audio helpers can share it (see ProctoringSetup:
 * proctoringStream / proctoringPeerConnection / proctoringSocket,
 * instructorAudio and the audio contexts). Nothing used to release them, so
 * the camera light stayed on after the quiz ended.
 */

type ProctoringWindow = Window & {
  proctoringStream?: MediaStream | null;
  proctoringPeerConnection?: RTCPeerConnection | null;
  proctoringSocket?: { disconnect?: () => void } | null;
  instructorAudio?: HTMLAudioElement | null;
  proctoringAudioContext?: AudioContext | null;
  micAudioContext?: AudioContext | null;
  masterGainNode?: unknown;
  micGainNode?: unknown;
};

/** Whether a stream actually carries a live camera track. */
export const streamHasCamera = (stream?: MediaStream | null): boolean =>
  !!stream && stream.getVideoTracks().some((t) => t.readyState !== "ended");

const stopStream = (stream?: MediaStream | null) => {
  try {
    stream?.getTracks().forEach((track) => track.stop());
  } catch {
    // Already stopped / not a real stream.
  }
};

const closeContext = (ctx?: AudioContext | null) => {
  try {
    if (ctx && ctx.state !== "closed") void ctx.close();
  } catch {
    // Ignore: closing is best effort.
  }
};

/**
 * Turn the camera and microphone off and drop every live proctoring
 * connection. Safe to call more than once and when proctoring never started.
 */
export function releaseProctoringMedia(extraStreams: (MediaStream | null | undefined)[] = []): void {
  if (typeof window === "undefined") return;
  const w = window as ProctoringWindow;

  const streams = new Set<MediaStream>();
  if (w.proctoringStream) streams.add(w.proctoringStream);
  for (const s of extraStreams) if (s) streams.add(s);

  // <video> elements showing the camera keep a reference to the stream.
  document.querySelectorAll("video").forEach((video) => {
    const src = video.srcObject;
    if (src && typeof (src as MediaStream).getTracks === "function") {
      streams.add(src as MediaStream);
      video.srcObject = null;
    }
  });

  streams.forEach(stopStream);

  try {
    w.proctoringPeerConnection?.close();
  } catch {
    // Ignore.
  }
  try {
    w.proctoringSocket?.disconnect?.();
  } catch {
    // Ignore.
  }
  if (w.instructorAudio) {
    try {
      w.instructorAudio.pause();
      w.instructorAudio.srcObject = null;
    } catch {
      // Ignore.
    }
  }
  closeContext(w.proctoringAudioContext);
  closeContext(w.micAudioContext);

  w.proctoringStream = null;
  w.proctoringPeerConnection = null;
  w.proctoringSocket = null;
  w.instructorAudio = null;
  w.proctoringAudioContext = null;
  w.micAudioContext = null;
  w.masterGainNode = undefined;
  w.micGainNode = undefined;
}

/**
 * The media a proctored session asks for. With no camera (the student said
 * so, or none was found) only the microphone is requested, so the browser
 * never shows a camera prompt.
 */
export async function getProctoringStream(noCamera: boolean): Promise<MediaStream> {
  if (noCamera) return navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: true,
    });
  } catch {
    // Camera missing or blocked: continue with the microphone only.
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}
