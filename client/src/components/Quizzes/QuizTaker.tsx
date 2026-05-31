import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store";
import { fetchQuizAttemptStatus } from "../../store/slices/quizSlice";
import { QuizApiService } from "../../services/quizApi";
import type { Quiz, AnswerDataType } from "../../types/quiz.types";
import QuizQuestion from "./QuizQuestion";
import CountdownTimer from "../Dashboard/CountdownTimer";
import QuestionTimer from "../ui/QuestionTimer";
import ProctoringMonitor from "../Proctoring/ProctoringMonitor";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  Monitor,
  AlertTriangle,
} from "lucide-react";
import RichTextDisplay from "../Common/RichTextDisplay";

// Question types that require explicit save before navigation
const QUESTION_TYPES_REQUIRING_SAVE = [
  "short_answer",
  "coding",
  "fill_blank",
  "numerical",
];

// Helper to check if a question type requires explicit save
const requiresExplicitSave = (questionType: string): boolean => {
  return QUESTION_TYPES_REQUIRING_SAVE.includes(questionType);
};

interface QuizTakerProps {
  quiz?: Quiz;
  submissionId: number;
}

export const QuizTaker: React.FC<QuizTakerProps> = ({
  quiz: initialQuiz,
  submissionId: initialSubmissionId,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const submissionId = initialSubmissionId;
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz || null);
  const [currentSubmission, setCurrentSubmission] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerDataType>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [locallyAnsweredQuestions, setLocallyAnsweredQuestions] = useState<
    Set<number>
  >(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<
    number | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [showQuestionNavigation, setShowQuestionNavigation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showProctoringMonitor, setShowProctoringMonitor] = useState(false);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    passed: boolean;
    input?: string;
    expected?: string;
    actual?: string;
    error?: string | null;
    executionTime?: number;
    status?: string;
  }>>([]);
  const [testError, setTestError] = useState<string | null>(null);
  // Removed navigation confirmation modal state - no longer needed

  // Initialize quiz
  useEffect(() => {
    const initializeQuiz = async () => {
      if (!submissionId) {
        setError("No submission ID provided");
        setLoading(false);
        return;
      }

      try {
        const result = await dispatch(
          fetchQuizAttemptStatus(submissionId),
        ).unwrap();
        setCurrentSubmission(result);
        setQuiz(result.quiz);

        // Initialize timer with remaining time from server
        if (
          result.time_remaining !== null &&
          result.time_remaining !== undefined
        ) {
          setTimeRemaining(result.time_remaining);
        } else if (quiz?.time_limit && !submissionId) {
          // Fallback for new submissions
          setTimeRemaining(quiz.time_limit * 60);
        }

        // Check if time has already expired
        if (result.is_time_expired) {
          // Auto-submit the quiz if time has expired
          setTimeout(() => {
            handleSubmitQuiz();
          }, 0);
        }

        setLoading(false);
      } catch (error: any) {
        setError(error.message || "Failed to load quiz");
        setLoading(false);
      }
    };

    initializeQuiz();
  }, [submissionId, dispatch]);

  const handleSubmitQuiz = useCallback(async () => {
    if (!currentSubmission?.submission_id) return;

    try {
      setLoading(true);
      // Submit all answers at once
      const answersToSubmit = Object.entries(answers).map(
        ([questionId, answerData]) => ({
          question_id: parseInt(questionId),
          answer_data: answerData,
        }),
      );

      await QuizApiService.submitAllAnswers(
        currentSubmission.submission_id,
        answersToSubmit,
      );

      // Mark quiz as submitted
      setQuizSubmitted(true);

      // Navigate to results
      navigate(`/quiz/${currentSubmission.submission_id}/results`);
    } catch (error: any) {
      setError(error.message || "Failed to submit quiz");
    } finally {
      setLoading(false);
    }
  }, [currentSubmission?.submission_id, answers, navigate]);

  // Enhanced Timer effect with auto-submission
  useEffect(() => {
    if (quiz?.time_limit && timeRemaining !== null && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Auto-submit when time runs out
            setTimeout(() => {
              handleSubmitQuiz();
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quiz?.time_limit, timeRemaining]);

  // Question-specific timer effect
  useEffect(() => {
    const currentQuestion = quiz?.questions?.[currentQuestionIndex];
    if (currentQuestion && !quizSubmitted) {
      // Resolve time limit: Assignment level → Bank level → Default (60s)
      // Resolve time limit: Priority is Bank Level (if user set it) → Assignment level → Default (60s)
      const rawTimeLimit =
        currentQuestion.questionBank?.time_limit_seconds || 60;
      const timeLimit =
        typeof rawTimeLimit === "string"
          ? parseInt(rawTimeLimit)
          : Number(rawTimeLimit);

      setQuestionTimeRemaining(timeLimit);

      const timer = setInterval(() => {
        setQuestionTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            // Auto-advance to next question or submit quiz
            if (currentQuestionIndex < (quiz?.questions?.length || 0) - 1) {
              setCurrentQuestionIndex((prev) => prev + 1);
            } else {
              handleSubmitQuiz();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setQuestionTimeRemaining(null);
    }
  }, [currentQuestionIndex, quiz?.questions, quizSubmitted, handleSubmitQuiz]);

  // Set initial time limit (only for new submissions, not reloads)
  useEffect(() => {
    if (quiz?.time_limit && !submissionId && timeRemaining === null) {
      setTimeRemaining(quiz.time_limit * 60); // Convert minutes to seconds
    }
  }, [quiz?.time_limit, submissionId, timeRemaining]);

  // Clear test results when navigating to a different question
  useEffect(() => {
    setTestResults([]);
    setTestError(null);
  }, [currentQuestionIndex]);

  const handleAnswerChange = (questionId: number, answer: AnswerDataType) => {
    if (!quizSubmitted) {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      if (answer && Object.keys(answer).length > 0) {
        setLocallyAnsweredQuestions((prev) => new Set([...prev, questionId]));
      }
    }
  };

  const toggleFlagQuestion = (questionId: number) => {
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const getQuestionStatus = (questionId: number) => {
    if (quizSubmitted) return "submitted";
    if (locallyAnsweredQuestions.has(questionId)) return "answered";
    if (flaggedQuestions.has(questionId)) return "flagged";
    return "unanswered";
  };

  // Navigation confirmation is no longer needed since we prevent navigation to answered questions

  const handleNext = () => {
    // Check if current question requires explicit save and hasn't been saved
    const currentQuestion = quiz?.questions?.[currentQuestionIndex];
    if (
      currentQuestion?.question_type &&
      requiresExplicitSave(currentQuestion.question_type)
    ) {
      if (!locallyAnsweredQuestions.has(currentQuestion.id)) {
        setShowSaveWarning(true);
        return;
      }
    }

    if (quiz?.questions && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleQuestionNavigation = (index: number) => {
    if (index !== currentQuestionIndex) {
      setCurrentQuestionIndex(index);
    }
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitConfirm(false);
    await handleSubmitQuiz();
  };

  const handleRunTests = useCallback(async () => {
    const question = quiz?.questions?.[currentQuestionIndex];
    if (!currentSubmission?.submission_id || !question) return;
    const code = (answers[question.id] as any)?.code;
    if (!code) return;
    const language = (question.question_data as any)?.language || "javascript";

    setTestRunning(true);
    setTestError(null);
    setTestResults([]);
    try {
      const res = await QuizApiService.submitQuestionAnswer(
        currentSubmission.submission_id,
        question.id,
        { code, language },
      );
      const results = res?.data?.grading_details?.test_results;
      if (results?.length) {
        setTestResults(results);
      } else {
        setTestError("No test results returned. Check your code and try again.");
      }
    } catch (err: any) {
      setTestError(err?.message || "Failed to run tests");
    } finally {
      setTestRunning(false);
    }
  }, [currentSubmission?.submission_id, quiz, currentQuestionIndex, answers]);

  // Removed navigation confirmation functions - no longer needed

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Initialize fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.warn("Failed to enter fullscreen:", error);
      }
    };

    enterFullscreen();

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const currentQuestion = quiz?.questions?.[currentQuestionIndex];
  const progress = quiz?.questions
    ? ((currentQuestionIndex + 1) / quiz.questions.length) * 100
    : 0;
  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = quiz?.questions?.length || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading quiz...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() =>
              navigate(
                quiz?.course_id ? `/courses/${quiz.course_id}` : "/dashboard",
              )
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Course
          </button>
        </div>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-600 mb-4">
            This quiz has no questions yet.
          </div>
          <button
            onClick={() =>
              navigate(
                quiz?.course_id ? `/courses/${quiz.course_id}` : "/dashboard",
              )
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Course
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 ${
        isFullscreen ? "fixed inset-0 z-50 overflow-auto" : ""
      }`}
    >
      {/* Header */}
      <div
        className={`bg-white border-b border-gray-200 px-4 sm:px-6 py-4 shadow-sm ${
          isFullscreen ? "hidden" : ""
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {quiz.title}
              </h1>
              <div className="text-gray-600 text-sm truncate">
                <RichTextDisplay
                  content={quiz.description || ""}
                  className="inline prose-p:my-0"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 ml-4">
              {/* Proctoring Monitor Button */}
              <button
                onClick={() => setShowProctoringMonitor(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                title="Open Proctoring Monitor"
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">Monitor</span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isFullscreen ? "Exit" : "Fullscreen"}
                </span>
              </button>

              {/* Enhanced Timer */}
              {quiz.time_limit && (
                <div className="hidden sm:flex items-center gap-2">
                  <CountdownTimer
                    deadline={new Date(
                      Date.now() + (timeRemaining || 0) * 1000,
                    ).toISOString()}
                    className="text-sm"
                    showLabel={false}
                    variant={
                      timeRemaining && timeRemaining < 300
                        ? "urgent"
                        : "default"
                    }
                  />
                </div>
              )}

              {/* Question Counter */}
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {currentQuestionIndex + 1} of {totalQuestions}
                </div>
                <div className="text-xs text-gray-500">
                  {answeredQuestions} answered
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Timer */}
          {quiz.time_limit && (
            <div className="sm:hidden mt-3 flex items-center justify-center">
              <CountdownTimer
                deadline={new Date(
                  Date.now() + (timeRemaining || 0) * 1000,
                ).toISOString()}
                className="text-base font-medium"
                showLabel={false}
                variant={
                  timeRemaining && timeRemaining < 300 ? "urgent" : "default"
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Progress Bar */}
      <div
        className={`bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm ${
          isFullscreen ? "hidden" : ""
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">
                Progress
              </span>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">
                    {answeredQuestions} answered
                  </span>
                </div>
                {flaggedQuestions.size > 0 && (
                  <div className="flex items-center gap-1">
                    <Flag className="w-3 h-3 text-orange-500" />
                    <span className="text-gray-600">
                      {flaggedQuestions.size} flagged
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowQuestionNavigation(!showQuestionNavigation)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {showQuestionNavigation ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {showQuestionNavigation ? "Hide" : "Show"} Questions
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question Navigation Panel */}
      {showQuestionNavigation && !isFullscreen && (
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Question Navigation
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {quiz.questions?.map((question, index) => {
                const status = getQuestionStatus(question.id);
                return (
                  <button
                    key={question.id}
                    onClick={() => handleQuestionNavigation(index)}
                    className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs font-medium transition-all relative ${
                      index === currentQuestionIndex
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                        : status === "submitted"
                          ? "border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100"
                          : status === "answered"
                            ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
                            : status === "flagged"
                              ? "border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100"
                              : "border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                    }`}
                  >
                    {index + 1}
                    {status === "flagged" && (
                      <Flag className="w-3 h-3 absolute -top-1 -right-1 text-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quiz Content */}
      <div
        className={`max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 ${
          isFullscreen
            ? "max-w-none px-8 py-8 min-h-screen flex items-center justify-center"
            : ""
        }`}
      >
        {currentQuestion && (
          <div
            className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${
              isFullscreen ? "max-w-5xl w-full" : ""
            }`}
          >
            {/* Question Header */}
            <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Question {currentQuestionIndex + 1}
                  </div>
                  <span className="text-sm text-gray-600">
                    {currentQuestion.points} point
                    {currentQuestion.points !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => toggleFlagQuestion(currentQuestion.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    flaggedQuestions.has(currentQuestion.id)
                      ? "bg-orange-100 text-orange-700 border border-orange-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  {flaggedQuestions.has(currentQuestion.id)
                    ? "Flagged"
                    : "Flag"}
                </button>
              </div>
            </div>

            {/* Question Content - 3 Column Grid Layout */}
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Column 1: Question Details */}
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Question
                    </h3>
                    <div className="prose prose-sm max-w-none">
                      <div className="text-gray-800 leading-relaxed">
                        <RichTextDisplay
                          content={
                            currentQuestion.question_text ||
                            currentQuestion.questionBank?.question_text ||
                            ""
                          }
                        />
                      </div>
                      {/* Display question image if available */}
                      {currentQuestion.question_data &&
                        typeof currentQuestion.question_data === "object" &&
                        "question_image" in currentQuestion.question_data && (
                          <div className="mt-4">
                            <img
                              src={
                                (currentQuestion.question_data as any)
                                  .question_image
                              }
                              alt="Question"
                              className="max-w-full h-auto rounded-lg border"
                            />
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Question Timer */}
                  {questionTimeRemaining !== null &&
                    questionTimeRemaining > 0 && (
                      <div className="flex items-center justify-center">
                        <QuestionTimer timeLeft={questionTimeRemaining} />
                      </div>
                    )}
                </div>

                {/* Column 2: Answer Input */}
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Your Answer
                    </h3>
                    <QuizQuestion
                      question={currentQuestion}
                      answer={answers[currentQuestion.id]}
                      onAnswerChange={(answer) =>
                        handleAnswerChange(currentQuestion.id, answer)
                      }
                      disabled={loading || quizSubmitted}
                      showQuestionNumber={false}
                      questionNumber={currentQuestionIndex + 1}
                      timeRemaining={timeRemaining || undefined}
                    />
                  </div>
                </div>

                {/* Column 3: Tests and Submit */}
                <div className="space-y-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Actions
                    </h3>

                    {/* Test Cases for Coding Questions */}
                    {currentQuestion.question_type === "coding" &&
                      currentQuestion.question_data &&
                      typeof currentQuestion.question_data === "object" &&
                      "test_cases" in currentQuestion.question_data && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Test Cases
                          </h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {(
                              currentQuestion.question_data as any
                            ).test_cases?.map(
                              (testCase: any, index: number) => (
                                <div
                                  key={index}
                                  className="bg-white p-2 rounded border text-xs"
                                >
                                  <div className="font-medium">
                                    Input: {testCase.input}
                                  </div>
                                  <div className="text-gray-600">
                                    Expected: {testCase.expected_output}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                    {/* Quiz submitted indicator */}
                    {quizSubmitted && (
                      <div className="mb-4">
                        <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium text-center">
                          ✓ Quiz Submitted
                        </div>
                      </div>
                    )}

                    {/* Run Tests Button for Coding Questions */}
                    {currentQuestion.question_type === "coding" &&
                      !quizSubmitted && (
                        <div className="mb-4">
                          <button
                            onClick={handleRunTests}
                            disabled={testRunning || !(answers[currentQuestion.id] as any)?.code}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                          >
                            {testRunning ? (
                              <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                Running...
                              </>
                            ) : "Run Tests"}
                          </button>
                          {/* Test Results Panel */}
                          {(testResults.length > 0 || testError) && (
                            <div className="mt-3 space-y-2">
                              {testError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                  {testError}
                                </div>
                              )}
                              {testResults.length > 0 && (
                                <>
                                  <div className="text-xs font-medium text-gray-600 mb-1">
                                    {testResults.filter(r => r.passed).length}/{testResults.length} tests passed
                                  </div>
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {testResults.map((result, idx) => (
                                      <div
                                        key={idx}
                                        className={`flex items-start justify-between p-2 rounded border text-xs ${
                                          result.passed
                                            ? "bg-green-50 border-green-200 text-green-700"
                                            : "bg-red-50 border-red-200 text-red-700"
                                        }`}
                                      >
                                        <span className="font-medium shrink-0">
                                          {result.passed ? "✓" : "✗"} Test {idx + 1}
                                        </span>
                                        {!result.passed && result.error && (
                                          <span className="opacity-75 truncate ml-2">
                                            {result.error}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    {/* Submit Quiz Button for Last Question */}
                    {currentQuestionIndex === totalQuestions - 1 && (
                      <div className="mb-4">
                        <button
                          onClick={handleConfirmSubmit}
                          disabled={loading}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          {loading ? "Submitting..." : "Submit Quiz"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Navigation */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between mt-8 bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm gap-4 ${
            isFullscreen ? "max-w-5xl w-full mx-auto" : ""
          }`}
        >
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0 || loading}
            className="flex items-center gap-2 px-4 sm:px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 w-full sm:w-auto"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {/* Flag/Unflag Button */}
            {currentQuestion && !quizSubmitted && (
              <button
                onClick={() => toggleFlagQuestion(currentQuestion.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  flaggedQuestions.has(currentQuestion.id)
                    ? "bg-orange-100 text-orange-700 border border-orange-300"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Flag className="w-4 h-4" />
                {flaggedQuestions.has(currentQuestion.id) ? "Unflag" : "Flag"}
              </button>
            )}

            {currentQuestionIndex === totalQuestions - 1 ? (
              <button
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl font-medium w-full sm:w-auto"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {loading ? "Submitting..." : "Submit Quiz"}
                </span>
                <span className="sm:hidden">
                  {loading ? "Submitting..." : "Submit"}
                </span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={
                  !quiz.questions ||
                  currentQuestionIndex === quiz.questions.length - 1 ||
                  loading
                }
                className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r text-white rounded-lg hover:shadow-xl font-medium w-full sm:w-auto transition-all duration-200 shadow-lg ${
                  currentQuestion?.question_type &&
                  requiresExplicitSave(currentQuestion.question_type) &&
                  !locallyAnsweredQuestions.has(currentQuestion.id)
                    ? "from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    : "from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <span className="hidden sm:inline">
                  {currentQuestion?.question_type &&
                  requiresExplicitSave(currentQuestion.question_type) &&
                  !locallyAnsweredQuestions.has(currentQuestion.id)
                    ? "Save Required"
                    : "Next"}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quiz Instructions */}
        {quiz.instructions && (
          <div
            className={`mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 ${
              isFullscreen ? "max-w-5xl w-full mx-auto" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h3 className="font-medium text-blue-900 mb-2">
                  Quiz Instructions
                </h3>
                <div className="text-blue-800 text-sm leading-relaxed">
                  <RichTextDisplay content={quiz.instructions || ""} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ready to Submit?
              </h3>
              <p className="text-gray-600 mb-6 text-sm">
                You have answered {answeredQuestions} out of {totalQuestions}{" "}
                questions.
                {flaggedQuestions.size > 0 &&
                  ` ${flaggedQuestions.size} question${
                    flaggedQuestions.size > 1 ? "s" : ""
                  } still flagged.`}
                <br />
                Once submitted, you cannot make changes.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200"
                >
                  Continue Quiz
                </button>
                <button
                  onClick={confirmSubmit}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? "Submitting..." : "Submit Quiz"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Warning Modal */}
      {showSaveWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Save Required
              </h3>
              <p className="text-gray-600 mb-6 text-sm">
                This question requires you to save your answer before
                proceeding.
                <br />
                Please click the "Save Answer" button to continue.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowSaveWarning(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Monitor Modal */}
      <ProctoringMonitor
        isOpen={showProctoringMonitor}
        onClose={() => setShowProctoringMonitor(false)}
      />

      {/* Navigation confirmation modal removed - no longer needed */}
    </div>
  );
};

export default QuizTaker;
