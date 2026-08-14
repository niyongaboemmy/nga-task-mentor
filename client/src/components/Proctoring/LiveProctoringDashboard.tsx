import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import StreamModal from "./StreamModal";
import { ProctoringApiService } from "../../services/proctoringApi";
import {
  User,
  AlertTriangle,
  Flag,
  Circle,
  RefreshCw,
  PauseCircle,
  Ban,
  Search,
  X,
  VideoOff,
  ArrowLeft,
  Video,
  Play,
} from "lucide-react";

interface LiveStream {
  id?: number;
  sessionToken: string;
  student: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  quiz: {
    id: number;
    title: string;
  };
  startTime: string;
  riskScore: number;
  flagsCount: number;
  isLive: boolean;
  lastConnectionTime?: string;
  stream?: MediaStream;
  disconnectedAt?: string;
  lastReconnection?: string;
  examStatus?: "active" | "paused" | "ended" | "warning";
  cameraHidden?: boolean;
  screenshots?: {
    type: "camera" | "interface";
    image: string;
    timestamp: string;
  }[];
}

interface ProctoringEvent {
  id: number;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: string;
}

const LiveProctoringDashboard: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const [selectedQuiz, setSelectedQuiz] = useState<number | null>(
    quizId ? Number(quizId) : null,
  );
  const [activeStreams, setActiveStreams] = useState<LiveStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null);
  const [selectedStreamForModal, setSelectedStreamForModal] =
    useState<LiveStream | null>(null);
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "online" | "offline" | "flagged"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<
    { id: number; title: string }[]
  >([]);
  const [statusMessages, setStatusMessages] = useState<
    {
      id: number;
      message: string;
      type: "info" | "success" | "error" | "warning";
      timestamp: Date;
    }[]
  >([]);

  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map()); // Store video element refs by session token
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localAudioStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const joiningStreamsRef = useRef<Set<string>>(new Set()); // Track streams currently being joined
  const offerInProgressRef = useRef<Set<string>>(new Set()); // Prevent concurrent offer creation per session
  const pendingICECandidatesRef = useRef<Map<string, any[]>>(new Map()); // Queue ICE candidates until peer connection is ready
  const socketIdToSessionRef = useRef<Map<string, string>>(new Map()); // Map socket IDs to session tokens
  const activeStreamsRef = useRef<LiveStream[]>([]); // Ref for current active streams

  // Helper to update activeStreams in both state and ref
  const updateActiveStreams = (
    updater: (prev: LiveStream[]) => LiveStream[],
  ) => {
    setActiveStreams((prev) => {
      const newStreams = updater(prev);
      activeStreamsRef.current = newStreams;
      return newStreams;
    });
  };

  // Keep activeStreamsRef in sync with activeStreams state
  useEffect(() => {
    activeStreamsRef.current = activeStreams;
  }, [activeStreams]);

  useEffect(() => {
    loadActiveStreams();
    initializeSocket();

    return () => {
      // Clear the stream refresh interval
      if ((window as any).streamRefreshInterval) {
        clearInterval((window as any).streamRefreshInterval);
        (window as any).streamRefreshInterval = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      // Stop all local audio streams
      localAudioStreamsRef.current.forEach((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
      localAudioStreamsRef.current.clear();
      // Clear joining streams set
      joiningStreamsRef.current.clear();
      // Clear pending ICE candidates
      pendingICECandidatesRef.current.clear();
      // Clear socket ID to session mapping
      socketIdToSessionRef.current.clear();
    };
  }, []);

  // Effect to handle video stream assignment when streams change
  useEffect(() => {
    activeStreams.forEach((stream) => {
      if (stream.stream) {
        const videoEl = videoRefs.current.get(stream.sessionToken);
        if (videoEl) {
          if (videoEl.srcObject !== stream.stream) {
            videoEl.srcObject = stream.stream;
          }
          // Only call play() if not already playing to avoid AbortError
          if (videoEl.paused) {
            videoEl.play().catch((e) => {
              if ((e as DOMException).name !== "AbortError") {
                console.error("Play error:", e);
              }
            });
          }
        }
      }
    });
  }, [activeStreams]);

  // Establish WebRTC connections when socket connects or streams are loaded
  useEffect(() => {
    if (socketConnected && activeStreams.length > 0) {
      // Small delay to ensure socket is fully ready
      const connectTimeout = setTimeout(() => {
        activeStreams.forEach((stream) => {
          if (
            stream.isLive &&
            !peerConnectionsRef.current.has(stream.sessionToken)
          ) {
            joinStream(stream);
          }
        });
      }, 1000); // Reduced delay for faster connection

      return () => clearTimeout(connectTimeout);
    }
  }, [socketConnected, activeStreams]);

  // Auto-join all active streams
  useEffect(() => {
    activeStreams.forEach((stream) => {
      if (
        stream.isLive &&
        !peerConnectionsRef.current.has(stream.sessionToken) &&
        socketConnected
      ) {
        // Auto-join live streams
        joinStream(stream);
      }
    });
  }, [activeStreams, socketConnected]);

  // Auto-click on first available stream to start video
  useEffect(() => {
    const liveStreams = getFilteredStreams().filter((stream) => stream.isLive);
    if (liveStreams.length > 0 && !selectedStream && socketConnected) {
      // Add a small delay to ensure socket is connected
      setTimeout(() => {
        if (!peerConnectionsRef.current.has(liveStreams[0].sessionToken)) {
          joinStream(liveStreams[0]);
        }
      }, 1000);
    }
  }, [activeStreams, selectedStream, socketConnected]);

  // Auto-join stream when modal opens
  useEffect(() => {
    if (selectedStreamForModal && socketConnected) {
      // Only join if not already connected
      if (
        !peerConnectionsRef.current.has(selectedStreamForModal.sessionToken)
      ) {
        joinStream(selectedStreamForModal);
      }
    }
  }, [selectedStreamForModal, socketConnected]);

  // Update available quizzes when streams change
  useEffect(() => {
    const quizzes = Array.from(
      new Map(
        activeStreams.map((stream) => [stream.quiz.id, stream.quiz]),
      ).values(),
    );
    setAvailableQuizzes(quizzes);
  }, [activeStreams]);

  const initializeSocket = () => {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5003";

    socketRef.current = io(socketUrl, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Global socket listener for debugging
    // socketRef.current.onAny((eventName, ...args) => {
    // });

    socketRef.current.on("connect", () => {
      //   "Dashboard Socket.IO connected with ID:",
      //   socketRef.current?.id,
      // );
      setSocketConnected(true);
      addStatusMessage("Connected to socket server", "success");

      // Debug: Log all outgoing events
      // if (socketRef.current) {
      //   const originalEmit = socketRef.current.emit.bind(socketRef.current);
      //   socketRef.current.emit = function (eventName: string, ...args: any[]) {
      //     if (eventName.includes("webrtc") || eventName.includes("offer")) {
      //     }
      //     return originalEmit(eventName, ...args);
      //   };
      // }

      // Request current active streams when connected
      socketRef.current?.emit("get-active-streams");

      // Set up periodic refresh of active streams every 10 seconds
      // This ensures the live status stays in sync even if events are missed
      const refreshInterval = setInterval(() => {
        if (socketRef.current?.connected) {
          socketRef.current.emit("get-active-streams");
        }
      }, 10000);

      // Store interval ID for cleanup
      (window as any).streamRefreshInterval = refreshInterval;
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Dashboard Socket.IO connection error:", error.message);
      // Provide more specific error messages
      if (error.message === "x4t") {
        addStatusMessage(
          "Unable to connect to socket server. The server may be unavailable.",
          "error",
        );
      } else if (error.message.includes("websocket")) {
        addStatusMessage(
          "WebSocket connection failed. Falling back to polling mode...",
          "warning",
        );
      } else {
        addStatusMessage(`Socket connection error: ${error.message}`, "error");
      }
    });

    socketRef.current.on("reconnect_attempt", (attemptNumber) => {
      addStatusMessage(`Reconnecting... (attempt ${attemptNumber})`, "warning");
    });

    socketRef.current.on("reconnect_failed", () => {
      addStatusMessage(
        "Failed to reconnect to socket server. Please refresh the page.",
        "error",
      );
    });

    socketRef.current.on("disconnect", (reason) => {
      setSocketConnected(false);
    });

    // Listen for real-time stream events
    socketRef.current.on("stream-started", handleStreamStarted);
    socketRef.current.on("stream-ended", handleStreamEnded);
    socketRef.current.on("stream-paused", handleStreamPaused);
    socketRef.current.on("stream-resumed", handleStreamResumed);
    socketRef.current.on("active-streams", handleActiveStreamsUpdate);

    // Listen for exam status changes (paused, active, warning)
    socketRef.current.on(
      "exam-status-changed",
      (data: { sessionToken: string; status: string }) => {
        console.log("Received exam-status-changed:", data);
        setActiveStreams((prev) =>
          prev.map((stream) =>
            stream.sessionToken === data.sessionToken
              ? { ...stream, examStatus: data.status as any }
              : stream,
          ),
        );
      },
    );

    socketRef.current.on(
      "webrtc-offer",
      async (data: { offer: any; from: string; sessionToken: string }) => {
        // Dashboard should NOT receive offers - it sends them!
        // console.error(
        //   "DASHBOARD RECEIVED OFFER - THIS SHOULD NOT HAPPEN!",
        //   data,
        // );
      },
    );

    socketRef.current.on(
      "webrtc-answer",
      (data: { answer: any; sessionToken: string; from: string }) => {
        //   "Dashboard handling WebRTC answer for session:",
        //   data.sessionToken,
        // );
        handleWebRTCAnswerDashboard(data.answer, data.sessionToken);
      },
    );

    socketRef.current.on(
      "webrtc-ice-candidate",
      (data: {
        candidate: any;
        sessionToken?: string | null;
        from: string;
      }) => {
        // Handle case where sessionToken might be missing or null (fallback from server)
        let effectiveSessionToken = data.sessionToken;

        // If sessionToken is missing or null, try to find it from the socket ID mapping
        if (!effectiveSessionToken && data.from) {
          effectiveSessionToken = socketIdToSessionRef.current.get(data.from);
        }

        // If we still don't have a sessionToken, try to find from activeStreams
        if (!effectiveSessionToken) {
          // Use the first live stream as fallback for single-student scenarios
          const liveStreams = activeStreamsRef.current.filter((s) => s.isLive);
          if (liveStreams.length > 0) {
            effectiveSessionToken = liveStreams[0].sessionToken;
          }
        }

        // If we STILL don't have a sessionToken - check if there's a pending stream waiting
        // This handles the case where ICE candidates arrive BEFORE stream-started event
        if (!effectiveSessionToken && data.from) {
          // The ICE candidate has a 'from' socket ID - the student is in a proctoring session
          // We need to guess the session token from the URL or create a placeholder

          // Try to get session from URL params (common pattern: ?session=xxx)
          const urlParams = new URLSearchParams(window.location.search);
          const urlSession = urlParams.get("session");
          if (urlSession) {
            effectiveSessionToken = urlSession;
          }
        }

        // If we still don't have a sessionToken, we need to queue the candidate
        // BUT also try to trigger a stream discovery
        if (!effectiveSessionToken) {
          // Request active streams from server to see if we missed the stream-started event
          if (socketRef.current?.connected) {
            socketRef.current.emit("get-active-streams");
          }

          // Also queue the candidate for potential later use
          if (data.from && !pendingICECandidatesRef.current.has(data.from)) {
            pendingICECandidatesRef.current.set(data.from, []);
          }
          if (data.from) {
            pendingICECandidatesRef.current
              .get(data.from)
              ?.push(data.candidate);
          }
          return;
        }

        // Handle ICE candidates from students
        if (peerConnectionsRef.current.has(effectiveSessionToken)) {
          handleICECandidate(data.candidate, effectiveSessionToken);
        } else {
          // Queue the ICE candidate for when peer connection is created
          if (!pendingICECandidatesRef.current.has(effectiveSessionToken)) {
            pendingICECandidatesRef.current.set(effectiveSessionToken, []);
          }
          pendingICECandidatesRef.current
            .get(effectiveSessionToken)
            ?.push(data.candidate);

          // Try to auto-join the stream if we have it in activeStreams
          const stream = activeStreamsRef.current.find(
            (s) => s.sessionToken === effectiveSessionToken,
          );
          if (
            stream &&
            !peerConnectionsRef.current.has(effectiveSessionToken)
          ) {
            joinStream(stream);
          }
        }
      },
    );

    socketRef.current.on("proctoring-event", (event: ProctoringEvent) => {
      setEvents((prev) => [event, ...prev.slice(0, 49)]); // Keep last 50 events
    });

    // Listen for exam status changes from students
    socketRef.current.on(
      "exam-status-changed",
      (data: {
        sessionToken: string;
        status: "active" | "paused" | "ended" | "warning";
      }) => {
        setActiveStreams((prev) =>
          prev.map((s) =>
            s.sessionToken === data.sessionToken
              ? { ...s, examStatus: data.status }
              : s,
          ),
        );
        // Also update selectedStreamForModal if it's the same session
        setSelectedStreamForModal((prev) =>
          prev?.sessionToken === data.sessionToken
            ? { ...prev, examStatus: data.status }
            : prev,
        );
      },
    );

    // Listen for camera screenshots from students
    socketRef.current.on(
      "student-camera-screenshot",
      async (data: {
        sessionToken: string;
        screenshot: string;
        timestamp: string;
      }) => {
        console.log("Received student camera screenshot:", data);

        // Save screenshot to database
        try {
          await ProctoringApiService.logEvent({
            session_token: data.sessionToken,
            event_type: "instructor_screenshot",
            severity: "low",
            description: "Camera screenshot captured by instructor",
            screenshot_url: data.screenshot,
          });
          console.log("Camera screenshot saved to database");
        } catch (error) {
          console.error("Failed to save camera screenshot to database:", error);
        }

        setActiveStreams((prev) =>
          prev.map((s) =>
            s.sessionToken === data.sessionToken
              ? {
                  ...s,
                  screenshots: [
                    ...(s.screenshots || []).slice(-19), // Keep last 20 screenshots
                    {
                      type: "camera",
                      image: data.screenshot,
                      timestamp: data.timestamp,
                    },
                  ],
                }
              : s,
          ),
        );
        // Also update selectedStreamForModal
        setSelectedStreamForModal((prev) =>
          prev?.sessionToken === data.sessionToken
            ? {
                ...prev,
                screenshots: [
                  ...(prev.screenshots || []).slice(-19),
                  {
                    type: "camera",
                    image: data.screenshot,
                    timestamp: data.timestamp,
                  },
                ],
              }
            : prev,
        );
      },
    );

    // Listen for interface screenshots from students
    socketRef.current.on(
      "student-interface-screenshot",
      async (data: {
        sessionToken: string;
        screenshot: string;
        timestamp: string;
      }) => {
        console.log("Received student interface screenshot:", data);

        // Save screenshot to database
        try {
          await ProctoringApiService.logEvent({
            session_token: data.sessionToken,
            event_type: "instructor_interface_screenshot",
            severity: "low",
            description: "Interface screenshot captured by instructor",
            screenshot_url: data.screenshot,
          });
          console.log("Interface screenshot saved to database");
        } catch (error) {
          console.error(
            "Failed to save interface screenshot to database:",
            error,
          );
        }

        setActiveStreams((prev) =>
          prev.map((s) =>
            s.sessionToken === data.sessionToken
              ? {
                  ...s,
                  screenshots: [
                    ...(s.screenshots || []).slice(-19),
                    {
                      type: "interface",
                      image: data.screenshot,
                      timestamp: data.timestamp,
                    },
                  ],
                }
              : s,
          ),
        );
        // Also update selectedStreamForModal
        setSelectedStreamForModal((prev) =>
          prev?.sessionToken === data.sessionToken
            ? {
                ...prev,
                screenshots: [
                  ...(prev.screenshots || []).slice(-19),
                  {
                    type: "interface",
                    image: data.screenshot,
                    timestamp: data.timestamp,
                  },
                ],
              }
            : prev,
        );
      },
    );

    // Listen for student ready signal globally (moved from joinStream)
    socketRef.current.on("student-webrtc-ready", async (data: any) => {
      const { sessionToken } = data;

      // Check if we have a peer connection for this session
      const peerConnection = peerConnectionsRef.current.get(sessionToken);
      if (peerConnection) {
        // Clear the fallback timeout since student is ready
        const pcAny = peerConnection as any;
        if (pcAny.offerTimeout) {
          clearTimeout(pcAny.offerTimeout);
        }

        const isStale =
          peerConnection.signalingState === "closed" ||
          peerConnection.connectionState === "closed" ||
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected";

        if (isStale) {
          // Student reconnected with a new peer connection — close the stale one
          // and kick off a fresh joinStream so all handlers are re-registered
          peerConnection.close();
          peerConnectionsRef.current.delete(sessionToken);
          joiningStreamsRef.current.delete(sessionToken);
          offerInProgressRef.current.delete(sessionToken);

          const stream = activeStreamsRef.current.find(
            (s) => s.sessionToken === sessionToken,
          );
          if (stream) joinStream(stream);
          return;
        }

        // Only create offer if no offer has been sent yet (initial stable state, no localDescription)
        // If localDescription is already set, an offer was already sent — skip to avoid duplicate offers
        if (
          peerConnection.signalingState !== "stable" ||
          peerConnection.localDescription !== null ||
          offerInProgressRef.current.has(sessionToken)
        ) {
          return;
        }

        offerInProgressRef.current.add(sessionToken);
        try {
          const offer = await peerConnection.createOffer();
          // Re-check after async gap — another path may have sent an offer while we awaited
          if (peerConnection.localDescription !== null) return;
          await peerConnection.setLocalDescription(offer);

          if (socketRef.current?.connected) {
            socketRef.current.emit("webrtc-offer", {
              offer,
              sessionToken,
            });
          }
        } catch (error) {
          console.error(
            "🚨 Failed to create/send offer for",
            sessionToken + ":",
            error,
          );
        } finally {
          offerInProgressRef.current.delete(sessionToken);
        }
      } else {
      }
    });
  };

  const loadActiveStreams = async () => {
    let streams: LiveStream[] = [];
    try {
      setIsLoading(true);
      const data = await ProctoringApiService.getActiveStreams();
      streams = data.data;

      // Merge with existing streams, preserving connection state
      setActiveStreams((prevStreams) =>
        streams.map((newStream: LiveStream) => {
          const existingStream = prevStreams.find(
            (s) => s.sessionToken === newStream.sessionToken,
          );
          return existingStream
            ? { ...newStream, ...existingStream }
            : newStream;
        }),
      );

      // Request current live status from socket server
      if (socketRef.current?.connected) {
        socketRef.current.emit("get-active-streams");
      }

      setError(null);
    } catch (error) {
      console.error("Error loading active streams:", error);
      setError("Failed to load active streams");
    } finally {
      // Unblock the UI immediately — screenshots load in the background
      setIsLoading(false);
    }

    // Load screenshots for all streams in parallel (non-blocking)
    if (streams.length > 0) {
      await Promise.all(
        streams.map(async (stream: LiveStream) => {
          try {
            const screenshotsData = await ProctoringApiService.getSessionEvents(
              stream.sessionToken,
            );
            if (screenshotsData.success && screenshotsData.data.length > 0) {
              setActiveStreams((prev) =>
                prev.map((s) =>
                  s.sessionToken === stream.sessionToken
                    ? {
                        ...s,
                        screenshots: [
                          ...(s.screenshots || []),
                          ...screenshotsData.data,
                        ].slice(-20),
                      }
                    : s,
                ),
              );
            }
          } catch (screenshotError) {
            console.error(
              `Failed to load screenshots for session ${stream.sessionToken}:`,
              screenshotError,
            );
          }
        }),
      );
    }
  };

  // Handle real-time stream updates
  const handleStreamStarted = (streamData: any) => {
    setActiveStreams((prev) => {
      const existing = prev.find(
        (s) => s.sessionToken === streamData.sessionToken,
      );
      if (existing) {
        return prev.map((s) =>
          s.sessionToken === streamData.sessionToken
            ? {
                ...s,
                ...streamData,
                isLive: streamData.isLive !== false,
              }
            : s,
        );
      } else {
        return [...prev, { ...streamData, isLive: true }];
      }
    });
  };

  const handleStreamEnded = (data: { sessionToken: string }) => {
    setActiveStreams((prev) =>
      prev.map((s) =>
        s.sessionToken === data.sessionToken ? { ...s, isLive: false } : s,
      ),
    );
  };

  const handleActiveStreamsUpdate = (streams: any[]) => {
    // If the server returns empty array, show a warning and DON'T clear local streams!
    // The server is currently sending [] for active streams because they aren't fully synced in DB/memory.
    if (!streams || streams.length === 0) {
      console.warn(
        "⚠️ WARNING: Server returned empty active streams! Showing warning to user.",
      );
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "warning" as const,
          message:
            "⚠️ No active proctoring sessions found on server. Students may not have started proctoring yet.",
          timestamp: new Date(),
        },
      ]);
      // Don't return - we want to preserve local state
      // But we also want to show the warning to the user
    }

    // Update existing streams to mark them as live if they're in the socket server's active list
    // Also add new streams that don't exist in local state yet
    setActiveStreams((prev) => {
      const updatedStreams = prev.map((existingStream) => {
        const socketStream = streams.find(
          (s) => s.sessionToken === existingStream.sessionToken,
        );
        return socketStream
          ? {
              ...existingStream,
              isLive: socketStream.isLive !== false,
              ...socketStream,
            }
          : existingStream;
      });

      // Add new streams from server that don't exist in local state
      const existingTokens = new Set(prev.map((s) => s.sessionToken));
      const newStreams = streams
        .filter((s) => !existingTokens.has(s.sessionToken))
        .map((s) => ({ ...s, isLive: s.isLive !== false }));

      return [...updatedStreams, ...newStreams];
    });
  };

  const handleStreamPaused = (data: {
    sessionToken: string;
    reason: string;
    disconnectedAt: string;
  }) => {
    setActiveStreams((prev) =>
      prev.map((s) =>
        s.sessionToken === data.sessionToken
          ? { ...s, isLive: false, disconnectedAt: data.disconnectedAt }
          : s,
      ),
    );
  };

  const handleStreamResumed = (data: {
    sessionToken: string;
    resumedAt: string;
    wasDisconnected: boolean;
  }) => {
    setActiveStreams((prev) =>
      prev.map((s) =>
        s.sessionToken === data.sessionToken
          ? {
              ...s,
              isLive: true,
              disconnectedAt: undefined,
              lastReconnection: data.resumedAt,
            }
          : s,
      ),
    );
  };

  const getFilteredStreams = () => {
    let filtered = activeStreams;

    // Filter by quiz
    if (selectedQuiz !== null) {
      filtered = filtered.filter((stream) => stream.quiz.id === selectedQuiz);
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "online") {
        filtered = filtered.filter((stream) => stream.isLive);
      } else if (statusFilter === "offline") {
        filtered = filtered.filter((stream) => !stream.isLive);
      } else if (statusFilter === "flagged") {
        filtered = filtered.filter((stream) => stream.flagsCount > 0);
      }
    }

    // Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (stream) =>
          stream.student.first_name.toLowerCase().includes(query) ||
          stream.student.last_name.toLowerCase().includes(query) ||
          stream.student.email.toLowerCase().includes(query) ||
          stream.quiz.title.toLowerCase().includes(query),
      );
    }

    return filtered;
  };

  // Helper function to add status messages
  const addStatusMessage = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info",
  ) => {
    const id = Date.now();
    setStatusMessages((prev) =>
      [...prev, { id, message, type, timestamp: new Date() }].slice(-10),
    );
  };

  const fetchIceServers = async (): Promise<RTCIceServer[]> => {
    const fallback: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
    try {
      const socketUrl =
        import.meta.env.VITE_SOCKET_URL || "http://localhost:5003";
      const res = await fetch(`${socketUrl}/turn-credentials`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      return (data.iceServers as RTCIceServer[]) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const joinStream = async (stream: LiveStream) => {
    // Prevent concurrent join attempts for the same stream
    if (joiningStreamsRef.current.has(stream.sessionToken)) {
      return;
    }

    joiningStreamsRef.current.add(stream.sessionToken);

    try {
      setSelectedStream(stream);

      // Check if we already have a peer connection for this stream
      const existingConnection = peerConnectionsRef.current.get(
        stream.sessionToken,
      );
      if (existingConnection) {
        // Check if the connection is still valid
        if (
          existingConnection.signalingState !== "closed" &&
          existingConnection.connectionState !== "closed"
        ) {
          return;
        } else {
          // Clean up the closed connection

          existingConnection.close();
          peerConnectionsRef.current.delete(stream.sessionToken);
        }
      }

      // Check if socket is connected before proceeding
      if (!socketRef.current?.connected) {
        console.error("Socket not connected, cannot join stream");
        setError("Socket connection lost. Please refresh the page.");
        return;
      }

      // Join the stream via API
      const joinResult = await ProctoringApiService.joinLiveStream(
        stream.sessionToken,
        socketRef.current?.id || "",
      );

      // Initialize WebRTC peer connection with STUN + TURN for cross-network support
      const iceServers = await fetchIceServers();
      const peerConnection = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });

      peerConnectionsRef.current.set(stream.sessionToken, peerConnection);

      // Process any queued ICE candidates for this session
      const queuedCandidates = pendingICECandidatesRef.current.get(
        stream.sessionToken,
      );
      if (queuedCandidates && queuedCandidates.length > 0) {
        for (const candidate of queuedCandidates) {
          handleICECandidate(candidate, stream.sessionToken);
        }
        pendingICECandidatesRef.current.delete(stream.sessionToken);
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        // Ignore ended tracks — can arrive from a previous dropped connection
        if (event.track.readyState === "ended") return;

        let remoteStream = event.streams[0];
        if (!remoteStream) {
          remoteStream = new MediaStream([event.track]);
        }

        // When a track ends, clear the stale stream so the placeholder shows
        event.track.onended = () => {
          setActiveStreams((prev) =>
            prev.map((s) =>
              s.sessionToken === stream.sessionToken
                ? { ...s, stream: undefined }
                : s,
            ),
          );
        };

        // Update the stream in activeStreams
        setActiveStreams((prev) =>
          prev.map((s) => {
            if (s.sessionToken === stream.sessionToken) {
              const existingStream = s.stream;
              if (!event.streams[0] && existingStream) {
                // If browser didn't group tracks, manually group them
                existingStream.addTrack(event.track);
                remoteStream = existingStream;
              }
              return { ...s, stream: remoteStream };
            }
            return s;
          }),
        );

        // Also update the modal stream if this is the selected stream
        if (selectedStreamForModal?.sessionToken === stream.sessionToken) {
          setSelectedStreamForModal((prev) =>
            prev ? { ...prev, stream: remoteStream } : null,
          );
        }

        // Assign srcObject directly — the useEffect watching activeStreams will call play()
        const videoEl = videoRefs.current.get(stream.sessionToken);
        if (videoEl && videoEl.srcObject !== remoteStream) {
          videoEl.srcObject = remoteStream;
        }
      };

      // Add connection state handlers
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          addStatusMessage(
            `Connected to ${stream.student.first_name} ${stream.student.last_name}'s stream`,
            "success",
          );
        } else if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "closed"
        ) {
          addStatusMessage(
            `Connection lost to ${stream.student.first_name} ${stream.student.last_name}`,
            "error",
          );
          // Remove stale entry so student-webrtc-ready can trigger a fresh joinStream
          peerConnectionsRef.current.delete(stream.sessionToken);
          joiningStreamsRef.current.delete(stream.sessionToken);
          offerInProgressRef.current.delete(stream.sessionToken);
        }
      };

      // Add ICE state handlers
      peerConnection.oniceconnectionstatechange = () => {
        // Add status message for ICE state
        if (peerConnection.iceConnectionState === "checking") {
          addStatusMessage(
            `Connecting to ${stream.student.first_name} ${stream.student.last_name}...`,
            "info",
          );
        } else if (
          peerConnection.iceConnectionState === "connected" ||
          peerConnection.iceConnectionState === "completed"
        ) {
          addStatusMessage(
            `WebRTC connected to ${stream.student.first_name} ${stream.student.last_name}`,
            "success",
          );
        } else if (peerConnection.iceConnectionState === "failed") {
          // Trigger ICE restart before falling back to full reconnect
          peerConnection.restartIce();
          addStatusMessage(
            `Reconnecting to ${stream.student.first_name} ${stream.student.last_name}...`,
            "warning",
          );
        } else if (peerConnection.iceConnectionState === "disconnected") {
          addStatusMessage(
            `${stream.student.first_name} ${stream.student.last_name} temporarily disconnected`,
            "warning",
          );
        }
      };

      // Handle signaling state changes
      // peerConnection.onsignalingstatechange = () => {};

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          socketRef.current.emit("webrtc-ice-candidate", {
            sessionToken: stream.sessionToken,
            candidate: event.candidate,
          });
        } else if (!event.candidate) {
        }
      };

      // Join the proctoring session room FIRST
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-proctoring-session", {
          sessionToken: stream.sessionToken,
          role: "dashboard",
        });
      } else {
        // Socket not ready yet — clean up the peer connection we just created
        // and let the socket reconnect flow re-trigger joinStream automatically
        peerConnection.close();
        peerConnectionsRef.current.delete(stream.sessionToken);
        return;
      }

      // Add transceivers for receiving video and audio from student
      // Setting directions before offering explicitly creates the m-lines in the SDP
      peerConnection.addTransceiver("video", { direction: "recvonly" });
      peerConnection.addTransceiver("audio", { direction: "recvonly" });

      // Add transceiver for sending audio to student
      peerConnection.addTransceiver("audio", { direction: "sendonly" });

      // Allow microtask queue to process transceivers
      await new Promise((resolve) => setTimeout(resolve, 500));

      // WAIT for student-webrtc-ready signal before sending offer
      // This ensures the student is in the room and ready to receive the offer
      // The student-webrtc-ready handler will create and send the offer

      // Set a timeout as fallback - if no ready signal after 5 seconds, send offer anyway
      const offerTimeout = setTimeout(async () => {
        const pc = peerConnectionsRef.current.get(stream.sessionToken);
        // Skip if offer was already sent, negotiation done, or another path is creating an offer
        if (
          !pc ||
          pc.localDescription !== null ||
          offerInProgressRef.current.has(stream.sessionToken)
        ) {
          return;
        }

        offerInProgressRef.current.add(stream.sessionToken);
        try {
          const offer = await pc.createOffer();
          // Re-check after async gap
          if (pc.localDescription !== null) return;
          await pc.setLocalDescription(offer);
          if (socketRef.current?.connected) {
            socketRef.current.emit("webrtc-offer", {
              offer,
              sessionToken: stream.sessionToken,
            });
          }
        } catch (error) {
          console.error(
            `📡 Failed to send fallback offer for ${stream.sessionToken}:`,
            error,
          );
        } finally {
          offerInProgressRef.current.delete(stream.sessionToken);
        }
      }, 5000); // Wait 5 seconds for student to be ready

      // Store timeout ID so we can cancel it when student-webrtc-ready is received
      (peerConnection as any).offerTimeout = offerTimeout;

      // Offer will be created by student-webrtc-ready handler or the fallback timeout above
    } catch (error) {
      console.error("Error joining stream:", error);
      setError("Failed to join stream. Please try again.");
    } finally {
      // Always remove the flag when done
      joiningStreamsRef.current.delete(stream.sessionToken);
    }
  };

  const handleWebRTCAnswerDashboard = async (
    answer: any,
    sessionToken: string,
  ) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(sessionToken);
      if (peerConnection) {
        // Only accept answer when we have a local offer (not when already stable)
        // This prevents "Called in wrong state: stable" errors
        if (peerConnection.signalingState === "have-local-offer") {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer),
          );

          // Process queued ICE candidates
          const pcAny = peerConnection as any;
          if (pcAny.pendingCandidates && pcAny.pendingCandidates.length > 0) {
            for (const queuedCandidate of pcAny.pendingCandidates) {
              await peerConnection
                .addIceCandidate(new RTCIceCandidate(queuedCandidate))
                .catch((e) =>
                  console.error("Failed to add queued candidate:", e),
                );
            }
            pcAny.pendingCandidates = [];
          }
        } else {
          // Signaling state is already stable, answer may be duplicate - ignore
        }
      } else {
        console.error(`No peer connection found for session ${sessionToken}`);
      }
    } catch (error) {
      console.error("Error handling WebRTC answer:", error);
    }
  };

  const handleICECandidate = async (candidate: any, sessionToken: string) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(sessionToken);
      if (peerConnection) {
        if (peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Queue the candidate if remote description is not yet set
          const pcAny = peerConnection as any;
          pcAny.pendingCandidates = pcAny.pendingCandidates || [];
          pcAny.pendingCandidates.push(candidate);
        }
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-600 bg-red-50";
    if (score >= 60) return "text-orange-600 bg-orange-50";
    if (score >= 30) return "text-yellow-600 bg-yellow-50";
    return "text-green-600 bg-green-50";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  const reconnectWebRTC = async () => {
    setIsReconnecting(true);
    try {
      // Close all existing peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      joiningStreamsRef.current.clear();
      offerInProgressRef.current.clear();

      // Disconnect and re-initialize socket so all listeners and session state reset
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocketConnected(false);

      // Reload streams from API so we get the latest session list
      await loadActiveStreams();

      // Re-initialize socket — this re-registers all event listeners and
      // triggers the student-webrtc-ready / stream-started flow automatically
      initializeSocket();
    } catch (error) {
      console.error("Error reconnecting:", error);
      setError("Failed to reconnect. Please try again.");
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleToggleMic = async (sessionToken: string, enabled: boolean) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(sessionToken);
      if (!peerConnection) {
        console.error("No peer connection found for session:", sessionToken);
        return;
      }

      if (enabled) {
        // Get microphone access
        const localAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        localAudioStreamsRef.current.set(sessionToken, localAudioStream);

        // Add audio track to peer connection
        const audioTrack = localAudioStream.getAudioTracks()[0];
        const sender = peerConnection.addTrack(audioTrack, localAudioStream);

        // Check signaling state before renegotiation
        if (peerConnection.signalingState !== "stable") {
          return;
        }

        // Trigger renegotiation by creating new offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send the new offer to student for renegotiation
        if (socketRef.current?.connected) {
          const offerData = {
            offer: offer,
            sessionToken: sessionToken,
          };

          socketRef.current.emit("webrtc-offer", offerData);
        }
      } else {
        // Remove microphone
        const localAudioStream = localAudioStreamsRef.current.get(sessionToken);
        if (localAudioStream) {
          localAudioStream.getTracks().forEach((track) => track.stop());
          localAudioStreamsRef.current.delete(sessionToken);
        }

        // Remove track from peer connection
        peerConnection.getSenders().forEach((sender) => {
          if (sender.track && sender.track.kind === "audio") {
            peerConnection.removeTrack(sender);
          }
        });
      }
    } catch (error) {
      console.error("Error toggling microphone:", error);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const handleForceAudioSettings = (
    sessionToken: string,
    volume?: number,
    micGain?: number,
  ) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("force-student-audio", {
        sessionToken: sessionToken,
        volume: volume || 0.5,
        micGain: micGain || 0.6,
      });
    } else {
      console.error("Socket not connected, cannot send force audio command");
      setError("Connection lost. Please refresh the page.");
    }
  };

  const handlePauseExam = (sessionToken: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("pause-student-exam", {
        sessionToken: sessionToken,
      });
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Exam paused for session ${sessionToken}`,
          type: "warning",
          timestamp: new Date(),
        },
      ]);
    } else {
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Failed to pause exam: Socket not connected. Please refresh the page.`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleResumeExam = (sessionToken: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("resume-student-exam", {
        sessionToken: sessionToken,
      });
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Exam resumed for session ${sessionToken}`,
          type: "success",
          timestamp: new Date(),
        },
      ]);
    } else {
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Failed to resume exam: Socket not connected. Please refresh the page.`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSendWarning = async (sessionToken: string, message: string) => {
    // First, log the warning event to the database (message is NOT stored)
    try {
      await ProctoringApiService.logWarningEvent(sessionToken);
    } catch (error) {
      console.error("Failed to log warning event:", error);
      // Continue even if logging fails - the warning will still be sent to the student
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit("send-warning-to-student", {
        sessionToken: sessionToken,
        message: message,
      });
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Warning sent to student: ${message}`,
          type: "warning",
          timestamp: new Date(),
        },
      ]);
    } else {
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Failed to send warning: Socket not connected. Please refresh the page.`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSendNote = async (sessionToken: string, message: string) => {
    // Log the note event to the database
    try {
      await ProctoringApiService.logWarningEvent(sessionToken);
    } catch (error) {
      console.error("Failed to log note event:", error);
      // Continue even if logging fails - the note will still be sent to the student
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit("send-note-to-student", {
        sessionToken: sessionToken,
        message: message,
      });
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Note sent to student: ${message}`,
          type: "info",
          timestamp: new Date(),
        },
      ]);
    } else {
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Failed to send note: Socket not connected. Please refresh the page.`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleRestartQuiz = async (
    sessionToken: string,
    submissionId: number,
  ) => {
    try {
      // Call the API to reset the quiz submission
      await ProctoringApiService.resetQuizSubmission(submissionId);

      if (socketRef.current?.connected) {
        socketRef.current.emit("restart-student-quiz", {
          sessionToken,
        });
        setStatusMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            message: `Quiz restarted for session ${sessionToken}`,
            type: "success",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to restart quiz:", error);
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Failed to restart quiz: ${error}`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  // Request camera screenshot from student
  const handleRequestCameraScreenshot = (sessionToken: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("request-student-camera-screenshot", {
        sessionToken,
      });
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Requested camera screenshot from student`,
          type: "info",
          timestamp: new Date(),
        },
      ]);
    }
  };

  // Request interface screenshot from student
  const handleRequestInterfaceScreenshot = (sessionToken: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("request-student-interface-screenshot", {
        sessionToken,
      });
      setStatusMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: `Requested interface screenshot from student`,
          type: "info",
          timestamp: new Date(),
        },
      ]);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-blue-50 to-blue-50 dark:from-black dark:via-black dark:to-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-white animate-pulse"
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
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 to-blue-500 rounded-2xl opacity-30 animate-ping"></div>
          </div>
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-3">
            Loading Proctoring Dashboard
          </h2>
          <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium mb-4">
            Connecting to live streams...
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    // Intentionally always-dark, regardless of the app's light/dark toggle —
    // a live camera-monitoring wall reads as a proper "surveillance/proctoring"
    // console (and video thumbnails stay legible) rather than another light
    // content page. Same exemption precedent as the code-editor cluster.
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-[#0a0a0a] backdrop-blur-md border-b border-gray-900 px-4 sm:px-6 lg:px-8 py-2.5 sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-full hover:bg-gray-900 transition-colors text-gray-500 hover:text-white shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Video className="w-4 h-4 text-white" />
                <span
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-black ${
                    socketConnected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
                  }`}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Live Proctoring Dashboard
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-gray-500 truncate hidden sm:block">
                    Real-time student monitoring
                  </p>
                  <span
                    className={`hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${
                      socketConnected
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                    {socketConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={reconnectWebRTC}
              disabled={isReconnecting}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-semibold transition-colors rounded-full flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isReconnecting ? "Reconnecting..." : "Reconnect"}</span>
            </button>
            <button
              onClick={loadActiveStreams}
              className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition-colors rounded-full"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 mb-4 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-red-300 text-xs font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Section header + status pills */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="w-7 h-7 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
            <Circle className="w-3.5 h-3.5 text-blue-400 fill-current animate-pulse" />
          </div>
          <h2 className="text-sm font-bold text-white">Live Student Videos</h2>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold rounded-full flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {getFilteredStreams().filter((s) => s.isLive).length} Live
            </div>
            <div className="px-2.5 py-1 bg-gray-900 text-gray-500 text-[11px] font-semibold rounded-full">
              {getFilteredStreams().length} Total
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-gray-600 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search students, emails, or quiz titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-9 py-2 bg-gray-950 border border-gray-900 text-gray-100 placeholder:text-gray-600 text-xs rounded-full focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-600 hover:text-red-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-full border border-gray-900 overflow-x-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all duration-200 whitespace-nowrap ${
                statusFilter === "all"
                  ? "bg-gray-800 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("online")}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === "online"
                  ? "bg-gray-800 text-emerald-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${statusFilter === "online" ? "animate-pulse" : ""}`} />
              Online
            </button>
            <button
              onClick={() => setStatusFilter("offline")}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === "offline"
                  ? "bg-gray-800 text-gray-300 shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              Offline
            </button>
            <button
              onClick={() => setStatusFilter("flagged")}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === "flagged"
                  ? "bg-gray-800 text-red-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Flag className="w-3 h-3" />
              Flagged
            </button>
          </div>
        </div>

        {getFilteredStreams().length === 0 ? (
          <div className="flex items-center justify-center py-20 border border-dashed border-gray-900 rounded-2xl">
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-gray-950 border border-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                <VideoOff className="w-5 h-5 text-gray-700" />
              </div>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">
                No students found for this quiz
              </h3>
              <p className="text-xs text-gray-600 max-w-sm">
                {selectedQuiz
                  ? "No connected students for the selected quiz."
                  : "Students will appear here when they start their quiz sessions"}
              </p>
            </div>
          </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {getFilteredStreams().map((stream, index) => (
                <div
                  key={index + 1}
                  className="group bg-gray-950 rounded-xl hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/50 transition-all duration-200 cursor-pointer overflow-hidden border border-gray-900 hover:border-gray-800"
                  onClick={() => setSelectedStreamForModal(stream)}
                >
                  <div className="aspect-video bg-black relative overflow-hidden">
                    {stream.stream ? (
                      <>
                        <video
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          data-session-token={stream.sessionToken}
                          ref={(el) => {
                            if (el) {
                              videoRefs.current.set(stream.sessionToken, el);
                              if (stream.stream && el.srcObject !== stream.stream) {
                                el.srcObject = stream.stream;
                                // autoPlay handles playback; no explicit play() needed
                              }
                            } else {
                              videoRefs.current.delete(stream.sessionToken);
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black">
                        <div className="text-center">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2 bg-gray-900">
                            {stream.cameraHidden
                              ? <VideoOff className="w-5 h-5 text-gray-600" />
                              : <User className="w-5 h-5 text-gray-600" />
                            }
                          </div>
                          <p className="text-[11px] text-gray-600 font-medium">
                            {stream.cameraHidden ? "Camera hidden" : stream.isLive ? "Connecting..." : "No Stream"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* YouTube-style LIVE indicator */}
                    <div className="absolute top-2 left-2">
                      {stream.isLive && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                      )}
                    </div>

                    {/* Exam Status Indicator */}
                    {stream.examStatus && stream.examStatus !== "active" && (
                      <div className="absolute top-2 left-2">
                        {stream.examStatus === "paused" && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] font-bold rounded">
                            <PauseCircle className="w-2.5 h-2.5" />
                            PAUSED
                          </div>
                        )}
                        {stream.examStatus === "ended" && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded">
                            <Ban className="w-2.5 h-2.5" />
                            ENDED
                          </div>
                        )}
                        {stream.examStatus === "warning" && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            WARNING
                          </div>
                        )}
                      </div>
                    )}

                    {/* Risk score indicator */}
                    {stream.riskScore >= 60 && (
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {stream.riskScore}
                        </div>
                      </div>
                    )}

                    {/* Camera hidden indicator */}
                    {stream.cameraHidden && (
                      <div className="absolute bottom-2 left-2">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900/90 text-white text-[10px] font-medium rounded backdrop-blur-sm">
                          <VideoOff className="w-2.5 h-2.5" />
                          Camera hidden
                        </div>
                      </div>
                    )}

                    {/* Flags indicator */}
                    {stream.flagsCount > 0 && (
                      <div className="absolute bottom-2 right-2">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600/90 text-white text-[10px] font-medium rounded backdrop-blur-sm">
                          <Flag className="w-2.5 h-2.5" />
                          {stream.flagsCount}
                        </div>
                      </div>
                    )}

                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                      <div className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                        <Play className="w-4 h-4 text-white ml-0.5 fill-current" />
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5">
                    <h3 className="text-xs font-bold text-gray-100 line-clamp-2 mb-1.5 group-hover:text-blue-400 transition-colors">
                      {stream.student.first_name} {stream.student.last_name}
                    </h3>
                    {/* Exam Status Badge */}
                    {stream.examStatus && stream.examStatus !== "active" && (
                      <div
                        className={`mb-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          stream.examStatus === "paused"
                            ? "bg-yellow-500/15 text-yellow-400"
                            : stream.examStatus === "ended"
                              ? "bg-red-500/15 text-red-400"
                              : stream.examStatus === "warning"
                                ? "bg-orange-500/15 text-orange-400"
                                : "bg-gray-800 text-gray-300"
                        }`}
                      >
                        {stream.examStatus === "paused" && (<><PauseCircle className="w-2.5 h-2.5" /> Paused</>)}
                        {stream.examStatus === "ended" && (<><Ban className="w-2.5 h-2.5" /> Ended</>)}
                        {stream.examStatus === "warning" && (<><AlertTriangle className="w-2.5 h-2.5" /> Warning</>)}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-600 line-clamp-1 mb-2">
                      {stream.quiz.title}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            stream.isLive
                              ? "bg-emerald-400 animate-pulse"
                              : "bg-gray-700"
                          }`}
                        ></div>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {stream.isLive ? "Live" : "Offline"}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-600">
                        {new Date(stream.startTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      <StreamModal
        stream={selectedStreamForModal}
        onClose={() => setSelectedStreamForModal(null)}
        onJoinStream={joinStream}
        onToggleMic={handleToggleMic}
        onForceAudioSettings={handleForceAudioSettings}
        onPauseExam={handlePauseExam}
        onResumeExam={handleResumeExam}
        onSendWarning={handleSendWarning}
        onSendNote={handleSendNote}
        onRestartQuiz={handleRestartQuiz}
        onRequestCameraScreenshot={handleRequestCameraScreenshot}
        onRequestInterfaceScreenshot={handleRequestInterfaceScreenshot}
      />
    </div>
  );
};

export default LiveProctoringDashboard;
