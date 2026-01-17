import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import StreamModal from "./StreamModal";
import { ProctoringApiService } from "../../services/proctoringApi";
import { User, AlertTriangle, Flag, Circle, RefreshCw } from "lucide-react";

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
  const [selectedQuiz, _setSelectedQuiz] = useState<number | null>(
    quizId ? Number(quizId) : null
  );
  const [activeStreams, setActiveStreams] = useState<LiveStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null);
  const [selectedStreamForModal, setSelectedStreamForModal] =
    useState<LiveStream | null>(null);
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [_availableQuizzes, setAvailableQuizzes] = useState<
    { id: number; title: string }[]
  >([]);

  const socketRef = useRef<Socket | null>(null);
  // const _videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localAudioStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const joiningStreamsRef = useRef<Set<string>>(new Set()); // Track streams currently being joined

  useEffect(() => {
    loadActiveStreams();
    initializeSocket();

    return () => {
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
    };
  }, []);

  // Establish WebRTC connections when socket connects or streams are loaded
  useEffect(() => {
    if (socketConnected && activeStreams.length > 0) {
      console.log(
        "Socket connected/streams loaded, attempting to establish WebRTC connections"
      );
      // Small delay to ensure socket is fully ready
      const connectTimeout = setTimeout(() => {
        activeStreams.forEach((stream) => {
          if (
            stream.isLive &&
            !peerConnectionsRef.current.has(stream.sessionToken)
          ) {
            console.log(`Establishing connection for ${stream.sessionToken}`);
            joinStream(stream);
          }
        });
      }, 1000); // Reduced delay for faster connection

      return () => clearTimeout(connectTimeout);
    }
  }, [socketConnected, activeStreams]);

  // Auto-join all active streams
  useEffect(() => {
    console.log("Active streams changed:", activeStreams.length);
    activeStreams.forEach((stream) => {
      console.log(
        `Stream ${stream.sessionToken}: isLive=${
          stream.isLive
        }, hasConnection=${peerConnectionsRef.current.has(stream.sessionToken)}`
      );
      if (
        stream.isLive &&
        !peerConnectionsRef.current.has(stream.sessionToken) &&
        socketConnected
      ) {
        console.log(
          `Attempting to join stream for ${stream.student.first_name} ${stream.student.last_name}`
        );
        // Auto-join live streams
        joinStream(stream);
      }
    });
  }, [activeStreams, socketConnected]);

  // Auto-click on first available stream to start video
  useEffect(() => {
    const liveStreams = getFilteredStreams().filter((stream) => stream.isLive);
    if (liveStreams.length > 0 && !selectedStream && socketConnected) {
      console.log(
        "Auto-joining first live stream:",
        liveStreams[0].student.first_name
      );
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
      console.log(
        "Auto-joining stream for modal:",
        selectedStreamForModal.sessionToken
      );
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
        activeStreams.map((stream) => [stream.quiz.id, stream.quiz])
      ).values()
    );
    setAvailableQuizzes(quizzes);
  }, [activeStreams]);

  const initializeSocket = () => {
    socketRef.current = io("http://localhost:5002", {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log(
        "Dashboard Socket.IO connected with ID:",
        socketRef.current?.id
      );
      setSocketConnected(true);

      // Request current active streams when connected
      socketRef.current?.emit("get-active-streams");
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Dashboard Socket.IO connection error:", error);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("Dashboard Socket.IO disconnected:", reason);
      setSocketConnected(false);
    });

    // Listen for real-time stream events
    socketRef.current.on("stream-started", handleStreamStarted);
    socketRef.current.on("stream-ended", handleStreamEnded);
    socketRef.current.on("stream-paused", handleStreamPaused);
    socketRef.current.on("stream-resumed", handleStreamResumed);
    socketRef.current.on("active-streams", handleActiveStreamsUpdate);

    socketRef.current.on(
      "webrtc-offer",
      async (data: { offer: any; from: string; sessionToken: string }) => {
        console.log("Dashboard received WebRTC offer:", data);
        // Dashboard should NOT receive offers - it sends them!
        console.error(
          "DASHBOARD RECEIVED OFFER - THIS SHOULD NOT HAPPEN!",
          data
        );
      }
    );

    socketRef.current.on(
      "webrtc-answer",
      (data: { answer: any; sessionToken: string; from: string }) => {
        console.log("Dashboard received WebRTC answer:", data);
        console.log(
          "Dashboard handling WebRTC answer for session:",
          data.sessionToken
        );
        handleWebRTCAnswerDashboard(data.answer, data.sessionToken);
      }
    );

    socketRef.current.on(
      "webrtc-ice-candidate",
      (data: { candidate: any; sessionToken: string; from: string }) => {
        console.log("Dashboard received WebRTC ICE candidate:", data);
        // Handle ICE candidates from students
        if (peerConnectionsRef.current.has(data.sessionToken)) {
          console.log(
            "Dashboard handling ICE candidate for session:",
            data.sessionToken
          );
          handleICECandidate(data.candidate, data.sessionToken);
        } else {
          console.log(
            "Dashboard ignoring ICE candidate - no peer connection for session:",
            data.sessionToken
          );
        }
      }
    );

    socketRef.current.on("proctoring-event", (event: ProctoringEvent) => {
      setEvents((prev) => [event, ...prev.slice(0, 49)]); // Keep last 50 events
    });

    // Listen for student ready signal globally (moved from joinStream)
    socketRef.current.on("student-webrtc-ready", async (data: any) => {
      console.log("Dashboard received student WebRTC ready signal:", data);
      const { sessionToken } = data;

      // Check if we have a peer connection for this session
      const peerConnection = peerConnectionsRef.current.get(sessionToken);
      if (peerConnection) {
        console.log(
          `Student signaled ready for ${sessionToken}, creating offer`
        );

        // Check if peer connection is still valid before creating offer
        if (
          peerConnection.signalingState === "closed" ||
          peerConnection.connectionState === "closed"
        ) {
          console.error(
            `Peer connection for ${sessionToken} is closed, cannot create offer`
          );
          peerConnectionsRef.current.delete(sessionToken);
          return;
        }

        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          if (socketRef.current?.connected) {
            socketRef.current.emit("webrtc-offer", {
              offer: offer,
              sessionToken: sessionToken,
            });
            console.log(`Dashboard sent offer for ${sessionToken}`);
          }
        } catch (error) {
          console.error(
            `Failed to create/send offer for ${sessionToken}:`,
            error
          );
        }
      } else {
        console.log(
          `No peer connection found for session ${sessionToken} when student signaled ready`
        );
      }
    });
  };

  const loadActiveStreams = async () => {
    try {
      console.log("Loading active streams...");
      setIsLoading(true);
      const data = await ProctoringApiService.getActiveStreams();
      console.log("Active streams response:", data);

      // Don't clear existing streams and peer connections on refresh
      // Instead, merge with existing data to preserve connections
      setActiveStreams((prevStreams) => {
        const newStreams = data.data;
        // Merge new data with existing streams, preserving connection state
        return newStreams.map((newStream: LiveStream) => {
          const existingStream = prevStreams.find(
            (s) => s.sessionToken === newStream.sessionToken
          );
          return existingStream
            ? { ...newStream, ...existingStream }
            : newStream;
        });
      });

      // Request current live status from socket server to update online/offline state
      if (socketRef.current?.connected) {
        console.log("Requesting live streams status from socket server...");
        socketRef.current.emit("get-active-streams");
      } else {
        console.log("Socket not connected, cannot request live streams status");
      }

      setError(null); // Clear any previous errors
    } catch (error) {
      console.error("Error loading active streams:", error);
      setError("Failed to load active streams");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle real-time stream updates
  const handleStreamStarted = (streamData: any) => {
    console.log("Stream started:", streamData);
    setActiveStreams((prev) => {
      const existing = prev.find(
        (s) => s.sessionToken === streamData.sessionToken
      );
      if (existing) {
        return prev.map((s) =>
          s.sessionToken === streamData.sessionToken
            ? { ...s, ...streamData, isLive: true }
            : s
        );
      } else {
        return [...prev, { ...streamData, isLive: true }];
      }
    });
  };

  const handleStreamEnded = (data: { sessionToken: string }) => {
    console.log("Stream ended:", data.sessionToken);
    setActiveStreams((prev) =>
      prev.map((s) =>
        s.sessionToken === data.sessionToken ? { ...s, isLive: false } : s
      )
    );
  };

  const handleActiveStreamsUpdate = (streams: any[]) => {
    console.log("Active streams update:", streams);
    // Update existing streams to mark them as live if they're in the socket server's active list
    setActiveStreams((prev) =>
      prev.map((existingStream) => {
        const socketStream = streams.find(
          (s) => s.sessionToken === existingStream.sessionToken
        );
        return socketStream
          ? { ...existingStream, isLive: true, ...socketStream }
          : existingStream;
      })
    );
  };

  const handleStreamPaused = (data: {
    sessionToken: string;
    reason: string;
    disconnectedAt: string;
  }) => {
    console.log("Stream paused:", data);
    setActiveStreams((prev) =>
      prev.map((s) =>
        s.sessionToken === data.sessionToken
          ? { ...s, isLive: false, disconnectedAt: data.disconnectedAt }
          : s
      )
    );
  };

  const handleStreamResumed = (data: {
    sessionToken: string;
    resumedAt: string;
    wasDisconnected: boolean;
  }) => {
    console.log("Stream resumed:", data);
    setActiveStreams((prev) =>
      prev.map((s) =>
        s.sessionToken === data.sessionToken
          ? {
              ...s,
              isLive: true,
              disconnectedAt: undefined,
              lastReconnection: data.resumedAt,
            }
          : s
      )
    );
  };

  const getFilteredStreams = () => {
    if (selectedQuiz === null) {
      return activeStreams;
    }
    return activeStreams.filter((stream) => stream.quiz.id === selectedQuiz);
  };

  const joinStream = async (stream: LiveStream) => {
    // Prevent concurrent join attempts for the same stream
    if (joiningStreamsRef.current.has(stream.sessionToken)) {
      console.log(
        `Already joining stream for ${stream.sessionToken}, skipping`
      );
      return;
    }

    joiningStreamsRef.current.add(stream.sessionToken);

    try {
      console.log(
        `Joining stream for ${stream.student.first_name} ${stream.student.last_name} (${stream.sessionToken})`
      );
      setSelectedStream(stream);

      // Check if we already have a peer connection for this stream
      const existingConnection = peerConnectionsRef.current.get(
        stream.sessionToken
      );
      if (existingConnection) {
        // Check if the connection is still valid
        if (
          existingConnection.signalingState !== "closed" &&
          existingConnection.connectionState !== "closed"
        ) {
          console.log(
            `Already have active peer connection for ${stream.sessionToken}`
          );
          return;
        } else {
          // Clean up the closed connection
          console.log(
            `Cleaning up closed peer connection for ${stream.sessionToken}`
          );
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
        socketRef.current?.id || ""
      );
      console.log("Join stream API result:", joinResult);

      // Initialize WebRTC peer connection for receiving stream
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      peerConnectionsRef.current.set(stream.sessionToken, peerConnection);
      console.log(`Created peer connection for ${stream.sessionToken}`);

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log(
          `Received remote stream for ${stream.sessionToken}`,
          event.streams[0]
        );
        if (event.streams[0]) {
          console.log(`Dashboard stream tracks:`, event.streams[0].getTracks());
          // Update the stream in activeStreams
          setActiveStreams((prev) =>
            prev.map((s) =>
              s.sessionToken === stream.sessionToken
                ? { ...s, stream: event.streams[0] }
                : s
            )
          );

          // Also update the modal stream if this is the selected stream
          if (selectedStreamForModal?.sessionToken === stream.sessionToken) {
            setSelectedStreamForModal((prev) =>
              prev ? { ...prev, stream: event.streams[0] || undefined } : null
            );
          }

          // Force video element update
          setTimeout(() => {
            const videoElements = document.querySelectorAll(
              `[data-session-token="${stream.sessionToken}"]`
            );
            videoElements.forEach((videoEl) => {
              const video = videoEl as HTMLVideoElement;
              if (video && video.srcObject !== event.streams[0]) {
                console.log(
                  `Force updating video element for ${stream.sessionToken}`
                );
                video.srcObject = event.streams[0];
              }
            });
          }, 100);
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(
          `Peer connection state for ${stream.sessionToken}:`,
          peerConnection.connectionState
        );
      };

      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log(
          `ICE connection state for ${stream.sessionToken}:`,
          peerConnection.iceConnectionState
        );
      };

      // Handle signaling state changes
      peerConnection.onsignalingstatechange = () => {
        console.log(
          `Signaling state for ${stream.sessionToken}:`,
          peerConnection.signalingState
        );
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          console.log(
            `Dashboard sending ICE candidate for ${stream.sessionToken}:`,
            event.candidate
          );
          socketRef.current.emit("webrtc-ice-candidate", {
            sessionToken: stream.sessionToken,
            candidate: event.candidate,
          });
        } else if (!event.candidate) {
          console.log(
            `Dashboard ICE gathering complete for ${stream.sessionToken}`
          );
        }
      };

      // Join the proctoring session room FIRST
      if (socketRef.current?.connected) {
        socketRef.current.emit("join-proctoring-session", {
          sessionToken: stream.sessionToken,
          role: "dashboard",
        });
        console.log(
          `Joined proctoring session room: ${stream.sessionToken} as dashboard`
        );
      } else {
        console.error("Socket not connected when trying to join room");
        setError("Lost connection to server. Please refresh the page.");
        return;
      }

      // Add transceivers for receiving video and audio from student
      peerConnection.addTransceiver("video", { direction: "recvonly" });
      peerConnection.addTransceiver("audio", { direction: "recvonly" });

      // Add transceiver for sending audio to student (initially inactive)
      peerConnection.addTransceiver("audio", { direction: "sendonly" });

      // Wait a bit for transceivers to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create and send initial offer immediately, in case student is already ready
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        if (socketRef.current?.connected) {
          socketRef.current.emit("webrtc-offer", {
            offer: offer,
            sessionToken: stream.sessionToken,
          });
          console.log(
            `Dashboard sent initial offer for ${stream.sessionToken}`
          );
        }
      } catch (error) {
        console.error(
          `Failed to send initial offer for ${stream.sessionToken}:`,
          error
        );
      }

      console.log(
        `Dashboard WebRTC setup complete for ${stream.sessionToken} - waiting for student to initiate connection`
      );
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
    sessionToken: string
  ) => {
    try {
      console.log(
        `Dashboard received WebRTC answer for ${sessionToken} (may be renegotiation)`
      );
      const peerConnection = peerConnectionsRef.current.get(sessionToken);
      if (peerConnection) {
        // Accept answer in various signaling states (including renegotiation)
        if (
          peerConnection.signalingState === "have-local-offer" ||
          peerConnection.signalingState === "stable"
        ) {
          console.log(
            `Setting remote description for ${sessionToken}, current state: ${peerConnection.signalingState}`
          );
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          console.log(
            `Successfully set remote description for ${sessionToken}`
          );
        } else {
          console.log(
            `Cannot set remote description, signaling state: ${peerConnection.signalingState}`
          );
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
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  };

  // const _getRiskColor = (score: number) => {
  //   if (score >= 80) return "text-red-600 bg-red-50";
  //   if (score >= 60) return "text-orange-600 bg-orange-50";
  //   if (score >= 30) return "text-yellow-600 bg-yellow-50";
  //   return "text-green-600 bg-green-50";
  // };

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

      // Reconnect to all live streams
      const liveStreams = getFilteredStreams();
      for (const stream of liveStreams) {
        if (stream.isLive) {
          await joinStream(stream);
          // Small delay between connections
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
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
        // const audioTrack = localAudioStream.getAudioTracks()[0];
        // const _sender = peerConnection.addTrack(audioTrack, localAudioStream);

        // Trigger renegotiation by creating new offer
        console.log("Creating renegotiation offer for microphone");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send the new offer to student for renegotiation
        if (socketRef.current?.connected) {
          socketRef.current.emit("webrtc-offer", {
            offer: offer,
            sessionToken: sessionToken,
          });
          console.log(
            "Sent renegotiation offer for microphone to:",
            sessionToken
          );
        }

        console.log(
          "Added microphone track and renegotiated connection for:",
          sessionToken
        );
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
        console.log(
          "Removed microphone track from peer connection for:",
          sessionToken
        );
      }
    } catch (error) {
      console.error("Error toggling microphone:", error);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const handleForceAudioSettings = (
    sessionToken: string,
    volume?: number,
    micGain?: number
  ) => {
    if (socketRef.current?.connected) {
      console.log(
        "Sending force audio settings command to student:",
        sessionToken,
        { volume, micGain }
      );
      socketRef.current.emit("force-student-audio", {
        sessionToken: sessionToken,
        volume: volume || 0.5, // Default to 50% volume
        micGain: micGain || 0.6, // Default to 60% microphone gain
      });
    } else {
      console.error("Socket not connected, cannot send force audio command");
      setError("Connection lost. Please refresh the page.");
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-blue-50 to-blue-50 flex items-center justify-center">
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
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
            Loading Proctoring Dashboard
          </h2>
          <p className="text-gray-600 font-medium mb-4">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-50 to-blue-50">
      <div className="w-full py-6 pt-0">
        {/* Header */}
        <div className="bg-white/90 border-b border-blue-100 dark:border-gray-800 p-3 mb-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.history.back()}
                className="p-3 hover:bg-blue-50 transition-all duration-300 rounded-xl group"
              >
                <svg
                  className="w-6 h-6 text-gray-600 group-hover:text-gray-800 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
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
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    Live Proctoring Dashboard
                  </h1>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Real-time student monitoring system
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reconnectWebRTC}
                disabled={isReconnecting}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white text-sm font-semibold transition-all duration-300 rounded-full flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isReconnecting ? "animate-spin" : ""}`}
                />
                {isReconnecting ? "Reconnecting..." : "Reconnect"}
              </button>
              <button
                onClick={loadActiveStreams}
                className="px-6 py-3 bg-white/90 hover:bg-white border border-blue-200 hover:border-blue-300 text-gray-700 text-sm font-semibold transition-all duration-300 rounded-full flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
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
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/90 border border-red-200 p-4 mb-6 rounded-xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Student Videos Section */}
        <div className="bg-white/90 border border-blue-200 rounded-2xl p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg flex items-center justify-center">
                <Circle className="w-4 h-4 text-white fill-current animate-pulse" />
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Live Student Videos
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  {getFilteredStreams().filter((s) => s.isLive).length} Live
                </div>
                <div className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                  {getFilteredStreams().length} Total
                </div>
              </div>
            </div>
          </div>

          {getFilteredStreams().length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-12 h-12 text-gray-400"
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
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No students found for this quiz
                </h3>
                <p className="text-gray-600">
                  {selectedQuiz
                    ? "No connected students for the selected quiz."
                    : "Students will appear here when they start their quiz sessions"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-6">
              {getFilteredStreams().map((stream, index) => (
                <div
                  key={index + 1}
                  className="group bg-white rounded-2xl hover:bg-blue-50 transition-all duration-300 cursor-pointer overflow-hidden border border-blue-100"
                  onClick={() => setSelectedStreamForModal(stream)}
                >
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                    {stream.stream ? (
                      <>
                        <video
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          data-session-token={stream.sessionToken}
                          ref={(el) => {
                            if (el && stream.stream) {
                              el.srcObject = stream.stream;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <User className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-xs text-gray-500 font-medium">
                            {stream.isLive ? "Connecting..." : "No Stream"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* YouTube-style LIVE indicator */}
                    <div className="absolute top-3 left-3">
                      {stream.isLive && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                      )}
                    </div>

                    {/* Risk score indicator */}
                    {stream.riskScore >= 60 && (
                      <div className="absolute top-3 right-3">
                        <div className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">
                          <AlertTriangle className="w-3 h-3" />
                          {stream.riskScore}
                        </div>
                      </div>
                    )}

                    {/* Flags indicator */}
                    {stream.flagsCount > 0 && (
                      <div className="absolute bottom-3 right-3">
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-600/90 text-white text-xs font-medium rounded backdrop-blur-sm">
                          <Flag className="w-3 h-3" />
                          {stream.flagsCount}
                        </div>
                      </div>
                    )}

                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <svg
                          className="w-6 h-6 text-gray-800 ml-1"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                      {stream.student.first_name} {stream.student.last_name}
                    </h3>
                    <p className="text-xs text-gray-600 line-clamp-1 mb-3">
                      {stream.quiz.title}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            stream.isLive
                              ? "bg-green-500 animate-pulse"
                              : "bg-gray-400"
                          }`}
                        ></div>
                        <span className="text-xs text-gray-500 font-medium">
                          {stream.isLive ? "Live" : "Offline"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(stream.startTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Events Section */}
        {events.length > 0 && (
          <div className="mt-6">
            <div className="bg-white/90 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    Recent Events
                  </h2>
                  <p className="text-sm text-gray-600">
                    Latest proctoring alerts and notifications
                  </p>
                </div>
                <div className="ml-auto">
                  <div className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                    {events.length} Events
                  </div>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <div className="space-y-3">
                  {events.slice(0, 50).map((event, _eventIndex) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 p-4 bg-white/50 hover:bg-blue-50/50 rounded-xl transition-all duration-200 border border-blue-100/50 hover:border-blue-200"
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${getSeverityColor(
                          event.severity
                        )}`}
                      ></div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <p className="text-sm text-gray-800 font-medium leading-relaxed">
                            {event.description}
                          </p>
                          <div className="ml-3 flex-shrink-0">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              event.severity === "critical"
                                ? "bg-red-100 text-red-700"
                                : event.severity === "high"
                                ? "bg-orange-100 text-orange-700"
                                : event.severity === "medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {event.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {event.event_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <StreamModal
        stream={selectedStreamForModal}
        onClose={() => setSelectedStreamForModal(null)}
        onJoinStream={joinStream}
        onToggleMic={handleToggleMic}
        onForceAudioSettings={handleForceAudioSettings}
      />
    </div>
  );
};

export default LiveProctoringDashboard;
