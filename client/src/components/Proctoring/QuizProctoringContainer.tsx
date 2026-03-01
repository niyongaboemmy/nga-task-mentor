import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import WarningNotification from "./WarningNotification";
import FloatingCameraComponent from "./FloatingCameraComponent";
import ProctoringMonitorComponent from "./ProctoringMonitorComponent";
import { ProctoringApiService } from "../../services/proctoringApi";

interface QuizProctoringContainerProps {
  children: ReactNode;
  quizId: number;
  onViolation?: (violation: any) => void;
  onExamPaused?: () => void;
  onExamResumed?: () => void;
  onExamTerminated?: (reason: string) => void;
}

const QuizProctoringContainer: React.FC<QuizProctoringContainerProps> = ({
  children,
  quizId,
  onViolation,
  onExamPaused,
  onExamResumed,
  onExamTerminated,
}) => {
  // All proctoring state - MOVED HERE FROM QuizTakingPage
  const [proctoringSession, setProctoringSession] = useState<any>(null);
  const [proctoringSettings, setProctoringSettings] = useState<any>(null);
  const [showProctoringSetup, setShowProctoringSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video/stream state
  const [proctoringVideoElement, setProctoringVideoElement] =
    useState<HTMLVideoElement | null>(null);
  const [proctoringStream, setProctoringStream] = useState<MediaStream | null>(
    null,
  );
  const [proctoringMonitorActive, setProctoringMonitorActive] = useState(false);
  const [proctoringError, setProctoringError] = useState<string | null>(null);

  // Fullscreen state
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Socket state
  const [socketConnected, setSocketConnected] = useState(false);
  const [showConnectionPopup, setShowConnectionPopup] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  // Warning state
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Audio confirmation state
  const [audioConfirmationRequest, setAudioConfirmationRequest] = useState<{
    volume: number;
    micGain: number;
    requestId: string;
    sessionToken: string;
  } | null>(null);

  // Volume check state
  const [showVolumeCheck, setShowVolumeCheck] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isCheckingVolume, setIsCheckingVolume] = useState(false);
  const [volumeCheckPassed, setVolumeCheckPassed] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isPlayingSpeakerTest, setIsPlayingSpeakerTest] = useState(false);
  const [speakerTestConfirmed, setSpeakerTestConfirmed] = useState(false);
  const [speakerTestPlayed, setSpeakerTestPlayed] = useState(false);

  // Check proctoring settings
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
    } finally {
      setIsLoading(false);
    }
  }, [quizId]);

  // Initialize on mount
  useEffect(() => {
    checkProctoringSettings();
  }, [checkProctoringSettings]);

  // Handle proctoring setup complete
  const handleProctoringSetupComplete = useCallback(
    async (sessionData: any) => {
      setProctoringSession(sessionData);
      setShowProctoringSetup(false);

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
            setShowFullscreenPrompt(true);
          }
        }
      }
    },
    [proctoringSettings],
  );

  // Initialize video and socket when session is ready
  useEffect(() => {
    if (!proctoringSession?.session_token || !proctoringSettings) return;

    let socket: any = null;

    const initializeProctoring = async () => {
      try {
        // Get user media (camera and microphone)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });

        setProctoringStream(stream);
        setAudioStream(stream);

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
            transports: ["websocket", "polling"],
          },
        );
        socketRef.current = socket;

        socket.on("connect", () => {
          setSocketConnected(true);
          setShowConnectionPopup(true);
          setConnectionError(null);
          socket.emit("join-proctoring-session", {
            sessionToken: proctoringSession.session_token,
            role: "student",
          });
        });

        // Handle warning from instructor
        socket.on("send-warning-to-student", (data: any) => {
          console.log("Student received send-warning-to-student", data);
          if (data.sessionToken === proctoringSession.session_token) {
            setWarningMessage(data.message || "Warning from instructor");
            setShowWarning(true);
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

        // Handle audio confirmation request
        socket.on("request-student-audio-confirmation", (data: any) => {
          if (data.sessionToken === proctoringSession.session_token) {
            setAudioConfirmationRequest({
              volume: data.volume,
              micGain: data.micGain,
              requestId: data.requestId,
              sessionToken: data.sessionToken,
            });
          }
        });

        // Handle quiz terminated
        socket.on("quiz-terminated", (data: any) => {
          if (data.sessionToken === proctoringSession.session_token) {
            onExamTerminated?.(data.reason || "Quiz terminated by instructor");
          }
        });

        socket.on("connect_error", () => {
          setConnectionError("Failed to connect to proctoring server");
        });
      } catch (error) {
        console.error("Error initializing proctoring:", error);
        setProctoringError("Failed to initialize camera or connection");
      }
    };

    initializeProctoring();

    return () => {
      if (socket) {
        socket.disconnect();
      }
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
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Handle audio confirmation response
  const handleAudioConfirmationResponse = useCallback(
    (confirmed: boolean) => {
      if (!audioConfirmationRequest || !socketRef.current) return;

      socketRef.current.emit("student-audio-confirmation", {
        sessionToken: audioConfirmationRequest.sessionToken,
        confirmed,
        requestId: audioConfirmationRequest.requestId,
        volume: audioConfirmationRequest.volume,
        micGain: audioConfirmationRequest.micGain,
      });

      setAudioConfirmationRequest(null);
    },
    [audioConfirmationRequest],
  );

  // Cleanup audio
  useEffect(() => {
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
      }
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, []);

  return (
    <>
      {/* Warning Notification - Orange popup at top of browser */}
      <WarningNotification
        message={warningMessage}
        isVisible={showWarning}
        onClose={() => setShowWarning(false)}
      />

      {/* Show proctoring setup if needed */}
      {showProctoringSetup && proctoringSettings && (
        <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
          <p className="text-white">Loading proctoring setup...</p>
        </div>
      )}

      {/* Connection Status Popup */}
      {showConnectionPopup && proctoringSession && (
        <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${socketConnected ? "bg-green-500" : "bg-yellow-500"}`}
            />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {socketConnected
                ? "Connected to proctoring server"
                : "Connecting to proctoring server..."}
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Required Overlay */}
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

      {/* Main content - the quiz */}
      {children}

      {/* Proctoring Monitor Component */}
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

      {/* Floating Camera Component */}
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

      {/* Proctoring Error Display */}
      {proctoringError && (
        <div className="fixed bottom-4 left-4 z-40 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 max-w-xs">
          <div className="flex items-center gap-2">
            <svg
              className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-xs text-red-700 dark:text-red-300 truncate">
              {proctoringError}
            </p>
            <button
              onClick={() => setProctoringError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default QuizProctoringContainer;
