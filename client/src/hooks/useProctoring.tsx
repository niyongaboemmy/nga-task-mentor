import React, { useState, useEffect, useRef, useCallback } from "react";
import { ProctoringApiService } from "../services/proctoringApi";
import WarningNotification from "../components/Proctoring/WarningNotification";
import FloatingCameraComponent from "../components/Proctoring/FloatingCameraComponent";
import ProctoringMonitorComponent from "../components/Proctoring/ProctoringMonitorComponent";

interface UseProctoringOptions {
  quizId: number;
  onViolation?: (violation: any) => void;
  onExamPaused?: () => void;
  onExamResumed?: () => void;
  onExamTerminated?: (reason: string) => void;
  onWarning?: () => void;
}

interface UseProctoringReturn {
  // State
  proctoringSession: any;
  proctoringSettings: any;
  isLoading: boolean;
  error: string | null;
  showProctoringSetup: boolean;
  showWarning: boolean;
  warningMessage: string;
  isFullscreenMode: boolean;

  // Actions
  checkProctoringSettings: () => Promise<void>;
  setProctoringSession: (session: any) => void;
  startQuiz: () => Promise<void>;
  handleFullscreenExit: () => void;

  // UI Components (render these in your component)
  ProctoringUI: React.FC<{ children: React.ReactNode }>;
}

export const useProctoring = (
  options: UseProctoringOptions,
): UseProctoringReturn => {
  const {
    quizId,
    onViolation,
    onExamPaused,
    onExamResumed,
    onExamTerminated,
    onWarning,
  } = options;

  // All proctoring state
  const [proctoringSession, setProctoringSessionState] = useState<any>(null);
  const [proctoringSettings, setProctoringSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProctoringSetup, setShowProctoringSetup] = useState(false);

  // Warning state
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Video/stream state
  const [proctoringVideoElement, setProctoringVideoElement] =
    useState<HTMLVideoElement | null>(null);
  const [proctoringStream, setProctoringStream] = useState<MediaStream | null>(
    null,
  );
  const [proctoringMonitorActive, setProctoringMonitorActive] = useState(false);

  // Fullscreen state
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Socket ref
  const socketRef = useRef<any>(null);

  // Check proctoring settings on mount
  const checkProctoringSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ProctoringApiService.getProctoringSettings(quizId);
      const settings = response.data;
      setProctoringSettings(settings);

      if (settings && settings.enabled) {
        setShowProctoringSetup(true);
      }
    } catch (err: any) {
      console.error("Error checking proctoring settings:", err);
      // Don't block quiz start on error
    } finally {
      setIsLoading(false);
    }
  }, [quizId]);

  // Handle proctoring setup complete
  const setProctoringSession = useCallback((session: any) => {
    setProctoringSessionState(session);
    setShowProctoringSetup(false);
  }, []);

  // Start quiz after proctoring is ready
  const startQuiz = useCallback(async () => {
    // Check fullscreen requirement
    if (proctoringSettings?.require_fullscreen) {
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          console.error("Failed to enter fullscreen:", err);
          // Continue anyway
        }
      }
    }
  }, [proctoringSettings]);

  // Handle fullscreen exit
  const handleFullscreenExit = useCallback(() => {
    setIsFullscreenMode(false);
  }, []);

  // Initialize proctoring when session is set
  useEffect(() => {
    if (!proctoringSession?.session_token || !proctoringSettings) return;

    let socket: any = null;

    const initializeProctoring = async () => {
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });

        setProctoringStream(stream);

        // Create video element
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.play();
        setProctoringVideoElement(video);

        // Connect to socket
        const { io } = await import("socket.io-client");
        socket = io(
          import.meta.env.VITE_SOCKET_URL || "http://localhost:5002",
          {
            transports: ["polling", "websocket"],
          },
        );
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join-proctoring-session", {
            sessionToken: proctoringSession.session_token,
            role: "student",
          });
        });

        // Handle warning from instructor
        socket.on("send-warning-to-student", (data: any) => {
          if (data.sessionToken === proctoringSession.session_token) {
            setWarningMessage(data.message || "Warning from instructor");
            setShowWarning(true);
            onWarning?.();
            socket.emit("exam-status-changed", {
              sessionToken: proctoringSession.session_token,
              status: "warning",
            });
          }
        });

        // Handle exam paused
        socket.on("pause-student-exam", (data: any) => {
          if (data.sessionToken === proctoringSession.session_token) {
            onExamPaused?.();
          }
        });

        // Handle exam resumed
        socket.on("resume-student-exam", (data: any) => {
          if (data.sessionToken === proctoringSession.session_token) {
            onExamResumed?.();
          }
        });

        // Handle quiz terminated
        socket.on("quiz-terminated", (data: any) => {
          if (data.sessionToken === proctoringSession.session_token) {
            onExamTerminated?.(data.reason || "Quiz terminated by instructor");
          }
        });
      } catch (err) {
        console.error("Error initializing proctoring:", err);
        setError("Failed to initialize camera or connection");
      }
    };

    initializeProctoring();

    return () => {
      if (socket) socket.disconnect();
      if (proctoringStream) {
        proctoringStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [proctoringSession?.session_token, proctoringSettings]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenMode(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Proctoring UI Component
  const ProctoringUI: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => (
    <>
      {/* Warning Notification */}
      <WarningNotification
        message={warningMessage}
        isVisible={showWarning}
        onClose={() => setShowWarning(false)}
      />

      {/* Fullscreen required overlay */}
      {proctoringSettings?.require_fullscreen && !isFullscreenMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Fullscreen Required
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              This quiz requires fullscreen mode. Please enter fullscreen to
              continue.
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      {children}

      {/* Proctoring Monitor */}
      {proctoringSession &&
        proctoringSettings &&
        proctoringVideoElement &&
        proctoringStream && (
          <ProctoringMonitorComponent
            sessionToken={proctoringSession.session_token}
            quizId=""
            settings={proctoringSettings}
            videoElement={proctoringVideoElement}
            stream={proctoringStream}
            isActive={proctoringMonitorActive}
            onViolation={onViolation}
          />
        )}

      {/* Floating Camera */}
      {proctoringSession &&
        proctoringSettings &&
        proctoringVideoElement &&
        proctoringStream && (
          <FloatingCameraComponent
            videoElement={proctoringVideoElement}
            stream={proctoringStream}
            settings={{
              enableFaceDetection: proctoringSettings.enable_face_detection,
              faceDetectionSensitivity:
                proctoringSettings.face_detection_sensitivity,
              enableObjectDetection: proctoringSettings.enable_object_detection,
              objectDetectionSensitivity:
                proctoringSettings.object_detection_sensitivity,
            }}
            onViolation={onViolation}
          />
        )}
    </>
  );

  return {
    proctoringSession,
    proctoringSettings,
    isLoading,
    error,
    showProctoringSetup,
    showWarning,
    warningMessage,
    isFullscreenMode,
    checkProctoringSettings,
    setProctoringSession,
    startQuiz,
    handleFullscreenExit,
    ProctoringUI,
  };
};
