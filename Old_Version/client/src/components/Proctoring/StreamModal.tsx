import React, { useState, useRef, useEffect } from "react";
import Modal from "../ui/Modal";
import { ProctoringApiService } from "../../services/proctoringApi";
import {
  User,
  AlertTriangle,
  Flag,
  Circle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Volume,
  Ban,
} from "lucide-react";

interface ProctoringEvent {
  id: number;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: string;
}

interface ProctoringSession {
  id: number;
  session_token: string;
  student_id: number;
  quiz_id: number;
  status: string;
  flags_count: number;
  risk_score: number;
  events?: ProctoringEvent[];
}

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

interface StreamModalProps {
  stream: LiveStream | null;
  onClose: () => void;
  onJoinStream?: (stream: LiveStream) => void;
  onToggleMic?: (sessionToken: string, enabled: boolean) => void;
  onForceAudioSettings?: (
    sessionToken: string,
    volume?: number,
    micGain?: number
  ) => void;
}

const StreamModal: React.FC<StreamModalProps> = ({
  stream,
  onClose,
  onJoinStream,
  onToggleMic,
  onForceAudioSettings,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(50);
  const [micGainLevel, setMicGainLevel] = useState(60);
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] =
    useState(false);
  const [confirmationRequestId, setConfirmationRequestId] = useState<
    string | null
  >(null);
  const [sessionData, setSessionData] = useState<ProctoringSession | null>(
    null
  );
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [showEndQuizModal, setShowEndQuizModal] = useState(false);
  const [endQuizReason, setEndQuizReason] = useState("");
  const [isEndingQuiz, setIsEndingQuiz] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (videoRef.current && stream?.stream) {
      videoRef.current.srcObject = stream.stream;
    }
  }, [stream?.stream]);

  // Fetch session data and events when stream changes
  useEffect(() => {
    if (stream) {
      fetchSessionData();
    }
  }, [stream]);

  // Initialize socket connection for audio confirmation
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const { io } = await import("socket.io-client");
        socketRef.current = io("http://localhost:5002", {
          transports: ["websocket", "polling"],
        });

        socketRef.current.on("connect", () => {
          console.log("StreamModal connected to socket server");
          if (stream) {
            socketRef.current.emit("join-proctoring-session", {
              sessionToken: stream.sessionToken,
              role: "dashboard",
            });
          }
        });

        // Listen for student confirmation response
        socketRef.current.on("student-audio-confirmation", (data: any) => {
          if (
            data.sessionToken === stream?.sessionToken &&
            data.requestId === confirmationRequestId &&
            stream
          ) {
            setIsWaitingForConfirmation(false);
            setConfirmationRequestId(null);

            if (data.confirmed) {
              // Student confirmed, now apply the settings
              if (onForceAudioSettings) {
                onForceAudioSettings(
                  stream.sessionToken,
                  volumeLevel / 100,
                  micGainLevel / 100
                );
              }
            } else {
              // Student declined
              alert("Student declined the audio settings adjustment.");
            }
          }
        });

        socketRef.current.on("connect_error", (error: any) => {
          console.error("StreamModal socket connection error:", error);
        });
      } catch (error) {
        console.error("Error initializing socket in StreamModal:", error);
      }
    };

    if (stream) {
      initializeSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [
    stream,
    confirmationRequestId,
    volumeLevel,
    micGainLevel,
    onForceAudioSettings,
  ]);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    const videoContainer = document.querySelector(".video-container");
    if (videoContainer) {
      videoContainer.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      if (videoContainer) {
        videoContainer.removeEventListener("mousemove", handleMouseMove);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleMic = () => {
    if (stream && onToggleMic) {
      const newMicState = !isMicEnabled;
      setIsMicEnabled(newMicState);
      onToggleMic(stream.sessionToken, newMicState);
    }
  };

  const handleVolumeChange = (value: number) => {
    setVolumeLevel(value);
  };

  const handleMicGainChange = (value: number) => {
    setMicGainLevel(value);
  };

  const applyAudioSettings = () => {
    if (stream && socketRef.current && socketRef.current.connected) {
      const requestId = `audio-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      setIsWaitingForConfirmation(true);
      setConfirmationRequestId(requestId);

      // Send confirmation request to student
      socketRef.current.emit("request-student-audio-confirmation", {
        sessionToken: stream.sessionToken,
        volume: volumeLevel / 100,
        micGain: micGainLevel / 100,
        requestId,
      });
    } else {
      alert("Unable to connect to student for confirmation. Please try again.");
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-600 bg-red-50";
    if (score >= 60) return "text-orange-600 bg-orange-50";
    if (score >= 30) return "text-yellow-600 bg-yellow-50";
    return "text-green-600 bg-green-50";
  };

  const fetchSessionData = async () => {
    if (!stream) return;

    try {
      // Find session by token - we need to get the session ID first
      // Since we don't have direct access to session ID from LiveStream,
      // we'll need to fetch active streams and find the matching one
      const activeStreamsResponse =
        await ProctoringApiService.getActiveStreams();
      const activeStream = activeStreamsResponse.data.find(
        (s: any) => s.sessionToken === stream.sessionToken
      );

      if (activeStream && activeStream.id) {
        // Fetch the full session details including events
        const sessionResponse = await ProctoringApiService.getProctoringSession(
          activeStream.id
        );
        const session = sessionResponse.data;

        setSessionData({
          id: session.id,
          session_token: session.session_token,
          student_id: session.student_id,
          quiz_id: session.quiz_id,
          status: session.status,
          flags_count: session.flags_count,
          risk_score: session.risk_score,
          events: session.events || [],
        });
        setEvents(session.events || []);
      } else {
        // Fallback: create a mock session object if we can't get the real one
        const mockSession: ProctoringSession = {
          id: 1,
          session_token: stream.sessionToken,
          student_id: stream.student.id,
          quiz_id: stream.quiz.id,
          status: "active",
          flags_count: stream.flagsCount,
          risk_score: stream.riskScore,
          events: [],
        };
        setSessionData(mockSession);
        setEvents([]);
      }
    } catch (error) {
      console.error("Error fetching session data:", error);
      // Fallback to mock data on error
      const mockSession: ProctoringSession = {
        id: 1,
        session_token: stream.sessionToken,
        student_id: stream.student.id,
        quiz_id: stream.quiz.id,
        status: "active",
        flags_count: stream.flagsCount,
        risk_score: stream.riskScore,
        events: [],
      };
      setSessionData(mockSession);
      setEvents([]);
    }
  };

  const handleEndQuiz = async () => {
    if (!sessionData || !endQuizReason.trim()) return;

    setIsEndingQuiz(true);
    try {
      await ProctoringApiService.endProctoringSession(
        sessionData.id,
        endQuizReason.trim()
      );

      // Send socket event to notify student
      if (socketRef.current?.connected) {
        socketRef.current.emit("end-student-quiz", {
          sessionToken: stream?.sessionToken,
          reason: endQuizReason.trim(),
        });
      }

      setShowEndQuizModal(false);
      setEndQuizReason("");
      // Optionally close the modal or show success message
    } catch (error) {
      console.error("Error ending quiz:", error);
      alert("Failed to end quiz. Please try again.");
    } finally {
      setIsEndingQuiz(false);
    }
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

  if (!stream) return null;

  return (
    <Modal
      isOpen={!!stream}
      onClose={onClose}
      title={`${stream.student.first_name} ${stream.student.last_name}`}
      subtitle={`Session: ${stream.quiz.title}`}
      size="xxl"
    >
      <div className="space-y-6">
        {/* Full Video Display with YouTube-style Controls */}
        <div className="relative bg-black rounded-2xl overflow-hidden video-container group">
          <div className="aspect-video relative">
            {stream.stream ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center">
                  <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                    <User className="w-12 h-12 text-white/70" />
                  </div>
                  <p className="text-white/80 font-medium text-lg">
                    {stream.isLive
                      ? "Connecting to stream..."
                      : stream.disconnectedAt
                      ? "Reconnecting..."
                      : "Stream offline"}
                  </p>
                </div>
              </div>
            )}

            {/* Status overlay */}
            <div className="absolute top-6 right-6">
              <div
                className={`flex items-center px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-md ${
                  stream.isLive
                    ? "text-white bg-red-600/90 shadow-lg"
                    : "text-gray-300 bg-black/50"
                } animate-pulse`}
              >
                <div
                  className={`w-3 h-3 rounded-full mr-3 ${
                    stream.isLive ? "bg-white animate-pulse" : "bg-gray-400"
                  }`}
                ></div>
                {stream.isLive
                  ? "LIVE"
                  : stream.disconnectedAt
                  ? "Reconnecting"
                  : "Offline"}
              </div>
            </div>

            {/* Risk Score overlay */}
            {stream.riskScore >= 60 && (
              <div className="absolute top-6 left-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/90 text-white text-sm font-bold rounded-xl backdrop-blur-md shadow-lg animate-bounce">
                  <AlertTriangle className="w-5 h-5" />
                  Risk: {stream.riskScore}
                </div>
              </div>
            )}

            {/* YouTube-style Controls */}
            {stream.stream && showControls && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white ml-1" />
                      )}
                    </button>
                    <button
                      onClick={toggleMute}
                      className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm ${
                        isMicEnabled
                          ? "bg-red-500/80 hover:bg-red-600/80"
                          : "bg-white/20 hover:bg-white/30"
                      }`}
                    >
                      {isMicEnabled ? (
                        <Mic className="w-5 h-5 text-white" />
                      ) : (
                        <MicOff className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={toggleFullscreen}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5 text-white" />
                    ) : (
                      <Maximize className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Student Information Cards with Modern Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
                <User className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-blue-800">
                Student Information
              </h3>
            </div>
            <div className="space-y-5">
              <div className="flex justify-between items-center p-3 bg-white/50 rounded-xl">
                <span className="text-blue-700 font-semibold">Name:</span>
                <span className="font-bold text-blue-900 text-right">
                  {stream.student.first_name} {stream.student.last_name}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/50 rounded-xl">
                <span className="text-blue-700 font-semibold">Email:</span>
                <span className="font-bold text-blue-900 text-sm text-right break-all">
                  {stream.student.email}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/50 rounded-xl">
                <span className="text-blue-700 font-semibold">Status:</span>
                <span
                  className={`font-bold text-sm px-4 py-2 rounded-full shadow-md ${
                    stream.isLive
                      ? "text-green-700 bg-green-200 animate-pulse"
                      : "text-gray-700 bg-gray-200"
                  }`}
                >
                  {stream.isLive
                    ? "Active"
                    : stream.disconnectedAt
                    ? "Reconnecting"
                    : "Offline"}
                </span>
              </div>
              {stream.lastConnectionTime && (
                <div className="flex justify-between items-center p-3 bg-white/50 rounded-xl">
                  <span className="text-blue-700 font-semibold">
                    Last Connected:
                  </span>
                  <span className="font-bold text-blue-900 text-sm text-right">
                    {new Date(stream.lastConnectionTime).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-white rounded-2xl p-6 border border-yellow-200 transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-6 w-full">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md">
                <Circle className="w-6 h-6 text-white fill-current" />
              </div>
              <h3 className="text-xl font-bold text-yellow-800">
                Session Details
              </h3>
            </div>
            <div className="space-y-5">
              <div className="flex justify-between items-center p-3 border-b dark:border-gray-700">
                <span className="font-semibold">Quiz:</span>
                <span className="font-bold text-yellow-900 text-sm text-right">
                  {stream.quiz.title}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 border-b dark:border-gray-700">
                <span className="font-semibold">Started:</span>
                <span className="font-bold text-yellow-900 text-sm text-right">
                  {new Date(stream.startTime).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 border-b dark:border-gray-700">
                <span className="font-semibold">Risk Score:</span>
                <span
                  className={`font-bold text-sm px-4 py-2 rounded-full shadow-md ${getRiskColor(
                    stream.riskScore
                  )}`}
                >
                  {stream.riskScore}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 border-b dark:border-gray-700">
                <span className="font-semibold">Flags:</span>
                <span className="font-bold text-yellow-900 text-sm flex items-center gap-2">
                  <Flag className="w-5 h-5 text-red-500" />
                  {stream.flagsCount}
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200 transition-shadow duration-300 mt-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-red-500 rounded-xl flex items-center justify-center shadow-md">
                  <Flag className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-red-800">
                  Flags & Warnings
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-white/50 rounded-xl">
                  <span className="text-red-700 font-semibold">
                    Total Flags:
                  </span>
                  <span className="font-bold text-red-900 text-lg">
                    {stream.flagsCount}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {events.length > 0 ? (
                    events.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-3 bg-white/70 rounded-lg border border-red-100"
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${getSeverityColor(
                            event.severity
                          )}`}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-red-800 font-medium truncate">
                            {event.description}
                          </p>
                          <p className="text-xs text-red-600">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-red-600 text-sm">
                        No flags or warnings
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowEndQuizModal(true)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  <Ban className="w-5 h-5" />
                  End Student Quiz
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Control Section */}
        {stream.isLive && onForceAudioSettings && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
                <Volume className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-blue-800">
                Audio Controls
              </h3>
            </div>

            <div className="space-y-4">
              {/* Volume Control */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-blue-700 min-w-[80px]">
                  Volume: {volumeLevel}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volumeLevel}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <button
                  onClick={() => setVolumeLevel(50)}
                  className="px-3 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* Microphone Gain Control */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-blue-700 min-w-[80px]">
                  Mic Gain: {micGainLevel}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={micGainLevel}
                  onChange={(e) => handleMicGainChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <button
                  onClick={() => setMicGainLevel(60)}
                  className="px-3 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* Apply Button */}
              <button
                onClick={applyAudioSettings}
                disabled={isWaitingForConfirmation}
                className={`w-full px-6 py-3 rounded-xl text-white font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-md ${
                  isWaitingForConfirmation
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg transform hover:-translate-y-0.5"
                }`}
              >
                <Volume className="w-5 h-5" />
                {isWaitingForConfirmation
                  ? "Waiting for Student Confirmation..."
                  : "Apply Audio Settings"}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons with Modern Design */}
        <div className="fle justify-between items-center hidden">
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Close
            </button>
            {stream.isLive && onJoinStream && (
              <button
                onClick={() => {
                  onJoinStream(stream);
                  onClose();
                }}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold transition-all duration-300 flex items-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <Play className="w-5 h-5" />
                Join Stream
              </button>
            )}
          </div>
        </div>

        {/* End Quiz Confirmation Modal */}
        {showEndQuizModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-400/20 to-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Ban className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  End Student Quiz
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  This will immediately terminate the student's quiz session.
                  The student will see the reason you provide.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for ending quiz:
                  </label>
                  <textarea
                    value={endQuizReason}
                    onChange={(e) => setEndQuizReason(e.target.value)}
                    placeholder="Enter the reason for ending this quiz..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {endQuizReason.length}/500 characters
                  </p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setShowEndQuizModal(false);
                      setEndQuizReason("");
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition-colors"
                    disabled={isEndingQuiz}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndQuiz}
                    disabled={!endQuizReason.trim() || isEndingQuiz}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEndingQuiz ? "Ending Quiz..." : "End Quiz"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default StreamModal;
