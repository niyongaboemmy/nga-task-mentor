import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
// Fallback import for face-api.js
import * as faceapi from "face-api.js";

export interface FaceDetectionResult {
  hasFace: boolean;
  faceCount: number;
  faceDetails?: any[];
  confidence?: number;
}

export interface ProctoringDetectionResult {
  faceDetected: boolean;
  faceCount: number;
  faceConfidence: number;
  objectsDetected: string[];
  warnings: string[];
  gazeDirection?: "center" | "left" | "right" | "up" | "down" | "away";
  headPose?: {
    yaw: number; // left-right rotation
    pitch: number; // up-down rotation
    roll: number; // tilt
  };
  lookingAway: boolean;
  lookingAwayDuration: number; // in seconds
  attentionScore: number; // 0-100, higher is better attention
}

class FaceDetectionService {
  private faceDetector: FaceDetector | null = null;
  private objectDetector: cocoSsd.ObjectDetection | null = null;
  private modelsLoaded = false;
  private modelLoadingPromise: Promise<void> | null = null;
  private audioContext: AudioContext | null = null;
  private useMediaPipe = true; // Try MediaPipe first, fallback to face-api.js
  private faceApiModelsLoaded = false;
  private lookingAwayStartTime: number | null = null;
  private attentionHistory: number[] = [];
  private lookingAwayEvents: Array<{ start: number; duration: number }> = [];

  /**
   * Load MediaPipe face detection and TensorFlow.js COCO-SSD models
   */
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) {
      return;
    }

    if (this.modelLoadingPromise) {
      return this.modelLoadingPromise;
    }

    this.modelLoadingPromise = this.loadModelsInternal();
    return this.modelLoadingPromise;
  }

  private async loadModelsInternal(): Promise<void> {
    try {
      console.log("Starting model loading process...");

      // Set TensorFlow.js backend
      console.log("Setting TensorFlow.js backend to WebGL...");
      await tf.setBackend("webgl");
      await tf.ready();
      console.log("TensorFlow.js backend ready");

      // Load COCO-SSD model for object detection
      console.log("Loading COCO-SSD model...");
      this.objectDetector = await cocoSsd.load();
      console.log("COCO-SSD object detection model loaded successfully");

      // Try to load MediaPipe Tasks Vision Face Detector
      let mediaPipeLoaded = false;
      try {
        console.log(
          "Attempting to load MediaPipe Tasks Vision Face Detector..."
        );
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        console.log("MediaPipe vision resolver loaded");

        this.faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
          minSuppressionThreshold: 0.3,
        });

        this.useMediaPipe = true;
        mediaPipeLoaded = true;
        console.log("MediaPipe Tasks Vision Face Detector loaded successfully");
      } catch (mediaPipeError) {
        console.warn(
          "MediaPipe Tasks Vision failed, falling back to face-api.js:",
          mediaPipeError
        );
        this.useMediaPipe = false;
      }

      // Load face-api.js models (either as primary or fallback)
      if (!mediaPipeLoaded) {
        console.log("Loading face-api.js models...");
        const MODEL_URL =
          "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/";

        try {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          ]);

          this.faceApiModelsLoaded = true;
          console.log("face-api.js models loaded successfully");
        } catch (faceApiError) {
          console.error("Failed to load face-api.js models:", faceApiError);
          throw new Error("Both MediaPipe and face-api.js failed to load");
        }
      }

      this.modelsLoaded = true;
      console.log(
        `Face detection models loaded successfully. Using: ${
          this.useMediaPipe ? "MediaPipe" : "face-api.js"
        }`
      );
    } catch (error) {
      console.error("Error loading detection models:", error);
      this.modelsLoaded = false;
      throw error;
    }
  }

  /**
   * Detect faces in a video element using MediaPipe or face-api.js fallback
   */
  async detectFaces(
    videoElement: HTMLVideoElement,
    options?: {
      minConfidence?: number;
      maxResults?: number;
    }
  ): Promise<FaceDetectionResult> {
    // Ensure models are loaded
    if (!this.modelsLoaded) {
      await this.loadModels();
    }

    const { minConfidence = 0.5 } = options || {};

    console.log(
      "Video element dimensions:",
      videoElement.videoWidth,
      "x",
      videoElement.videoHeight
    );
    console.log("Video ready state:", videoElement.readyState);

    // Check if video is ready
    if (videoElement.readyState < 2) {
      console.warn("Video element not ready for detection");
      return {
        hasFace: false,
        faceCount: 0,
      };
    }

    // Try MediaPipe Tasks Vision first (if loaded)
    if (this.useMediaPipe && this.faceDetector) {
      try {
        console.log("Trying MediaPipe Tasks Vision detection...");

        // Detect faces directly (synchronous call)
        const results = this.faceDetector.detectForVideo(
          videoElement,
          performance.now()
        );

        console.log("MediaPipe Tasks Vision results:", results);

        // Filter detections by confidence
        const validDetections = (results.detections || [])
          .filter(
            (detection: any) =>
              (detection.categories?.[0]?.score || 0) >= minConfidence
          )
          .map((detection: any) => ({
            ...detection,
            score: detection.categories?.[0]?.score || 0,
            boundingBox: detection.boundingBox,
          }));

        console.log("Valid MediaPipe detections:", validDetections.length);

        if (validDetections.length > 0) {
          return {
            hasFace: true,
            faceCount: validDetections.length,
            faceDetails: validDetections,
            confidence: validDetections[0].score,
          };
        }
      } catch (mediaPipeError) {
        console.warn("MediaPipe Tasks Vision failed:", mediaPipeError);
        this.useMediaPipe = false;
      }
    }

    // Try face-api.js as fallback or primary method
    if (this.faceApiModelsLoaded) {
      try {
        console.log("Trying face-api.js detection with landmarks...");
        const detections = await faceapi
          .detectAllFaces(
            videoElement,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 512,
              scoreThreshold: minConfidence - 0.2, // Lower threshold for detection
            })
          )
          .withFaceLandmarks();

        console.log("face-api.js detections with landmarks:", detections);

        // Filter detections by confidence
        const validDetections = detections.filter(
          (detection) => detection.detection.score >= minConfidence
        );

        console.log(
          "Valid detections after filtering:",
          validDetections.length
        );

        return {
          hasFace: validDetections.length > 0,
          faceCount: validDetections.length,
          faceDetails: validDetections,
          confidence:
            validDetections.length > 0 ? validDetections[0].detection.score : 0,
        };
      } catch (faceApiError) {
        console.error("face-api.js face detection failed:", faceApiError);
      }
    }

    // If all methods fail, return empty result
    console.error("All face detection methods failed");
    return {
      hasFace: false,
      faceCount: 0,
    };
  }

  /**
   * Analyze gaze direction based on eye landmarks
   */
  private analyzeGazeDirection(
    landmarks: faceapi.FaceLandmarks68
  ): "center" | "left" | "right" | "up" | "down" | "away" {
    try {
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      if (!leftEye || !rightEye || leftEye.length < 6 || rightEye.length < 6) {
        return "away";
      }

      // Get eye corner landmarks for better gaze estimation
      // Left eye: [0] outer corner, [3] inner corner
      // Right eye: [0] inner corner, [3] outer corner
      const leftEyeOuter = leftEye[0];
      const leftEyeInner = leftEye[3];
      const rightEyeInner = rightEye[0];
      const rightEyeOuter = rightEye[3];

      // Calculate eye centers
      const leftEyeCenter = {
        x: (leftEyeOuter.x + leftEyeInner.x) / 2,
        y: (leftEye[1].y + leftEye[5].y) / 2, // top and bottom eyelids
      };

      const rightEyeCenter = {
        x: (rightEyeInner.x + rightEyeOuter.x) / 2,
        y: (rightEye[1].y + rightEye[5].y) / 2,
      };

      // Calculate the midpoint between eyes
      const eyeMidpoint = {
        x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
        y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
      };

      // Get nose tip for reference
      const nose = landmarks.getNose();
      const noseTip = nose && nose.length > 0 ? nose[0] : null;

      // Calculate horizontal gaze based on eye positions relative to face center
      const faceCenterX = noseTip ? noseTip.x : eyeMidpoint.x;
      const eyeSeparation = Math.abs(rightEyeCenter.x - leftEyeCenter.x);

      // Horizontal gaze: how far eyes are from face center
      const horizontalGaze = (eyeMidpoint.x - faceCenterX) / eyeSeparation;

      // Vertical gaze: based on eye position relative to nose
      const verticalGaze = noseTip
        ? (eyeMidpoint.y - noseTip.y) / eyeSeparation
        : 0;

      // Define thresholds (normalized)
      const horizontalThreshold = 0.15; // 15% of eye separation
      const verticalThreshold = 0.1; // 10% of eye separation

      console.log(
        `Gaze analysis - Horizontal: ${horizontalGaze.toFixed(
          3
        )}, Vertical: ${verticalGaze.toFixed(3)}`
      );

      // Determine gaze direction
      if (Math.abs(horizontalGaze) > horizontalThreshold) {
        if (Math.abs(verticalGaze) > verticalThreshold) {
          // Diagonal gaze
          if (horizontalGaze > 0 && verticalGaze > 0) return "right"; // down-right
          if (horizontalGaze > 0 && verticalGaze < 0) return "right"; // up-right
          if (horizontalGaze < 0 && verticalGaze > 0) return "left"; // down-left
          if (horizontalGaze < 0 && verticalGaze < 0) return "left"; // up-left
        } else {
          // Pure horizontal
          return horizontalGaze > 0 ? "right" : "left";
        }
      } else if (Math.abs(verticalGaze) > verticalThreshold) {
        return verticalGaze > 0 ? "down" : "up";
      }

      return "center";
    } catch (error) {
      console.error("Error analyzing gaze direction:", error);
      return "away";
    }
  }

  /**
   * Analyze head pose using facial landmarks
   */
  private analyzeHeadPose(landmarks: faceapi.FaceLandmarks68): {
    yaw: number;
    pitch: number;
    roll: number;
  } {
    try {
      const nose = landmarks.getNose();
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const jawOutline = landmarks.getJawOutline();

      if (
        !nose ||
        !leftEye ||
        !rightEye ||
        !jawOutline ||
        nose.length < 1 ||
        leftEye.length < 6 ||
        rightEye.length < 6 ||
        jawOutline.length < 17
      ) {
        return { yaw: 0, pitch: 0, roll: 0 };
      }

      // Get key facial landmarks
      const noseTip = nose[0];
      const leftEyeOuter = leftEye[0];
      const leftEyeInner = leftEye[3];
      const rightEyeInner = rightEye[0];
      const rightEyeOuter = rightEye[3];
      const chin = jawOutline[8]; // Center of jaw

      // Calculate eye centers
      const leftEyeCenter = {
        x: (leftEyeOuter.x + leftEyeInner.x) / 2,
        y: (leftEye[1].y + leftEye[5].y) / 2,
      };
      const rightEyeCenter = {
        x: (rightEyeInner.x + rightEyeOuter.x) / 2,
        y: (rightEye[1].y + rightEye[5].y) / 2,
      };

      // Calculate eye midpoint
      const eyeMidpoint = {
        x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
        y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
      };

      // Calculate distances for normalization
      const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
      const faceHeight = Math.abs(chin.y - eyeMidpoint.y);

      // Yaw (left-right rotation): based on nose position relative to face center
      const faceCenterX = eyeMidpoint.x;
      const yaw = (noseTip.x - faceCenterX) / eyeDistance;

      // Pitch (up-down rotation): based on nose position relative to eyes and chin
      const expectedNoseY = eyeMidpoint.y + faceHeight * 0.3; // Nose should be below eyes
      const pitch = (noseTip.y - expectedNoseY) / faceHeight;

      // Roll (tilt): based on eye vertical alignment and jaw symmetry
      const eyeRoll =
        Math.atan2(
          rightEyeCenter.y - leftEyeCenter.y,
          rightEyeCenter.x - leftEyeCenter.x
        ) *
        (180 / Math.PI);

      // Jaw roll for additional validation
      const jawLeft = jawOutline[0];
      const jawRight = jawOutline[16];
      const jawRoll =
        Math.atan2(jawRight.y - jawLeft.y, jawRight.x - jawLeft.x) *
        (180 / Math.PI);

      // Combine eye and jaw roll for more accurate measurement
      const roll = (eyeRoll + jawRoll) / 2;

      console.log(
        `Head pose - Yaw: ${yaw.toFixed(3)}, Pitch: ${pitch.toFixed(
          3
        )}, Roll: ${roll.toFixed(1)}°`
      );

      return {
        yaw: Math.max(-1, Math.min(1, yaw)), // Normalize to -1 to 1
        pitch: Math.max(-1, Math.min(1, pitch)),
        roll: roll, // Keep in degrees
      };
    } catch (error) {
      console.error("Error analyzing head pose:", error);
      return { yaw: 0, pitch: 0, roll: 0 };
    }
  }

  /**
   * Calculate attention score based on gaze and head pose
   */
  private calculateAttentionScore(
    gazeDirection: string,
    headPose: { yaw: number; pitch: number; roll: number }
  ): number {
    let score = 100;

    // Penalize based on gaze direction
    if (gazeDirection !== "center") {
      score -= 30;
    }

    // Penalize based on head pose deviation
    const yawPenalty = Math.abs(headPose.yaw) * 40;
    const pitchPenalty = Math.abs(headPose.pitch) * 40;
    const rollPenalty = Math.abs(headPose.roll) * 0.5;

    score -= yawPenalty + pitchPenalty + rollPenalty;

    // Add to attention history for trend analysis
    this.attentionHistory.push(score);
    if (this.attentionHistory.length > 10) {
      this.attentionHistory.shift(); // Keep only last 10 readings
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Track looking away duration with improved logic
   */
  private updateLookingAwayTracking(
    gazeDirection: string,
    headPose: { yaw: number; pitch: number; roll: number }
  ): { lookingAway: boolean; duration: number } {
    // Define thresholds for looking away
    const yawThreshold = 0.25; // 25% of normalized range
    const pitchThreshold = 0.2; // 20% of normalized range
    const rollThreshold = 15; // 15 degrees

    // Determine if currently looking away
    const isGazeAway = gazeDirection !== "center" && gazeDirection !== "away";
    const isHeadTurned =
      Math.abs(headPose.yaw) > yawThreshold ||
      Math.abs(headPose.pitch) > pitchThreshold ||
      Math.abs(headPose.roll) > rollThreshold;

    const isLookingAway = isGazeAway || isHeadTurned;

    const now = Date.now();

    if (isLookingAway) {
      if (this.lookingAwayStartTime === null) {
        this.lookingAwayStartTime = now;
        console.log("Started looking away tracking");
      }
      const duration = (now - this.lookingAwayStartTime) / 1000; // Convert to seconds
      console.log(`Looking away for ${duration.toFixed(1)} seconds`);
      return { lookingAway: true, duration };
    } else {
      // Record the completed looking away event
      if (this.lookingAwayStartTime !== null) {
        const duration = (now - this.lookingAwayStartTime) / 1000;
        if (duration >= 1) {
          // Only record events longer than 1 second
          this.lookingAwayEvents.push({
            start: this.lookingAwayStartTime,
            duration,
          });
          console.log(
            `Recorded looking away event: ${duration.toFixed(1)} seconds`
          );
        }
        // Keep only recent events (last 10 minutes)
        const tenMinutesAgo = now - 10 * 60 * 1000;
        this.lookingAwayEvents = this.lookingAwayEvents.filter(
          (event) => event.start > tenMinutesAgo
        );
      }
      this.lookingAwayStartTime = null;
      return { lookingAway: false, duration: 0 };
    }
  }

  /**
   * Detect suspicious behavior patterns
   */
  private detectSuspiciousBehavior(): string[] {
    const flags: string[] = [];

    // Check for frequent looking away (more than 5 times in last 10 minutes)
    if (this.lookingAwayEvents.length > 5) {
      flags.push("Frequent looking away detected");
    }

    // Check for long total looking away time (more than 2 minutes in last 10 minutes)
    const totalLookingAwayTime = this.lookingAwayEvents.reduce(
      (total, event) => total + event.duration,
      0
    );
    if (totalLookingAwayTime > 120) {
      // 2 minutes
      flags.push("Extended periods of inattention detected");
    }

    // Check for declining attention trend
    if (this.attentionHistory.length >= 5) {
      const recent = this.attentionHistory.slice(-5);
      const trend =
        recent.reduce((acc, score, i) => {
          if (i === 0) return acc;
          return acc + (score - recent[i - 1]);
        }, 0) /
        (recent.length - 1);

      if (trend < -10) {
        // Declining attention
        flags.push("Declining attention trend detected");
      }
    }

    return flags;
  }

  /**
   * Check if face is visible and detect potential issues
   */
  async checkProctoringCompliance(
    videoElement: HTMLVideoElement,
    settings: {
      enableFaceDetection: boolean;
      faceDetectionSensitivity: number;
      enableObjectDetection: boolean;
      objectDetectionSensitivity: number;
    }
  ): Promise<ProctoringDetectionResult> {
    const result: ProctoringDetectionResult = {
      faceDetected: false,
      faceCount: 0,
      faceConfidence: 0,
      objectsDetected: [],
      warnings: [],
      gazeDirection: "center",
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      lookingAway: false,
      lookingAwayDuration: 0,
      attentionScore: 100,
    };

    if (!settings.enableFaceDetection) {
      return result;
    }

    try {
      const faceResult = await this.detectFaces(videoElement, {
        minConfidence: settings.faceDetectionSensitivity / 100,
      });

      result.faceDetected = faceResult.hasFace;
      result.faceCount = faceResult.faceCount;
      result.faceConfidence = (faceResult.confidence || 0) * 100;

      // Perform behavioral analysis if face is detected
      if (
        faceResult.hasFace &&
        faceResult.faceCount === 1 &&
        faceResult.faceDetails &&
        faceResult.faceDetails.length > 0
      ) {
        const detection = faceResult.faceDetails[0];

        // Check if detection has landmarks (from face-api.js)
        if (
          detection.landmarks &&
          typeof detection.landmarks.getLeftEye === "function"
        ) {
          try {
            // Analyze gaze direction
            result.gazeDirection = this.analyzeGazeDirection(
              detection.landmarks
            );

            // Analyze head pose
            result.headPose = this.analyzeHeadPose(detection.landmarks);

            // Calculate attention score
            result.attentionScore = this.calculateAttentionScore(
              result.gazeDirection,
              result.headPose
            );

            // Track looking away
            const lookingAwayInfo = this.updateLookingAwayTracking(
              result.gazeDirection,
              result.headPose
            );
            result.lookingAway = lookingAwayInfo.lookingAway;
            result.lookingAwayDuration = lookingAwayInfo.duration;

            // Add behavioral warnings
            if (result.lookingAway) {
              if (result.lookingAwayDuration > 3) {
                result.warnings.push(
                  `Extended looking away detected (${result.lookingAwayDuration.toFixed(
                    1
                  )}s)`
                );
              } else if (result.gazeDirection !== "center") {
                result.warnings.push(
                  `Gaze not centered (${result.gazeDirection})`
                );
              }
            }

            if (result.attentionScore < 50) {
              result.warnings.push(
                `Low attention score (${result.attentionScore.toFixed(0)})`
              );
            }

            if (Math.abs(result.headPose.yaw) > 0.5) {
              result.warnings.push("Head turned significantly to the side");
            }

            // Detect suspicious behavior patterns
            const suspiciousFlags = this.detectSuspiciousBehavior();
            suspiciousFlags.forEach((flag) => {
              result.warnings.push(flag);
            });
          } catch (behavioralError) {
            console.error("Error in behavioral analysis:", behavioralError);
          }
        }
      }

      // Check for face detection warnings
      if (!faceResult.hasFace) {
        result.warnings.push("No face detected in camera feed");
      } else if (faceResult.faceCount > 1) {
        result.warnings.push(
          "Multiple faces detected - only one person should be visible"
        );
      } else if (
        faceResult.confidence &&
        faceResult.confidence < settings.faceDetectionSensitivity / 100
      ) {
        result.warnings.push(
          "Face detection confidence is low - ensure proper lighting and positioning"
        );
      }

      // Basic object detection using heuristics (can be enhanced with TensorFlow.js)
      if (settings.enableObjectDetection) {
        const objects = await this.detectObjects(
          videoElement,
          settings.objectDetectionSensitivity
        );
        result.objectsDetected = objects;

        // Check for specific prohibited objects
        if (objects.includes("mobile_phone")) {
          result.warnings.push("Mobile phone detected in camera feed");
        }
        if (objects.includes("unauthorized_device")) {
          result.warnings.push("Unauthorized electronic device detected");
        }
        if (objects.includes("unauthorized_material")) {
          result.warnings.push("Unauthorized materials (books/notes) detected");
        }
        if (objects.includes("prohibited_item")) {
          result.warnings.push("Prohibited item detected in camera feed");
        }
      }
    } catch (error) {
      console.error("Error in proctoring compliance check:", error);
      result.warnings.push("Face detection system error");
    }

    return result;
  }

  /**
   * Object detection using TensorFlow.js COCO-SSD
   */
  private async detectObjects(
    videoElement: HTMLVideoElement,
    sensitivity: number
  ): Promise<string[]> {
    if (!this.objectDetector) {
      console.warn("Object detector not loaded");
      return [];
    }

    try {
      console.log("Running object detection...");
      // Run object detection on the video element
      const predictions = await this.objectDetector.detect(videoElement);
      console.log("Object detection predictions:", predictions);

      // Comprehensive list of prohibited objects for proctoring
      const prohibitedObjects = {
        phones: [
          "cell phone",
          "mobile",
          "phone",
          "smartphone",
          "mobile phone",
          "cellular telephone",
          "handset",
        ],
        devices: [
          "laptop",
          "computer",
          "tablet",
          "ipad",
          "kindle",
          "ebook reader",
          "electronic device",
        ],
        materials: [
          "book",
          "notebook",
          "paper",
          "document",
          "notes",
          "cheat sheet",
          "textbook",
          "magazine",
          "newspaper",
        ],
        other: [
          "calculator",
          "watch",
          "smartwatch",
          "headphones",
          "earbuds",
          "microphone",
          "camera",
          "remote control",
        ],
      };

      const detectedObjects: string[] = [];
      const confidenceThreshold = sensitivity / 100;

      console.log(`Using confidence threshold: ${confidenceThreshold}`);

      for (const prediction of predictions) {
        if (prediction.score >= confidenceThreshold) {
          const className = prediction.class.toLowerCase().trim();
          console.log(
            `Checking object: ${className} (confidence: ${prediction.score})`
          );

          // Check phones
          if (
            prohibitedObjects.phones.some(
              (phone) => className.includes(phone) || phone.includes(className)
            )
          ) {
            detectedObjects.push("mobile_phone");
            console.log("Detected phone-like object");
          }
          // Check devices
          else if (
            prohibitedObjects.devices.some(
              (device) =>
                className.includes(device) || device.includes(className)
            )
          ) {
            detectedObjects.push("unauthorized_device");
            console.log("Detected unauthorized device");
          }
          // Check materials
          else if (
            prohibitedObjects.materials.some(
              (material) =>
                className.includes(material) || material.includes(className)
            )
          ) {
            detectedObjects.push("unauthorized_material");
            console.log("Detected unauthorized material");
          }
          // Check other prohibited items
          else if (
            prohibitedObjects.other.some(
              (item) => className.includes(item) || item.includes(className)
            )
          ) {
            detectedObjects.push("prohibited_item");
            console.log("Detected prohibited item");
          }
        }
      }

      const uniqueObjects = [...new Set(detectedObjects)];
      console.log("Final detected objects:", uniqueObjects);
      return uniqueObjects;
    } catch (error) {
      console.error("Error in object detection:", error);
      return [];
    }
  }

  /**
   * Monitor camera/microphone/speaker levels
   */
  async checkMediaLevels(stream: MediaStream): Promise<{
    cameraLevel: number;
    microphoneLevel: number;
    speakerLevel: number;
  }> {
    return new Promise((resolve) => {
      try {
        // Reuse AudioContext or create new one
        if (!this.audioContext) {
          this.audioContext = new AudioContext();
        }

        // Resume context if suspended (required by some browsers)
        if (this.audioContext.state === "suspended") {
          this.audioContext.resume();
        }

        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        let cameraLevel = 50; // Default to 50% if no video
        let microphoneLevel = 0;
        let speakerLevel = 50; // Assume speaker is working

        // Check microphone level
        if (audioTrack) {
          const microphone = this.audioContext.createMediaStreamSource(
            new MediaStream([audioTrack])
          );
          microphone.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          // Collect multiple samples over a short period
          let samples = [];
          const sampleCount = 5;

          const collectSample = () => {
            analyser.getByteFrequencyData(dataArray);
            const average =
              dataArray.reduce((a, b) => a + b) / dataArray.length;
            samples.push(average);

            if (samples.length >= sampleCount) {
              // Calculate average of samples
              const totalAverage =
                samples.reduce((a, b) => a + b) / samples.length;
              microphoneLevel = Math.min(100, (totalAverage / 255) * 100);

              // Check camera (video) - this is approximate
              if (videoTrack) {
                // For camera, we check if the track is active and enabled
                cameraLevel =
                  videoTrack.enabled && videoTrack.readyState === "live"
                    ? 100
                    : 0;
              }

              resolve({
                cameraLevel,
                microphoneLevel,
                speakerLevel,
              });
            } else {
              // Collect next sample after a short delay
              setTimeout(collectSample, 100);
            }
          };

          // Start collecting samples
          collectSample();
        } else {
          // No audio track, resolve immediately
          if (videoTrack) {
            cameraLevel =
              videoTrack.enabled && videoTrack.readyState === "live" ? 100 : 0;
          }

          resolve({
            cameraLevel,
            microphoneLevel,
            speakerLevel,
          });
        }
      } catch (error) {
        console.error("Error checking media levels:", error);
        resolve({
          cameraLevel: 50,
          microphoneLevel: 0,
          speakerLevel: 50,
        });
      }
    });
  }

  /**
   * Check if browser is in fullscreen mode
   */
  checkFullscreenStatus(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  }

  /**
   * Request fullscreen mode
   */
  async requestFullscreen(
    element: HTMLElement = document.documentElement
  ): Promise<boolean> {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
      return true;
    } catch (error) {
      console.error("Error requesting fullscreen:", error);
      return false;
    }
  }
}

// Export singleton instance
export const faceDetectionService = new FaceDetectionService();
export default faceDetectionService;
