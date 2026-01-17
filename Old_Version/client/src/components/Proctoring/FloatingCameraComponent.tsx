import React, { useState, useRef, useEffect } from "react";
import { AlertTriangle, Camera, Eye, EyeOff, Minimize2 } from "lucide-react";
import faceDetectionService, {
  type ProctoringDetectionResult,
} from "../../utils/faceDetection";

interface FloatingCameraComponentProps {
  videoElement: HTMLVideoElement;
  stream: MediaStream;
  settings: {
    enableFaceDetection: boolean;
    faceDetectionSensitivity: number;
    enableObjectDetection: boolean;
    objectDetectionSensitivity: number;
  };
  onViolation?: (violation: any) => void;
  onViolationResolved?: () => void;
}

const FloatingCameraComponent: React.FC<FloatingCameraComponentProps> = ({
  videoElement,
  stream: _stream,
  settings,
  onViolation,
  onViolationResolved,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previousWarnings, setPreviousWarnings] = useState<string[]>([]);
  const [detectionStatus, setDetectionStatus] = useState({
    faceCount: 0,
    confidence: 0,
    isDetecting: false,
  });
  const [smoothDetectionStatus, setSmoothDetectionStatus] = useState({
    faceCount: 0,
    confidence: 0,
    isDetecting: false,
  });
  const [warningDebounceTimer, setWarningDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [position, setPosition] = useState({
    x: 20,
    y: window.innerHeight - 280,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Start continuous monitoring when component mounts
  useEffect(() => {
    startMonitoring();
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (warningDebounceTimer) {
        clearTimeout(warningDebounceTimer);
      }
    };
  }, [videoElement, settings]);

  // Handle video element setup and playback
  useEffect(() => {
    const setupVideo = async () => {
      const videoEl = videoRef.current;
      if (!videoEl || !videoElement || !videoElement.srcObject) return;

      try {
        // Stop any existing playback first
        if (!videoEl.paused) {
          videoEl.pause();
        }

        // Clear any existing source
        videoEl.srcObject = null;

        // Set new source
        videoEl.srcObject = videoElement.srcObject;

        // Wait for the video to be ready before playing
        await new Promise<void>((resolve) => {
          const onCanPlay = () => {
            videoEl.removeEventListener("canplay", onCanPlay);
            resolve();
          };
          videoEl.addEventListener("canplay", onCanPlay);

          // Fallback timeout in case canplay never fires
          setTimeout(resolve, 1000);
        });

        // Now try to play
        await videoEl.play();
      } catch (error) {
        // Handle AbortError specifically
        if (error instanceof DOMException && error.name === "AbortError") {
          console.warn(
            "Video play was aborted, likely due to new load request. This is normal."
          );
        } else {
          console.error("Error playing video in floating camera:", error);
        }
      }
    };

    setupVideo();
  }, [videoElement]);

  // Smooth detection status updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setSmoothDetectionStatus(detectionStatus);
    }, 500); // 500ms delay for smooth transitions

    return () => clearTimeout(timer);
  }, [detectionStatus]);

  // Debounced warning updates
  useEffect(() => {
    if (warningDebounceTimer) {
      clearTimeout(warningDebounceTimer);
    }

    const timer = setTimeout(() => {
      // Check if any critical violations were resolved
      const criticalWarnings = [
        "No face detected",
        "Multiple faces detected",
        "Mobile phone detected",
        "Unauthorized materials",
      ];

      const hadCriticalWarnings = previousWarnings.some((w) =>
        criticalWarnings.some((cw) => w.includes(cw))
      );

      const hasCriticalWarnings = warnings.some((w) =>
        criticalWarnings.some((cw) => w.includes(cw))
      );

      // If we had critical warnings but now don't, call resolved
      if (hadCriticalWarnings && !hasCriticalWarnings && onViolationResolved) {
        console.log(
          "Critical violations resolved - calling violation resolved"
        );
        onViolationResolved();
      }

      // Update previous warnings
      setPreviousWarnings(warnings);
    }, 1000); // 1000ms debounce for warning changes

    setWarningDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [warnings, previousWarnings, onViolationResolved]);

  const startMonitoring = async () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    try {
      await faceDetectionService.loadModels();
    } catch (error) {
      console.error("Error loading face detection models:", error);
      return;
    }

    setDetectionStatus((prev) => ({ ...prev, isDetecting: true }));

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoElement) return;

      try {
        const result: ProctoringDetectionResult =
          await faceDetectionService.checkProctoringCompliance(videoElement, {
            enableFaceDetection: settings.enableFaceDetection,
            faceDetectionSensitivity: settings.faceDetectionSensitivity,
            enableObjectDetection: settings.enableObjectDetection,
            objectDetectionSensitivity: settings.objectDetectionSensitivity,
          });

        setDetectionStatus({
          faceCount: result.faceCount,
          confidence: result.faceConfidence,
          isDetecting: true,
        });

        // Update warnings
        const newWarnings = result.warnings;
        setWarnings(newWarnings);

        // Get face details for drawing borders
        if (settings.enableFaceDetection) {
          try {
            const faceResult = await faceDetectionService.detectFaces(
              videoElement,
              {
                minConfidence: settings.faceDetectionSensitivity / 100,
              }
            );
            // Draw face borders on overlay canvas
            drawFaceBorders(faceResult.faceDetails || []);
          } catch (error) {
            console.error("Error getting face details for borders:", error);
          }
        }

        // Report violations if callback provided
        if (onViolation && newWarnings.length > 0) {
          newWarnings.forEach((warning) => {
            let severity = "medium";
            if (
              warning.includes("No face detected") ||
              warning.includes("Multiple faces")
            ) {
              severity = "high";
            } else if (
              warning.includes("Mobile phone") ||
              warning.includes("Unauthorized")
            ) {
              severity = "critical";
            }

            onViolation({
              type: "face_detection_violation",
              severity,
              message: warning,
              timestamp: new Date(),
              details: result,
            });
          });
        }
      } catch (error) {
        console.error("Error during monitoring:", error);
        setDetectionStatus((prev) => ({ ...prev, isDetecting: false }));
      }
    }, 1000); // Check every second
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMinimized) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Keep within viewport bounds (square component)
    const componentSize = 200;
    const maxX = window.innerWidth - componentSize;
    const maxY = window.innerHeight - componentSize;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  const getWarningColor = (warning: string) => {
    if (
      warning.includes("No face detected") ||
      warning.includes("Multiple faces")
    ) {
      return "border-red-500 bg-red-50 dark:bg-red-900/20";
    } else if (
      warning.includes("Mobile phone") ||
      warning.includes("Unauthorized")
    ) {
      return "border-red-600 bg-red-100 dark:bg-red-900/30";
    } else {
      return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
    }
  };

  const getWarningIcon = (warning: string) => {
    if (warning.includes("No face detected")) {
      return <EyeOff className="w-4 h-4 text-red-600" />;
    } else if (warning.includes("Multiple faces")) {
      return <Eye className="w-4 h-4 text-red-600" />;
    } else if (
      warning.includes("Mobile phone") ||
      warning.includes("Unauthorized")
    ) {
      return <AlertTriangle className="w-4 h-4 text-red-700" />;
    } else {
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    }
  };

  const drawFaceBorders = (faceDetails: any[]) => {
    const video = videoElement;
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

        // Draw static green square
        ctx.strokeStyle = "rgba(16, 185, 129, 0.9)"; // Green with fixed opacity
        ctx.lineWidth = 3; // Fixed line width
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
          (face.score || face.confidence || 0) * 100
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

  if (isMinimized) {
    return (
      <div
        ref={containerRef}
        className="fixed z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg cursor-pointer w-12 h-12 flex items-center justify-center"
        style={{ left: position.x, top: position.y }}
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex flex-col items-center gap-1">
          <Camera className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          {warnings.length > 0 && (
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: "200px",
        height: "200px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            Camera Monitor
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Video Feed */}
      <div className="relative w-full h-32">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover rounded-t-lg"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-t-lg"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Detection Status Overlay */}
        <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded transition-all duration-300 ease-in-out">
          <div className="flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                smoothDetectionStatus.isDetecting
                  ? "bg-green-400"
                  : "bg-gray-400"
              }`}
            ></div>
            <span className="transition-all duration-300">
              {smoothDetectionStatus.faceCount} face
              {smoothDetectionStatus.faceCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Confidence Overlay */}
        {smoothDetectionStatus.confidence > 0 && (
          <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded transition-all duration-300 ease-in-out">
            {Math.round(smoothDetectionStatus.confidence)}%
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 max-h-20 overflow-y-auto transition-all duration-300 ease-in-out">
          {warnings.map((warning, index) => (
            <div
              key={`${warning}-${index}`}
              className={`flex items-center gap-2 p-2 rounded-md border text-xs mb-1 transition-all duration-300 ease-in-out ${getWarningColor(
                warning
              )}`}
            >
              {getWarningIcon(warning)}
              <span className="flex-1 text-gray-800 dark:text-gray-200">
                {warning}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status Footer */}
      <div className="p-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                smoothDetectionStatus.isDetecting
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
            ></div>
            <span className="text-gray-600 dark:text-gray-400 transition-all duration-300">
              {smoothDetectionStatus.isDetecting ? "Monitoring" : "Paused"}
            </span>
          </div>
          <div className="text-gray-500 dark:text-gray-500 transition-all duration-300">
            {smoothDetectionStatus.faceCount === 1
              ? "✓ In Frame"
              : "⚠ Adjust Position"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingCameraComponent;
