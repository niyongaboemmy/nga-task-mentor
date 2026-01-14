import faceDetectionService, {
  type ProctoringDetectionResult,
} from "../utils/faceDetection";
import axios from "../utils/axiosConfig";

export interface ProctoringSettings {
  require_fullscreen: boolean;
  min_camera_level: number;
  min_microphone_level: number;
  min_speaker_level: number;
  enable_face_detection: boolean;
  enable_object_detection: boolean;
  object_detection_sensitivity: number;
  face_detection_sensitivity: number;
}

export interface ProctoringViolation {
  type:
    | "fullscreen_exited"
    | "camera_level_low"
    | "microphone_level_low"
    | "speaker_level_low"
    | "face_not_visible"
    | "mobile_phone_detected"
    | "unauthorized_object_detected"
    | "looking_away"
    | "head_turned"
    | "low_attention"
    | "suspicious_behavior";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  details?: any;
}

export interface ProctoringMonitorConfig {
  sessionToken: string;
  quizId: string;
  settings: ProctoringSettings;
  videoElement: HTMLVideoElement;
  stream: MediaStream;
  onViolation: (violation: ProctoringViolation) => void;
  onStatusUpdate: (status: ProctoringStatus) => void;
}

export interface ProctoringStatus {
  isFullscreen: boolean;
  cameraLevel: number;
  microphoneLevel: number;
  speakerLevel: number;
  faceDetected: boolean;
  faceCount: number;
  objectsDetected: string[];
  gazeDirection?: "center" | "left" | "right" | "up" | "down" | "away";
  headPose?: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  lookingAway: boolean;
  lookingAwayDuration: number;
  attentionScore: number;
  lastCheck: Date;
  violations: ProctoringViolation[];
}

class ProctoringMonitor {
  private config: ProctoringMonitorConfig | null = null;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private status!: ProctoringStatus;
  private isMonitoring = false;
  private socket: any = null;
  private sessionId: string | null = null;

  constructor() {
    this.resetStatus();
  }

  private resetStatus(): void {
    this.status = {
      isFullscreen: false,
      cameraLevel: 0,
      microphoneLevel: 0,
      speakerLevel: 50,
      faceDetected: false,
      faceCount: 0,
      objectsDetected: [],
      gazeDirection: "center",
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      lookingAway: false,
      lookingAwayDuration: 0,
      attentionScore: 100,
      lastCheck: new Date(),
      violations: [],
    };
  }

  /**
   * Start monitoring with the given configuration
   */
  async startMonitoring(config: ProctoringMonitorConfig): Promise<void> {
    // Check if we're already monitoring a different session
    if (this.isMonitoring && this.sessionId !== config.sessionToken) {
      console.log("Switching to new proctoring session:", config.sessionToken);
      await this.stopMonitoring();
    } else if (this.isMonitoring) {
      console.log("Already monitoring session:", config.sessionToken);
      return;
    }

    this.sessionId = config.sessionToken;
    this.config = config;
    this.isMonitoring = true;
    this.resetStatus();

    try {
      // Load face detection models
      await faceDetectionService.loadModels();

      // Initialize socket connection for real-time notifications
      await this.initializeSocket();

      // Start monitoring loop
      this.startMonitoringLoop();

      // Set up event listeners
      this.setupEventListeners();

      console.log("Proctoring monitoring started");
    } catch (error) {
      console.error("Error starting proctoring monitoring:", error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    this.sessionId = null;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.removeEventListeners();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    console.log("Proctoring monitoring stopped");
  }

  /**
   * Initialize socket connection for real-time notifications
   */
  private async initializeSocket(): Promise<void> {
    try {
      const { io } = await import("socket.io-client");
      this.socket = io("http://localhost:5002", {
        transports: ["websocket", "polling"],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect", () => {
        console.log("Proctoring monitor connected to socket server");
        if (this.config) {
          this.socket.emit("join-proctoring-session", {
            sessionToken: this.config.sessionToken,
            role: "monitor",
          });
        }
      });

      this.socket.on("connect_error", (error: any) => {
        console.error("Proctoring monitor socket connection error:", error);
      });

      this.socket.on("disconnect", (reason: any) => {
        console.log(
          "Proctoring monitor disconnected from socket server:",
          reason
        );
      });

      this.socket.on("reconnect", (attemptNumber: any) => {
        console.log(
          "Proctoring monitor reconnected to socket server after",
          attemptNumber,
          "attempts"
        );
      });

      this.socket.on("reconnect_error", (error: any) => {
        console.error("Proctoring monitor failed to reconnect:", error);
      });
    } catch (error) {
      console.error("Error initializing socket connection:", error);
      // Don't throw here - monitoring can still work without socket
    }
  }

  /**
   * Start the monitoring loop
   */
  private startMonitoringLoop(): void {
    // Check every 2 seconds
    this.monitoringInterval = setInterval(async () => {
      if (!this.isMonitoring || !this.config) return;

      try {
        await this.performMonitoringCheck();
      } catch (error) {
        console.error("Error in monitoring check:", error);
      }
    }, 2000);
  }

  /**
   * Perform a complete monitoring check
   */
  private async performMonitoringCheck(): Promise<void> {
    if (!this.config) return;

    const violations: ProctoringViolation[] = [];

    // Check fullscreen status
    const isFullscreen = faceDetectionService.checkFullscreenStatus();
    this.status.isFullscreen = isFullscreen;

    if (this.config.settings.require_fullscreen && !isFullscreen) {
      violations.push({
        type: "fullscreen_exited",
        severity: "high",
        message: "Student exited fullscreen mode",
        timestamp: new Date(),
        details: { required: true, current: false },
      });
    }

    // Check media levels
    const mediaLevels = await faceDetectionService.checkMediaLevels(
      this.config.stream
    );
    this.status.cameraLevel = mediaLevels.cameraLevel;
    this.status.microphoneLevel = mediaLevels.microphoneLevel;
    this.status.speakerLevel = mediaLevels.speakerLevel;

    if (mediaLevels.cameraLevel < this.config.settings.min_camera_level) {
      violations.push({
        type: "camera_level_low",
        severity: "medium",
        message: `Camera activity below minimum threshold (${mediaLevels.cameraLevel}% < ${this.config.settings.min_camera_level}%)`,
        timestamp: new Date(),
        details: {
          current: mediaLevels.cameraLevel,
          required: this.config.settings.min_camera_level,
        },
      });
    }

    if (
      mediaLevels.microphoneLevel < this.config.settings.min_microphone_level
    ) {
      violations.push({
        type: "microphone_level_low",
        severity: "medium",
        message: `Microphone activity below minimum threshold (${mediaLevels.microphoneLevel}% < ${this.config.settings.min_microphone_level}%)`,
        timestamp: new Date(),
        details: {
          current: mediaLevels.microphoneLevel,
          required: this.config.settings.min_microphone_level,
        },
      });
    }

    if (mediaLevels.speakerLevel < this.config.settings.min_speaker_level) {
      violations.push({
        type: "speaker_level_low",
        severity: "low",
        message: `Speaker volume below minimum threshold (${mediaLevels.speakerLevel}% < ${this.config.settings.min_speaker_level}%)`,
        timestamp: new Date(),
        details: {
          current: mediaLevels.speakerLevel,
          required: this.config.settings.min_speaker_level,
        },
      });
    }

    // Check face and object detection
    if (
      this.config.settings.enable_face_detection ||
      this.config.settings.enable_object_detection
    ) {
      const detectionResult: ProctoringDetectionResult =
        await faceDetectionService.checkProctoringCompliance(
          this.config.videoElement,
          {
            enableFaceDetection: this.config.settings.enable_face_detection,
            faceDetectionSensitivity:
              this.config.settings.face_detection_sensitivity,
            enableObjectDetection: this.config.settings.enable_object_detection,
            objectDetectionSensitivity:
              this.config.settings.object_detection_sensitivity,
          }
        );

      this.status.faceDetected = detectionResult.faceDetected;
      this.status.faceCount = detectionResult.faceCount;
      this.status.objectsDetected = detectionResult.objectsDetected;
      this.status.gazeDirection = detectionResult.gazeDirection;
      this.status.headPose = detectionResult.headPose;
      this.status.lookingAway = detectionResult.lookingAway;
      this.status.lookingAwayDuration = detectionResult.lookingAwayDuration;
      this.status.attentionScore = detectionResult.attentionScore;

      // Process detection warnings
      detectionResult.warnings.forEach((warning) => {
        let violationType: ProctoringViolation["type"];
        let severity: ProctoringViolation["severity"] = "medium";

        if (warning.includes("No face detected")) {
          violationType = "face_not_visible";
          severity = "high";
        } else if (warning.includes("Multiple faces detected")) {
          violationType = "face_not_visible"; // Could be extended to multiple_faces
          severity = "high";
        } else if (warning.includes("Mobile phone detected")) {
          violationType = "mobile_phone_detected";
          severity = "critical";
        } else if (warning.includes("Unauthorized materials")) {
          violationType = "unauthorized_object_detected";
          severity = "critical";
        } else if (warning.includes("Extended looking away detected")) {
          violationType = "looking_away";
          severity = "high";
        } else if (warning.includes("Gaze not centered")) {
          violationType = "looking_away";
          severity = "medium";
        } else if (warning.includes("Head turned significantly")) {
          violationType = "head_turned";
          severity = "medium";
        } else if (warning.includes("Low attention score")) {
          violationType = "low_attention";
          severity = "low";
        } else if (
          warning.includes("Frequent looking away detected") ||
          warning.includes("Extended periods of inattention detected") ||
          warning.includes("Declining attention trend detected")
        ) {
          violationType = "suspicious_behavior";
          severity = "high";
        } else {
          violationType = "face_not_visible"; // Default
        }

        violations.push({
          type: violationType,
          severity,
          message: warning,
          timestamp: new Date(),
          details: detectionResult,
        });
      });
    }

    // Update status
    this.status.lastCheck = new Date();
    this.status.violations = [...this.status.violations, ...violations];

    // Keep only recent violations (last 50)
    if (this.status.violations.length > 50) {
      this.status.violations = this.status.violations.slice(-50);
    }

    // Notify about violations
    violations.forEach((violation) => {
      this.config?.onViolation(violation);
      this.reportViolation(violation);
    });

    // Notify status update
    this.config?.onStatusUpdate({ ...this.status });
  }

  /**
   * Report violation to server and instructors
   */
  private async reportViolation(violation: ProctoringViolation): Promise<void> {
    if (!this.config) return;

    try {
      // Send to server
      await axios.post("/api/proctoring/events", {
        session_token: this.config.sessionToken,
        event_type: violation.type,
        severity: violation.severity,
        description: violation.message,
        metadata: JSON.stringify({
          ...violation.details,
          timestamp: violation.timestamp.toISOString(),
        }),
      });

      // Send real-time notification via socket
      if (this.socket && this.socket.connected) {
        this.socket.emit("proctoring-violation", {
          sessionToken: this.config.sessionToken,
          quizId: this.config.quizId,
          violation,
        });
      }
    } catch (error) {
      console.error("Error reporting violation:", error);
    }
  }

  /**
   * Set up event listeners for additional monitoring
   */
  private setupEventListeners(): void {
    // Listen for fullscreen changes
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      this.handleFullscreenChange
    );
    document.addEventListener(
      "mozfullscreenchange",
      this.handleFullscreenChange
    );
    document.addEventListener(
      "MSFullscreenChange",
      this.handleFullscreenChange
    );

    // Listen for visibility changes (tab switching)
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Listen for window blur/focus
    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("focus", this.handleWindowFocus);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    document.removeEventListener(
      "fullscreenchange",
      this.handleFullscreenChange
    );
    document.removeEventListener(
      "webkitfullscreenchange",
      this.handleFullscreenChange
    );
    document.removeEventListener(
      "mozfullscreenchange",
      this.handleFullscreenChange
    );
    document.removeEventListener(
      "MSFullscreenChange",
      this.handleFullscreenChange
    );

    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );

    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("focus", this.handleWindowFocus);
  }

  /**
   * Handle fullscreen change events
   */
  private handleFullscreenChange = (): void => {
    const isFullscreen = faceDetectionService.checkFullscreenStatus();
    this.status.isFullscreen = isFullscreen;

    if (this.config?.settings.require_fullscreen && !isFullscreen) {
      const violation: ProctoringViolation = {
        type: "fullscreen_exited",
        severity: "high",
        message: "Student exited fullscreen mode",
        timestamp: new Date(),
        details: { required: true, current: false },
      };

      this.config.onViolation(violation);
      this.reportViolation(violation);
    }
  };

  /**
   * Handle visibility change (tab switching)
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // Tab switched away - this could be flagged
      console.log("Tab visibility changed - student may have switched tabs");
    }
  };

  /**
   * Handle window blur
   */
  private handleWindowBlur = (): void => {
    console.log("Window lost focus - potential tab switching");
  };

  /**
   * Handle window focus
   */
  private handleWindowFocus = (): void => {
    console.log("Window regained focus");
  };

  /**
   * Get current status
   */
  getStatus(): ProctoringStatus {
    return { ...this.status };
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}

// Export singleton instance
export const proctoringMonitor = new ProctoringMonitor();
export default proctoringMonitor;
