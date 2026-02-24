import React, { useState, useRef, useEffect } from "react";
import Modal from "../ui/Modal";
import { ProctoringApiService } from "../../services/proctoringApi";
import {
  User,
  AlertTriangle,
  Flag,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Ban,
  Eye,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Image,
  ChevronDown,
  ChevronUp,
  Send,
  PauseCircle,
  Wifi,
  WifiOff,
  Save,
  Terminal,
  Shield,
  Skull,
  Zap,
  Cpu,
  HardDrive,
  Lock,
  Bell,
  Clock,
  Activity,
  AlertCircle,
  Search,
} from "lucide-react";

interface ProctoringEvent {
  id: number;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: string;
  screenshot_url?: string;
  metadata?: any;
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
  screenshots?: string[];
  notes?: ProctoringNote[];
}

interface ProctoringNote {
  id: number;
  content: string;
  created_by: number;
  created_at: string;
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
  stream?: MediaStream;
  disconnectedAt?: string;
}

interface StreamModalProps {
  stream: LiveStream | null;
  onClose: () => void;
  onJoinStream?: (stream: LiveStream) => void;
  onToggleMic?: (sessionToken: string, enabled: boolean) => void;
  onForceAudioSettings?: (
    sessionToken: string,
    volume?: number,
    micGain?: number,
  ) => void;
  onPauseExam?: (sessionToken: string) => void;
  onResumeExam?: (sessionToken: string) => void;
  onSendWarning?: (sessionToken: string, message: string) => void;
}

// Events Dropdown Component for Title Bar - Opens Modal when clicked
const EventsDropdown: React.FC<{
  events: ProctoringEvent[];
  flagsCount: number;
  onEventClick?: (event: ProctoringEvent) => void;
}> = ({ events, flagsCount, onEventClick }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  // Get unique event types with counts
  const eventCounts = events.reduce(
    (acc, e) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Get critical/high severity events
  const criticalEvents = events.filter(
    (e) => e.severity === "critical" || e.severity === "high",
  );

  // Filter events based on search and filters
  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      searchQuery === "" ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.event_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity =
      severityFilter === "all" || e.severity === severityFilter;
    const matchesEventType =
      eventTypeFilter === "all" || e.event_type === eventTypeFilter;
    return matchesSearch && matchesSeverity && matchesEventType;
  });

  // Get all events sorted by time
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

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

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case "critical":
        return "bg-red-100/90 text-red-700 border-red-200/60 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800/40";
      case "high":
        return "bg-orange-100/90 text-orange-700 border-orange-200/60 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800/40";
      case "medium":
        return "bg-yellow-100/90 text-yellow-700 border-yellow-200/60 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800/40";
      default:
        return "bg-blue-100/90 text-blue-700 border-blue-200/60 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/40";
    }
  };

  return (
    <>
      {/* Button Trigger */}
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          criticalEvents.length > 0
            ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/40"
            : events.length > 0
              ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40"
              : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200/60 dark:border-green-800/40"
        } hover:shadow-md`}
      >
        <Flag className="w-4 h-4" />
        <span>Events</span>
        {flagsCount > 0 && (
          <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
            {flagsCount}
          </span>
        )}
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Events Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-200/60 dark:border-gray-700/40 shadow-2xl">
            {/* Modal Header */}
            <div className="p-3 border-b border-gray-200/60 dark:border-gray-700/40 bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Flag className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800 dark:text-white">
                      Events & Flags
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {events.length} events • {flagsCount} flags
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSearchQuery("");
                    setSeverityFilter("all");
                    setEventTypeFilter("all");
                  }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="p-2 border-b border-gray-200/40 dark:border-gray-700/40">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300/60 dark:border-gray-600/50 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                  />
                </div>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-gray-300/60 dark:border-gray-600/50 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-24"
                >
                  <option value="all">Severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-gray-300/60 dark:border-gray-600/50 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-24"
                >
                  <option value="all">Type</option>
                  {Object.keys(eventCounts).map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ").slice(0, 10)}
                    </option>
                  ))}
                </select>
                {(searchQuery ||
                  severityFilter !== "all" ||
                  eventTypeFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSeverityFilter("all");
                      setEventTypeFilter("all");
                    }}
                    className="px-2 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="p-1.5 border-b border-gray-200/40 dark:border-gray-700/40 grid grid-cols-4 gap-1">
              <div className="text-center p-1 bg-red-50 dark:bg-red-900/20 rounded">
                <div className="text-sm font-bold text-red-600 dark:text-red-400">
                  {events.filter((e) => e.severity === "critical").length}
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400">
                  Critical
                </div>
              </div>
              <div className="text-center p-1 bg-orange-50 dark:bg-orange-900/20 rounded">
                <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {events.filter((e) => e.severity === "high").length}
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400">
                  High
                </div>
              </div>
              <div className="text-center p-1 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                  {events.filter((e) => e.severity === "medium").length}
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400">
                  Medium
                </div>
              </div>
              <div className="text-center p-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {events.filter((e) => e.severity === "low").length}
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400">
                  Low
                </div>
              </div>
            </div>

            {/* Event Types Summary */}
            {Object.keys(eventCounts).length > 0 && (
              <div className="p-3 border-b border-gray-200/40 dark:border-gray-700/40">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Event Types
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(eventCounts).map(([type, count]) => (
                    <span
                      key={type}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      onClick={() => setEventTypeFilter(type)}
                    >
                      {type.replace(/_/g, " ")} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Events List */}
            <div className="max-h-96 overflow-y-auto p-3 space-y-2">
              {sortedEvents.length > 0 ? (
                sortedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/30"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getSeverityColor(event.severity)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${getSeverityBadge(event.severity)}`}
                          >
                            {event.severity.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                            {event.event_type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {event.description}
                        </p>
                        {event.screenshot_url && (
                          <img
                            src={event.screenshot_url}
                            alt="Screenshot"
                            className="mt-2 w-full h-24 object-cover rounded-lg cursor-pointer"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No events match your filters
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200/40 dark:border-gray-700/40 bg-gray-50 dark:bg-gray-800/30">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const StreamModal: React.FC<StreamModalProps> = ({
  stream,
  onClose,
  onJoinStream,
  onToggleMic,
  onForceAudioSettings,
  onPauseExam,
  onResumeExam,
  onSendWarning,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(50);
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [showEndQuizModal, setShowEndQuizModal] = useState(false);
  const [endQuizReason, setEndQuizReason] = useState("");
  const [isEndingQuiz, setIsEndingQuiz] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isSendingWarning, setIsSendingWarning] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [matrixRain, setMatrixRain] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);
  const socketRef = useRef<any>(null);

  // Glitch effect for high risk
  const [glitchActive, setGlitchActive] = useState(false);
  useEffect(() => {
    if (stream && stream.riskScore >= 80) {
      const interval = setInterval(() => {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 150);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [stream?.riskScore]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream?.stream) return;
    if (video.srcObject !== stream.stream) video.srcObject = stream.stream;
    video.play().catch(() => {});
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [stream?.stream]);

  useEffect(() => {
    if (stream) fetchSessionData();
  }, [stream]);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = window.setTimeout(
        () => setShowControls(false),
        3000,
      );
    };
    const videoContainer = document.querySelector(".video-container");
    if (videoContainer)
      videoContainer.addEventListener("mousemove", handleMouseMove);
    return () => {
      if (videoContainer)
        videoContainer.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      isPlaying ? videoRef.current.pause() : videoRef.current.play();
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
      const newState = !isMicEnabled;
      setIsMicEnabled(newState);
      onToggleMic(stream.sessionToken, newState);
    }
  };

  const fetchSessionData = async () => {
    if (!stream) return;
    try {
      const res = await ProctoringApiService.getActiveStreams();
      const activeStream = res.data.find(
        (s: any) => s.sessionToken === stream.sessionToken,
      );
      if (activeStream?.id) {
        const session = (
          await ProctoringApiService.getProctoringSession(activeStream.id)
        ).data;
        const ss = (session.events || [])
          .filter((e: ProctoringEvent) => e.screenshot_url)
          .map((e: ProctoringEvent) => e.screenshot_url);
        setEvents(session.events || []);
        setScreenshots(ss);
      } else {
        setEvents([]);
        setScreenshots([]);
      }
    } catch (e) {
      setEvents([]);
      setScreenshots([]);
    }
  };

  const handleEndQuiz = async () => {
    if (!endQuizReason.trim()) return;
    setIsEndingQuiz(true);
    try {
      if (socketRef.current?.connected)
        socketRef.current.emit("end-student-quiz", {
          sessionToken: stream?.sessionToken,
          reason: endQuizReason,
        });
      setShowEndQuizModal(false);
      setEndQuizReason("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsEndingQuiz(false);
    }
  };

  const handleSendWarning = () => {
    if (!warningMessage.trim() || !stream) return;
    setIsSendingWarning(true);
    try {
      // Use the onSendWarning prop from parent (LiveProctoringDashboard)
      // which has the proper socket connection
      if (onSendWarning) {
        onSendWarning(stream.sessionToken, warningMessage);
      }
      setShowWarningModal(false);
      setWarningMessage("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingWarning(false);
    }
  };

  const handlePauseExam = () => {
    if (!stream || !onPauseExam) return;
    // Use the onPauseExam prop from parent (LiveProctoringDashboard)
    // which has the proper socket connection
    onPauseExam(stream.sessionToken);
  };

  const handleResumeExam = () => {
    if (!stream || !onResumeExam) return;
    // Use the onResumeExam prop from parent (LiveProctoringDashboard)
    // which has the proper socket connection
    onResumeExam(stream.sessionToken);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;
    setIsSavingNote(true);
    try {
      await ProctoringApiService.logEvent({
        session_token: stream?.sessionToken || "",
        event_type: "instructor_note",
        severity: "low",
        description: `Note: ${noteContent}`,
      });
      setShowNoteModal(false);
      setNoteContent("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case "critical":
        return "bg-red-100/90 text-red-700 border-red-200/60 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800/40";
      case "high":
        return "bg-orange-100/90 text-orange-700 border-orange-200/60 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800/40";
      case "medium":
        return "bg-yellow-100/90 text-yellow-700 border-yellow-200/60 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800/40";
      default:
        return "bg-blue-100/90 text-blue-700 border-blue-200/60 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/40";
    }
  };

  const filteredEvents = events.filter(
    (e) =>
      (eventFilter === "all" || e.event_type === eventFilter) &&
      (severityFilter === "all" || e.severity === severityFilter),
  );
  const eventTypes = [...new Set(events.map((e) => e.event_type))];

  if (!stream) return null;

  return (
    <Modal
      isOpen={!!stream}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full">
          <div>
            <span className="text-lg font-bold text-gray-800 dark:text-white">
              {stream.student.first_name} {stream.student.last_name}
            </span>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Terminal className="w-3 h-3" />
              {stream.quiz.title}
            </div>
          </div>
        </div>
      }
      subtitle={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <span
              className={`flex items-center gap-1.5 text-xs ${
                stream.isLive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-500 dark:text-red-400"
              }`}
            >
              {stream.isLive ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  LIVE
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  OFFLINE
                </>
              )}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">|</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Risk:{" "}
              <span
                className={
                  stream.riskScore >= 60
                    ? "text-red-500 font-semibold"
                    : "text-green-500 font-semibold"
                }
              >
                {stream.riskScore}
              </span>
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">|</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Flag className="w-3 h-3" />
              Flags:{" "}
              <span
                className={
                  stream.flagsCount > 0 ? "text-red-500 font-semibold" : ""
                }
              >
                {stream.flagsCount}
              </span>
            </span>
          </div>
          {/* Events Dropdown on the right */}
          <EventsDropdown
            events={events}
            flagsCount={stream.flagsCount}
            onEventClick={(event) => {
              setShowEventsModal(false);
            }}
          />
        </div>
      }
      size="full"
    >
      <div className="w-full flex flex-row items-center justify-center">
        <div className="container h-full">
          {/* Main: 2 Columns - Info | Video+Events */}
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 min-h-0 overflow-y-auto pb-12">
            {/* COL-4: Info Panel - Modern Cards with Glow */}
            <div className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-2 lg:gap-3 order-2 lg:order-1">
              {/* Student Info - Cyberpunk Card */}
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl p-3 lg:p-4 border border-gray-200/60 dark:border-gray-700/40 shadow-lg shadow-purple-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                      Student Info
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Terminal className="w-3 h-3" />
                      Session Data
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      Name
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-white text-xs truncate max-w-[110px]">
                      {stream.student.first_name} {stream.student.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      Quiz
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-white text-xs truncate max-w-[110px]">
                      {stream.quiz.title}
                    </span>
                  </div>
                </div>
              </div>

              {/* Risk & Status - Glowing Card */}
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl p-3 lg:p-4 border border-gray-200/60 dark:border-gray-700/40 shadow-lg shadow-red-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-9 h-9 bg-gradient-to-br ${stream.riskScore >= 80 ? "from-red-500 via-red-600 to-red-700" : stream.riskScore >= 60 ? "from-orange-500 via-orange-600 to-orange-700" : "from-green-500 via-green-600 to-green-700"} rounded-lg flex items-center justify-center shadow-lg ${stream.riskScore >= 80 ? "shadow-red-500/40" : stream.riskScore >= 60 ? "shadow-orange-500/40" : "shadow-green-500/40"}`}
                  >
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                      Risk Assessment
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      Real-time Monitor
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`relative overflow-hidden rounded-lg p-2.5 text-center border ${stream.riskScore >= 80 ? "bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20 border-red-200/60 dark:border-red-800/30" : stream.riskScore >= 60 ? "bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/30 dark:to-orange-800/20 border-orange-200/60 dark:border-orange-800/30" : "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/30 dark:to-green-800/20 border-green-200/60 dark:border-green-800/30"}`}
                  >
                    <div
                      className={`text-2xl font-black ${stream.riskScore >= 80 ? "text-red-600 dark:text-red-400" : stream.riskScore >= 60 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}
                    >
                      {stream.riskScore}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Risk Score
                    </div>
                    <div
                      className={`mt-1.5 h-1.5 rounded-full overflow-hidden ${stream.riskScore >= 80 ? "bg-red-200/60 dark:bg-red-800/40" : stream.riskScore >= 60 ? "bg-orange-200/60 dark:bg-orange-800/40" : "bg-green-200/60 dark:bg-green-800/40"}`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${stream.riskScore >= 80 ? "bg-gradient-to-r from-red-500 to-red-600" : stream.riskScore >= 60 ? "bg-gradient-to-r from-orange-500 to-orange-600" : "bg-gradient-to-r from-green-500 to-green-600"}`}
                        style={{ width: `${stream.riskScore}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20 rounded-lg p-2.5 text-center border border-red-200/60 dark:border-red-800/30">
                    <div className="text-2xl font-black text-red-600 dark:text-red-400">
                      {stream.flagsCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Flags
                    </div>
                    <div className="mt-1.5 flex justify-center gap-0.5">
                      {stream.flagsCount > 0 ? (
                        [...Array(Math.min(stream.flagsCount, 4))].map(
                          (_, i) => (
                            <Flag key={i} className="w-3 h-3 text-red-500" />
                          ),
                        )
                      ) : (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
                {/* Connection Status - Terminal Style */}
                <div className="mt-2 flex items-center gap-2 py-2 px-3 bg-gray-900/95 dark:bg-gray-950 rounded-lg border border-gray-800/60">
                  {stream.isLive ? (
                    <>
                      <div className="relative">
                        <Wifi className="w-4 h-4 text-green-500" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                      </div>
                      <span className="text-xs text-green-400 font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        CONNECTED
                      </span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-400 font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        DISCONNECTED
                      </span>
                    </>
                  )}
                </div>
                {/* System Icons */}
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <div className="text-center py-1.5 bg-gray-50/80 dark:bg-gray-800/40 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                    <Cpu className="w-3.5 h-3.5 mx-auto text-purple-500 mb-0.5" />
                    <span className="text-[10px] text-gray-500">CPU</span>
                  </div>
                  <div className="text-center py-1.5 bg-gray-50/80 dark:bg-gray-800/40 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                    <HardDrive className="w-3.5 h-3.5 mx-auto text-cyan-500 mb-0.5" />
                    <span className="text-[10px] text-gray-500">Disk</span>
                  </div>
                  <div className="text-center py-1.5 bg-gray-50/80 dark:bg-gray-800/40 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                    <Lock className="w-3.5 h-3.5 mx-auto text-green-500 mb-0.5" />
                    <span className="text-[10px] text-gray-500">Secure</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions - Glow Buttons */}
              <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
                <button
                  onClick={handlePauseExam}
                  disabled={!stream.isLive}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20 hover:from-amber-100 hover:to-amber-100/80 dark:hover:from-amber-900/50 dark:hover:to-amber-800/30 border border-amber-200/60 dark:border-amber-800/30 rounded-lg text-amber-700 dark:text-amber-400 text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:shadow-lg hover:shadow-amber-500/20"
                >
                  <PauseCircle className="w-4 h-4" />
                  Pause
                </button>
                <button
                  onClick={handleResumeExam}
                  disabled={!stream.isLive}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 bg-gradient-to-b from-green-50 to-green-100/50 dark:from-green-900/30 dark:to-green-800/20 hover:from-green-100 hover:to-green-100/80 dark:hover:from-green-900/50 dark:hover:to-green-800/30 border border-green-200/60 dark:border-green-800/30 rounded-lg text-green-700 dark:text-green-400 text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:shadow-lg hover:shadow-green-500/20"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
                <button
                  onClick={() => setShowWarningModal(true)}
                  disabled={!stream.isLive}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 bg-gradient-to-b from-orange-50 to-orange-100/50 dark:from-orange-900/30 dark:to-orange-800/20 hover:from-orange-100 hover:to-orange-100/80 dark:hover:from-orange-900/50 dark:hover:to-orange-800/30 border border-orange-200/60 dark:border-orange-800/30 rounded-lg text-orange-700 dark:text-orange-400 text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:shadow-lg hover:shadow-orange-500/20"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Warn
                </button>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 bg-gradient-to-b from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 hover:from-blue-100 hover:to-blue-100/80 dark:hover:from-blue-900/50 dark:hover:to-blue-800/30 border border-blue-200/60 dark:border-blue-800/30 rounded-lg text-blue-700 dark:text-blue-400 text-xs font-semibold transition-all duration-200 active:scale-95 hover:shadow-lg hover:shadow-blue-500/20"
                >
                  <FileText className="w-4 h-4" />
                  Note
                </button>
                <button
                  onClick={() => setShowEndQuizModal(true)}
                  disabled={!stream.isLive}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 bg-gradient-to-b from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20 hover:from-red-100 hover:to-red-100/80 dark:hover:from-red-900/50 dark:hover:to-red-800/30 border border-red-200/60 dark:border-red-800/30 rounded-lg text-red-700 dark:text-red-400 text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:shadow-lg hover:shadow-red-500/20"
                >
                  <Ban className="w-4 h-4" />
                  End
                </button>
                <button
                  onClick={() => setMatrixRain(!matrixRain)}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 hover:shadow-lg ${matrixRain ? "bg-gradient-to-b from-green-500 to-green-600 text-white shadow-green-500/40" : "bg-gradient-to-b from-gray-100 to-gray-200/50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/60 dark:border-gray-600/40 text-gray-700 dark:text-gray-300 hover:shadow-gray-500/20"}`}
                >
                  <Zap className="w-4 h-4" />
                  Matrix
                </button>
                <button
                  onClick={fetchSessionData}
                  className="col-span-3 flex items-center justify-center gap-2 px-2 py-2 bg-gradient-to-b from-gray-100 to-gray-200/50 dark:from-gray-800/60 dark:to-gray-700/40 hover:from-gray-200 hover:to-gray-300/50 dark:hover:from-gray-700/60 dark:hover:to-gray-600/50 border border-gray-200/60 dark:border-gray-600/40 rounded-lg text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all duration-200 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Data
                </button>
              </div>
            </div>

            {/* COL-8: Video + Events */}
            <div className="flex-1 flex flex-col gap-3 min-h-0 order-1 lg:order-2">
              {/* Video - Full Width, Glitch Effect */}
              <div
                className={`relative bg-gray-900 rounded-xl video-container group border-2 transition-all duration-300 ${glitchActive ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]" : "border-gray-800/50 dark:border-gray-700/30 shadow-2xl"}`}
              >
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,6px_100%] opacity-15"></div>

                {/* Matrix Rain Effect - Inside Video Container Only */}
                {matrixRain && (
                  <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                    <div className="absolute inset-0 bg-green-500/5"></div>
                    <style>{`
                    @keyframes matrix-fall {
                      0% { transform: translateY(-100%); }
                      100% { transform: translateY(100%); }
                    }
                  `}</style>
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute text-green-500/70 text-[8px] font-mono leading-tight"
                        style={{
                          left: `${i * 12.5}%`,
                          top: "0",
                          height: "100%",
                          writingMode: "vertical-rl",
                          textOrientation: "upright",
                          animation: `matrix-fall 2s linear infinite`,
                          animationDelay: `${i * 0.25}s`,
                        }}
                      >
                        {[...Array(30)].map((_, j) => (
                          <div key={j} className="opacity-80">
                            {String.fromCharCode(
                              0x30a0 + Math.floor(Math.random() * 96),
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Glitch overlay */}
                {glitchActive && (
                  <>
                    <div className="absolute inset-0 bg-red-500/10 z-10 animate-pulse"></div>
                    <div className="absolute inset-0 skew-x-12 bg-cyan-500/5 z-10 translate-x-1"></div>
                  </>
                )}

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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                      {/* Corner accents - Cyberpunk */}
                      <div className="absolute top-0 left-0 w-10 h-10 border-l-3 border-t-3 border-cyan-400/60 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                      <div className="absolute top-0 right-0 w-10 h-10 border-r-3 border-t-3 border-cyan-400/60 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                      <div className="absolute bottom-0 left-0 w-10 h-10 border-l-3 border-b-3 border-cyan-400/60 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                      <div className="absolute bottom-0 right-0 w-10 h-10 border-r-3 border-b-3 border-cyan-400/60 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                      <div className="text-center">
                        <div className="relative">
                          <div className="w-24 h-24 border-4 border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse bg-gray-800/50">
                            <div className="absolute inset-0 rounded-2xl border-2 border-purple-500/50 animate-ping"></div>
                            <User className="w-12 h-12 text-white/70" />
                          </div>
                        </div>
                        <p className="text-white/80 font-medium text-lg">
                          {stream.isLive
                            ? "Connecting to stream..."
                            : "Stream offline"}
                        </p>
                        {stream.isLive && (
                          <div className="mt-3 flex items-center justify-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></span>
                            <span
                              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></span>
                            <span
                              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 z-30">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black backdrop-blur-md shadow-lg transition-all duration-300 ${stream.isLive ? "bg-red-600/95 shadow-red-500/30" : "bg-gray-900/80"}`}
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${stream.isLive ? "bg-white animate-pulse" : "bg-gray-400"}`}
                      ></div>
                      <span className="text-white tracking-wider">
                        {stream.isLive ? "● LIVE" : "○ OFFLINE"}
                      </span>
                    </div>
                  </div>

                  {/* Risk Badge */}
                  {stream.riskScore >= 60 && (
                    <div className="absolute top-3 left-3 z-30">
                      <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black backdrop-blur-md shadow-lg animate-bounce ${stream.riskScore >= 80 ? "bg-red-600/95 shadow-red-500/30" : "bg-orange-500/90 shadow-orange-500/30"}`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-white">
                          RISK: {stream.riskScore}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Video Controls */}
                  {stream.stream && showControls && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 z-40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={togglePlay}
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm active:scale-90 hover:scale-105"
                          >
                            {isPlaying ? (
                              <Pause className="w-5 h-5 text-white" />
                            ) : (
                              <Play className="w-5 h-5 text-white ml-0.5" />
                            )}
                          </button>
                          <div className="hidden md:flex items-center gap-1.5">
                            <button
                              onClick={toggleMute}
                              className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm active:scale-90"
                            >
                              {isMuted ? (
                                <VolumeX className="w-4 h-4 text-white" />
                              ) : (
                                <Volume2 className="w-4 h-4 text-white" />
                              )}
                            </button>
                            <button
                              onClick={toggleMic}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm active:scale-90 ${isMicEnabled ? "bg-red-500/90 hover:bg-red-600/90" : "bg-white/20 hover:bg-white/30"}`}
                            >
                              {isMicEnabled ? (
                                <Mic className="w-4 h-4 text-white" />
                              ) : (
                                <MicOff className="w-4 h-4 text-white" />
                              )}
                            </button>
                            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 backdrop-blur-sm">
                              <Volume2 className="w-4 h-4 text-white" />
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={volumeLevel}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setVolumeLevel(v);
                                  if (videoRef.current)
                                    videoRef.current.volume = v / 100;
                                }}
                                className="w-16 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={toggleFullscreen}
                          className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm active:scale-90"
                        >
                          {isFullscreen ? (
                            <Minimize className="w-4 h-4 text-white" />
                          ) : (
                            <Maximize className="w-4 h-4 text-white" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Screenshot Gallery Modal */}
        {showScreenshots && screenshots.length > 0 && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-gray-200/60 dark:border-gray-700/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-500" />
                  Screenshots Gallery{" "}
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                    {screenshots.length}
                  </span>
                </h3>
                <button
                  onClick={() => setShowScreenshots(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {screenshots.map((s, i) => (
                  <div
                    key={i}
                    className="relative group cursor-pointer rounded-xl overflow-hidden"
                    onClick={() => window.open(s, "_blank")}
                  >
                    <img
                      src={s}
                      alt=""
                      className="w-full h-36 object-cover transition-transform duration-200 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-10 h-10 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Warning Modal */}
        {showWarningModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-5 border border-orange-200/60 dark:border-orange-800/30 shadow-2xl shadow-orange-500/10 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                    Send Warning
                  </h3>
                  <p className="text-xs text-gray-500">
                    Immediate alert to student
                  </p>
                </div>
              </div>
              <textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="Enter warning message..."
                className="w-full p-3 border border-gray-300/60 dark:border-gray-600/50 rounded-xl bg-gray-50/80 dark:bg-gray-800/60 text-gray-800 dark:text-white resize-none text-sm"
                rows={3}
              />
              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={() => setShowWarningModal(false)}
                  className="px-4 py-2 border border-gray-300/60 dark:border-gray-600/50 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendWarning}
                  disabled={!warningMessage.trim() || isSendingWarning}
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full font-medium transition-all disabled:opacity-50 flex items-center gap-2 text-sm shadow-lg shadow-orange-500/20"
                >
                  <Send className="w-4 h-4" />
                  {isSendingWarning ? "Sending..." : "Send Warning"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Note Modal */}
        {showNoteModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-5 border border-blue-200/60 dark:border-blue-800/30 shadow-2xl shadow-blue-500/10 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                    Add Note
                  </h3>
                  <p className="text-xs text-gray-500">Private session note</p>
                </div>
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter your note..."
                className="w-full p-3 border border-gray-300/60 dark:border-gray-600/50 rounded-xl bg-gray-50/80 dark:bg-gray-800/60 text-gray-800 dark:text-white resize-none text-sm"
                rows={4}
              />
              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 border border-gray-300/60 dark:border-gray-600/50 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={!noteContent.trim() || isSavingNote}
                  className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full font-medium transition-all disabled:opacity-50 flex items-center gap-2 text-sm shadow-lg shadow-blue-500/20"
                >
                  <Save className="w-4 h-4" />
                  {isSavingNote ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End Quiz Modal */}
        {showEndQuizModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-5 border border-red-200/60 dark:border-red-800/30 shadow-2xl shadow-red-500/10 animate-in fade-in zoom-in duration-200">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-red-500/30">
                  <Skull className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  End Student Quiz?
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  This action cannot be undone
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for termination:
                </label>
                <textarea
                  value={endQuizReason}
                  onChange={(e) => setEndQuizReason(e.target.value)}
                  placeholder="Enter reason..."
                  className="w-full p-3 border border-gray-300/60 dark:border-gray-600/50 rounded-xl bg-gray-50/80 dark:bg-gray-800/60 text-gray-800 dark:text-white resize-none text-sm"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {endQuizReason.length}/500
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowEndQuizModal(false)}
                  className="px-5 py-2 border border-gray-300/60 dark:border-gray-600/50 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndQuiz}
                  disabled={!endQuizReason.trim() || isEndingQuiz}
                  className="px-5 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full font-medium transition-all disabled:opacity-50 text-sm shadow-lg shadow-red-500/20"
                >
                  {isEndingQuiz ? "Ending..." : "End Quiz"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default StreamModal;
