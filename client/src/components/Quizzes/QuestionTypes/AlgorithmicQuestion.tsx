import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  AlgorithmicData,
  AlgorithmicAnswer,
  AnswerDataType,
} from "../../../types/quiz.types";
import {
  Play,
  StepForward,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Brain,
  AlertCircle,
  Tag,
} from "lucide-react";
import RichTextDisplay from "../../Common/RichTextDisplay";

// Extended answer type for component state management
interface AlgorithmicAnswerWithState extends AlgorithmicAnswer {
  currentStep?: number;
  userSteps?: any[];
  predictions?: Record<string, any>;
  submitted?: boolean;
  score?: number;
  mode?: "trace" | "predict";
}

// Algorithm step interface for component state
interface AlgorithmStep {
  description: string;
  state: Record<string, string | number | boolean>;
  highlight?: string[];
}

export const AlgorithmicQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
}) => {
  const algorithmicData: AlgorithmicData =
    question.question_data as AlgorithmicData;

  // Create algorithm steps based on the actual AlgorithmicData structure
  const firstTestCase = algorithmicData.test_cases?.[0] || {
    input: "N/A",
    expected_output: "N/A",
  };
  const algorithmSteps: AlgorithmStep[] = [
    {
      description: "Initialize variables",
      state: {
        input: firstTestCase.input,
        expected: firstTestCase.expected_output,
        step: "initialization",
        counter: 0,
      },
      highlight: ["input", "expected"],
    },
    {
      description: "Processing Loop",
      state: {
        input: firstTestCase.input,
        expected: firstTestCase.expected_output,
        step: "processing",
        current_val: "...",
        counter: 1,
      },
      highlight: ["current_val", "counter"],
    },
    {
      description: "Algorithm completion",
      state: {
        input: firstTestCase.input,
        expected: firstTestCase.expected_output,
        step: "completion",
        result: firstTestCase.expected_output,
        success: "true",
      },
      highlight: ["result", "success"],
    },
  ];

  const [currentStep, setCurrentStep] = useState(
    (answer as AlgorithmicAnswerWithState)?.currentStep || 0,
  );
  const [userSteps, setUserSteps] = useState<AlgorithmStep[]>(
    (answer as AlgorithmicAnswerWithState)?.userSteps || [],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [predictions, setPredictions] = useState<Record<string, any>>(
    (answer as AlgorithmicAnswerWithState)?.predictions || {},
  );
  const [submitted, setSubmitted] = useState(
    (answer as AlgorithmicAnswerWithState)?.submitted || false,
  );
  const [score, setScore] = useState(
    (answer as AlgorithmicAnswerWithState)?.score || 0,
  );
  const [mode, setMode] = useState<"trace" | "predict">(
    (answer as AlgorithmicAnswerWithState)?.mode || "trace",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (answer) {
      const algorithmicAnswer = answer as AlgorithmicAnswerWithState;
      if (algorithmicAnswer) {
        setCurrentStep(algorithmicAnswer.currentStep || 0);
        setUserSteps(algorithmicAnswer.userSteps || []);
        setPredictions(algorithmicAnswer.predictions || {});
        setSubmitted(algorithmicAnswer.submitted || false);
        setScore(algorithmicAnswer.score || 0);
        setMode(algorithmicAnswer.mode || "trace");
      }
    }
  }, [answer]);

  const handleStepForward = () => {
    if (currentStep < algorithmSteps.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);

      if (mode === "trace") {
        const newUserSteps = [...userSteps, algorithmSteps[newStep]];
        setUserSteps(newUserSteps);

        updateParentAnswer({
          solution: "Algorithm trace completed",
          currentStep: newStep,
          userSteps: newUserSteps,
        });
      }
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    let step = currentStep;

    const interval = setInterval(() => {
      step++;
      if (step >= algorithmSteps.length) {
        clearInterval(interval);
        setIsPlaying(false);
        return;
      }

      setCurrentStep(step);
      const newUserSteps = [...userSteps, algorithmSteps[step]];
      setUserSteps(newUserSteps);

      updateParentAnswer({
        solution: "Algorithm trace completed",
        currentStep: step,
        userSteps: newUserSteps,
      });
    }, 1500);
  };

  const updateParentAnswer = (
    overrides: Partial<AlgorithmicAnswerWithState>,
  ) => {
    const algorithmicAnswer: AlgorithmicAnswerWithState = {
      solution: overrides.solution || "Algorithm progress",
      language: "algorithm",
      currentStep: overrides.currentStep ?? currentStep,
      userSteps: overrides.userSteps ?? userSteps,
      predictions: overrides.predictions ?? predictions,
      submitted: overrides.submitted ?? submitted,
      score: overrides.score ?? score,
      mode: overrides.mode ?? mode,
      ...overrides,
    };
    onAnswerChange(algorithmicAnswer as AnswerDataType, overrides.submitted);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setUserSteps([]);
    setIsPlaying(false);
    setPredictions({});
    setSubmitted(false);
    setScore(0);

    updateParentAnswer({
      solution: "",
      currentStep: 0,
      userSteps: [],
      predictions: {},
      submitted: false,
      score: 0,
      mode,
    });
  };

  const handlePredictionChange = (
    stepIndex: number,
    key: string,
    value: any,
  ) => {
    const newPredictions = {
      ...predictions,
      [`${stepIndex}-${key}`]: value,
    };
    setPredictions(newPredictions);

    updateParentAnswer({
      solution: "Algorithm predictions",
      predictions: newPredictions,
      mode: "predict",
    });
  };

  const handleSaveAnswer = async () => {
    setIsSaving(true);
    try {
      let correctCount = 0;
      let totalCount = 0;

      algorithmSteps.forEach((step, stepIndex) => {
        Object.keys(step.state).forEach((key) => {
          const predictionKey = `${stepIndex}-${key}`;
          if (predictions[predictionKey] !== undefined) {
            totalCount++;
            const predicted = predictions[predictionKey];
            const actual = step.state[key];

            if (String(predicted).trim() === String(actual).trim()) {
              correctCount++;
            }
          }
        });
      });

      const calculatedScore =
        totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

      updateParentAnswer({
        solution: "Algorithm predictions completed",
        predictions,
        submitted: true,
        score: calculatedScore,
        mode: "predict",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStateValue = (value: string | number | boolean): string => {
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getCurrentState = () => {
    return algorithmSteps[currentStep]?.state || {};
  };

  const isHighlighted = (key: string) => {
    return algorithmSteps[currentStep]?.highlight?.includes(key) || false;
  };

  return (
    <div className="space-y-6">
      {/* Problem Statement */}
      <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl text-text-primary-light dark:text-text-primary-dark flex items-center gap-3">
            <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500/20" />
            Algorithm Challenge
          </h3>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setMode("trace")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === "trace"
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              TRACE
            </button>
            <button
              onClick={() => setMode("predict")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === "predict"
                  ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              PREDICT
            </button>
          </div>
        </div>

        <div className="text-text-secondary-light dark:text-text-secondary-dark leading-relaxed text-lg mb-8">
          <RichTextDisplay content={question.question_text || ""} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-blue-600/60 dark:text-blue-400/60">
                Input Format
              </p>
              <code className="text-sm font-mono font-bold text-text-primary-light dark:text-text-primary-dark">
                {algorithmicData.input_format || "Any integer n"}
              </code>
            </div>
          </div>
          <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl text-purple-600 dark:text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-purple-600/60 dark:text-purple-400/60">
                Output Format
              </p>
              <code className="text-sm font-mono font-bold text-text-primary-light dark:text-text-primary-dark">
                {algorithmicData.output_format || "Factorial of n"}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Code Display */}
      {algorithmicData.algorithm_code && (
        <div className="bg-gray-900 dark:bg-black rounded-3xl overflow-hidden border-2 border-gray-800 shadow-xl">
          <div className="px-6 py-3 bg-gray-800/50 dark:bg-gray-900/50 border-b border-gray-800 flex items-center justify-between">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Algorithm Logic
            </span>
          </div>
          <div className="p-6 font-mono text-sm leading-relaxed text-blue-300 overflow-x-auto">
            <pre>
              <code>{algorithmicData.algorithm_code}</code>
            </pre>
          </div>
        </div>
      )}

      {mode === "trace" && (
        <>
          {/* Algorithm Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Execution Trace / Code */}
            <div className="space-y-4">
              <div className="bg-gray-900 dark:bg-black rounded-2xl p-6 relative overflow-hidden group border border-gray-800 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Algorithm Execution
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold">
                      STEP {currentStep + 1} / {algorithmSteps.length}
                    </span>
                  </div>
                </div>

                <div className="font-mono text-sm space-y-3 relative z-10">
                  {algorithmicData.algorithm_code
                    ?.split("\n")
                    .map((line: string, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg transition-all duration-300 ${
                          algorithmSteps[currentStep]?.highlight?.some((h) =>
                            line.toLowerCase().includes(h.toLowerCase()),
                          )
                            ? "bg-blue-500/20 border-l-4 border-blue-500 text-blue-100 translate-x-1"
                            : "text-gray-300 opacity-80"
                        }`}
                      >
                        <span className="inline-block w-8 text-gray-600 select-none">
                          {idx + 1}
                        </span>
                        {line}
                      </div>
                    ))}
                </div>
              </div>

              {/* Current Step Description */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 shadow-sm">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                  {algorithmSteps[currentStep]?.description || "Initial State"}
                </p>
              </div>
            </div>

            {/* State Visualization */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4 uppercase tracking-wider flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-500" />
                State Trace
              </h3>
              <div className="space-y-4">
                {Object.entries(algorithmSteps[currentStep]?.state || {}).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {key}
                      </span>
                      <span className="font-mono text-sm text-text-primary-light dark:text-text-primary-dark">
                        {renderStateValue(value)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="flex flex-wrap gap-4 p-6 bg-gray-50/50 dark:bg-gray-800/20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl">
            <button
              onClick={handleStepForward}
              disabled={
                disabled ||
                isPlaying ||
                currentStep >= algorithmSteps.length - 1
              }
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 disabled:bg-blue-300 dark:disabled:bg-blue-900/40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <StepForward className="w-5 h-5" />
              Next Step
            </button>

            <button
              onClick={handlePlay}
              disabled={
                disabled ||
                isPlaying ||
                currentStep >= algorithmSteps.length - 1
              }
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 hover:shadow-lg hover:shadow-green-500/30 disabled:bg-green-300 dark:disabled:bg-green-900/40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Play className="w-5 h-5" />
              Auto Simulation
            </button>

            <button
              onClick={handleReset}
              disabled={disabled || isPlaying || submitted}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="w-5 h-5" />
              Reset Trace
            </button>
          </div>
        </>
      )}

      {mode === "predict" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Prediction Interface */}
          <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
            <h3 className="font-bold text-xl mb-4 text-text-primary-light dark:text-text-primary-dark flex items-center gap-3">
              <Brain className="w-6 h-6 text-purple-500" />
              Variable Prediction
            </h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-8 leading-relaxed">
              Based on the algorithm logic above, predict the exact state of
              each variable at every stage of execution. Match the expected
              types carefully.
            </p>

            <div className="space-y-8">
              {algorithmSteps.map((step, stepIndex) => (
                <div
                  key={stepIndex}
                  className="border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-6 bg-gray-50/30 dark:bg-gray-800/20 group hover:border-purple-200 dark:hover:border-purple-900/40 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-bold text-xs shadow-sm">
                      {stepIndex + 1}
                    </span>
                    <div className="font-bold text-gray-800 dark:text-gray-100 uppercase tracking-widest text-[10px]">
                      {step.description}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(step.state).map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                          {key}
                        </label>
                        <input
                          type="text"
                          value={predictions[`${stepIndex}-${key}`] || ""}
                          onChange={(e) =>
                            handlePredictionChange(
                              stepIndex,
                              key,
                              e.target.value,
                            )
                          }
                          disabled={disabled || submitted}
                          placeholder="Enter value"
                          className={`w-full px-3 py-2 border rounded text-sm font-mono ${
                            submitted && showCorrectAnswer
                              ? String(
                                  predictions[`${stepIndex}-${key}`] || "",
                                ).trim() === String(step.state[key]).trim()
                                ? "border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-700 text-green-900 dark:text-green-100"
                                : "border-red-400 bg-red-50 dark:bg-red-950 dark:border-red-700 text-red-900 dark:text-red-100"
                              : submitted
                                ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 dark:text-gray-100"
                                : "border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                          } focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                        />
                        {submitted && showCorrectAnswer && (
                          <div className="flex items-center gap-1 text-xs">
                            {String(
                              predictions[`${stepIndex}-${key}`] || "",
                            ).trim() === String(step.state[key]).trim() ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span className="text-text-secondary-light dark:text-text-secondary-dark">
                                  Correct: {renderStateValue(step.state[key])}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Predictions */}
          {!submitted ? (
            <button
              onClick={handleSaveAnswer}
              disabled={
                disabled || isSaving || Object.keys(predictions).length === 0
              }
              className="flex items-center gap-2 px-8 py-3 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/30 disabled:bg-purple-300 dark:disabled:bg-purple-900/40 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? (
                <>
                  <RotateCcw className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Save Answer
                </>
              )}
            </button>
          ) : (
            <div
              className={`p-8 rounded-3xl border-2 shadow-sm animate-fadeIn ${
                score >= 70
                  ? "border-green-100 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900/30"
                  : "border-yellow-100 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-900/30"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-4 rounded-2xl ${
                    score >= 70
                      ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                      : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400"
                  }`}
                >
                  {score >= 70 ? (
                    <CheckCircle className="w-8 h-8" />
                  ) : (
                    <AlertCircle className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-2xl mb-1 text-text-primary-light dark:text-text-primary-dark">
                    Simulation {showCorrectAnswer ? "Accuracy" : "Completed"}:{" "}
                    {showCorrectAnswer ? `${score.toFixed(0)}%` : "Steps Saved"}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-400 leading-relaxed text-lg">
                    {showCorrectAnswer
                      ? score >= 70
                        ? "Exceptional accuracy. You have a deep understanding of this algorithm's logic."
                        : "The trace results show some discrepancies in variable prediction. Review the simulation values above."
                      : "Your variable predictions have been saved. You can continue to the next question."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Cases */}
      {algorithmicData.test_cases && algorithmicData.test_cases.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
          <h3 className="font-bold text-xl mb-4 text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
            <Tag className="w-6 h-6 text-blue-500" />
            Validation Suite
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {algorithmicData.test_cases.map((testCase, idx) => (
              <div
                key={idx}
                className="bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm group hover:border-blue-200 dark:hover:border-blue-900/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest">
                    Test Vector {idx + 1}
                  </span>
                  {testCase.is_hidden && (
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded text-[9px] font-bold">
                      HIDDEN
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Input:</span>
                    <code className="text-xs font-mono font-bold text-text-primary-light dark:text-text-primary-dark truncate max-w-[150px]">
                      {testCase.input}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Expect:</span>
                    <code className="text-xs font-mono font-bold text-green-600 dark:text-green-400 truncate max-w-[150px]">
                      {testCase.expected_output}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Mode: Complete Algorithm Trace */}
      {showCorrectAnswer && (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-800 rounded-3xl p-8 shadow-sm">
          <h3 className="font-bold text-xl mb-6 text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Verified Trace Path
          </h3>
          <div className="space-y-4">
            {algorithmSteps.map((step, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800/50 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 shadow-sm"
              >
                <div className="font-bold text-sm mb-4 text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  {step.description}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(step.state).map(([key, value]) => (
                    <div
                      key={key}
                      className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800"
                    >
                      <p className="text-[9px] uppercase font-bold text-gray-500 mb-1">
                        {key}
                      </p>
                      <p className="font-mono text-[11px] font-bold text-text-primary-light dark:text-text-primary-dark">
                        {renderStateValue(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlgorithmicQuestion;
