import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Monitor,
  Camera,
  Mic,
  Volume2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  proctoringMonitor,
  type ProctoringSettings,
  type ProctoringViolation,
  type ProctoringStatus,
} from "../../services/proctoringMonitor";
import faceDetectionService from "../../utils/faceDetection";

interface ProctoringMonitorComponentProps {
  sessionToken: string;
  quizId: string;
  settings: ProctoringSettings;
  videoElement: HTMLVideoElement;
  stream: MediaStream;
  isActive: boolean;
  onViolation?: (violation: ProctoringViolation) => void;
  onStatusUpdate?: (status: ProctoringStatus) => void;
}

const ProctoringMonitorComponent: React.FC<ProctoringMonitorComponentProps> = ({
  sessionToken,
  quizId,
  settings,
  videoElement,
  stream,
  isActive,
  onViolation,
  onStatusUpdate,
}) => {
  const [status, setStatus] = useState<ProctoringStatus | null>(null);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const monitorStartedRef = useRef(false);

  // Start monitoring when component mounts and has required props
  useEffect(() => {
    if (
      !monitorStartedRef.current &&
      sessionToken &&
      quizId &&
      settings &&
      videoElement &&
      stream
    ) {
      startMonitoring();
    }

    return () => {
      if (monitorStartedRef.current) {
        proctoringMonitor.stopMonitoring();
        monitorStartedRef.current = false;
      }
    };
  }, [sessionToken, quizId, settings, videoElement, stream]);

  // Update fullscreen status
  useEffect(() => {
    const checkFullscreen = () => {
      const fullscreenStatus = faceDetectionService.checkFullscreenStatus();
      setIsFullscreen(fullscreenStatus);
    };

    checkFullscreen();
    const interval = setInterval(checkFullscreen, 1000);
    return () => clearInterval(interval);
  }, []);

  const startMonitoring = async () => {
    try {
      await proctoringMonitor.startMonitoring({
        sessionToken,
        quizId,
        settings,
        videoElement,
        stream,
        onViolation: handleViolation,
        onStatusUpdate: handleStatusUpdate,
      });

      monitorStartedRef.current = true;
      console.log("Proctoring monitoring started successfully");
    } catch (error) {
      console.error("Failed to start proctoring monitoring:", error);
      toast.error("Failed to start proctoring monitoring");
    }
  };

  const handleViolation = (violation: ProctoringViolation) => {
    setViolations((prev) => [violation, ...prev.slice(0, 9)]); // Keep last 10 violations

    // Only trigger popup through parent component, no toast notifications
    onViolation?.(violation);
  };

  const handleStatusUpdate = (newStatus: ProctoringStatus) => {
    setStatus(newStatus);
    onStatusUpdate?.(newStatus);
  };

  const requestFullscreen = async () => {
    const success = await faceDetectionService.requestFullscreen();
    if (success) {
      toast.success("Entered fullscreen mode");
    } else {
      toast.error("Failed to enter fullscreen mode");
    }
  };

  const getStatusIcon = (value: number, threshold: number) => {
    if (value >= threshold) {
      return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
    } else {
      return (
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      );
    }
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case "fullscreen_exited":
        return <Monitor className="w-4 h-4" />;
      case "camera_level_low":
        return <Camera className="w-4 h-4" />;
      case "microphone_level_low":
        return <Mic className="w-4 h-4" />;
      case "speaker_level_low":
        return <Volume2 className="w-4 h-4" />;
      case "face_not_visible":
        return <EyeOff className="w-4 h-4" />;
      case "mobile_phone_detected":
      case "unauthorized_object_detected":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getViolationColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "medium":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "critical":
        return "text-red-700 bg-red-50 border-red-300";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  if (!isActive || !status) {
    return null;
  }

  return (
    <div className="fixed hidden top-0 left-4 right-4 fle items-center justify-center">
      {/* Main Status Indicator */}
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-b-2xl shadow p-3 pt-2 min-w-[280px] w-max">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Proctoring Active
            </span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showDetails ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Status */}
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex items-center gap-1">
            {getStatusIcon(status.cameraLevel, settings.min_camera_level)}
            <Camera className="w-3 h-3" />
            <span className="text-gray-600 dark:text-gray-400">Camera</span>
          </div>
          <div className="flex items-center gap-1">
            {getStatusIcon(
              status.microphoneLevel,
              settings.min_microphone_level
            )}
            <Mic className="w-3 h-3" />
            <span className="text-gray-600 dark:text-gray-400">Mic</span>
          </div>
          <div className="flex items-center gap-1">
            {settings.require_fullscreen ? (
              isFullscreen ? (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              ) : (
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              )
            ) : (
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            )}
            <Monitor className="w-3 h-3" />
            <span className="text-gray-600 dark:text-gray-400">Screen</span>
          </div>
          <div className="flex items-center gap-1">
            {status.faceDetected ? (
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            ) : (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            )}
            <Eye className="w-3 h-3" />
            <span className="text-gray-600 dark:text-gray-400">Face</span>
          </div>
        </div>

        {/* Fullscreen Warning */}
        {settings.require_fullscreen && !isFullscreen && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-xs text-red-700 dark:text-red-300">
                Fullscreen required
              </span>
              <button
                onClick={requestFullscreen}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Enter Fullscreen
              </button>
            </div>
          </div>
        )}

        {/* Recent Violations */}
        {showDetails && violations.length > 0 && (
          <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="text-xs font-medium text-gray-900 dark:text-white mb-2">
              Recent Alerts ({violations.length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {violations.slice(0, 5).map((violation, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded-md border text-xs ${getViolationColor(
                    violation.severity
                  )}`}
                >
                  {getViolationIcon(violation.type)}
                  <span className="flex-1 truncate">{violation.message}</span>
                  <span className="text-xs opacity-75">
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProctoringMonitorComponent;
