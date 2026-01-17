import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import { QuizApiService } from "../services/quizApi";
import { ProctoringApiService } from "../services/proctoringApi";
import {
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  BookOpen,
  Timer,
  Target,
  Zap,
} from "lucide-react";
import QuestionTimer from "../components/ui/QuestionTimer";
import { QuestionRenderer } from "../components/Quizzes/QuestionRenderer";
import { ProctoringSetup } from "../components/Proctoring";
import ProctoringMonitorComponent from "../components/Proctoring/ProctoringMonitorComponent";
import FloatingCameraComponent from "../components/Proctoring/FloatingCameraComponent";
import type { Quiz, QuizQuestion, AnswerDataType } from "../types/quiz.types";
import { toast } from "react-toastify";

interface QuizTakingQuiz extends Quiz {
  quiz_completed?: boolean;
}

interface Answer {
  question_id: number;
  answer: AnswerDataType;
  time_taken?: number;
}

interface QuizSubmission {
  id: number;
  quiz_id: number;
  student_id: number;
  status: string;
  time_taken: number;
  started_at: string;
  answers?: any[];
}

const QuizTakingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizTakingQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [currentInstructionStep, setCurrentInstructionStep] = useState(0);
  const [existingSubmission, setExistingSubmission] =
    useState<QuizSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnSizes, setColumnSizes] = useState({ left: 50, right: 50 });
  const [isResizing, setIsResizing] = useState(false);
  const [showGradeSummary, setShowGradeSummary] = useState(false);
  const [gradeSummary, setGradeSummary] = useState<any>(null);
  const [showQuizTerminated, setShowQuizTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState<string>("");

  // Proctoring state
  const [showProctoringSetup, setShowProctoringSetup] = useState(false);
  const [proctoringSession, setProctoringSession] = useState<any>(null);
  const [proctoringSettings, setProctoringSettings] = useState<any>(null);
  const [proctoringVideoElement, setProctoringVideoElement] =
    useState<HTMLVideoElement | null>(null);
  const [proctoringStream, setProctoringStream] = useState<MediaStream | null>(
    null
  );
  const [proctoringMonitorActive, setProctoringMonitorActive] = useState(false);
  const [proctoringError, setProctoringError] = useState<string | null>(null);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<any>(null);
  const [contentDisabled, setContentDisabled] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Audio confirmation state
  const [audioConfirmationRequest, setAudioConfirmationRequest] = useState<{
    volume: number;
    micGain: number;
    requestId: string;
    sessionToken: string;
  } | null>(null);
  const [socketRef, setSocketRef] = useState<any>(null);

  // Volume check state
  const [showVolumeCheck, setShowVolumeCheck] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isCheckingVolume, setIsCheckingVolume] = useState(false);
  const [volumeCheckPassed, setVolumeCheckPassed] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<any>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isPlayingSpeakerTest, setIsPlayingSpeakerTest] = useState(false);
  const [speakerTestConfirmed, setSpeakerTestConfirmed] = useState(false);
  const [speakerTestPlayed, setSpeakerTestPlayed] = useState(false);

  const instructions = [
    {
      icon: <BookOpen className="h-8 w-8 text-blue-600" />,
      title: "Read Carefully",
      description:
        "Read each question thoroughly before answering. Take your time to understand what is being asked.",
    },
    {
      icon: <Timer className="h-8 w-8 text-amber-600" />,
      title: "Manage Your Time",
      description: `You have ${
        quiz?.time_limit || 0
      } minutes to complete this quiz. The timer will start once you begin.`,
    },
    {
      icon: <Target className="h-8 w-8 text-purple-600" />,
      title: "Answer All Questions",
      description:
        "Make sure to answer all questions. You can navigate between questions using the buttons at the bottom.",
    },
    {
      icon: <Zap className="h-8 w-8 text-green-600" />,
      title: "Submit When Ready",
      description:
        "Review your answers before submitting. Once submitted, you cannot make changes.",
    },
  ];

  useEffect(() => {
    if (id) {
      fetchQuiz();
    }
  }, [id]);

  useEffect(() => {
    if (quiz && !quizStartTime) {
      // Check for existing submission first
      checkExistingSubmission();
    }
  }, [quiz, quizStartTime]);

  // Load saved answers and timer state from localStorage on component mount
  useEffect(() => {
    if (id) {
      const quizSessionKey = `quiz_${id}_answers`;
      const timerSessionKey = `quiz_${id}_timer`;

      // Load saved answers
      const savedAnswers = localStorage.getItem(quizSessionKey);
      if (savedAnswers) {
        try {
          const parsedAnswers = JSON.parse(savedAnswers);
          setAnswers(parsedAnswers);
        } catch (error) {
          console.error("Error parsing saved answers:", error);
          localStorage.removeItem(quizSessionKey);
        }
      }

      // Load saved timer state
      const savedTimerState = localStorage.getItem(timerSessionKey);
      if (savedTimerState) {
        try {
          const { timeLeft: savedTimeLeft, quizStartTime: savedStartTime } =
            JSON.parse(savedTimerState);
          if (savedTimeLeft > 0 && savedStartTime) {
            setTimeLeft(savedTimeLeft);
            setQuizStartTime(new Date(savedStartTime));
          }
        } catch (error) {
          console.error("Error parsing saved timer state:", error);
          localStorage.removeItem(timerSessionKey);
        }
      }
    }
  }, [id]);

  // Clear errors when component mounts
  useEffect(() => {
    setError(null);
  }, []);

  // Clear errors when navigating away
  useEffect(() => {
    return () => {
      setError(null);
      // Clean up volume check resources
      stopVolumeCheck();
    };
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && quizStartTime && !showInstructions) {
      const timer = setTimeout(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          const newTimeLeft = prev - 1;

          // Save timer state to localStorage
          if (id && quizStartTime) {
            const timerSessionKey = `quiz_${id}_timer`;
            localStorage.setItem(
              timerSessionKey,
              JSON.stringify({
                timeLeft: newTimeLeft,
                quizStartTime: quizStartTime.toISOString(),
              })
            );
          }

          return newTimeLeft;
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [timeLeft, quizStartTime, showInstructions, id]);

  // Initialize socket connection for audio confirmation when proctoring session is active
  useEffect(() => {
    if (proctoringSession && !showProctoringSetup && !showInstructions) {
      const initializeSocket = async () => {
        try {
          const { io } = await import("socket.io-client");
          const socket = io("http://localhost:5002", {
            transports: ["websocket", "polling"],
          });

          socket.on("connect", () => {
            socket.emit("join-proctoring-session", {
              sessionToken: proctoringSession.session_token,
              role: "student",
            });
          });

          // Listen for audio confirmation requests from proctor
          socket.on("request-student-audio-confirmation", (data: any) => {
            if (data.sessionToken === proctoringSession.session_token) {
              setAudioConfirmationRequest({
                volume: data.volume || 0.5,
                micGain: data.micGain || 0.6,
                requestId: data.requestId,
                sessionToken: data.sessionToken,
              });
            }
          });

          // Listen for quiz termination from proctor
          socket.on("quiz-terminated", (data: any) => {
            if (data.sessionToken === proctoringSession.session_token) {
              setTerminationReason(
                data.reason || "Quiz terminated by instructor"
              );
              setShowQuizTerminated(true);
              // Auto-submit the quiz
              setTimeout(() => {
                handleAutoSubmit();
              }, 3000); // Give student time to read the message
            }
          });

          socket.on("connect_error", (error: any) => {
            console.error("QuizTakingPage socket connection error:", error);
          });

          setSocketRef(socket);
        } catch (error) {
          console.error("Error initializing socket in QuizTakingPage:", error);
        }
      };

      initializeSocket();
    }

    return () => {
      if (socketRef) {
        socketRef.disconnect();
        setSocketRef(null);
      }
    };
  }, [proctoringSession, showProctoringSetup, showInstructions]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      const response = await QuizApiService.getQuiz(parseInt(id!));

      // Check if the quiz has already been completed by this user
      if (response.data && (response.data as QuizTakingQuiz).quiz_completed) {
        // Redirect to results page with the completed quiz data
        navigate(`/quizzes/${id}/results`, {
          state: { completedResults: response.data },
          replace: true, // Replace current history entry to prevent going back to quiz taking
        });
        return;
      }

      setQuiz(response.data as QuizTakingQuiz);
    } catch (error: any) {
      console.error("Error fetching quiz:", error);

      // Extract error message from response
      let errorMessage = "Failed to load quiz. Please try again.";

      if (error.response?.data?.message) {
        const serverMessage = error.response.data.message;

        if (serverMessage.includes("not found")) {
          errorMessage =
            "The quiz you're looking for could not be found. It may have been deleted or you may not have access to it.";
        } else if (serverMessage.includes("not authorized")) {
          errorMessage =
            "You are not authorized to view this quiz. Please make sure you're logged in.";
        } else {
          errorMessage = serverMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingSubmission = async () => {
    try {
      const response = await axios.get(
        `/api/quizzes/submissions?quiz_id=${id}&status=in_progress`
      );
      const submissions = response.data.data;

      if (submissions && submissions.length > 0) {
        const submission = submissions[0];
        setExistingSubmission(submission);

        // Resume from existing submission
        if (submission.answers && submission.answers.length > 0) {
          setAnswers(
            submission.answers.map((answer: any) => ({
              question_id: answer.question_id,
              answer: answer.answer_data || answer.user_answer,
              time_taken: answer.time_taken || 0,
            }))
          );
        }

        // Calculate remaining time
        const startedAt = new Date(submission.started_at);
        const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        const totalTimeInSeconds = (quiz?.time_limit || 0) * 60;
        const remainingTime = Math.max(0, totalTimeInSeconds - elapsed);

        setTimeLeft(remainingTime);
        setQuizStartTime(startedAt);

        // Update timer state in localStorage if resuming
        if (id) {
          const timerSessionKey = `quiz_${id}_timer`;
          localStorage.setItem(
            timerSessionKey,
            JSON.stringify({
              timeLeft: remainingTime,
              quizStartTime: startedAt.toISOString(),
            })
          );
        }

        // Hide instructions since we're resuming an existing quiz
        setShowInstructions(false);
      }
    } catch (error: any) {
      console.error("Error checking existing submission:", error);
      // Don't show error for this check, just log it
    }
  };

  const startQuizAttempt = async () => {
    // If we already have an existing submission, don't create a new one
    if (existingSubmission) {
      setShowInstructions(false);
      return;
    }

    try {
      setError(null); // Clear any previous errors

      // First, perform volume check
      setShowVolumeCheck(true);
      await startVolumeCheck();
    } catch (error: any) {
      console.error("Error starting quiz:", error);

      // Extract error message from response
      let errorMessage = "Failed to start quiz. Please try again.";

      if (error.response?.data?.message) {
        const serverMessage = error.response.data.message;

        // Provide more helpful messages for specific errors
        if (serverMessage.includes("Quiz is not currently available")) {
          errorMessage =
            "This quiz is not currently available. It may be in draft status, completed, or outside its scheduled time period. Please contact your instructor for more information.";
        } else if (serverMessage.includes("not found")) {
          errorMessage =
            "The quiz you're looking for could not be found. It may have been deleted or you may not have access to it.";
        } else if (serverMessage.includes("not authorized")) {
          errorMessage =
            "You are not authorized to take this quiz. Please make sure you're logged in and have the necessary permissions.";
        } else {
          errorMessage = serverMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    }
  };

  const proceedWithQuizStart = async () => {
    try {
      // Check if quiz has proctoring enabled
      const proctoringResponse =
        await ProctoringApiService.getProctoringSettings(parseInt(id!));
      const settings = proctoringResponse.data;
      setProctoringSettings(settings);

      if (settings && settings.enabled) {
        // Show proctoring setup instead of starting quiz directly
        setShowProctoringSetup(true);
        return;
      }

      // No proctoring, start quiz normally
      await startQuizNormally();
    } catch (error: any) {
      console.error("Error proceeding with quiz start:", error);
      setError("Failed to start quiz. Please try again.");
    }
  };

  const startQuizNormally = async () => {
    const response = await axios.post(`/api/quizzes/submissions`, {
      quiz_id: parseInt(id!),
      status: "in_progress",
      started_at: new Date().toISOString(),
    });

    const submission = response.data.data;
    setExistingSubmission(submission);
    setQuizStartTime(new Date());
    setTimeLeft((quiz?.time_limit || 0) * 60);

    // Save initial timer state to localStorage
    if (id) {
      const timerSessionKey = `quiz_${id}_timer`;
      localStorage.setItem(
        timerSessionKey,
        JSON.stringify({
          timeLeft: (quiz?.time_limit || 0) * 60,
          quizStartTime: new Date().toISOString(),
        })
      );
    }

    setShowInstructions(false);
    setError(null); // Clear any errors on successful start
  };

  const handleProctoringSetupComplete = async (sessionData: any) => {
    setProctoringSession(sessionData);
    setShowProctoringSetup(false);

    // Check if fullscreen is required
    if (proctoringSettings?.require_fullscreen) {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isCurrentlyFullscreen) {
        // Automatically request fullscreen instead of showing prompt
        try {
          await requestFullscreen();
          // Wait a bit for fullscreen to activate
          setTimeout(async () => {
            await startQuizNormally();
          }, 500);
        } catch (error) {
          toast.error("Failed to enter fullscreen. Please enable fullscreen manually to proceed.");
          // Fallback to showing prompt if auto-fullscreen fails
          setShowFullscreenPrompt(true);
          return;
        }
        return; // Don't start quiz yet, wait for fullscreen
      }
    }

    // Now start the quiz normally
    await startQuizNormally();
  };

  const handleVideoReady = (
    videoElement: HTMLVideoElement,
    stream: MediaStream
  ) => {
    setProctoringVideoElement(videoElement);
    setProctoringStream(stream);
  };

  const handleAudioConfirmation = (confirmed: boolean) => {
    if (!audioConfirmationRequest || !socketRef) return;

    socketRef.emit("student-audio-confirmation", {
      sessionToken: audioConfirmationRequest.sessionToken,
      confirmed,
      requestId: audioConfirmationRequest.requestId,
    });

    // If confirmed, apply the settings to the browser/computer system
    if (confirmed) {
      applySystemAudioSettings(
        audioConfirmationRequest.volume,
        audioConfirmationRequest.micGain
      );
    }

    setAudioConfirmationRequest(null);
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
            const micAudioContext = new (AudioContext ||
              (window as any).webkitAudioContext)();

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
            (window as any).micGainNode = micGainNode;
          } catch (micError) {
            console.warn(
              "Could not apply microphone gain adjustment:",
              micError
            );
          }
        }
      }

      // Show user feedback - replace custom DOM element with toast
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-bold text-lg">BROWSER FORCED TO MAXIMUM VOLUME</span>
          <span className="text-sm">Volume: {(volume * 100).toFixed(0)}% | Mic: {(micGain * 100).toFixed(0)}%</span>
        </div>,
        {
          position: "top-right",
          autoClose: 8000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          style: {
            background: "#EF4444", // red-500
            color: "#FFFFFF",
            fontWeight: "bold",
          }
        }
      );

      // Force browser focus and volume
      document.body.focus();
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (error) {
      console.error("Error applying system audio settings:", error);

      toast.warning("Audio settings applied (limited browser support)");
    }
  };

  // Volume check functions
  const startVolumeCheck = async () => {
    try {
      setIsCheckingVolume(true);
      setVolumeLevel(0);
      setSpeakerTestConfirmed(false);
      setSpeakerTestPlayed(false);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setAudioStream(stream);

      // Create audio context and analyser
      const audioCtx = new (AudioContext ||
        (window as any).webkitAudioContext)();

      // Resume audio context if suspended (required by browser autoplay policies)
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.8; // Smooth the readings

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyserNode);

      setAudioContext(audioCtx);
      setAnalyser(analyserNode);

      setAnalyser(analyserNode);

      // Start monitoring volume levels with the analyser directly
      checkVolumeLevels(analyserNode);
    } catch (error) {
      console.error("Error starting volume check:", error);
      setError(
        "Unable to access microphone. Please check your browser permissions and try again."
      );
      setIsCheckingVolume(false);
    }
  };

  function checkVolumeLevels(providedAnalyser?: AnalyserNode) {
    const analyserToUse = providedAnalyser || analyser;
    if (!analyserToUse) {
      return;
    }

    const bufferLength = analyserToUse.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const checkLevels = () => {
      if (!analyserToUse) {
        return;
      }



      // Try time domain data first (more reliable for volume detection)
      analyserToUse.getFloatTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) for accurate volume measurement
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const volumePercent = Math.min(100, Math.max(0, rms * 2000)); // Scale RMS to percentage (adjusted scaling)

      // Simple check: if RMS is above a very low threshold, there's audio input


      setVolumeLevel(volumePercent);

      // Check if volume meets threshold
      if (volumePercent >= 80) {
        console.log("Volume threshold reached! Passing volume check.");
        setVolumeCheckPassed(true);
        stopVolumeCheck();
        return;
      }

      // For testing: if RMS is very high (like speaking loudly), also pass
      if (rms > 0.05) {
        // This would be very loud audio
        console.log("High RMS detected, passing volume check for testing");
        setVolumeCheckPassed(true);
        stopVolumeCheck();
        return;
      }
    };

    // Check volume levels every second for real-time updates
    const intervalId = setInterval(checkLevels, 1000);

    // Store interval ID for cleanup
    (window as any).volumeCheckInterval = intervalId;

    // Initial check
    checkLevels();
  }

  const stopVolumeCheck = () => {
    setIsCheckingVolume(false);

    // Clear the volume check interval
    if ((window as any).volumeCheckInterval) {
      clearInterval((window as any).volumeCheckInterval);
      (window as any).volumeCheckInterval = null;
    }

    // Clean up audio resources
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }

    if (audioContext && audioContext.state !== "closed") {
      audioContext.close();
      setAudioContext(null);
    }

    setAnalyser(null);
  };

  const playSpeakerTestTone = async () => {
    if (isPlayingSpeakerTest) return;

    try {
      setIsPlayingSpeakerTest(true);

      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) {
        console.warn("Web Audio API not supported for speaker test");
        setIsPlayingSpeakerTest(false);
        return;
      }

      const ctx = new AudioContextClass();

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 1000; // 1 kHz test tone
      gainNode.gain.value = 0.2; // comfortable level

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Mark that the system has successfully started a speaker test tone
      setSpeakerTestPlayed(true);

      oscillator.start();

      setTimeout(() => {
        try {
          oscillator.stop();
          ctx.close();
        } catch (e) {
          console.warn("Error stopping speaker test tone", e);
        }
        setIsPlayingSpeakerTest(false);
      }, 1500);
    } catch (error) {
      console.error("Error playing speaker test tone:", error);
      setIsPlayingSpeakerTest(false);
    }
  };

  const handleVolumeCheckComplete = () => {
    if (volumeCheckPassed) {
      setShowVolumeCheck(false);
      // Proceed with quiz start
      proceedWithQuizStart();
    }
  };

  const handleProctoringViolation = (violation: any) => {
    // setProctoringViolations((prev) => [violation, ...prev.slice(0, 9)]); // Keep last 10 violations

    // Track active violations that disable content
    // const violationKey = `${violation.type}_${violation.severity}`;
    // setActiveViolations((prev) => new Set(prev).add(violationKey));

    // Disable content for critical violations and high-priority face/object violations
    const shouldDisableContent =
      violation.severity === "critical" ||
      (violation.severity === "high" &&
        (violation.type === "face_not_visible" ||
          violation.type === "mobile_phone_detected" ||
          violation.type === "unauthorized_object_detected" ||
          violation.type === "multiple_faces"));

    if (shouldDisableContent) {
      setContentDisabled(true);
      console.log(
        "Content disabled due to violation:",
        violation.type,
        violation.severity
      );
    }

    // Show warning popup for high and critical violations
    if (violation.severity === "high" || violation.severity === "critical") {
      setCurrentViolation(violation);
      setShowViolationWarning(true);

      // Auto-hide after 10 seconds for non-critical violations
      if (violation.severity !== "critical") {
        setTimeout(() => {
          setShowViolationWarning(false);
          setCurrentViolation(null);
        }, 10000);
      }
    }
  };

  // const handleViolationResolved = () => {
  //   console.log("Violation resolved - checking if content can be re-enabled");

  //   // Check current proctoring status to see if violations are resolved
  //   // This will be called by the FloatingCameraComponent when issues are fixed
  //   setActiveViolations((prev) => {
  //     // For now, clear all active violations when resolved is called
  //     // In a more sophisticated implementation, we could check specific violations
  //     const newActiveViolations = new Set(prev);

  //     // Remove face and object related violations that are commonly resolved
  //     const resolvedTypes = [
  //       "face_not_visible",
  //       "mobile_phone_detected",
  //       "unauthorized_object_detected",
  //       "multiple_faces",
  //     ];

  //     resolvedTypes.forEach((type) => {
  //       newActiveViolations.forEach((key) => {
  //         if (key.startsWith(type)) {
  //           newActiveViolations.delete(key);
  //         }
  //       });
  //     });

  //     // Re-enable content if no critical violations remain
  //     const hasCriticalViolations = Array.from(newActiveViolations).some(
  //       (key) =>
  //         key.includes("_critical") ||
  //         (key.includes("_high") &&
  //           (key.includes("face_not_visible") ||
  //             key.includes("mobile_phone_detected") ||
  //             key.includes("unauthorized_object_detected") ||
  //             key.includes("multiple_faces")))
  //     );

  //     if (!hasCriticalViolations) {
  //       setContentDisabled(false);
  //       setShowViolationWarning(false);
  //       setCurrentViolation(null);
  //       console.log("Content re-enabled - all blocking violations resolved");
  //     }

  //     return newActiveViolations;
  //   });
  // };

  const updateAnswer = useCallback(
    async (questionId: number, answer: AnswerDataType) => {
      const newAnswer: Answer = {
        question_id: questionId,
        answer,
        time_taken: Math.floor(
          (Date.now() - (quizStartTime?.getTime() || 0)) / 1000
        ), // Convert to seconds
      };

      setAnswers((prev) => {
        const existing = prev.find((a) => a.question_id === questionId);
        if (existing) {
          return prev.map((a) =>
            a.question_id === questionId ? newAnswer : a
          );
        }
        return [...prev, newAnswer];
      });

      // Save answer to localStorage for persistence across reloads
      const quizSessionKey = `quiz_${id}_answers`;
      const updatedAnswers = answers
        .filter((a) => a.question_id !== questionId)
        .concat(newAnswer);
      localStorage.setItem(quizSessionKey, JSON.stringify(updatedAnswers));

      // Save answer to database with grading
      if (existingSubmission) {
        try {
          await QuizApiService.submitQuestionAnswer(
            existingSubmission.id,
            questionId,
            answer
          );
        } catch (error: any) {
          console.error("Error saving answer to database:", error);
          // Don't show error for answer saving failures, just log them
        }
      }
    },
    [answers, quizStartTime, existingSubmission, id]
  );

  const handleAutoSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitQuiz();
    } catch (error) {
      console.error("Error auto-submitting quiz:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitQuiz = useCallback(async () => {
    if (!quiz) return;

    try {
      setIsSubmitting(true);
      setError(null); // Clear any previous errors
      const submissionData = {
        quiz_id: quiz.id,
        answers: answers,
        time_taken: quizStartTime
          ? Math.floor((Date.now() - quizStartTime.getTime()) / 1000)
          : 0, // Convert to seconds
        submitted_at: new Date().toISOString(),
      };

      // Update submission status to completed
      if (existingSubmission) {
        await axios.patch(`/api/quizzes/submissions/${existingSubmission.id}`, {
          status: "completed",
          completed_at: new Date().toISOString(),
          answers: answers,
          time_taken: submissionData.time_taken,
        });
      }

      // Submit the quiz
      const response = await axios.post(
        `/api/quizzes/${quiz.id}/submit`,
        submissionData
      );
      const submissionResult = response.data.data;

      // Clear saved answers and timer state from localStorage after successful submission
      if (id) {
        const quizSessionKey = `quiz_${id}_answers`;
        const timerSessionKey = `quiz_${id}_timer`;
        localStorage.removeItem(quizSessionKey);
        localStorage.removeItem(timerSessionKey);
      }

      // Check if quiz settings allow immediate results display
      if ((quiz as any).show_results_immediately) {
        // Show grade summary modal first
        setGradeSummary({
          final_score: submissionResult.final_score,
          max_score: submissionResult.max_score,
          percentage: submissionResult.percentage,
          passed: submissionResult.passed,
          quiz_title: quiz.title,
        });
        setShowGradeSummary(true);

        // Auto-navigate to full results after 3 seconds
      } else {
        // Navigate directly to results page
        navigate(`/quizzes/${quiz.id}/results`, {
          state: { quiz, answers, submissionData },
        });
      }
    } catch (error: any) {
      console.error("Error submitting quiz:", error);

      // Extract error message from response
      let errorMessage = "Failed to submit quiz. Please try again.";

      if (error.response?.data?.message) {
        const serverMessage = error.response.data.message;

        // Provide more helpful messages for specific errors
        if (serverMessage.includes("Quiz is not currently available")) {
          errorMessage =
            "This quiz is no longer available for submission. It may have expired or been completed.";
        } else if (serverMessage.includes("not found")) {
          errorMessage =
            "The quiz submission could not be found. Please try starting the quiz again.";
        } else if (serverMessage.includes("not authorized")) {
          errorMessage =
            "You are not authorized to submit this quiz. Please make sure you're logged in.";
        } else {
          errorMessage = serverMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setIsSubmitting(false);
    }
  }, [quiz, answers, quizStartTime, existingSubmission, id, navigate]);

  const nextInstruction = () => {
    if (currentInstructionStep < instructions.length - 1) {
      setCurrentInstructionStep(currentInstructionStep + 1);
    }
  };

  const prevInstruction = () => {
    if (currentInstructionStep > 0) {
      setCurrentInstructionStep(currentInstructionStep - 1);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const container = document.querySelector(
      "[data-resizable-container]"
    ) as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    // Constrain between 20% and 80%
    const constrainedPercentage = Math.max(20, Math.min(80, percentage));

    setColumnSizes({
      left: constrainedPercentage,
      right: 100 - constrainedPercentage,
    });
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).mozRequestFullScreen) {
        await (document.documentElement as any).mozRequestFullScreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error("Error requesting fullscreen:", error);
      setError(
        "Unable to enter fullscreen mode. Please try again or contact your instructor."
      );
    }
  };

  // const handleFullscreenConfirmed = async () => {
  //   setShowFullscreenPrompt(false);
  //   // Now start the quiz normally
  //   await startQuizNormally();
  // };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
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
  }, [isResizing]);

  // Fullscreen event listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullscreenMode(isCurrentlyFullscreen);

      // Auto-start quiz when fullscreen is entered and required
      if (
        proctoringSettings?.require_fullscreen &&
        isCurrentlyFullscreen &&
        !showInstructions &&
        !showProctoringSetup &&
        !quizStartTime // Only if quiz hasn't started yet
      ) {
        startQuizNormally();
      }
      // If fullscreen is required and we're not in fullscreen, show the prompt
      else if (
        proctoringSettings?.require_fullscreen &&
        !isCurrentlyFullscreen &&
        !showInstructions &&
        !showProctoringSetup
      ) {
        setShowFullscreenPrompt(true);
      } else if (isCurrentlyFullscreen) {
        setShowFullscreenPrompt(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, [
    proctoringSettings,
    showInstructions,
    showProctoringSetup,
    quizStartTime,
  ]);

  const renderQuestion = (question: QuizQuestion) => {
    const currentAnswer = answers.find(
      (a) => a.question_id === question.id
    )?.answer;

    return (
      <QuestionRenderer
        key={question.id} // Add key to force re-render when question changes
        question={question}
        answer={currentAnswer}
        onAnswerChange={(answer: AnswerDataType) =>
          updateAnswer(question.id, answer)
        }
        disabled={contentDisabled}
      />
    );
  };

  const currentQuestion = quiz?.questions?.[currentQuestionIndex] || null;
  const answeredQuestions = answers.length;
  const totalQuestions = quiz?.questions?.length || 0;
  const progress =
    totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
  const quizQuestions = quiz?.questions || [];

  const submitCurrentAnswer = useCallback(async () => {
    if (!currentQuestion) return;

    const currentAnswer = answers.find(
      (a) => a.question_id === currentQuestion.id
    )?.answer;

    if (currentAnswer) {
      await updateAnswer(currentQuestion.id, currentAnswer);
    }
  }, [currentQuestion, answers, updateAnswer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Quiz Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error ||
              "The quiz you're looking for doesn't exist or is not available."}
          </p>
          <Link
            to="/my-quizzes"
            onClick={() => setError(null)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  // Show volume check modal if needed
  if (showVolumeCheck) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
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
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Audio Volume Check
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Please speak or make noise to test your microphone volume. The
              quiz will only start when your audio volume reaches at least 80%.
            </p>

            {/* Volume Level Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Volume
                </span>
                <span
                  className={`text-sm font-bold ${
                    volumeLevel >= 80 ? "text-green-600" : "text-orange-600"
                  }`}
                >
                  {Math.round(volumeLevel)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    volumeLevel >= 80 ? "bg-green-500" : "bg-orange-500"
                  }`}
                  style={{ width: `${Math.min(volumeLevel, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>0%</span>
                <span className="font-semibold text-blue-600">
                  80% Required
                </span>
                <span>100%</span>
              </div>
            </div>

            <div className="mb-4 flex flex-col items-center gap-2 text-sm">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={playSpeakerTestTone}
                  disabled={isPlayingSpeakerTest}
                  className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPlayingSpeakerTest
                    ? "Playing test sound..."
                    : "Play Test Sound"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (speakerTestPlayed) {
                      setSpeakerTestConfirmed(true);
                    }
                  }}
                  disabled={!speakerTestPlayed}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    speakerTestConfirmed
                      ? "bg-green-600 border-green-600 text-white"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  } ${
                    !speakerTestPlayed ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  I heard the sound
                </button>
              </div>
              {isCheckingVolume && (
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                  Checking microphone volume levels...
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  stopVolumeCheck();
                  setShowVolumeCheck(false);
                  setShowInstructions(true);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Skip Check
              </button>
              {!volumeCheckPassed && (
                <button
                  onClick={() => {
                    if (!isCheckingVolume) {
                      startVolumeCheck();
                    }
                  }}
                  disabled={isCheckingVolume}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCheckingVolume ? "Checking..." : "Test Again"}
                </button>
              )}
              {volumeCheckPassed &&
                speakerTestConfirmed &&
                !isCheckingVolume && (
                  <button
                    onClick={handleVolumeCheckComplete}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-colors"
                  >
                    Continue
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show proctoring setup if needed
  if (showProctoringSetup) {
    return (
      <ProctoringSetup
        quizId={id!}
        onSetupComplete={handleProctoringSetupComplete}
        onCancel={() => {
          setShowProctoringSetup(false);
          setShowInstructions(true);
        }}
        onVideoReady={handleVideoReady}
      />
    );
  }

  // Show fullscreen prompt if needed
  if (showFullscreenPrompt) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
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
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Fullscreen Required
          </h2>

          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            This quiz requires fullscreen mode to ensure academic integrity.
            Please click the button below to enter fullscreen mode and begin the
            quiz.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                <svg
                  className="w-3 h-3 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="text-left">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  Important Notes:
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>
                    • You will not be able to see quiz questions until
                    fullscreen is enabled
                  </li>
                  <li>
                    • Exiting fullscreen during the quiz may be flagged as a
                    violation
                  </li>
                  <li>• Make sure your browser allows fullscreen mode</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                setShowFullscreenPrompt(false);
                setShowInstructions(true);
              }}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 font-medium"
            >
              ← Back to Instructions
            </button>

            <button
              onClick={requestFullscreen}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full hover:from-blue-700 hover:to-blue-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg
                className="w-5 h-5 inline mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              Enter Fullscreen Mode
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <p className="text-red-700 dark:text-red-300 font-medium">
                  {error}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show instructions modal if needed
  if (showInstructions) {
    const currentInstruction = instructions[currentInstructionStep];

    return (
      <div className="max-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 max-w-4xl w-full p-8 transform transition-all duration-300">
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                    Unable to Start Quiz
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {error}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={startQuizAttempt}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                  >
                    <span className="sr-only">Close error</span>×
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Quiz Instructions
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Step {currentInstructionStep + 1} of {instructions.length}
            </p>
          </div>

          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-2xl flex items-center justify-center mb-4 transform -rotate-3 hover:rotate-0 transition-transform duration-500 animate-pulse">
              {currentInstruction.icon}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {currentInstruction.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {currentInstruction.description}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={prevInstruction}
              disabled={currentInstructionStep === 0}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </button>

            <div className="flex space-x-2">
              {instructions.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentInstructionStep
                      ? "bg-purple-600 animate-pulse"
                      : index < currentInstructionStep
                      ? "bg-emerald-500"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              ))}
            </div>

            {currentInstructionStep === instructions.length - 1 ? (
              <button
                onClick={startQuizAttempt}
                disabled={!!error}
                className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full hover:from-blue-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <span className="mr-2">🚀</span>
                Start Quiz
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                onClick={nextInstruction}
                className="inline-flex items-center px-4 pl-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 overflow-auto z-50">
      {/* Main quiz content container */}
      <div>
        {/* Fullscreen Required Overlay */}
        {proctoringSettings?.require_fullscreen && !isFullscreenMode && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-2xl border border-gray-200 dark:border-gray-700">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400/20 to-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Fullscreen Required
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                You must be in fullscreen mode to continue taking this quiz.
                Click the button below to enter fullscreen.
              </p>
              <button
                onClick={requestFullscreen}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full hover:from-blue-700 hover:to-blue-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl"
              >
                <svg
                  className="w-5 h-5 inline mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                Enter Fullscreen
              </button>
            </div>
          </div>
        )}

        {/* Content Disabled Overlay */}
        {contentDisabled && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-lg w-full mx-4 text-center shadow-2xl border border-red-300 dark:border-red-700">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Quiz Temporarily Disabled
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6 text-lg leading-relaxed">
                Your quiz interaction has been paused due to a proctoring
                violation. Please check your camera feed and resolve the issue
                to continue.
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                  How to Resolve:
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 text-left">
                  <li>• Ensure your face is clearly visible in the camera</li>
                  <li>• Remove any phones or unauthorized objects from view</li>
                  <li>• Look directly at the camera/screen</li>
                  <li>• Stay in fullscreen mode if required</li>
                </ul>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                The floating camera monitor shows real-time status and specific
                issues.
              </p>
            </div>
          </div>
        )}
        {/* Violation Warning Popup */}
        {showViolationWarning && currentViolation && (
          <div className="fixed top-4 left-4 z-50 max-w-md w-full mx-4">
            <div
              className={`bg-white dark:bg-gray-900 border rounded-lg shadow-lg p-4 ${
                currentViolation.severity === "critical"
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                  : currentViolation.severity === "high"
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                  : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    currentViolation.severity === "critical"
                      ? "bg-red-500"
                      : currentViolation.severity === "high"
                      ? "bg-orange-500"
                      : "bg-yellow-500"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm ${
                      currentViolation.severity === "critical"
                        ? "text-red-800 dark:text-red-200"
                        : currentViolation.severity === "high"
                        ? "text-orange-800 dark:text-orange-200"
                        : "text-yellow-800 dark:text-yellow-200"
                    }`}
                  >
                    Proctoring Alert
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      currentViolation.severity === "critical"
                        ? "text-red-700 dark:text-red-300"
                        : currentViolation.severity === "high"
                        ? "text-orange-700 dark:text-orange-300"
                        : "text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    {currentViolation.message}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Please ensure you follow all testing guidelines to avoid
                    violations.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowViolationWarning(false);
                    setCurrentViolation(null);
                  }}
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 ${
                    currentViolation.severity === "critical"
                      ? "text-red-600"
                      : currentViolation.severity === "high"
                      ? "text-orange-600"
                      : "text-yellow-600"
                  }`}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Proctoring Monitor Component */}
      {proctoringSession &&
        proctoringSettings &&
        proctoringVideoElement &&
        proctoringStream && (
          <ProctoringMonitorComponent
            sessionToken={proctoringSession.session_token}
            quizId={id!}
            settings={proctoringSettings}
            videoElement={proctoringVideoElement}
            stream={proctoringStream}
            isActive={proctoringMonitorActive}
            onViolation={handleProctoringViolation}
            onStatusUpdate={(_status) => {
              // Update monitoring active state based on actual monitoring status
              setProctoringMonitorActive(true);
            }}
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
            onViolation={handleProctoringViolation}
            onViolationResolved={() => setContentDisabled(false)}
          />
        )}

      {/* Proctoring Error Display */}
      {proctoringError && (
        <div className="fixed bottom-4 left-4 z-40 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 max-w-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-700 dark:text-red-300 truncate">
                {proctoringError}
              </p>
            </div>
            <button
              onClick={() => setProctoringError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-xs leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
              <div>
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                  Quiz Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setError(null);
                  if (showInstructions) {
                    // Already in instructions, just clear error
                  } else {
                    setShowInstructions(true);
                  }
                }}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => setError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                <span className="sr-only">Close error</span>×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div>
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {quiz.title}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Progress Indicator */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progress
              </span>
              <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[3rem]">
                {answeredQuestions}/{totalQuestions}
              </span>
            </div>

            {/* Question Timer */}
            {currentQuestion?.time_limit_seconds && (
              <QuestionTimer
                key={`question-timer-${currentQuestionIndex}`} // Force re-mount on question change
                timeLeft={currentQuestion.time_limit_seconds}
                onTimeout={() => {
                  // Auto-submit current question and move to next
                  const currentAnswer = answers.find(
                    (a) => a.question_id === currentQuestion.id
                  )?.answer;

                  if (currentAnswer) {
                    // Submit the question automatically
                    updateAnswer(currentQuestion.id, currentAnswer);
                    // Mark as submitted and move to next
                    if (currentQuestionIndex < totalQuestions - 1) {
                      setCurrentQuestionIndex((prev) => prev + 1);
                    } else {
                      submitQuiz();
                    }
                  } else {
                    // If no answer, just move to next question
                    if (currentQuestionIndex < totalQuestions - 1) {
                      setCurrentQuestionIndex((prev) => prev + 1);
                    } else {
                      submitQuiz();
                    }
                  }
                }}
              />
            )}

            {/* Submit Button */}
            <button
              onClick={async () => {
                await submitCurrentAnswer();
                setShowConfirmSubmit(true);
              }}
              disabled={
                isSubmitting || answeredQuestions === 0 || contentDisabled
              }
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 inline" />
                  Submit Quiz
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden" data-resizable-container>
        {/* Column 1: Question Details */}
        <div
          className={`overflow-y-auto p-6 ${
            (proctoringSettings?.require_fullscreen && !isFullscreenMode) ||
            contentDisabled
              ? "blur-sm pointer-events-none select-none"
              : ""
          }`}
          style={{
            width: `${columnSizes.left}%`,
            height: "calc(100vh - 160px)",
          }}
        >
          <div className="space-y-6">
            {/* Question Image */}
            {currentQuestion?.question_data &&
              typeof currentQuestion.question_data === "object" &&
              "question_image" in currentQuestion.question_data && (
                <div>
                  <img
                    src={(currentQuestion.question_data as any).question_image}
                    alt="Question"
                    className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
                  />
                </div>
              )}

            {/* Problem Statement */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Problem Statement
              </h3>
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {(() => {
                  try {
                    // Handle case where question_text might be stored as JSON
                    const text = currentQuestion?.question_text;
                    if (typeof text === "string") {
                      // Try to parse as JSON first, fallback to string
                      try {
                        const parsed = JSON.parse(text);
                        return typeof parsed === "string" ? parsed : text;
                      } catch {
                        return text;
                      }
                    }
                    return text || "Question text not available";
                  } catch (error) {
                    console.error("Error parsing question text:", error);
                    return "Question text not available";
                  }
                })()}
              </div>
            </div>

            {/* Constraints */}
            {currentQuestion?.question_data &&
              typeof currentQuestion.question_data === "object" &&
              "constraints" in currentQuestion.question_data &&
              (currentQuestion.question_data as any).constraints && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                    Constraints
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {(currentQuestion.question_data as any).constraints}
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Resizer */}
        <div
          className="w-1 bg-gray-300 dark:bg-gray-600 cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors relative"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-0.5 bg-gray-400 dark:bg-gray-500"></div>
        </div>

        {/* Column 2: Answering and Testing */}
        <div
          className={`overflow-y-auto p-6 ${
            (proctoringSettings?.require_fullscreen && !isFullscreenMode) ||
            contentDisabled
              ? "blur-sm pointer-events-none select-none"
              : ""
          }`}
          style={{
            width: `${columnSizes.right}%`,
            height: "calc(100vh - 160px)",
          }}
        >
          <div className="space-y-6">
            {/* Answer Input */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Your Answer
              </h3>
              <div className="space-y-4">
                {currentQuestion && renderQuestion(currentQuestion)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() =>
              setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
            }
            disabled={currentQuestionIndex === 0 || contentDisabled}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2 inline" />
            Previous
          </button>

          <div className="flex items-center gap-2">
            {quizQuestions.map((question, index) => {
              const isAnswered = answers.find(
                (a) => a.question_id === question.id
              );
              return (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  disabled={contentDisabled}
                  className={`w-8 h-8 rounded-xl text-sm font-medium transition-colors ${
                    index === currentQuestionIndex
                      ? "bg-blue-500 text-white"
                      : isAnswered
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                  } ${contentDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={async () => {
              await submitCurrentAnswer();
              setCurrentQuestionIndex((prev) =>
                Math.min(totalQuestions - 1, prev + 1)
              );
            }}
            disabled={
              currentQuestionIndex === totalQuestions - 1 || contentDisabled
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2 inline" />
          </button>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ready to Submit?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                You have answered {answeredQuestions} out of {totalQuestions}{" "}
                questions.
                <br />
                This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirmSubmit(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Continue Quiz
                </button>
                <button
                  onClick={submitQuiz}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 inline" />
                      Submit Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Settings Confirmation Modal */}
      {audioConfirmationRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
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
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Audio Settings Adjustment
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                The proctor is requesting to adjust your audio settings:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Volume:</span>
                    <span className="font-medium">
                      {Math.round(audioConfirmationRequest.volume * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Microphone Gain:</span>
                    <span className="font-medium">
                      {Math.round(audioConfirmationRequest.micGain * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-6">
                This will adjust your audio levels for better communication
                during the quiz.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleAudioConfirmation(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleAudioConfirmation(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grade Summary Modal */}
      {showGradeSummary && gradeSummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 text-center shadow-2xl border border-gray-200">
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Quiz Submitted Successfully!
              </h2>
              <p className="text-gray-600">{gradeSummary.quiz_title}</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6">
                <div className="text-center">
                  <div
                    className={`text-5xl font-bold mb-2 ${
                      gradeSummary.percentage >= 90
                        ? "text-green-600"
                        : gradeSummary.percentage >= 80
                        ? "text-blue-600"
                        : gradeSummary.percentage >= 70
                        ? "text-yellow-600"
                        : gradeSummary.percentage >= 60
                        ? "text-orange-600"
                        : "text-red-600"
                    }`}
                  >
                    {Math.round(gradeSummary.percentage)}%
                  </div>
                  <div className="text-lg font-semibold text-gray-700 mb-1">
                    Grade:{" "}
                    {gradeSummary.percentage >= 90
                      ? "A"
                      : gradeSummary.percentage >= 80
                      ? "B"
                      : gradeSummary.percentage >= 70
                      ? "C"
                      : gradeSummary.percentage >= 60
                      ? "D"
                      : "F"}
                  </div>
                  <div
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                      gradeSummary.passed
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {gradeSummary.passed ? "✓ Passed" : "✗ Failed"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {gradeSummary.final_score}
                  </div>
                  <div className="text-sm text-gray-600">Points Earned</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {gradeSummary.max_score}
                  </div>
                  <div className="text-sm text-gray-600">Total Points</div>
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>Redirecting to detailed results in a few seconds...</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                <div className="bg-blue-500 h-1 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Terminated Modal */}
      {showQuizTerminated && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 text-center shadow-2xl border border-red-300">
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Quiz Terminated
              </h2>
              <p className="text-gray-600 mb-4">
                Your quiz session has been terminated by the instructor.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Reason:
              </h3>
              <p className="text-red-700 leading-relaxed">
                {terminationReason}
              </p>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>Your quiz will be submitted automatically...</p>
              <div className="mt-2 w-full bg-red-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizTakingPage;
