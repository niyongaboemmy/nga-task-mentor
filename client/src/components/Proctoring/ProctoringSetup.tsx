import React, { useState, useRef, useEffect } from "react";
import axios from "../../utils/axiosConfig";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import faceDetectionService from "../../utils/faceDetection";
import { useAuth } from "../../contexts/AuthContext";
import { QuizApiService } from "../../services/quizApi";

interface ProctoringSetupProps {
  quizId: string;
  onSetupComplete: (sessionData: any) => void;
  onCancel: () => void;
  onVideoReady?: (videoElement: HTMLVideoElement, stream: MediaStream) => void;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  completed: boolean;
}

const ProctoringSetup: React.FC<ProctoringSetupProps> = ({
  quizId,
  onSetupComplete,
  onCancel,
  onVideoReady,
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [quizData, setQuizData] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [browserInfo, setBrowserInfo] = useState({
    userAgent: "",
    platform: "",
    language: "",
    cookieEnabled: false,
    screenWidth: 0,
    screenHeight: 0,
  });

  const [environmentCheck, setEnvironmentCheck] = useState({
    singlePerson: false,
    noUnauthorizedMaterials: false,
    properLighting: false,
    quietEnvironment: false,
  });

  const [identityVerified, setIdentityVerified] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState<string | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);

  // Connection status states
  const [socketConnected, setSocketConnected] = useState(false);
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showConnectionPopup, setShowConnectionPopup] = useState(false);

  // Exam control states
  const [isExamPaused, setIsExamPaused] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  useEffect(() => {
    // Collect browser information
    setBrowserInfo({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    });
  }, []);

  // Fetch quiz data
  useEffect(() => {
    const fetchQuizData = async () => {
      try {
        const response = await QuizApiService.getQuiz(parseInt(quizId));
        setQuizData({
          id: response.data.id,
          title: response.data.title,
        });
      } catch (error) {
        console.error("Error fetching quiz data:", error);
        // Fallback to basic quiz data
        setQuizData({
          id: parseInt(quizId),
          title: "Quiz",
        });
      }
    };

    if (quizId) {
      fetchQuizData();
    }
  }, [quizId]);

  const steps: SetupStep[] = [
    {
      id: "permissions",
      title: "Camera & Microphone Permissions",
      description: "Grant access to your camera and microphone for proctoring",
      component: (
        <CameraPermissionStep onComplete={() => handleStepComplete(0)} />
      ),
      completed: false,
    },
    {
      id: "face-verification",
      title: "Face Verification",
      description: "Verify your face is clearly visible using AI detection",
      component: (
        <FaceVerificationStep
          onFaceVerified={() => setFaceVerified(true)}
          faceVerified={faceVerified}
        />
      ),
      completed: faceVerified,
    },
    {
      id: "environment",
      title: "Environment Check",
      description: "Ensure your testing environment meets requirements",
      component: (
        <EnvironmentCheckStep
          environmentCheck={environmentCheck}
          onEnvironmentUpdate={setEnvironmentCheck}
        />
      ),
      completed:
        environmentCheck.singlePerson &&
        environmentCheck.noUnauthorizedMaterials &&
        environmentCheck.properLighting &&
        environmentCheck.quietEnvironment,
    },
    {
      id: "identity",
      title: "Identity Verification",
      description: "Take a photo for identity verification",
      component: (
        <IdentityVerificationStep
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
          onPhotoCaptured={(photo) => {
            setPhotoCaptured(photo);
            setIdentityVerified(true);
          }}
          photoCaptured={photoCaptured}
        />
      ),
      completed: identityVerified,
    },
    {
      id: "confirmation",
      title: "Final Confirmation",
      description: "Review settings and start the proctored session",
      component: (
        <ConfirmationStep
          browserInfo={browserInfo}
          environmentCheck={environmentCheck}
          identityVerified={identityVerified}
          faceVerified={faceVerified}
        />
      ),
      completed: true,
    },
  ];

  const handleStepComplete = (stepIndex: number) => {
    const newSteps = [...steps];
    newSteps[stepIndex].completed = true;
    setCurrentStep(stepIndex + 1);
  };

  const applySystemAudioSettings = async (volume: number, micGain: number) => {
    try {
      // Apply volume settings using Web Audio API for system-level control
      if (
        typeof AudioContext !== "undefined" ||
        typeof (window as any).webkitAudioContext !== "undefined"
      ) {
        const AudioContextClass =
          AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();

        // Resume audio context if suspended (required by browser autoplay policies)
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Create master volume gain node
        const masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = volume;
        masterGainNode.connect(audioContext.destination);

        // Apply to instructor audio if it exists
        const instructorAudio = (window as any).instructorAudio;
        if (instructorAudio) {
          // Create a media element source and connect through gain node
          const source = audioContext.createMediaElementSource(instructorAudio);
          source.connect(masterGainNode);
          instructorAudio.volume = 1; // Let Web Audio API handle volume
        }

        // Store audio context for cleanup
        (window as any).proctoringAudioContext = audioContext;
        (window as any).masterGainNode = masterGainNode;
      } else {
        // Fallback to basic audio element control
        const instructorAudio = (window as any).instructorAudio;
        if (instructorAudio) {
          instructorAudio.volume = volume;
        }
      }

      // Handle microphone gain adjustment using Web Audio API
      const localStream = (window as any).proctoringStream;
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0 && micGain !== undefined) {
          try {
            // Create audio context for microphone processing
            const micAudioContext = new (
              AudioContext || (window as any).webkitAudioContext
            )();

            if (micAudioContext.state === "suspended") {
              await micAudioContext.resume();
            }

            // Create microphone source and gain node
            const micSource =
              micAudioContext.createMediaStreamSource(localStream);
            const micGainNode = micAudioContext.createGain();
            micGainNode.gain.value = micGain;

            // Connect microphone through gain node to destination
            micSource.connect(micGainNode);
            micGainNode.connect(micAudioContext.destination);

            // Store for cleanup
            (window as any).micAudioContext = micAudioContext;
            (window as any).micGainNode = micGainNode;
          } catch (micError) {
            console.warn(
              "Could not apply microphone gain adjustment:",
              micError,
            );
          }
        }
      }

      // Show user feedback
      const notification = document.createElement("div");
      notification.className =
        "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[10000]";
      notification.textContent = `Audio settings applied: Volume ${(
        volume * 100
      ).toFixed(0)}%, Mic ${(micGain * 100).toFixed(0)}%`;
      document.body.appendChild(notification);

      // Remove notification after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    } catch (error) {
      console.error("Error applying system audio settings:", error);

      // Fallback notification
      const notification = document.createElement("div");
      notification.className =
        "fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-[10000]";
      notification.textContent =
        "Audio settings applied (limited browser support)";
      document.body.appendChild(notification);

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    }
  };

  const handleStartSession = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post(
        `/proctoring/quizzes/${quizId}/proctoring/start`,
        {
          browser_info: browserInfo,
          system_info: {
            platform: browserInfo.platform,
            language: browserInfo.language,
            screenResolution: `${browserInfo.screenWidth}x${browserInfo.screenHeight}`,
          },
          ip_address: "", // Will be set by server
          location_data: null, // Will be set by server
        },
      );

      if (response.data.success) {
        // Start WebRTC streaming after session is created
        await startWebRTCStream(response.data.data.session_token);
        onSetupComplete(response.data.data);
      } else {
        alert("Failed to start proctoring session: " + response.data.message);
      }
    } catch (error: any) {
      console.error("Error starting proctoring session:", error);
      alert(
        "Failed to start proctoring session: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startWebRTCStream = async (sessionToken: string) => {
    try {
      // Get user media (camera and microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });

      // Notify parent component that video and stream are ready
      if (onVideoReady) {
        // Create a video element for monitoring if not already created
        let monitorVideo = videoRef.current;
        if (!monitorVideo) {
          monitorVideo = document.createElement("video");
          monitorVideo.srcObject = stream;
          monitorVideo.muted = true;
          monitorVideo.play();
        }
        onVideoReady(monitorVideo, stream);
      }

      // Import socket.io client
      const { io } = await import("socket.io-client");

      // Connect to socket server
      const socket = io(
        import.meta.env.VITE_SOCKET_URL || "http://localhost:5002",
        {
          transports: ["websocket", "polling"],
        },
      );

      // Global socket listener for debugging
      // socket.onAny((eventName, ...args) => {});

      socket.on("connect", () => {
        setSocketConnected(true);
        setShowConnectionPopup(true);
        setConnectionError(null);

        // Notify server that student stream has started
        if (socket.connected) {
          // Join proctoring session room FIRST - before emitting stream-started
          socket.emit("join-proctoring-session", {
            sessionToken,
            role: "student",
          });
          console.log("Student joined proctoring session room:", sessionToken);

          // Then notify server that student stream has started
          socket.emit("student-stream-started", {
            sessionToken,
            studentInfo: {
              id: parseInt(user?.id || "1"),
              first_name: user?.first_name || "Student",
              last_name: user?.last_name || "",
              email: user?.email || "student@example.com",
            },
            quizInfo: {
              id: quizData?.id || parseInt(quizId),
              title: quizData?.title || "Quiz",
            },
          });
        } else {
          console.error("Socket not connected when starting stream");
          throw new Error("Lost connection to server");
        }

        // Create WebRTC peer connection
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });

        // Add local stream tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Add transceivers explicitly to guarantee they are considered in the offer/answer
        peerConnection.addTransceiver("video", { direction: "sendonly" });
        peerConnection.addTransceiver("audio", { direction: "sendrecv" });

        // Handle remote audio stream from dashboard
        peerConnection.ontrack = (event) => {
          if (event.track.kind === "audio") {
            // Create audio element to play instructor's voice
            const audioElement = new Audio();
            audioElement.srcObject = event.streams[0];
            audioElement.autoplay = true;
            audioElement.volume = 0.5; // Start at 50% volume

            // Store reference for cleanup and volume control
            (window as any).instructorAudio = audioElement;
          }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && socket?.connected) {
            socket.emit("webrtc-ice-candidate", {
              sessionToken,
              candidate: event.candidate,
            });
          } else if (!event.candidate) {
          }
        };

        // Add connection state monitoring
        // peerConnection.onconnectionstatechange = () => {};

        peerConnection.oniceconnectionstatechange = () => {
          // Update WebRTC connection status
          if (
            peerConnection.iceConnectionState === "connected" ||
            peerConnection.iceConnectionState === "completed"
          ) {
            setWebrtcConnected(true);
            setShowConnectionPopup(true);
          } else if (
            peerConnection.iceConnectionState === "failed" ||
            peerConnection.iceConnectionState === "disconnected"
          ) {
            setWebrtcConnected(false);
            setConnectionError(
              "WebRTC connection failed. Please refresh and try again.",
            );
            setShowConnectionPopup(true);
          }
        };

        // peerConnection.onsignalingstatechange = () => {};

        // Signal to dashboard that student is ready for WebRTC connection
        if (socket.connected) {
          socket.emit("student-webrtc-ready", {
            sessionToken,
            message: "Student is ready for WebRTC connection",
          });
        }

        // Handle remote offer from dashboard (including renegotiation)
        socket.on("webrtc-offer", async (data: any) => {
          // Debug: Log what data looks like

          // Workaround: If sessionToken is undefined but we have a local sessionToken,
          // use our local sessionToken (server might not be forwarding it correctly)
          const effectiveSessionToken = data.sessionToken || sessionToken;

          if (effectiveSessionToken) {
            try {
              const currentPeerConnection =
                (window as any).proctoringPeerConnection || peerConnection;
              if (currentPeerConnection) {
                // Check signaling state before setting remote description
                // Allow both "stable" (first offer) and "have-remote-offer" (renegotiation)
                const signalingState = currentPeerConnection.signalingState;

                // If already stable after processing, we might have a duplicate - but allow it
                // The key is we cannot set remote description if we have a local offer
                if (signalingState === "have-local-offer") {
                  return;
                }

                await currentPeerConnection.setRemoteDescription(
                  new RTCSessionDescription(data.offer),
                );

                // Process queued ICE candidates
                const pcAny = currentPeerConnection as any;
                if (
                  pcAny.pendingCandidates &&
                  pcAny.pendingCandidates.length > 0
                ) {
                  for (const queuedCandidate of pcAny.pendingCandidates) {
                    await currentPeerConnection
                      .addIceCandidate(new RTCIceCandidate(queuedCandidate))
                      .catch((e: any) =>
                        console.error("Failed to add queued candidate:", e),
                      );
                  }
                  pcAny.pendingCandidates = [];
                }

                // Create and send answer
                // Check signaling state before setting local description
                if (
                  currentPeerConnection.signalingState !==
                    "have-remote-offer" &&
                  currentPeerConnection.signalingState !== "stable"
                ) {
                  return;
                }

                const answer = await currentPeerConnection.createAnswer();
                await currentPeerConnection.setLocalDescription(answer);

                if (socket.connected) {
                  socket.emit("webrtc-answer", {
                    sessionToken,
                    answer,
                  });
                } else {
                  console.error(
                    "Socket not connected when sending WebRTC answer",
                  );
                }
              } else {
                console.error(
                  "No peer connection available for handling offer",
                );
              }
            } catch (error) {
              console.error("❌ Error handling WebRTC offer:", error);
            }
          }
        });

        // Handle dashboard reconnection notification
        socket.on("dashboard-reconnected", async (data: any) => {
          if (data.sessionToken === sessionToken) {
            // Reset the peer connection to allow dashboard to reconnect
            try {
              // Close existing peer connection
              const currentPeerConnection =
                (window as any).proctoringPeerConnection || peerConnection;
              if (currentPeerConnection) {
                currentPeerConnection.close();
              }

              // Create new peer connection
              const newPeerConnection = new RTCPeerConnection({
                iceServers: [
                  { urls: "stun:stun.l.google.com:19302" },
                  { urls: "stun:stun1.l.google.com:19302" },
                ],
              });

              // Re-add local stream tracks
              stream.getTracks().forEach((track) => {
                newPeerConnection.addTrack(track, stream);
              });

              // Re-add transceiver for receiving audio from dashboard
              newPeerConnection.addTransceiver("audio", {
                direction: "recvonly",
              });

              // Re-setup ontrack handler for instructor audio
              newPeerConnection.ontrack = (event) => {
                if (event.track.kind === "audio") {
                  // Check if we already have an audio element, reuse it
                  let audioElement = (window as any).instructorAudio;
                  if (!audioElement) {
                    audioElement = new Audio();
                    audioElement.autoplay = true;
                    audioElement.volume = 0.5;
                    (window as any).instructorAudio = audioElement;
                  }
                  audioElement.srcObject = event.streams[0];
                }
              };

              // Re-setup event handlers
              newPeerConnection.onicecandidate = (event) => {
                if (event.candidate && socket?.connected) {
                  socket.emit("webrtc-ice-candidate", {
                    sessionToken,
                    candidate: event.candidate,
                  });
                }
              };

              // newPeerConnection.onconnectionstatechange = () => {};
              // newPeerConnection.oniceconnectionstatechange = () => {};
              // newPeerConnection.onsignalingstatechange = () => {};

              // Update the stored peer connection reference
              (window as any).proctoringPeerConnection = newPeerConnection;

              // Re-signal readiness for WebRTC connection
              if (socket.connected) {
                socket.emit("student-webrtc-ready", {
                  sessionToken,
                  message:
                    "Student is ready for WebRTC connection (reconnected)",
                });
              }
            } catch (error) {
              console.error("Error resetting WebRTC connection:", error);
            }
          }
        });

        // Handle remote ICE candidates
        socket.on("webrtc-ice-candidate", async (data: any) => {
          // Workaround: If sessionToken is undefined, use our local sessionToken
          const effectiveSessionToken = data.sessionToken || sessionToken;

          if (effectiveSessionToken === sessionToken && data.candidate) {
            try {
              const currentPeerConnection =
                (window as any).proctoringPeerConnection || peerConnection;
              if (currentPeerConnection) {
                if (currentPeerConnection.remoteDescription) {
                  await currentPeerConnection.addIceCandidate(
                    new RTCIceCandidate(data.candidate),
                  );
                } else {
                  const pcAny = currentPeerConnection as any;
                  pcAny.pendingCandidates = pcAny.pendingCandidates || [];
                  pcAny.pendingCandidates.push(data.candidate);
                }
              } else {
                console.error("No peer connection available for ICE candidate");
              }
            } catch (error) {
              console.error("Error adding ICE candidate:", error);
            }
          }
        });

        // Handle force audio settings command from dashboard
        socket.on("force-student-audio", async (data: any) => {
          if (data.sessionToken === sessionToken) {
            await applySystemAudioSettings(
              data.volume || 0.5,
              data.micGain || 0.6,
            );
          }
        });

        // Handle warning from dashboard
        socket.on("send-warning-to-student", (data: any) => {
          console.log("Student received send-warning-to-student", data);
          if (data.sessionToken === sessionToken) {
            setWarningMessage(data.message || "Warning from instructor");
            setShowWarning(true);
            // Notify dashboard of warning status
            socket.emit("exam-status-changed", {
              sessionToken,
              status: "warning",
            });
            const audio = new Audio(
              "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRAxA3Tv9/W5diYKLfrw9/K4fiIGKv799vK3eiAKLfr29/K3eyAKK/fs9vK2eR8LK/n09vK1eR4LK/jz9vK0eB0MK/bz9vKzeBwNK/X09vKyeBsOKvT19vKxeRsPKfP19vKweRsPKPL19vKvdxsPKPH19vKudxsPKO/19vGsdhoOKO709vGqdRkNKOnz9vGpdBkMKOjy9vCodBkLJ+fx9vCodBgKJuXu9vGndBcKJuPt9vGldBYKJuHs9vGkexYJJeDr9vGhexYJJOHq9vGhexYJI+Dp9vCfexYIIt/m9vCdexYII9/k9vCcexYIIt/l9vCdexYII9/k9vCdexYII9/k9vCdexYII9/k9vCdexYII9/k9vCdehYII9/k9vCdexYII9/k9vCdehYII9/k9vCdehYII+Dp9vCfexYIIt/m9vCdexYII9/k9vCcexYIIt/l9vCdexYII9/k9vCdexYII9/k9vCdexYII9/k9vCdexYII9/k9vCdexYII9/l9vCdexYJI+Dp9vCfexYJIt/m9vCdexYJI9/k9vCcexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vCdexYJI9/l9vCdehYJI+Dp9vCfexYJIt/m9vCdehYJI9/k9vCcexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vGdexYJI9/k9vGdexYJI+Dp9vGfexYJIt/m9vGdexYJI9/k9vGcexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/l9vGdehYJI+Dp9vGfexYJIt/m9vGdehYJI9/k9vGcexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/l9vGdehYJI+Dp9vGfexYJIt/m9vGdehYJI9/k9vGcexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/l9vGdehYJI+Dp9vGfexYJIt/m9",
            );
            audio.play().catch(() => {});
          }
        });

        // Handle pause exam command from dashboard
        socket.on("pause-student-exam", (data: any) => {
          console.log("Student received pause-student-exam", data);
          if (data.sessionToken === sessionToken) {
            setIsExamPaused(true);
            // Notify dashboard of paused status
            socket.emit("exam-status-changed", {
              sessionToken,
              status: "paused",
            });
          }
        });

        // Handle resume exam command from dashboard
        socket.on("resume-student-exam", (data: any) => {
          console.log("Student received resume-student-exam", data);
          if (data.sessionToken === sessionToken) {
            setIsExamPaused(false);
            // Notify dashboard of active status
            socket.emit("exam-status-changed", {
              sessionToken,
              status: "active",
            });
          }
        });

        // Store peer connection for cleanup
        (window as any).proctoringPeerConnection = peerConnection;
        (window as any).proctoringSocket = socket;
        (window as any).proctoringStream = stream;
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });
    } catch (error) {
      console.error("Error starting WebRTC stream:", error);
      throw error;
    }
  };

  const canProceed =
    steps[currentStep]?.completed || currentStep === steps.length - 1;

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Warning Modal - Displayed when instructor sends a warning */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl transform animate-pulse">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-red-600"
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
              </div>
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
                WARNING
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6 text-lg">
                {warningMessage}
              </p>
              <button
                onClick={() => setShowWarning(false)}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Paused Overlay */}
      {isExamPaused && (
        <div className="fixed inset-0 z-40 bg-yellow-900/80 backdrop-blur-sm flex items-center justify-center">
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
                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-4">
              Exam Paused
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your exam has been paused by the instructor. Please wait until it
              resumes.
            </p>
          </div>
        </div>
      )}

      {/* Connection Status Popup */}
      {showConnectionPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all">
            <div className="text-center">
              {/* Icon */}
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${connectionError ? "bg-red-100 dark:bg-red-900/30" : webrtcConnected ? "bg-green-100 dark:bg-green-900/30" : socketConnected ? "bg-blue-100 dark:bg-blue-900/30" : "bg-yellow-100 dark:bg-yellow-900/30"}`}
              >
                {connectionError ? (
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : webrtcConnected ? (
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : socketConnected ? (
                  <svg
                    className="w-8 h-8 text-blue-500 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-8 h-8 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-2 dark:text-white">
                {connectionError
                  ? "Connection Failed"
                  : webrtcConnected
                    ? "Connected!"
                    : socketConnected
                      ? "Connecting to Dashboard..."
                      : "Connecting..."}
              </h3>

              {/* Status Messages */}
              <div className="space-y-2 mb-6">
                <div
                  className={`flex items-center justify-center gap-2 ${socketConnected ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}
                >
                  {socketConnected ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  )}
                  <span>Socket Server</span>
                </div>
                <div
                  className={`flex items-center justify-center gap-2 ${webrtcConnected ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}
                >
                  {webrtcConnected ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : socketConnected ? (
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                  <span>WebRTC</span>
                </div>
              </div>

              {/* Error Message */}
              {connectionError && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">
                  {connectionError}
                </div>
              )}

              {/* Close Button */}
              {webrtcConnected || connectionError ? (
                <button
                  onClick={() => setShowConnectionPopup(false)}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  {connectionError ? "Close" : "Continue"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <Card className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/50 rounded-3xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-center text-gray-900 dark:text-white">
            Proctoring Setup
          </CardTitle>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
            Complete the setup process to begin your proctored quiz
          </p>
        </CardHeader>
        <CardContent>
          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex-1 text-center ${
                    index <= currentStep
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-400  dark:text-gray-400"
                  }`}
                >
                  <div
                    className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center text-xs font-bold mb-1 ${
                      step.completed
                        ? "bg-green-500 text-white"
                        : index === currentStep
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {step.completed ? "✓" : index + 1}
                  </div>
                  <div className="text-xs font-medium dark:text-gray-300">
                    {step.title}
                  </div>
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Current Step Content */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              {steps[currentStep]?.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
              {steps[currentStep]?.description}
            </p>
            {steps[currentStep]?.component}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              onClick={
                currentStep > 0
                  ? () => setCurrentStep(currentStep - 1)
                  : onCancel
              }
              className="px-4 py-2 shadow-none rounded-full bg-gray-100 text-black dark:bg-gray-800 dark:text-white hover:bg-blue-100 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white group"
            >
              <span className="text-black group-hover:text-white dark:text-gray-200 dark:group-hover:text-white">
                {currentStep > 0 ? "Previous" : "Cancel"}
              </span>
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed}
                className="px-4 py-2 shadow-none rounded-full bg-blue-600 hover:bg-blue-700"
              >
                Continue to Next Step
              </Button>
            ) : (
              <Button
                onClick={handleStartSession}
                disabled={isLoading || !canProceed}
                className="px-6 py-2 shadow-none rounded-full bg-green-600 hover:bg-green-700"
              >
                {isLoading ? "Starting..." : "Start Proctored Quiz"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hidden video and canvas for photo capture */}
      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

// Camera Permission Step Component
const CameraPermissionStep: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Stop the stream immediately after getting permission
      stream.getTracks().forEach((track) => track.stop());

      setPermissionsGranted(true);
      setError(null);
      onComplete();
    } catch (err) {
      setError("Camera and microphone access is required for proctoring");
      console.error("Error requesting permissions:", err);
    }
  };

  return (
    <div className="text-center">
      <div className="mb-4">
        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          We need access to your camera and microphone to monitor the testing
          environment and ensure academic integrity.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {!permissionsGranted ? (
        <Button onClick={requestPermissions} size="lg">
          Grant Camera & Microphone Access
        </Button>
      ) : (
        <div className="text-green-600 dark:text-green-400 font-medium">
          ✓ Permissions granted successfully
        </div>
      )}
    </div>
  );
};

// Environment Check Step Component
const EnvironmentCheckStep: React.FC<{
  environmentCheck: any;
  onEnvironmentUpdate: (check: any) => void;
}> = ({ environmentCheck, onEnvironmentUpdate }) => {
  const handleCheckboxChange = (field: string, value: boolean) => {
    onEnvironmentUpdate({
      ...environmentCheck,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Environment Requirements:
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• You must be alone in the room</li>
          <li>• No unauthorized materials, notes, or devices visible</li>
          <li>• Adequate lighting so your face is clearly visible</li>
          <li>• Quiet environment with no background noise</li>
        </ul>
      </div>

      <div className="space-y-3">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={environmentCheck.singlePerson}
            onChange={(e) =>
              handleCheckboxChange("singlePerson", e.target.checked)
            }
            className="mr-3"
          />
          <span className="dark:text-gray-300">
            I confirm I am alone in the room with no other people present
          </span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={environmentCheck.noUnauthorizedMaterials}
            onChange={(e) =>
              handleCheckboxChange("noUnauthorizedMaterials", e.target.checked)
            }
            className="mr-3"
          />
          <span className="dark:text-gray-300">
            I confirm there are no unauthorized materials, notes, or devices
            visible
          </span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={environmentCheck.properLighting}
            onChange={(e) =>
              handleCheckboxChange("properLighting", e.target.checked)
            }
            className="mr-3"
          />
          <span className="dark:text-gray-300">
            I confirm the lighting is adequate and my face is clearly visible
          </span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={environmentCheck.quietEnvironment}
            onChange={(e) =>
              handleCheckboxChange("quietEnvironment", e.target.checked)
            }
            className="mr-3"
          />
          <span>
            I confirm the environment is quiet with no background noise
          </span>
        </label>
      </div>
    </div>
  );
};

// Identity Verification Step Component
const IdentityVerificationStep: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onPhotoCaptured: (photo: string) => void;
  photoCaptured: string | null;
}> = ({ videoRef, canvasRef, onPhotoCaptured, photoCaptured }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [detectionStatus, setDetectionStatus] = useState<{
    faceCount: number;
    confidence: number;
    isDetecting: boolean;
  }>({
    faceCount: 0,
    confidence: 0,
    isDetecting: false,
  });
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [videoRef]);

  // Start continuous face detection when video is ready
  useEffect(() => {
    if (videoRef.current && !photoCaptured) {
      startContinuousDetection();
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [photoCaptured]);

  const startContinuousDetection = async () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    // Load face detection models
    try {
      await faceDetectionService.loadModels();
    } catch (error) {
      console.error("Error loading face detection models:", error);
      return;
    }

    setDetectionStatus((prev) => ({ ...prev, isDetecting: true }));

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || photoCaptured) return;

      try {
        const result = await faceDetectionService.detectFaces(
          videoRef.current,
          {
            minConfidence: 0.3,
          },
        );

        setDetectionStatus({
          faceCount: result.faceCount,
          confidence: (result.confidence || 0) * 100,
          isDetecting: true,
        });

        // Draw face borders on overlay canvas
        drawFaceBorders(result.faceDetails || []);
      } catch (error) {
        console.error("Error during face detection:", error);
        setDetectionStatus((prev) => ({
          ...prev,
          isDetecting: false,
        }));
      }
    }, 500);
  };

  const drawFaceBorders = (faceDetails: any[]) => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw animated green square around detected faces
    faceDetails.forEach((face: any) => {
      if (face.score >= 0.3) {
        let x, y, width, height;

        if (face.box) {
          // face-api.js format
          x = face.box.x;
          y = face.box.y;
          width = face.box.width;
          height = face.box.height;
        } else if (face.boundingBox) {
          // MediaPipe Tasks Vision format
          const box = face.boundingBox;
          if (
            box.originX !== undefined &&
            box.originY !== undefined &&
            box.width !== undefined &&
            box.height !== undefined
          ) {
            // Absolute coordinates
            x = box.originX;
            y = box.originY;
            width = box.width;
            height = box.height;
          } else if (
            box.xMin !== undefined &&
            box.yMin !== undefined &&
            box.xMax !== undefined &&
            box.yMax !== undefined
          ) {
            // Normalized coordinates
            x = box.xMin * canvas.width;
            y = box.yMin * canvas.height;
            width = (box.xMax - box.xMin) * canvas.width;
            height = (box.yMax - box.yMin) * canvas.height;
          } else {
            return; // Skip if no valid bounding box data
          }
        } else {
          return;
        }

        // Create animated green square effect
        const time = Date.now() * 0.005; // Animation speed
        const pulse = Math.sin(time) * 0.3 + 0.7; // Pulsing effect

        // Draw main green square with pulsing effect
        ctx.strokeStyle = `rgba(16, 185, 129, ${pulse})`; // Green with opacity
        ctx.lineWidth = 4 + Math.sin(time * 2) * 2; // Animated line width
        ctx.strokeRect(x, y, width, height);

        // Draw corner brackets for more prominent effect
        const bracketSize = 20;
        ctx.lineWidth = 3;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + bracketSize);
        ctx.lineTo(x, y);
        ctx.lineTo(x + bracketSize, y);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - bracketSize, y);
        ctx.lineTo(x + width, y);
        ctx.lineTo(x + width, y + bracketSize);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + height - bracketSize);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x + bracketSize, y + height);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - bracketSize, y + height);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + width, y + height - bracketSize);
        ctx.stroke();

        // Draw confidence score in a box
        const confidence = Math.round(
          (face.score || face.confidence || 0) * 100,
        );

        // Background for confidence text
        const text = `${confidence}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
        ctx.fillRect(x + 5, y - 25, textWidth + 10, 20);

        // Confidence text
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 14px Arial";
        ctx.fillText(text, x + 10, y - 10);
      }
    });
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    onPhotoCaptured(photoDataUrl);

    setIsCapturing(false);
  };

  return (
    <div className="text-center">
      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Please position yourself in front of the camera so your face is
          clearly visible for identity verification.
        </p>
      </div>

      {!photoCaptured ? (
        <div className="mb-4">
          {/* Video with Canvas Overlay */}
          <div className="relative inline-block max-w-md mx-auto">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full border border-gray-300 rounded-md"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          {/* Detection Status Display */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-blue-900/30 rounded-lg border dark:border-blue-700 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Faces Detected:
                </span>
                <span
                  className={`font-medium ${
                    detectionStatus.faceCount === 1
                      ? "text-green-600"
                      : detectionStatus.faceCount === 0
                        ? "text-red-600"
                        : "text-orange-600"
                  }`}
                >
                  {detectionStatus.faceCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Confidence:
                </span>
                <span
                  className={`font-medium ${
                    detectionStatus.confidence >= 70
                      ? "text-green-600"
                      : detectionStatus.confidence >= 50
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {Math.round(detectionStatus.confidence)}%
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  detectionStatus.isDetecting
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-400"
                }`}
              ></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {detectionStatus.isDetecting
                  ? "Detecting faces..."
                  : "Detection paused"}
              </span>
            </div>
          </div>

          <Button
            onClick={capturePhoto}
            disabled={isCapturing || detectionStatus.faceCount !== 1}
            className="mt-4"
          >
            {isCapturing ? "Capturing..." : "Take Photo"}
          </Button>
          {detectionStatus.faceCount !== 1 && (
            <p className="mt-2 text-sm text-orange-600">
              Please ensure exactly one face is detected before taking photo
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <img
            src={photoCaptured}
            alt="Captured photo"
            className="w-full max-w-md mx-auto border border-gray-300 rounded-md"
          />
          <div className="mt-4 text-green-600 font-medium">
            ✓ Photo captured successfully
          </div>
          <Button onClick={() => onPhotoCaptured("")} className="mt-2">
            Retake Photo
          </Button>
        </div>
      )}
    </div>
  );
};

// Face Verification Step Component
const FaceVerificationStep: React.FC<{
  onFaceVerified: () => void;
  faceVerified: boolean;
}> = ({ onFaceVerified, faceVerified }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<{
    faceCount: number;
    confidence: number;
    warnings: string[];
    isDetecting: boolean;
  }>({
    faceCount: 0,
    confidence: 0,
    warnings: [],
    isDetecting: false,
  });
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        setError("Unable to access camera for face verification");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  // Start continuous face detection when video is ready
  useEffect(() => {
    if (videoRef.current && !faceVerified && !isVerifying) {
      startContinuousDetection();
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [faceVerified, isVerifying]);

  const startContinuousDetection = async () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    // Load face detection models
    try {
      await faceDetectionService.loadModels();
    } catch (error) {
      console.error("Error loading face detection models:", error);
      setError("Failed to load face detection models");
      return;
    }

    setDetectionStatus((prev) => ({ ...prev, isDetecting: true }));

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || faceVerified) return;

      // Check if video is ready
      if (
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0
      ) {
        return;
      }

      try {
        const result = await faceDetectionService.detectFaces(
          videoRef.current,
          {
            minConfidence: 0.2, // Lower threshold for better detection
          },
        );

        const warnings: string[] = [];
        if (!result.hasFace) {
          warnings.push("No face detected");
        } else if (result.faceCount > 1) {
          warnings.push("Multiple faces detected");
        } else if (result.confidence && result.confidence < 0.3) {
          warnings.push("Low confidence - ensure proper lighting");
        }

        setDetectionStatus({
          faceCount: result.faceCount,
          confidence: (result.confidence || 0) * 100,
          warnings,
          isDetecting: true,
        });

        // Draw face borders and status indicators on canvas
        drawFaceBordersAndStatus(result.faceDetails || [], result);
      } catch (error) {
        console.error("Error during face detection:", error);
        setDetectionStatus((prev) => ({
          ...prev,
          warnings: [
            "Detection error: " +
              (error instanceof Error ? error.message : String(error)),
          ],
          isDetecting: false,
        }));
      }
    }, 300); // Detect every 300ms for more responsive feedback
  };

  const drawFaceBordersAndStatus = (faceDetails: any[], result: any) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw status indicators in the top-left corner
    const statusX = 20;
    const statusY = 30;
    const lineHeight = 25;

    // Background for status
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(statusX - 10, statusY - 20, 200, 80);

    // Status text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "14px Arial";
    ctx.fillText(`Faces: ${result.faceCount}`, statusX, statusY);

    ctx.fillStyle =
      result.faceCount === 1
        ? "#10B981"
        : result.faceCount === 0
          ? "#EF4444"
          : "#F59E0B";
    ctx.fillText(
      `Confidence: ${Math.round((result.confidence || 0) * 100)}%`,
      statusX,
      statusY + lineHeight,
    );

    // Detection status
    ctx.fillStyle = detectionStatus.isDetecting ? "#10B981" : "#6B7280";
    ctx.fillText(
      detectionStatus.isDetecting ? "Detecting..." : "Paused",
      statusX,
      statusY + lineHeight * 2,
    );

    // Draw animated green square around detected faces
    faceDetails.forEach((face: any) => {
      if (face.score >= 0.2) {
        // Lower threshold for visual feedback
        let x, y, width, height;

        if (face.box) {
          // face-api.js format
          x = face.box.x;
          y = face.box.y;
          width = face.box.width;
          height = face.box.height;
        } else if (face.boundingBox) {
          // MediaPipe Tasks Vision format
          const box = face.boundingBox;
          if (
            box.originX !== undefined &&
            box.originY !== undefined &&
            box.width !== undefined &&
            box.height !== undefined
          ) {
            // Absolute coordinates
            x = box.originX;
            y = box.originY;
            width = box.width;
            height = box.height;
          } else if (
            box.xMin !== undefined &&
            box.yMin !== undefined &&
            box.xMax !== undefined &&
            box.yMax !== undefined
          ) {
            // Normalized coordinates
            x = box.xMin * canvas.width;
            y = box.yMin * canvas.height;
            width = (box.xMax - box.xMin) * canvas.width;
            height = (box.yMax - box.yMin) * canvas.height;
          } else {
            return; // Skip if no valid bounding box data
          }
        } else {
          return; // Skip if no bounding box data
        }

        // Create animated green square effect
        const time = Date.now() * 0.005; // Animation speed
        const pulse = Math.sin(time) * 0.3 + 0.7; // Pulsing effect

        // Draw main green square with pulsing effect
        ctx.strokeStyle = `rgba(16, 185, 129, ${pulse})`; // Green with opacity
        ctx.lineWidth = 4 + Math.sin(time * 2) * 2; // Animated line width
        ctx.strokeRect(x, y, width, height);

        // Draw corner brackets for more prominent effect
        const bracketSize = 20;
        ctx.lineWidth = 3;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + bracketSize);
        ctx.lineTo(x, y);
        ctx.lineTo(x + bracketSize, y);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - bracketSize, y);
        ctx.lineTo(x + width, y);
        ctx.lineTo(x + width, y + bracketSize);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + height - bracketSize);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x + bracketSize, y + height);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - bracketSize, y + height);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + width, y + height - bracketSize);
        ctx.stroke();

        // Draw confidence score in a box
        const confidence = Math.round(
          (face.score || face.confidence || 0) * 100,
        );

        // Background for confidence text
        const text = `${confidence}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
        ctx.fillRect(x + 5, y - 25, textWidth + 10, 20);

        // Confidence text
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 14px Arial";
        ctx.fillText(text, x + 10, y - 10);
      }
    });

    // Draw center guidelines to help user position face
    if (result.faceCount === 0) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // Vertical center line
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      ctx.setLineDash([]);

      // Center circle guide
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 80, 0, 2 * Math.PI);
      ctx.stroke();

      // Instruction text
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "18px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        "Position face here",
        canvas.width / 2,
        canvas.height / 2 + 120,
      );
      ctx.textAlign = "left";
    }
  };

  const verifyFace = async () => {
    if (!videoRef.current) return;

    setIsVerifying(true);
    setError(null);

    try {
      // Load face detection models if not already loaded
      await faceDetectionService.loadModels();

      // Attempt face detection multiple times for reliability
      let faceDetected = false;
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const result = await faceDetectionService.detectFaces(
          videoRef.current,
          {
            minConfidence: 0.6, // Higher confidence for pre-exam verification
          },
        );

        if (result.hasFace && result.faceCount === 1) {
          faceDetected = true;
          break;
        }

        // Wait a bit before next attempt
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (faceDetected) {
        onFaceVerified();
      } else {
        setError(
          "No face detected. Please ensure your face is clearly visible in the camera and try again.",
        );
      }
    } catch (error) {
      console.error("Error during face verification:", error);
      setError("Face verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="text-center">
      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          We need to verify that your face is clearly visible using AI face
          detection before you can begin the proctored quiz.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {!faceVerified ? (
        <div className="mb-4">
          {/* Video with Canvas Overlay */}
          <div className="relative inline-block max-w-md mx-auto">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full border border-gray-300 rounded-md"
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          {/* Detection Status Display */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-800">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Face Detection Status
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Faces Detected:
                </span>
                <span
                  className={`font-medium ${
                    detectionStatus.faceCount === 1
                      ? "text-green-600"
                      : detectionStatus.faceCount === 0
                        ? "text-red-600"
                        : "text-orange-600"
                  }`}
                >
                  {detectionStatus.faceCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Confidence:
                </span>
                <span
                  className={`font-medium ${
                    detectionStatus.confidence >= 70
                      ? "text-green-600"
                      : detectionStatus.confidence >= 50
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {Math.round(detectionStatus.confidence)}%
                </span>
              </div>
            </div>

            {/* Detection Rules */}
            <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">Detection Rules:</p>
              <ul className="space-y-1 text-left">
                <li
                  className={
                    detectionStatus.faceCount === 1
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  ✓ Exactly one face must be visible
                </li>
                <li
                  className={
                    detectionStatus.confidence >= 50
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  ✓ Face confidence must be ≥50%
                </li>
                <li
                  className={
                    !detectionStatus.warnings.includes("No face detected")
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  ✓ Face must be continuously detected
                </li>
                <li
                  className={
                    !detectionStatus.warnings.includes(
                      "Multiple faces detected",
                    )
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  ✓ Only one person in frame
                </li>
              </ul>
            </div>

            {/* Warnings */}
            {detectionStatus.warnings.length > 0 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800 text-xs font-medium">Warnings:</p>
                <ul className="text-yellow-700 text-xs mt-1">
                  {detectionStatus.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detection Indicator */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  detectionStatus.isDetecting
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-400"
                }`}
              ></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {detectionStatus.isDetecting
                  ? "Detecting..."
                  : "Detection paused"}
              </span>
            </div>
          </div>

          <Button onClick={verifyFace} disabled={isVerifying} className="mt-4">
            {isVerifying ? "Verifying..." : "Verify Face"}
          </Button>

          {/* Debug button for testing detection
          <Button
            onClick={async () => {
              if (!videoRef.current) return;
              try {
                const result = await faceDetectionService.detectFaces(
                  videoRef.current,
                  { minConfidence: 0.1 }
                );
                alert(
                  `Detection result: ${
                    result.faceCount
                  } faces, confidence: ${Math.round(
                    (result.confidence || 0) * 100
                  )}%`
                );
              } catch (error) {
                console.error("Manual detection failed:", error);
                alert(
                  "Manual detection failed: " +
                    (error instanceof Error ? error.message : String(error))
                );
              }
            }}
            className="mt-2 text-sm"
          >
            Test Detection
          </Button> */}
        </div>
      ) : (
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="text-green-600 font-medium">
            ✓ Face verification successful
          </div>
        </div>
      )}
    </div>
  );
};

// Confirmation Step Component
const ConfirmationStep: React.FC<{
  browserInfo: any;
  environmentCheck: any;
  identityVerified: boolean;
  faceVerified: boolean;
}> = ({ browserInfo, environmentCheck, identityVerified, faceVerified }) => {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 dark:border-green-800 dark:bg-green-900/30 rounded-2xl p-4">
        <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">
          Setup Complete!
        </h4>
        <p className="text-green-800 dark:text-green-300 text-sm">
          All requirements have been met. You are ready to begin your proctored
          quiz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
          <h5 className="font-medium mb-2">Browser Information</h5>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>Platform: {browserInfo.platform}</p>
            <p>
              Screen: {browserInfo.screenWidth}x{browserInfo.screenHeight}
            </p>
            <p>Language: {browserInfo.language}</p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
          <h5 className="font-medium mb-2">Verification Status</h5>
          <div className="text-sm space-y-1">
            <p className={faceVerified ? "text-green-600" : "text-red-600"}>
              {faceVerified ? "✓" : "✗"} Face Verification
            </p>
            <p
              className={
                environmentCheck.singlePerson
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              {environmentCheck.singlePerson ? "✓" : "✗"} Environment Check
            </p>
            <p className={identityVerified ? "text-green-600" : "text-red-600"}>
              {identityVerified ? "✓" : "✗"} Identity Verification
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 dark:border-yellow-800 dark:bg-yellow-900/30 rounded-2xl p-4">
        <h4 className="font-medium text-yellow-900 dark:text-yellow-300 mb-2">
          Important Reminders:
        </h4>
        <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
          <li>• Do not leave the testing area during the quiz</li>
          <li>• Keep your face visible to the camera at all times</li>
          <li>• Do not use unauthorized materials or devices</li>
          <li>• Any suspicious activity will be flagged for review</li>
        </ul>
      </div>
    </div>
  );
};

export default ProctoringSetup;
