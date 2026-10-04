import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Check,
  Trophy,
  Dumbbell,
  Flag,
  CloudOff,
  Cloud,
  RotateCcw,
  ListChecks,
  SkipForward,
  Lock,
} from "lucide-react";
import QuestionTimer from "../components/ui/QuestionTimer";
import { toast } from "react-toastify";
import { QuestionRenderer } from "../components/Quizzes/QuestionRenderer";
import { ProctoringSetup } from "../components/Proctoring";
import ProctoringMonitorComponent from "../components/Proctoring/ProctoringMonitorComponent";
import FloatingCameraComponent from "../components/Proctoring/FloatingCameraComponent";
import WarningNotification from "../components/Proctoring/WarningNotification";
import NoteNotification from "../components/Proctoring/NoteNotification";
import PauseOverlay from "../components/Proctoring/PauseOverlay";
import type {
  Quiz,
  QuizQuestion,
  AnswerDataType,
  QuestionComponentProps,
} from "../types/quiz.types";
import RichTextDisplay from "../components/Common/RichTextDisplay";
import { liveSocketAuth } from "../utils/liveSocketAuth";
import {
  BACKGROUND_SAVE_TYPES,
  formatClock,
  hasAnswerValue,
  mergeAnswers,
  quizTimingMode,
  resolveDeadline,
  secondsUntil,
  isQuestionLocked,
  loadTimeBank,
  nextAfterTimeout,
  secondsLeftOn,
  secondsSpentOn,
  timeBankKey,
  type QuestionTimeBank,
} from "../utils/quizTimer";
import { useFocusMode } from "../utils/focusMode";
import { formatDuration } from "../utils/quizFormValidation";
import { releaseProctoringMedia, streamHasCamera } from "../utils/proctoringMedia";

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
  end_time?: string | null;
  /** Server-computed seconds left on a timed attempt (null = untimed). */
  time_remaining_seconds?: number | null;
  answers?: any[];
}

/** Background-save status shown in the footer (overall-duration mode). */
type SyncState = "idle" | "saving" | "saved" | "offline";

const isTimeExpiredError = (error: any) =>
  error?.response?.status === 409 &&
  error?.response?.data?.code === "ATTEMPT_TIME_EXPIRED";

/** localStorage read that never throws (private mode, blocked storage). */
const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const questionLimit = (q: QuizQuestion | null | undefined): number | null => {
  const limit = Number(q?.questionBank?.time_limit_seconds);
  return Number.isFinite(limit) && limit > 0 ? limit : null;
};

const QuizTakingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Nothing floats over a quiz in progress (install prompts and the like).
  useFocusMode();
  const [quiz, setQuiz] = useState<QuizTakingQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const quizQuestions = quiz?.questions || [];
  const currentQuestion = quizQuestions[currentQuestionIndex] || null;
  const totalQuestions = quizQuestions.length;
  const answeredQuestions = answers.filter((a) => hasAnswerValue(a.answer)).length;
  const progress =
    totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
  // Overall-duration mode: one countdown for the whole attempt, anchored to
  // the server deadline. Per-question mode: each question has its own timer.
  const timingMode = quizTimingMode(quiz);
  const isOverallTimed = timingMode === "overall";
  const overallTotalSeconds = isOverallTimed ? Number(quiz?.time_limit) * 60 : 0;
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timeUpState, setTimeUpState] = useState<
    null | "submitting" | "failed"
  >(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(
    () => new Set(),
  );
  const autoSubmitStartedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const warnedAtRef = useRef<Set<number>>(new Set());
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setIsCurrentSaved] = useState(true);
  const AUTO_SAVE_TYPES: string[] = [
    "single_choice",
    "multiple_choice",
    "true_false",
    "matching",
    "fill_blank",
    "dropdown",
    "numerical",
    "algorithmic",
    "short_answer",
    "coding",
    "logical_expression",
    "drag_drop",
    "ordering",
  ];
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
  const [socketConnected, setSocketConnected] = useState(false);
  const [showConnectionPopup, setShowConnectionPopup] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [proctoringSettings, setProctoringSettings] = useState<any>(null);
  const [proctoringVideoElement, setProctoringVideoElement] =
    useState<HTMLVideoElement | null>(null);
  const [proctoringStream, setProctoringStream] = useState<MediaStream | null>(
    null,
  );
  const [proctoringMonitorActive, setProctoringMonitorActive] = useState(false);
  const hasProctoringCamera = streamHasCamera(proctoringStream);
  // Stable settings for the proctoring components. Built inline, they were a
  // new object on every render (the clock re-renders every second), which
  // restarted the camera's detection loop each time and, for microphone-only
  // sessions, stopped and restarted monitoring (and its socket) each second.
  const monitorSettings = useMemo(
    () =>
      !proctoringSettings || hasProctoringCamera
        ? proctoringSettings
        : {
            // Microphone-only session: no camera-based checks, which
            // would otherwise flag violations nobody can fix.
            ...proctoringSettings,
            enable_face_detection: false,
            enable_object_detection: false,
            min_camera_level: 0,
          },
    [proctoringSettings, hasProctoringCamera],
  );
  const cameraSettings = useMemo(
    () => ({
      enableFaceDetection: proctoringSettings?.enable_face_detection,
      faceDetectionSensitivity: proctoringSettings?.face_detection_sensitivity,
      enableObjectDetection: proctoringSettings?.enable_object_detection,
      objectDetectionSensitivity:
        proctoringSettings?.object_detection_sensitivity,
    }),
    [proctoringSettings],
  );
  // Latest stream for cleanup/socket callbacks that outlive a render.
  const proctoringStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    proctoringStreamRef.current = proctoringStream;
  }, [proctoringStream]);
  // Leaving the page (submitted, navigated away, closed) turns the camera
  // and microphone off and drops the live proctoring connection.
  useEffect(() => {
    return () => releaseProctoringMedia([proctoringStreamRef.current]);
  }, []);
  const [proctoringError, setProctoringError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [isExamPaused, setIsExamPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<any>(null);
  // contentDisabled removed — violations no longer block quiz; use isExamPaused for instructor-initiated pauses
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [isCodingFullscreen, setIsCodingFullscreen] = useState(false);
  // Per-question timing: the clock of the question on screen, and every
  // question's remaining seconds (paused while away, so a skipped question
  // can be finished later). See QuestionTimeBank in utils/quizTimer.
  const [questionClock, setQuestionClock] = useState<{
    questionId: number;
    left: number;
  } | null>(null);
  const [timeBank, setTimeBank] = useState<QuestionTimeBank>(() =>
    id ? loadTimeBank(safeGet(timeBankKey(id))) : {},
  );
  const timeBankRef = useRef<QuestionTimeBank>(timeBank);
  const timedOutRef = useRef<Set<number>>(new Set());
  // Questions the student has opened (unanswered + visited = skipped).
  const [visitedIds, setVisitedIds] = useState<Set<number>>(new Set());
  // Last answer sent to the server per question, so moving on only saves changes.
  const lastSavedRef = useRef<Map<number, string>>(new Map());
  const [ackUnanswered, setAckUnanswered] = useState(false);
  const questionStartTimeRef = React.useRef<number>(Date.now());

  const getQuestionStartKey = useCallback(
    (questionId: number) => `quiz_${id}_question_${questionId}_started_at`,
    [id],
  );
  const [explicitlySavedQuestions, setExplicitlySavedQuestions] = useState<
    Set<string>
  >(new Set());

  // Track which question was just saved via forceSave to prevent useEffect from overriding
  const justSavedQuestionRef = React.useRef<string | null>(null);

  // Latest answers ref to avoid stale state in callbacks
  const latestAnswersRef = React.useRef<Answer[]>(answers);
  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  // Audio confirmation state
  const [audioConfirmationRequest, setAudioConfirmationRequest] = useState<{
    volume: number;
    micGain: number;
    requestId: string;
    sessionToken: string;
  } | null>(null);
  const socketRef = useRef<any>(null);
  // Stable ref to submitQuiz — avoids stale closures inside timer/socket callbacks
  const submitQuizRef = useRef<(opts?: { auto?: boolean }) => Promise<boolean>>(
    async () => false,
  );

  // Volume check state
  const [showVolumeCheck, setShowVolumeCheck] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isCheckingVolume, setIsCheckingVolume] = useState(false);
  const [volumeCheckPassed, setVolumeCheckPassed] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isPlayingSpeakerTest, setIsPlayingSpeakerTest] = useState(false);
  const [speakerTestConfirmed, setSpeakerTestConfirmed] = useState(false);
  const [speakerTestPlayed, setSpeakerTestPlayed] = useState(false);

  const authorInstructions = (quiz?.instructions || "").trim();
  const studentState = quiz?.student_state;
  const canStartQuiz = studentState ? studentState.can_start : true;

  const instructions: {
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode;
  }[] = [
    // The author's own instructions come first when there are any.
    ...(authorInstructions
      ? [
          {
            icon: <ListChecks className="h-8 w-8 text-blue-600" />,
            title: "From your teacher",
            description: (
              <div className="mx-auto max-h-64 max-w-2xl overflow-y-auto text-left">
                <RichTextDisplay content={authorInstructions} />
              </div>
            ),
          },
        ]
      : []),
    {
      icon: <BookOpen className="h-8 w-8 text-blue-600" />,
      title: "Read Carefully",
      description:
        "Read each question thoroughly before answering. Take your time to understand what is being asked.",
    },
    {
      icon: <Timer className="h-8 w-8 text-amber-600" />,
      title: "Manage Your Time",
      description: isOverallTimed
        ? `You have ${formatDuration(
            Number(quiz?.time_limit),
          )} for the whole quiz. The timer starts when you begin and keeps running even if you leave the page. When it reaches zero, the quiz is submitted automatically with the answers you have given.`
        : "Each question has its own time limit, shown at the top. When a question's time runs out you move on to the next one automatically and can't go back to it.",
    },
    {
      icon: <Target className="h-8 w-8 text-blue-600" />,
      title: "Answer All Questions",
      description: isOverallTimed
        ? "Move freely between questions with Previous / Next or the numbered buttons, change any answer until time runs out, and flag questions you want to come back to."
        : "Make sure to answer all questions. You can navigate between questions using the buttons at the bottom.",
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

  useEffect(() => {
    if (!currentQuestion || !id) {
      questionStartTimeRef.current = Date.now();
      return;
    }

    const key = getQuestionStartKey(currentQuestion.id);
    const existing = localStorage.getItem(key);
    const parsed = existing ? Number(existing) : NaN;
    const maxStalenessMs = Math.max(
      (currentQuestion?.questionBank?.time_limit_seconds ?? 600) * 1000 * 2,
      10 * 60 * 1000, // 10 minutes floor
    );
    const isStale = !Number.isFinite(parsed) || parsed <= 0 || (Date.now() - parsed) > maxStalenessMs;

    if (!isStale) {
      questionStartTimeRef.current = parsed;
    } else {
      const now = Date.now();
      questionStartTimeRef.current = now;
      localStorage.setItem(key, String(now));
    }
  }, [currentQuestionIndex, currentQuestion?.id, id, getQuestionStartKey]);

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
          // console.error("Error parsing saved answers:", error);
          localStorage.removeItem(quizSessionKey);
        }
      }

      // The old client-side timer snapshot is obsolete: the attempt deadline
      // now always comes from the server.
      localStorage.removeItem(timerSessionKey);

      try {
        const flagged = JSON.parse(
          localStorage.getItem(`quiz_${id}_flagged`) || "[]",
        );
        if (Array.isArray(flagged)) setFlaggedQuestions(new Set(flagged.map(Number)));
      } catch {
        localStorage.removeItem(`quiz_${id}_flagged`);
      }

      // Clear any stale locked indices from localStorage
      localStorage.removeItem(`quiz_${id}_locked_indices`);
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

  // Overall countdown. Recomputed from the deadline on every tick (and when
  // the tab becomes visible again) instead of decrementing a counter, so it
  // can't drift from the server. It deliberately keeps running during an
  // instructor pause: the server deadline doesn't pause either.
  useEffect(() => {
    if (!isOverallTimed || deadline === null) return;
    const tick = () => setTimeLeft(secondsUntil(deadline));
    tick();
    const interval = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isOverallTimed, deadline]);

  // Heads-up toasts at 5 and 1 minute(s) left.
  useEffect(() => {
    if (!isOverallTimed || deadline === null || showInstructions) return;
    for (const mark of [300, 60]) {
      if (
        timeLeft > 0 &&
        timeLeft <= mark &&
        overallTotalSeconds > mark &&
        !warnedAtRef.current.has(mark)
      ) {
        warnedAtRef.current.add(mark);
        toast.warn(
          mark === 60
            ? "1 minute left — the quiz will submit automatically."
            : "5 minutes left. Review any flagged or unanswered questions.",
          { position: "top-center", autoClose: 5000 },
        );
      }
    }
  }, [timeLeft, isOverallTimed, deadline, showInstructions, overallTotalSeconds]);

  // Time's up → submit the whole quiz once, with every answer given so far.
  useEffect(() => {
    if (!isOverallTimed || deadline === null) return;
    if (!existingSubmission || autoSubmitStartedRef.current) return;
    if (secondsUntil(deadline) > 0) return;
    autoSubmitStartedRef.current = true;
    setTimeUpState("submitting");
    submitQuizRef.current({ auto: true }).then((ok) => {
      if (!ok) setTimeUpState("failed");
    });
  }, [timeLeft, isOverallTimed, deadline, existingSubmission]);

  // Leaving mid-attempt doesn't stop the clock — say so before unloading.
  useEffect(() => {
    if (!isOverallTimed || !existingSubmission || showInstructions) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (submitInFlightRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isOverallTimed, existingSubmission, showInstructions]);

  // Initialize socket connection for audio confirmation when proctoring session is active
  useEffect(() => {
    if (proctoringSession && !showProctoringSetup && !showInstructions) {
      const initializeSocket = async () => {
        try {
          const { io } = await import("socket.io-client");
          const socket = io(
            import.meta.env.VITE_SOCKET_URL || "http://localhost:5002",
            {
              transports: ["polling", "websocket"],
              auth: liveSocketAuth,
            },
          );

          socket.on("connect", () => {
            setSocketConnected(true);
            setShowConnectionPopup(true);
            setConnectionError(null);
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
                data.reason || "Quiz terminated by instructor",
              );
              setShowQuizTerminated(true);
              // Auto-submit after 3s using the latest submitQuiz via ref (avoids stale closure)
              setTimeout(() => {
                submitQuizRef.current();
              }, 3000);
            }
          });

          // Listen for warning from instructor
          socket.on("send-warning-to-student", (data: any) => {
            console.log("Student received send-warning-to-student", data);
            if (data.sessionToken === proctoringSession.session_token) {
              console.log("Setting warning state - message:", data.message);
              setWarningMessage(data.message || "Warning from instructor");
              setShowWarning(true);
              console.log(
                "showWarning set to true, warningMessage:",
                data.message,
              );
            } else {
              console.log(
                "Session token mismatch:",
                data.sessionToken,
                "vs",
                proctoringSession.session_token,
              );
            }
          });

          // Listen for note from instructor
          socket.on("send-note-to-student", (data: any) => {
            console.log("Student received send-note-to-student", data);
            if (data.sessionToken === proctoringSession.session_token) {
              setNoteMessage(data.message || "Note from instructor");
              setShowNote(true);
            }
          });

          // Listen for exam pause from instructor
          socket.on("pause-student-exam", (data: any) => {
            console.log("Student received pause-student-exam", data);
            if (data.sessionToken === proctoringSession.session_token) {
              setPauseReason(data.reason || "Exam paused by instructor");
              setIsExamPaused(true);
              // Emit status change to server
              socket.emit("exam-status-changed", {
                sessionToken: proctoringSession.session_token,
                status: "paused",
              });
            }
          });

          // Listen for exam resume from instructor
          socket.on("resume-student-exam", (data: any) => {
            console.log("Student received resume-student-exam", data);
            if (data.sessionToken === proctoringSession.session_token) {
              setIsExamPaused(false);
              setPauseReason("");
              // Emit status change to server
              socket.emit("exam-status-changed", {
                sessionToken: proctoringSession.session_token,
                status: "active",
              });
            }
          });

          // Listen for quiz restart command from instructor
          socket.on("restart-student-quiz", (data: any) => {
            console.log("Student received restart-student-quiz", data);
            if (data.sessionToken === proctoringSession.session_token) {
              // Clear localStorage and reset quiz state
              if (id) {
                const quizSessionKey = `quiz_${id}_answers`;
                const timerSessionKey = `quiz_${id}_timer`;
                const questionStartPrefix = `quiz_${id}_question_`;
                localStorage.removeItem(quizSessionKey);
                localStorage.removeItem(timerSessionKey);

                for (let i = localStorage.length - 1; i >= 0; i--) {
                  const key = localStorage.key(i);
                  if (key && key.startsWith(questionStartPrefix)) {
                    localStorage.removeItem(key);
                  }
                }
              }
              // Reset quiz state (the server restarted the attempt clock too)
              setAnswers([]);
              setCurrentQuestionIndex(0);
              setFlaggedQuestions(new Set());
              autoSubmitStartedRef.current = false;
              warnedAtRef.current = new Set();
              setTimeUpState(null);
              setDeadline(
                resolveDeadline({
                  startedAt: new Date().toISOString(),
                  timeLimitMinutes: quiz?.time_limit,
                }),
              );
              setQuizStartTime(new Date());
              setIsExamPaused(false);
              setShowWarning(false);
              setShowNote(false);
            }
          });

          // Listen for camera screenshot request from instructor
          socket.on("request-student-camera-screenshot", async (data: any) => {
            console.log(
              "Student received request-student-camera-screenshot",
              data,
            );
            console.log("Current state:", {
              hasProctoringSession: !!proctoringSession,
              sessionToken: proctoringSession?.session_token,
              hasVideoElement: !!proctoringVideoElement,
              hasSocketRef: !!socketRef.current,
            });
            if (data.sessionToken === proctoringSession?.session_token) {
              await captureAndSendCameraScreenshot(socket);
            }
          });

          // Listen for interface screenshot request from instructor
          socket.on(
            "request-student-interface-screenshot",
            async (data: any) => {
              console.log(
                "Student received request-student-interface-screenshot",
                data,
              );
              if (data.sessionToken === proctoringSession.session_token) {
                await captureAndSendInterfaceScreenshot(socket);
              }
            },
          );

          socket.on("disconnect", () => {
            setSocketConnected(false);
          });

          socket.on("connect_error", (error: any) => {
            setSocketConnected(false);
            setConnectionError("Connection lost. Attempting to reconnect...");
          });

          socketRef.current = socket;
          console.log("Socket connected, socket id:", socket.id);
        } catch (error) {
          console.error("Error initializing socket in QuizTakingPage:", error);
        }
      };

      initializeSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
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
      // console.error("Error fetching quiz:", error);

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

  /** Answers saved on the server for an attempt, in the page's Answer shape. */
  const serverAnswersOf = (submission: QuizSubmission): Answer[] =>
    (submission.answers || [])
      .map((a: any) => ({
        question_id: Number(a.question_id),
        answer: a.answer_data ?? a.user_answer,
        time_taken: a.time_taken || 0,
      }))
      .filter((a) => a.answer !== undefined && a.answer !== null);

  /** Adopt an in-progress attempt from the server (fresh start or resume). */
  const adoptSubmission = (submission: QuizSubmission) => {
    setExistingSubmission(submission);
    const serverAnswers = serverAnswersOf(submission);
    if (serverAnswers.length) {
      setAnswers((prev) => {
        const merged = mergeAnswers(prev, serverAnswers);
        try {
          localStorage.setItem(`quiz_${id}_answers`, JSON.stringify(merged));
        } catch {
          // Storage full or blocked: state still holds it.
        }
        return merged;
      });
    }
    if (isOverallTimed) {
      setDeadline(
        resolveDeadline({
          timeRemainingSeconds: submission.time_remaining_seconds,
          endTime: submission.end_time,
          startedAt: submission.started_at,
          timeLimitMinutes: quiz?.time_limit,
        }),
      );
    }
  };

  /** The server closed an attempt whose time had already run out. */
  const goToFinalizedResults = (data: any, message?: string) => {
    clearLocalQuizState();
    toast.info(
      message ||
        "Time ran out on this attempt. It was submitted with your saved answers.",
      { autoClose: 6000 },
    );
    navigate(`/quizzes/${id}/results`, {
      state: { submissionId: data?.submission_id },
      replace: true,
    });
  };

  const checkExistingSubmission = async () => {
    try {
      const response = await axios.get(
        `/quizzes/submissions?quiz_id=${id}&status=in_progress`,
      );
      const submissions: QuizSubmission[] = response.data.data;
      if (!submissions || submissions.length === 0) return;

      const submission = submissions[0];
      adoptSubmission(submission);

      // Start at the first question without an answer.
      const answeredIds = new Set([
        ...serverAnswersOf(submission).map((a) => a.question_id),
        ...latestAnswersRef.current.map((a) => Number(a.question_id)),
      ]);
      const firstOpen = quizQuestions.findIndex((q) => !answeredIds.has(q.id));
      if (firstOpen > 0) setCurrentQuestionIndex(firstOpen);

      // Instructions stay up so the student re-enters through "Start" (and
      // proctoring set-up, when enabled); the countdown shown there is live.
    } catch {
      // Not fatal: "Start" creates or resumes the attempt anyway.
    }
  };

  const startQuizAttempt = async () => {
    try {
      setError(null);
      await proceedWithQuizStart();
    } catch (error: any) {
      let errorMessage = "Failed to start quiz. Please try again.";

      if (error.response?.data?.message) {
        const serverMessage = error.response.data.message;
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
      setError(
        error?.response?.data?.message || "Failed to start quiz. Please try again.",
      );
    }
  };

  const startQuizNormally = async () => {
    let submission: QuizSubmission;
    try {
      // Creates the attempt, or returns the one already in progress (resume).
      const response = await axios.post(`/quizzes/submissions`, {
        quiz_id: parseInt(id!),
        status: "in_progress",
      });
      submission = response.data.data;
    } catch (error: any) {
      if (isTimeExpiredError(error)) {
        goToFinalizedResults(error.response.data.data, error.response.data.message);
        return;
      }
      throw error;
    }

    adoptSubmission(submission);
    setQuizStartTime(
      submission.started_at ? new Date(submission.started_at) : new Date(),
    );
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
          // console.error("Failed to enter fullscreen:", error);
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
    stream: MediaStream,
  ) => {
    setProctoringVideoElement(videoElement);
    setProctoringStream(stream);
  };

  // Capture camera screenshot and send to instructor
  // Accept optional socket parameter to avoid closure issues
  const captureAndSendCameraScreenshot = async (socket?: any) => {
    const activeSocket = socket || socketRef.current;
    // Microphone-only session: there is no camera picture to send.
    if (!streamHasCamera(proctoringStreamRef.current)) return;

    console.log("captureAndSendCameraScreenshot called:", {
      hasVideoElement: !!proctoringVideoElement,
      hasProctoringStream: !!proctoringStream,
      hasSocket: !!activeSocket,
      proctoringSession: !!proctoringSession,
    });

    // Try to get video element from DOM if not in state
    let videoEl = proctoringVideoElement;
    if (!videoEl) {
      const videos = document.querySelectorAll("video");
      console.log("Found videos in DOM:", videos.length);
      if (videos.length > 0) {
        videoEl = videos[0] as HTMLVideoElement;
      }
    }

    if (!videoEl || !activeSocket) {
      console.warn(
        "Cannot capture camera screenshot: missing video element or socket",
        {
          hasVideoElement: !!videoEl,
          hasSocket: !!activeSocket,
        },
      );
      return;
    }

    try {
      // Create a canvas to capture the video frame
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth || 640;
      canvas.height = videoEl.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Could not get canvas context");
        return;
      }

      // Draw the current video frame to canvas
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      // Convert to base64 JPEG with moderate quality
      const screenshot = canvas.toDataURL("image/jpeg", 0.7);

      // Send to instructor via socket
      activeSocket.emit("student-camera-screenshot", {
        sessionToken: proctoringSession?.session_token,
        screenshot,
      });

      console.log("Camera screenshot captured and sent");
    } catch (error) {
      console.error("Error capturing camera screenshot:", error);
    }
  };

  // Capture quiz interface screenshot and send to instructor
  // Accept optional socket parameter to avoid closure issues
  const captureAndSendInterfaceScreenshot = async (socket?: any) => {
    const activeSocket = socket || socketRef.current;

    console.log("captureAndSendInterfaceScreenshot called:", {
      hasSocket: !!activeSocket,
      sessionToken: proctoringSession?.session_token,
    });

    if (!activeSocket || !proctoringSession?.session_token) {
      console.warn(
        "Cannot capture interface screenshot: missing socket or session",
        {
          hasSocket: !!activeSocket,
          sessionToken: proctoringSession?.session_token,
        },
      );
      return;
    }

    try {
      // Get the root element of the quiz page
      const rootElement = document.getElementById("root") || document.body;

      // Capture the interface using html2canvas
      // Loaded only when an instructor asks for a screenshot.
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(rootElement, {
        logging: false,
        useCORS: true,
        scale: 0.8, // Reduce scale for better performance
      });

      // Convert to base64 JPEG with moderate quality
      const screenshot = canvas.toDataURL("image/jpeg", 0.6);

      // Send to instructor via socket
      activeSocket.emit("student-interface-screenshot", {
        sessionToken: proctoringSession.session_token,
        screenshot,
      });

      console.log("Interface screenshot captured and sent");
    } catch (error) {
      console.error("Error capturing interface screenshot:", error);
    }
  };

  const handleAudioConfirmation = (confirmed: boolean) => {
    if (!audioConfirmationRequest || !socketRef.current) return;

    socketRef.current.emit("student-audio-confirmation", {
      sessionToken: audioConfirmationRequest.sessionToken,
      confirmed,
      requestId: audioConfirmationRequest.requestId,
    });

    // If confirmed, apply the settings to the browser/computer system
    if (confirmed) {
      applySystemAudioSettings(
        audioConfirmationRequest.volume,
        audioConfirmationRequest.micGain,
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
            // console.warn(
            //   "Could not apply microphone gain adjustment:",
            //   micError,
            // );
          }
        }
      }

      // Show user feedback - BROWSER FORCED TO MAXIMUM VOLUME
      const notification = document.createElement("div");
      notification.className =
        "fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl z-50 font-bold border-2 border-red-400 animate-pulse";
      notification.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>
            <path d="M16 9a5 5 0 0 1 0 6"/>
            <path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>
          </svg>
          <div>
            <div class="text-lg font-bold">BROWSER FORCED TO MAXIMUM VOLUME</div>
            <div class="text-sm opacity-90">Volume: ${(volume * 100).toFixed(
              0,
            )}% | Mic: ${(micGain * 100).toFixed(0)}%</div>
          </div>
        </div>
      `;
      document.body.appendChild(notification);

      // Force browser focus and volume
      document.body.focus();
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      // Remove notification after 8 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 8000);
    } catch (error) {
      // console.error("Error applying system audio settings:", error);

      // Fallback notification
      const notification = document.createElement("div");
      notification.className =
        "fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50";
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
      const audioCtx = new (
        AudioContext || (window as any).webkitAudioContext
      )();

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

      // Start monitoring volume levels with the analyser directly
      checkVolumeLevels(analyserNode);
    } catch (error) {
      // console.error("Error starting volume check:", error);
      setError(
        "Unable to access microphone. Please check your browser permissions and try again.",
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

      // Also log raw RMS for debugging

      // Simple check: if RMS is above a very low threshold, there's audio input
      const hasAudioInput = rms > 0.001; // Very low threshold for any audio

      setVolumeLevel(volumePercent);

      // Check if volume meets threshold
      if (volumePercent >= 80) {
        setVolumeCheckPassed(true);
        stopVolumeCheck();
        return;
      }

      // For testing: if RMS is very high (like speaking loudly), also pass
      if (rms > 0.05) {
        // This would be very loud audio
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
        // console.warn("Web Audio API not supported for speaker test");
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
          // console.warn("Error stopping speaker test tone", e);
        }
        setIsPlayingSpeakerTest(false);
      }, 1500);
    } catch (error) {
      // console.error("Error playing speaker test tone:", error);
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

  const handleProctoringViolation = (_violation: any) => {
    // Violations are recorded silently to DB via ProctoringMonitorComponent + socket pipeline.
    // Nothing is shown to the candidate — monitoring is invisible to them.
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

  // Track save status when question changes
  useEffect(() => {
    if (currentQuestion) {
      const qType = (
        currentQuestion.question_type ||
        currentQuestion.questionBank?.question_type ||
        ""
      ).toLowerCase();
      const autoSaveEnabled = AUTO_SAVE_TYPES.includes(qType);

      // Skip if we just saved this question (to avoid overriding the saved state)
      if (justSavedQuestionRef.current === String(currentQuestion.id)) {
        justSavedQuestionRef.current = null; // Clear after reading
        return;
      }

      if (autoSaveEnabled) {
        // These types in AUTO_SAVE_TYPES can auto-save - check if answer exists
        const hasAnswer = answers.some(
          (a) => String(a.question_id) === String(currentQuestion.id),
        );
        setIsCurrentSaved(hasAnswer);
      } else {
        // All other types require explicit save before continuing
        setIsCurrentSaved(
          explicitlySavedQuestions.has(String(currentQuestion.id)),
        );
      }
    }
  }, [currentQuestionIndex, quizQuestions, explicitlySavedQuestions, answers]);

  const updateAnswer = useCallback(
    async (
      questionId: number,
      answer: AnswerDataType,
      forceSave: boolean = false,
    ) => {
      // Determine question type FIRST (before any state updates that trigger useEffect)
      const question = quizQuestions.find(
        (q) => String(q.id) === String(questionId),
      );
      const qType =
        question?.question_type || question?.questionBank?.question_type;
      const normalizedQType = (qType || "").toLowerCase();
      const autoSaveEnabled = AUTO_SAVE_TYPES.includes(normalizedQType);

      // If this is a manual save for a non-auto-save type, set the ref BEFORE setAnswers
      // so the useEffect knows to skip overriding isCurrentSaved
      if (!autoSaveEnabled && forceSave) {
        justSavedQuestionRef.current = String(questionId);
      }

      // Per-question timing counts only the time the question was on screen
      // (across visits), so a skipped question isn't graded as timed out.
      const limit = isOverallTimed ? null : questionLimit(question);
      const timeTakenSeconds = limit
        ? secondsSpentOn(timeBankRef.current, questionId, limit)
        : Math.max(0, Math.floor((Date.now() - questionStartTimeRef.current) / 1000));

      const newAnswer: Answer = {
        question_id: questionId,
        answer,
        time_taken: timeTakenSeconds,
      };

      setAnswers((prev) => {
        const existing = prev.find((a) => a.question_id === questionId);
        let updated: Answer[];
        if (existing) {
          updated = prev.map((a) =>
            a.question_id === questionId ? newAnswer : a,
          );
        } else {
          updated = [...prev, newAnswer];
        }

        // Save answer to localStorage for persistence across reloads
        const quizSessionKey = `quiz_${id}_answers`;
        localStorage.setItem(quizSessionKey, JSON.stringify(updated));

        return updated;
      });

      if (!autoSaveEnabled && !forceSave) {
        setIsCurrentSaved(false);
      }

      if (existingSubmission && (!autoSaveEnabled || forceSave)) {
        try {
          if (forceSave) {
            setIsSubmitting(true);
            setSyncState("saving");
          }
          await QuizApiService.submitQuestionAnswer(
            existingSubmission.id,
            questionId,
            answer,
            timeTakenSeconds,
          );
          if (forceSave) {
            lastSavedRef.current.set(questionId, JSON.stringify(answer));
            setSyncState("saved");
            setIsCurrentSaved(true);
            setExplicitlySavedQuestions((prev) => {
              const next = new Set(prev);
              next.add(String(questionId));
              return next;
            });
            // No toast: it covered the navigation. The footer shows "saved".
          } else if (autoSaveEnabled) {
            // For auto-save types, also enable Next button after API success
            setIsCurrentSaved(true);
          }
        } catch (error: any) {
          if (isTimeExpiredError(error)) {
            // The deadline passed: stop editing; the countdown effect submits.
            setDeadline((d) => (d === null ? d : Math.min(d, Date.now())));
          } else if (forceSave) {
            setSyncState("offline");
          }
        } finally {
          if (forceSave) setIsSubmitting(false);
        }
      }
    },
    [quizQuestions, quizStartTime, existingSubmission, id, isOverallTimed],
  );

  /** Forget this attempt's local copies — only after the server has it. */
  const clearLocalQuizState = useCallback(() => {
    if (!id) return;
    const prefix = `quiz_${id}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) localStorage.removeItem(key);
    }
  }, [id]);

  /**
   * Submit the whole quiz with every answer given so far. Returns true on
   * success. Local copies of the answers are kept until the server confirms,
   * so a failed (auto-)submit never loses work — it can simply be retried.
   * Timed auto-submits retry a few times on network errors by themselves.
   */
  const submitQuiz = useCallback(
    async (opts: { auto?: boolean } = {}): Promise<boolean> => {
      if (!quiz || submitInFlightRef.current) return false;
      submitInFlightRef.current = true;
      setIsSubmitting(true);
      setError(null);

      const payload = () => ({
        quiz_id: quiz.id,
        answers: latestAnswersRef.current.filter((a) => hasAnswerValue(a.answer)),
        time_taken: quizStartTime
          ? Math.floor((Date.now() - quizStartTime.getTime()) / 1000)
          : 0,
        submitted_at: new Date().toISOString(),
      });

      const attempts = opts.auto ? 4 : 1;
      try {
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            const response = await axios.post(`/quizzes/${quiz.id}/submit`, payload());
            const result = response.data.data;

            clearLocalQuizState();
            releaseProctoringMedia([proctoringStreamRef.current]);
            setProctoringStream(null);
            if (result?.timed_out) {
              toast.info(
                response.data.message ||
                  "Time was up — your quiz was submitted with your saved answers.",
                { autoClose: 6000 },
              );
            } else if (opts.auto) {
              toast.success("Time's up — your quiz was submitted.", {
                autoClose: 4000,
              });
            }
            navigate(`/quizzes/${quiz.id}/results`, {
              state: { submissionId: result?.submission_id ?? existingSubmission?.id },
              replace: true,
            });
            return true;
          } catch (error: any) {
            const status = error?.response?.status;
            const serverMessage: string = error?.response?.data?.message || "";

            // Another tab/device already finished this attempt.
            if (status === 400 && /No active quiz session/i.test(serverMessage)) {
              clearLocalQuizState();
              navigate(`/quizzes/${quiz.id}/results`, {
                state: { submissionId: existingSubmission?.id },
                replace: true,
              });
              return true;
            }

            const retriable = !error?.response || status >= 500;
            if (retriable && attempt < attempts) {
              await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
              continue;
            }

            let errorMessage = "Failed to submit quiz. Please try again.";
            if (serverMessage) {
              if (serverMessage.includes("Quiz is not currently available")) {
                errorMessage =
                  "This quiz is no longer available for submission. It may have expired or been completed.";
              } else if (serverMessage.includes("not authorized")) {
                errorMessage =
                  "You are not authorized to submit this quiz. Please make sure you're logged in.";
              } else {
                errorMessage = serverMessage;
              }
            } else if (!error?.response) {
              errorMessage =
                "Couldn't reach the server. Your answers are kept on this device — check your connection and try again.";
            }
            setError(errorMessage);
            return false;
          }
        }
        return false;
      } finally {
        submitInFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [quiz, quizStartTime, existingSubmission, navigate, clearLocalQuizState],
  );

  // Keep ref in sync so timer/socket callbacks always call the latest version
  useEffect(() => {
    submitQuizRef.current = submitQuiz;
  }, [submitQuiz]);

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
      "[data-resizable-container]",
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
      // console.error("Error requesting fullscreen:", error);
      setError(
        "Unable to enter fullscreen mode. Please try again or contact your instructor.",
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
      if (!isCurrentlyFullscreen) {
        setIsCodingFullscreen(false);
        setColumnSizes({ left: 50, right: 50 });
      }

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
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
    };
  }, [
    proctoringSettings,
    showInstructions,
    showProctoringSetup,
    quizStartTime,
  ]);

  // Per-question mode: a question is locked once its own clock ran out.
  const isLockedAt = (index: number) =>
    !isOverallTimed &&
    !!quizQuestions[index] &&
    isQuestionLocked(timeBank, quizQuestions[index].id, questionLimit(quizQuestions[index]));
  const currentLocked = isLockedAt(currentQuestionIndex);
  const perQuestionTimeLeft =
    questionClock && currentQuestion && questionClock.questionId === currentQuestion.id
      ? questionClock.left
      : null;

  const answeringDisabled = isExamPaused || timeUpState !== null || currentLocked;

  const renderQuestion = (
    question: QuizQuestion,
    extraProps: Partial<QuestionComponentProps> = {},
  ) => {
    return (
      <QuestionRenderer
        key={question.id}
        question={question}
        answer={answers.find((a) => a.question_id === question.id)?.answer}
        onAnswerChange={(answer, forceSave) =>
          updateAnswer(question.id, answer, forceSave)
        }
        disabled={answeringDisabled}
        timeRemaining={
          isOverallTimed ? timeLeft : (perQuestionTimeLeft ?? undefined)
        }
        onStart={() => setIsCodingFullscreen(true)}
        onNext={handleNext}
        onToggleFullscreen={(isFullscreen) => {
          setIsCodingFullscreen(isFullscreen);
          if (isFullscreen) {
            setColumnSizes({ left: 0, right: 100 });
            requestFullscreen();
          } else {
            setColumnSizes({ left: 50, right: 50 });
            if (document.fullscreenElement) {
              document.exitFullscreen().catch((err) => console.log(err));
            }
          }
        }}
        {...extraProps}
      />
    );
  };

  /**
   * Quietly save one answer to the server (overall-duration mode). Failures
   * aren't fatal: the answer stays in state + localStorage and goes with the
   * final submit.
   */
  const persistAnswerSilently = useCallback(
    async (questionId: number, answer: AnswerDataType) => {
      if (!existingSubmission || !hasAnswerValue(answer)) return;
      setSyncState("saving");
      try {
        await QuizApiService.submitQuestionAnswer(
          existingSubmission.id,
          questionId,
          answer,
          Math.max(0, Math.floor((Date.now() - questionStartTimeRef.current) / 1000)),
        );
        setSyncState("saved");
      } catch (error: any) {
        if (isTimeExpiredError(error)) {
          setDeadline((d) => (d === null ? d : Math.min(d, Date.now())));
        }
        setSyncState("offline");
      }
    },
    [existingSubmission],
  );

  // Overall mode: auto-save cheap-to-grade answers shortly after they change.
  const currentAnswerValue = currentQuestion
    ? answers.find((a) => a.question_id === currentQuestion.id)?.answer
    : undefined;
  const currentAnswerKey = JSON.stringify(currentAnswerValue ?? null);
  useEffect(() => {
    if (!isOverallTimed || !currentQuestion || timeUpState) return;
    if (currentAnswerValue === undefined) return;
    const qType = (
      currentQuestion.question_type ||
      currentQuestion.questionBank?.question_type ||
      ""
    ).toLowerCase();
    if (!BACKGROUND_SAVE_TYPES.has(qType)) return;
    const t = window.setTimeout(
      () => persistAnswerSilently(currentQuestion.id, currentAnswerValue),
      1200,
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnswerKey, currentQuestion?.id, isOverallTimed, timeUpState]);

  /**
   * Overall mode navigation: any question, any direction. The answer being
   * left is saved in the background (never blocks the move).
   */
  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalQuestions || index === currentQuestionIndex) return;
      if (currentQuestion) {
        const answer = latestAnswersRef.current.find(
          (a) => a.question_id === currentQuestion.id,
        )?.answer;
        if (answer !== undefined) void persistAnswerSilently(currentQuestion.id, answer);
      }
      setCurrentQuestionIndex(index);
    },
    [totalQuestions, currentQuestionIndex, currentQuestion, persistAnswerSilently],
  );

  const toggleFlag = useCallback(
    (questionId: number) => {
      setFlaggedQuestions((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) next.delete(questionId);
        else next.add(questionId);
        try {
          localStorage.setItem(`quiz_${id}_flagged`, JSON.stringify([...next]));
        } catch {
          // Storage full or blocked: state still holds it.
        }
        return next;
      });
    },
    [id],
  );

  const answeredIds = new Set(
    answers.filter((a) => hasAnswerValue(a.answer)).map((a) => a.question_id),
  );
  const unansweredIndices = quizQuestions
    .map((q, i) => (answeredIds.has(q.id) ? -1 : i))
    .filter((i) => i >= 0);

  // ── Per-question timing ──────────────────────────────────────────────────
  // Each question's clock runs only while it is on screen; its remaining
  // seconds are banked (and kept on this device) when the student moves away,
  // so a skipped question can be finished later with the time it had left.

  const writeBank = useCallback(
    (questionId: number, left: number) => {
      const next = { ...timeBankRef.current, [questionId]: left };
      timeBankRef.current = next;
      setTimeBank(next);
      if (id) {
        try {
          localStorage.setItem(timeBankKey(id), JSON.stringify(next));
        } catch {
          // Storage blocked: the in-memory bank still applies.
        }
      }
    },
    [id],
  );

  // Opening a question: resume its own clock (or none if it's locked/untimed),
  // and remember it was visited.
  useEffect(() => {
    if (!currentQuestion) return;
    setVisitedIds((prev) =>
      prev.has(currentQuestion.id) ? prev : new Set(prev).add(currentQuestion.id),
    );
    const limit = isOverallTimed ? null : questionLimit(currentQuestion);
    if (!limit) {
      setQuestionClock(null);
      return;
    }
    const left = secondsLeftOn(timeBankRef.current, currentQuestion.id, limit);
    setQuestionClock(left > 0 ? { questionId: currentQuestion.id, left } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, currentQuestion?.id, isOverallTimed]);

  /** Save the answer on screen if it changed since the last save. */
  const saveCurrentIfChanged = useCallback(async () => {
    if (!currentQuestion || currentLocked) return;
    const answer = latestAnswersRef.current.find(
      (a) => a.question_id === currentQuestion.id,
    )?.answer;
    if (!hasAnswerValue(answer)) return;
    const key = JSON.stringify(answer);
    if (lastSavedRef.current.get(currentQuestion.id) === key) return;
    await updateAnswer(currentQuestion.id, answer as AnswerDataType, true);
  }, [currentQuestion, currentLocked, updateAnswer]);

  const handlePerQuestionTimeout = useCallback(async () => {
    if (!currentQuestion || timedOutRef.current.has(currentQuestion.id)) return;
    timedOutRef.current.add(currentQuestion.id);
    setQuestionClock(null);
    writeBank(currentQuestion.id, 0);

    // Keep whatever was answered before the clock ran out.
    const answer = latestAnswersRef.current.find(
      (a) => a.question_id === currentQuestion.id,
    )?.answer;
    if (hasAnswerValue(answer) && lastSavedRef.current.get(currentQuestion.id) !== JSON.stringify(answer)) {
      await updateAnswer(currentQuestion.id, answer as AnswerDataType, true);
    }

    const answered = new Set(
      latestAnswersRef.current.filter((a) => hasAnswerValue(a.answer)).map((a) => a.question_id),
    );
    const next = nextAfterTimeout({
      current: currentQuestionIndex,
      total: totalQuestions,
      isLocked: (i) =>
        isQuestionLocked(timeBankRef.current, quizQuestions[i].id, questionLimit(quizQuestions[i])),
      isAnswered: (i) => answered.has(quizQuestions[i].id),
    });
    if (next.kind === "goto") {
      toast.info(`Time's up for question ${currentQuestionIndex + 1}. Moving to question ${next.index + 1}.`, {
        position: "top-center",
        autoClose: 2500,
      });
      setCurrentQuestionIndex(next.index);
    } else if (next.kind === "review") {
      setAckUnanswered(false);
      setShowConfirmSubmit(true);
    } else {
      // Every question's time is used up: hand the quiz in.
      submitQuizRef.current();
    }
  }, [currentQuestion, currentQuestionIndex, totalQuestions, quizQuestions, updateAnswer, writeBank]);

  // Tick the clock of the question on screen and bank every second, so a
  // reload or a skip never hands back time already used.
  useEffect(() => {
    if (!questionClock) return;
    if (questionClock.left <= 0) {
      void handlePerQuestionTimeout();
      return;
    }
    // Paused with the exam or a violation banner. It keeps running behind the
    // review sheet, so opening it can't be used to stop the clock.
    if (showInstructions || isExamPaused || showViolationWarning) return;

    const timer = setTimeout(() => {
      setQuestionClock((c) => (c ? { ...c, left: Math.max(0, c.left - 1) } : c));
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    questionClock,
    showInstructions,
    isExamPaused,
    showViolationWarning,
    handlePerQuestionTimeout,
  ]);

  useEffect(() => {
    if (questionClock) writeBank(questionClock.questionId, questionClock.left);
  }, [questionClock, writeBank]);

  /**
   * Move to any question, in either timing mode. Per-question mode saves the
   * answer being left first (only if it changed); an unanswered question is
   * simply skipped and keeps the time it had left.
   */
  const navigateTo = useCallback(
    async (index: number) => {
      if (index < 0 || index >= totalQuestions || index === currentQuestionIndex) return;
      if (isOverallTimed) {
        goToQuestion(index);
        return;
      }
      if (isSubmitting) return;
      // Stop this question's clock now; it resumes if the student comes back.
      if (questionClock) {
        writeBank(questionClock.questionId, questionClock.left);
        setQuestionClock(null);
      }
      try {
        await saveCurrentIfChanged();
      } finally {
        setCurrentQuestionIndex(index);
      }
    },
    [
      totalQuestions,
      currentQuestionIndex,
      isOverallTimed,
      goToQuestion,
      isSubmitting,
      questionClock,
      writeBank,
      saveCurrentIfChanged,
    ],
  );

  const handleNext = useCallback(() => navigateTo(currentQuestionIndex + 1), [
    navigateTo,
    currentQuestionIndex,
  ]);

  const openReview = useCallback(async () => {
    if (!isOverallTimed) await saveCurrentIfChanged();
    setAckUnanswered(false);
    setShowConfirmSubmit(true);
  }, [isOverallTimed, saveCurrentIfChanged]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-200">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
            Quiz Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-200 mb-6">
            {error ||
              "The quiz you're looking for doesn't exist or is not available."}
          </p>
          <Link
            to="/my-quizzes"
            onClick={() => setError(null)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl">
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
            <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
              Audio Volume Check
            </h3>
            <p className="text-gray-600 dark:text-gray-200 mb-4 text-sm">
              Please speak or make noise to test your microphone volume. The
              quiz will only start when your audio volume reaches at least 80%.
            </p>

            {/* Volume Level Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
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
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-200 mt-1">
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
                  className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  // Skip the volume check and proceed with quiz
                  stopVolumeCheck();
                  setShowVolumeCheck(false);
                  proceedWithQuizStart();
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full p-8 text-center shadow-2xl">
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

          <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-4">
            Fullscreen Required
          </h2>

          <p className="text-lg text-gray-600 dark:text-gray-200 mb-6 leading-relaxed">
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
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 font-medium"
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

  const timeUpOverlay = timeUpState && (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="time-up-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            timeUpState === "failed"
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          }`}
        >
          {timeUpState === "failed" ? (
            <CloudOff className="h-7 w-7" />
          ) : (
            <Timer className="h-7 w-7" />
          )}
        </div>
        <h3
          id="time-up-title"
          className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Time's up!
        </h3>
        {timeUpState === "submitting" ? (
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting your answers…
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {error || "We couldn't submit your quiz."} Your{" "}
              {answeredQuestions} answer{answeredQuestions === 1 ? " is" : "s are"}{" "}
              kept on this device.
            </p>
            <button
              onClick={async () => {
                setTimeUpState("submitting");
                const ok = await submitQuiz({ auto: true });
                if (!ok) setTimeUpState("failed");
              }}
              disabled={isSubmitting}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Show instructions modal if needed
  if (showInstructions) {
    const currentInstruction = instructions[currentInstructionStep];

    return (
      <div className="flex items-center justify-center p-4 mt-12 h-max">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 max-w-4xl w-full p-8 transform transition-all duration-300">
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

          {timeUpOverlay}
          {existingSubmission && (
            <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 sm:flex-row sm:items-center sm:justify-between dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <span className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 flex-shrink-0" />
                You have an attempt in progress with {answeredQuestions} of{" "}
                {totalQuestions} answered.
              </span>
              {isOverallTimed && deadline !== null && (
                <span className="font-mono font-semibold tabular-nums">
                  {formatClock(timeLeft)} left
                </span>
              )}
            </div>
          )}
          {studentState && !canStartQuiz && (
            <div
              role="alert"
              className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {studentState.availability.state === "not_open" &&
                studentState.availability.opens_at
                  ? `This quiz opens on ${new Date(studentState.availability.opens_at).toLocaleString()}.`
                  : studentState.blocked_reason || "You can't take this quiz right now."}
              </span>
              {studentState.attempts.last_finished_submission_id && (
                <Link
                  to={`/quizzes/${id}/results`}
                  className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  View my results
                </Link>
              )}
            </div>
          )}

          {/* What this quiz is: taken straight from its settings */}
          <dl className="mb-6 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              {
                label: "Questions",
                value: String(quiz.question_count ?? totalQuestions),
              },
              {
                label: "Time",
                value: isOverallTimed
                  ? formatDuration(Number(quiz.time_limit))
                  : "Per question",
              },
              {
                label: "Attempt",
                value: studentState
                  ? studentState.attempts.max_attempts === null
                    ? `${studentState.attempts.current_attempt_number} · unlimited`
                    : `${Math.min(
                        studentState.attempts.current_attempt_number,
                        studentState.attempts.max_attempts,
                      )} of ${studentState.attempts.max_attempts}`
                  : "—",
              },
              {
                label: "Pass mark",
                value: `${Number(quiz.passing_score ?? 60)}%`,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
              >
                <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {item.label}
                </dt>
                <dd className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          {studentState?.availability.closes_at &&
            studentState.availability.state === "open" && (
              <p className="-mt-3 mb-6 text-center text-xs text-gray-500 dark:text-gray-400">
                Closes {new Date(studentState.availability.closes_at).toLocaleString()}
                {quiz.randomize_questions ? " · questions are shuffled for you" : ""}
              </p>
            )}

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-3">
              Quiz Instructions
            </h2>
            {isOverallTimed && (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Timer className="h-3.5 w-3.5" />
                {formatDuration(Number(quiz.time_limit))} for the whole quiz
              </span>
            )}
            <p className="text-gray-600 dark:text-gray-200">
              Step {currentInstructionStep + 1} of {instructions.length}
            </p>
          </div>

          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-2xl flex items-center justify-center mb-4 transform -rotate-3 hover:rotate-0 transition-transform duration-500 animate-pulse">
              {currentInstruction.icon}
            </div>
            <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-3">
              {currentInstruction.title}
            </h3>
            <div className="text-gray-600 dark:text-gray-200 leading-relaxed">
              {currentInstruction.description}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={
                currentInstructionStep === 0
                  ? () => history.back()
                  : prevInstruction
              }
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentInstructionStep === 0 ? "Back" : "Previous"}
            </button>

            <div className="flex space-x-2">
              {instructions.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentInstructionStep
                      ? "bg-blue-600 animate-pulse"
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
                disabled={!!error || !canStartQuiz}
                title={studentState?.blocked_reason || undefined}
                className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-full hover:from-blue-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {existingSubmission ? "Resume Quiz" : "Start Quiz"}
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
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-white dark:bg-gray-900"
    >
      {/* Warning Notification - Orange popup at top of browser */}
      <WarningNotification
        message={warningMessage}
        isVisible={showWarning}
        onClose={() => setShowWarning(false)}
      />

      {/* Note Notification - Blue popup at top of browser */}
      <NoteNotification
        message={noteMessage}
        isVisible={showNote}
        onClose={() => setShowNote(false)}
      />

      {/* Pause Overlay - When exam is paused */}
      <PauseOverlay isVisible={isExamPaused} reason={pauseReason} />

      {timeUpOverlay}

      {/* Main quiz content container */}
      <div>
        {/* Fullscreen Required Overlay */}
        {proctoringSettings?.require_fullscreen && !isFullscreenMode && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
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
              <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                Fullscreen Required
              </h3>
              <p className="text-gray-600 dark:text-gray-200 mb-6 text-sm">
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

      </div>

      {/* Proctoring Monitor Component */}
      {proctoringSession &&
        proctoringSettings &&
        proctoringVideoElement &&
        proctoringStream && (
          <ProctoringMonitorComponent
            sessionToken={proctoringSession.session_token}
            quizId={id!}
            settings={monitorSettings}
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

      {/* Floating Camera Component (only when there is a camera) */}
      {proctoringSession &&
        proctoringSettings &&
        proctoringVideoElement &&
        hasProctoringCamera &&
        proctoringStream && (
          <FloatingCameraComponent
            videoElement={proctoringVideoElement}
            stream={proctoringStream}
            settings={cameraSettings}
            onViolation={handleProctoringViolation}
            onViolationResolved={() => { setShowViolationWarning(false); setCurrentViolation(null); }}
          />
        )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="max-w-8xl mx-auto flex items-center justify-between">
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
      {!isCodingFullscreen && (
        <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 dark:border-gray-700 dark:bg-gray-900/90">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <BookOpen className="hidden h-6 w-6 flex-shrink-0 text-blue-600 sm:block" />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-text-primary-light sm:text-xl dark:text-text-primary-dark">
                  {quiz.title}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-200">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                  {flaggedQuestions.size > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Flag className="h-3 w-3" /> {flaggedQuestions.size} flagged
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
              {/* Progress Indicator */}
              <div className="hidden items-center gap-3 md:flex">
                <div
                  className="h-2 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                  role="progressbar"
                  aria-label="Questions answered"
                  aria-valuemin={0}
                  aria-valuemax={totalQuestions}
                  aria-valuenow={answeredQuestions}
                >
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="min-w-[3rem] text-sm font-medium text-gray-700 dark:text-gray-200">
                  {answeredQuestions}/{totalQuestions}
                </span>
              </div>

              {/* Timer: whole quiz, or the current question. The page owns the
                  countdown and the timeout; the timer only displays it. */}
              {isOverallTimed && deadline !== null ? (
                <QuestionTimer
                  variant="quiz"
                  label="Quiz time left"
                  timeLeft={overallTotalSeconds}
                  totalTime={overallTotalSeconds}
                  currentTime={timeLeft}
                />
              ) : (
                !isOverallTimed &&
                currentQuestion?.questionBank?.time_limit_seconds &&
                (currentLocked ? (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  >
                    <Lock className="h-3.5 w-3.5" /> Time's up
                  </span>
                ) : (
                  <QuestionTimer
                    key={`question-timer-${currentQuestionIndex}`}
                    variant="question"
                    label="Question"
                    timeLeft={currentQuestion.questionBank.time_limit_seconds}
                    currentTime={
                      perQuestionTimeLeft ??
                      currentQuestion.questionBank.time_limit_seconds
                    }
                    paused={isExamPaused || showViolationWarning}
                  />
                ))
              )}

              {/* Submit Button */}
              <button
                onClick={() => void openReview()}
                aria-label="Submit quiz"
                disabled={
                  isSubmitting ||
                  answeredQuestions === 0 ||
                  isExamPaused ||
                  timeUpState !== null
                }
                className="z-10 inline-flex items-center rounded-full bg-green-600 px-3 py-2 font-medium text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 dark:focus-visible:ring-offset-gray-900"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">
                  {isSubmitting ? "Submitting..." : "Submit Quiz"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Answered progress on small screens (the header shows it from md up) */}
      {!isCodingFullscreen && (
        <div className="h-1 w-full flex-shrink-0 bg-gray-100 md:hidden dark:bg-gray-800" aria-hidden>
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Main Content: stacked on phones/tablets, two resizable columns from lg */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
        data-resizable-container
        style={
          {
            "--quiz-left": `${columnSizes.left}%`,
            "--quiz-right": `${columnSizes.right}%`,
          } as React.CSSProperties
        }
      >
        {/* Column 1: Question Details */}
        <div
          className={`w-full flex-shrink-0 p-4 sm:p-6 lg:h-full lg:w-[var(--quiz-left)] lg:overflow-y-auto ${
            (proctoringSettings?.require_fullscreen && !isFullscreenMode) ||
            isExamPaused
              ? "blur-sm pointer-events-none select-none"
              : ""
          } ${isCodingFullscreen ? "hidden" : ""}`}
        >
          {currentLocked && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200"
            >
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Time ran out on this question, so it can't be changed.
                {answeredIds.has(currentQuestion?.id ?? -1)
                  ? " Your answer was kept."
                  : " It will count as unanswered."}
              </span>
            </div>
          )}
          <div className="space-y-6">
            {/* Question Image */}
            {(() => {
              const qData =
                currentQuestion?.question_data ||
                currentQuestion?.questionBank?.question_data;
              if (
                qData &&
                typeof qData === "object" &&
                "question_image" in qData
              ) {
                return (
                  <div>
                    <img
                      src={(qData as any).question_image}
                      alt="Question"
                      className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
                    />
                  </div>
                );
              }
              return null;
            })()}

            {/* Problem Statement */}
            <div>
              <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-3">
                Problem Statement
              </h3>
              <div className="text-gray-700 dark:text-gray-200 leading-relaxed">
                <RichTextDisplay
                  content={(() => {
                    try {
                      // Handle case where question_text might be stored as JSON
                      const text =
                        currentQuestion?.question_text ||
                        currentQuestion?.questionBank?.question_text;
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
                      // console.error("Error parsing question text:", error);
                      return "Question text not available";
                    }
                  })()}
                />
              </div>
            </div>

            {/* Constraints */}
            <RichTextDisplay
              content={(() => {
                const qData =
                  currentQuestion?.question_data ||
                  currentQuestion?.questionBank?.question_data;
                if (
                  qData &&
                  typeof qData === "object" &&
                  "constraints" in qData &&
                  (qData as any).constraints
                ) {
                  return (qData as any).constraints;
                }
                return "No constraints available";
              })()}
            />
          </div>
        </div>

        {/* Resizer (desktop only) */}
        {!isCodingFullscreen && (
          <div
            className="relative hidden w-1 flex-shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400 lg:block dark:bg-gray-700 dark:hover:bg-blue-500"
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize question and answer panels"
          >
            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-0.5 bg-gray-400 dark:bg-gray-500"></div>
          </div>
        )}

        {/* Column 2: Answering and Testing */}
        <div
          className={`w-full p-4 sm:p-6 ${
            isCodingFullscreen
              ? "h-screen overflow-y-auto"
              : "border-t border-gray-200 lg:h-full lg:w-[var(--quiz-right)] lg:overflow-y-auto lg:border-t-0 dark:border-gray-800"
          } ${
            (proctoringSettings?.require_fullscreen && !isFullscreenMode) ||
            isExamPaused
              ? "blur-sm pointer-events-none select-none"
              : ""
          }`}
        >
          <div className="space-y-6">
            {/* Answer Input */}
            <div>
              {!isCodingFullscreen && (
                <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-3">
                  Your Answer
                </h3>
              )}
              <div className="space-y-4">
                {currentQuestion &&
                  renderQuestion(currentQuestion, {
                    submissionId: existingSubmission?.id,
                    isFullscreen: isCodingFullscreen,
                    disabled: answeringDisabled,
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      {!isCodingFullscreen && (
        <div className="flex-shrink-0 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:px-6 dark:border-gray-700 dark:bg-gray-900/95">
          <div className="mx-auto mb-2 flex max-w-8xl flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => currentQuestion && toggleFlag(currentQuestion.id)}
              disabled={!currentQuestion || timeUpState !== null}
              aria-pressed={!!currentQuestion && flaggedQuestions.has(currentQuestion.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 ${
                currentQuestion && flaggedQuestions.has(currentQuestion.id)
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              {currentQuestion && flaggedQuestions.has(currentQuestion.id)
                ? "Flagged for review"
                : "Flag for review"}
            </button>

            {/* What the grid colours mean */}
            <div className="hidden items-center gap-3 text-gray-500 md:flex dark:text-gray-400" aria-hidden>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Answered</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/30" />Skipped</span>
              {!isOverallTimed && (
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-200 dark:bg-red-900/60" />Time's up</span>
              )}
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-gray-200 dark:bg-gray-700" />Not seen</span>
            </div>

            <span
              className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400"
              aria-live="polite"
            >
              {syncState === "saving" && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              )}
              {syncState === "saved" && (
                <>
                  <Cloud className="h-3.5 w-3.5 text-emerald-500" /> Answers saved
                </>
              )}
              {syncState === "offline" && (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-amber-500" /> Saved on this
                  device — will be sent on submit
                </>
              )}
            </span>
          </div>

          <div className="mx-auto flex max-w-8xl items-center gap-2 sm:gap-3">
            <button
              onClick={() => void navigateTo(currentQuestionIndex - 1)}
              disabled={
                currentQuestionIndex === 0 ||
                isExamPaused ||
                timeUpState !== null ||
                (!isOverallTimed && isSubmitting)
              }
              aria-label="Previous question"
              className="inline-flex h-10 flex-shrink-0 items-center rounded-full border border-gray-300 px-3 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin]">
              <div className="flex items-center gap-2 px-1 py-1.5">
                {quizQuestions.map((question, index) => {
                  const isAnswered = answeredIds.has(question.id);
                  const isFlagged = flaggedQuestions.has(question.id);
                  const isCurrent = index === currentQuestionIndex;
                  const isLocked = isLockedAt(index);
                  const isSkipped = !isAnswered && !isLocked && !isCurrent && visitedIds.has(question.id);
                  const status = isAnswered
                    ? "answered"
                    : isLocked
                      ? "time's up, not answered"
                      : isSkipped
                        ? "skipped, not answered"
                        : "not answered";
                  return (
                    <button
                      key={question.id ?? index}
                      ref={isCurrent ? (el) => el?.scrollIntoView?.({ block: "nearest", inline: "nearest" }) : undefined}
                      onClick={() => void navigateTo(index)}
                      disabled={
                        isExamPaused ||
                        timeUpState !== null ||
                        (!isOverallTimed && isSubmitting)
                      }
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`Question ${index + 1}, ${status}${isFlagged ? ", flagged" : ""}`}
                      title={`Question ${index + 1}: ${status}${isFlagged ? " · flagged" : ""}`}
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed dark:focus-visible:ring-offset-gray-900 ${
                        isCurrent
                          ? "z-10 scale-110 bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                          : isAnswered
                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600"
                            : isLocked
                              ? "bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-300"
                              : isSkipped
                                ? "border-2 border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      } ${isFlagged ? "ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-gray-900" : ""}`}
                    >
                      {isAnswered && (
                        <div className="absolute -right-1.5 -top-1.5 rounded-full border-2 border-emerald-500 bg-white p-0.5 shadow-sm dark:bg-gray-900">
                          <Check className="h-2.5 w-2.5 stroke-[4px] text-emerald-500" />
                        </div>
                      )}
                      {isLocked && !isAnswered && (
                        <Lock className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-red-500 dark:bg-gray-900" />
                      )}
                      {isFlagged && (
                        <Flag className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      )}
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {currentQuestionIndex === totalQuestions - 1 ? (
              <button
                onClick={() => void openReview()}
                disabled={isExamPaused || isSubmitting || timeUpState !== null}
                className="inline-flex h-10 flex-shrink-0 items-center rounded-full bg-green-600 px-3 font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              >
                <ListChecks className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Review &amp; Submit</span>
                <span className="sr-only sm:hidden">Review &amp; Submit</span>
              </button>
            ) : (
              (() => {
                // Nothing answered here (and still open): moving on is a skip.
                const willSkip =
                  !!currentQuestion && !currentLocked && !answeredIds.has(currentQuestion.id);
                return (
                  <button
                    onClick={() => void handleNext()}
                    disabled={
                      isExamPaused ||
                      timeUpState !== null ||
                      (!isOverallTimed && isSubmitting)
                    }
                    aria-label={willSkip ? "Skip question" : "Next question"}
                    title={willSkip ? "Skip for now — you can come back to it" : undefined}
                    className={`inline-flex h-10 flex-shrink-0 items-center rounded-full px-3 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${
                      willSkip
                        ? "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {!isOverallTimed && isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                        <span className="hidden sm:inline">Saving...</span>
                      </>
                    ) : willSkip ? (
                      <>
                        <span className="hidden sm:inline">Skip</span>
                        <SkipForward className="h-4 w-4 sm:ml-2" />
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Next</span>
                        <ArrowRight className="h-4 w-4 sm:ml-2" />
                      </>
                    )}
                  </button>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Submit Confirmation (review) sheet */}
      {showConfirmSubmit && (() => {
        const unanswered = unansweredIndices.length;
        const reopenable = unansweredIndices.filter((i) => !isLockedAt(i));
        const timedOut = unansweredIndices.filter((i) => isLockedAt(i));
        const needsAck = unanswered > 0;
        const close = () => setShowConfirmSubmit(false);
        const jump = (i: number) => {
          close();
          void navigateTo(i);
        };
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-submit-title"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !isSubmitting) close();
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSubmitting) close();
            }}
          >
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6 dark:bg-gray-900">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden dark:bg-gray-700" aria-hidden />
              <div className="text-center">
                {needsAck ? (
                  <AlertCircle className="mx-auto mb-3 h-11 w-11 text-amber-500" />
                ) : (
                  <ListChecks className="mx-auto mb-3 h-11 w-11 text-blue-600" />
                )}
                <h3
                  id="confirm-submit-title"
                  className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
                >
                  {needsAck
                    ? `${unanswered} question${unanswered === 1 ? "" : "s"} not answered`
                    : "Ready to submit?"}
                </h3>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-900/20">
                    <div className="text-lg font-bold text-emerald-600">{answeredQuestions}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Answered</div>
                  </div>
                  <div className={`rounded-xl p-2 ${needsAck ? "bg-amber-50 dark:bg-amber-900/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                    <div className={`text-lg font-bold ${needsAck ? "text-amber-600" : "text-gray-700 dark:text-gray-200"}`}>
                      {unanswered}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Unanswered</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-900/20">
                    <div className="text-lg font-bold text-blue-600">
                      {isOverallTimed ? formatClock(timeLeft) : flaggedQuestions.size}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isOverallTimed ? "Time left" : "Flagged"}
                    </div>
                  </div>
                </div>

                {(unanswered > 0 || flaggedQuestions.size > 0) && (
                  <div className="mt-4 space-y-3 text-left text-xs">
                    {reopenable.length > 0 && (
                      <div>
                        <p className="mb-1.5 font-medium text-gray-600 dark:text-gray-300">
                          Not answered yet — tap to go back:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {reopenable.map((i) => (
                            <button
                              key={`u-${i}`}
                              onClick={() => jump(i)}
                              aria-label={`Go to question ${i + 1}`}
                              className="h-8 min-w-[2rem] rounded-lg border-2 border-amber-400 bg-amber-50 px-2 font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-amber-900/20 dark:text-amber-300"
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {timedOut.length > 0 && (
                      <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <Lock className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                        Time ran out on question{timedOut.length === 1 ? "" : "s"}{" "}
                        {timedOut.map((i) => i + 1).join(", ")} — {timedOut.length === 1 ? "it" : "they"} can't be answered any more.
                      </p>
                    )}
                    {flaggedQuestions.size > 0 && (
                      <div>
                        <p className="mb-1.5 font-medium text-gray-600 dark:text-gray-300">
                          Flagged for review:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {quizQuestions.map((q, i) =>
                            flaggedQuestions.has(q.id) ? (
                              <button
                                key={`f-${q.id}`}
                                onClick={() => jump(i)}
                                aria-label={`Go to flagged question ${i + 1}`}
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-100 px-2 font-semibold text-amber-800 hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-amber-900/30 dark:text-amber-300"
                              >
                                <Flag className="h-3 w-3" />
                                {i + 1}
                              </button>
                            ) : null,
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  role={needsAck ? "alert" : undefined}
                  className={`mt-4 rounded-xl px-3 py-2.5 text-left text-sm ${
                    needsAck
                      ? "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                      : "bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
                  }`}
                >
                  {needsAck
                    ? `Unanswered questions score 0. Once you submit, you can't come back to answer or change anything — this can't be undone.`
                    : "Once you submit, you can't change your answers — this can't be undone."}
                </div>

                {needsAck && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl px-1 text-left text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={ackUnanswered}
                      onChange={(e) => setAckUnanswered(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span>
                      I understand {unanswered === 1 ? "1 question is" : `${unanswered} questions are`} unanswered
                      and I want to submit anyway.
                    </span>
                  </label>
                )}

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={close}
                    disabled={isSubmitting}
                    autoFocus
                    className="rounded-full border border-gray-300 px-4 py-2.5 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {needsAck && reopenable.length > 0 ? "Go back and answer" : "Continue quiz"}
                  </button>
                  <button
                    data-track="tm.quiz.submit_click"
                    onClick={async () => {
                      if (needsAck && !ackUnanswered) return;
                      const ok = await submitQuiz();
                      if (!ok) setShowConfirmSubmit(false);
                    }}
                    disabled={isSubmitting || (needsAck && !ackUnanswered)}
                    className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {needsAck ? "Submit anyway" : "Submit quiz"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl border border-white/20 dark:border-gray-800 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl"></div>

            <div className="relative z-10 mb-8">
              <h2 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
                Quiz Submitted!
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-lg font-medium animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                {gradeSummary.quiz_title}
              </p>
            </div>

            <div className="space-y-6 mb-8 relative z-10">
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-800/80 dark:to-blue-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-800/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
                <div className="text-center relative">
                  {/* Circular Progress Design */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <svg className="w-40 h-40 transform -rotate-90">
                      <circle
                        className="text-gray-200 dark:text-gray-700"
                        strokeWidth="12"
                        stroke="currentColor"
                        fill="transparent"
                        r="70"
                        cx="80"
                        cy="80"
                      />
                      <circle
                        className={`transition-all duration-1000 ease-out ${
                          gradeSummary.percentage >= 90
                            ? "text-emerald-500"
                            : gradeSummary.percentage >= 80
                              ? "text-indigo-500"
                              : gradeSummary.percentage >= 70
                                ? "text-yellow-500"
                                : gradeSummary.percentage >= 50
                                  ? "text-blue-500"
                                  : "text-red-500"
                        }`}
                        strokeWidth="12"
                        strokeDasharray={440}
                        strokeDashoffset={
                          440 - (440 * gradeSummary.percentage) / 100
                        }
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="70"
                        cx="80"
                        cy="80"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-text-primary-light dark:text-text-primary-dark">
                        {Math.round(gradeSummary.percentage)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 items-center justify-center">
                    <div className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                      Grade:{" "}
                      <span
                        className={
                          gradeSummary.percentage >= 90
                            ? "text-emerald-600 dark:text-emerald-400"
                            : gradeSummary.percentage >= 80
                              ? "text-indigo-600 dark:text-indigo-400"
                              : gradeSummary.percentage >= 70
                                ? "text-yellow-600 dark:text-yellow-400"
                                : gradeSummary.percentage >= 60
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-red-600 dark:text-red-400"
                        }
                      >
                        {gradeSummary.grade ||
                          (parseFloat(gradeSummary.percentage) >= 90
                            ? "A"
                            : parseFloat(gradeSummary.percentage) >= 80
                              ? "B"
                              : parseFloat(gradeSummary.percentage) >= 70
                                ? "C"
                                : parseFloat(gradeSummary.percentage) >= 60
                                  ? "D"
                                  : "F")}
                      </span>
                    </div>

                    {gradeSummary.passed !== undefined &&
                      gradeSummary.passed !== null && (
                        <div
                          className={`inline-flex items-center gap-2 px-6 py-2 rounded-full text-base font-bold shadow-sm ${
                            gradeSummary.passed
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                          }`}
                        >
                          {gradeSummary.passed ? (
                            <>
                              <Trophy className="w-4 h-4" /> Passed
                            </>
                          ) : (
                            <>
                              <Dumbbell className="w-4 h-4" /> Needs Review
                            </>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
                <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50 shadow-sm">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {gradeSummary.final_score}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/70">
                    Points Earned
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50 shadow-sm">
                  <div className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
                    {gradeSummary.max_score}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/70">
                    Total Points
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center animate-in fade-in duration-500 delay-700 relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                  Redirecting to detailed results...
                </p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-500 h-1.5 rounded-full w-full animate-[shrink_1.5s_ease-in-out_forwards] origin-left"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Terminated Modal */}
      {showQuizTerminated && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl border border-red-300 dark:border-red-800">
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                Quiz Terminated
              </h2>
              <p className="text-gray-600 dark:text-gray-200 mb-4">
                Your quiz session has been terminated by the instructor.
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                Reason:
              </h3>
              <p className="text-red-700 dark:text-red-400 leading-relaxed">
                {terminationReason}
              </p>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-200">
              <p>Your quiz will be submitted automatically...</p>
              <div className="mt-2 w-full bg-red-200 dark:bg-red-800 rounded-full h-2">
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
