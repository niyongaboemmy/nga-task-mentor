import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  AlgorithmicData,
  AlgorithmicAnswer,
  AnswerDataType
} from "../../../types/quiz.types";
import {
  Play,
  StepForward,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";

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
  timeRemaining: _timeRemaining,
}) => {
  const algorithmicData: AlgorithmicData = question.question_data as AlgorithmicData;

  // Create algorithm steps based on the actual AlgorithmicData structure
  const algorithmSteps: AlgorithmStep[] = [
    {
      description: "Initialize variables",
      state: {
        input: algorithmicData.test_cases[0]?.input || "sample input",
        expected: algorithmicData.test_cases[0]?.expected_output || "expected output",
        step: "initialization",
      },
      highlight: ["input", "expected"],
    },
    {
      description: "Process the algorithm",
      state: {
        input: algorithmicData.test_cases[0]?.input || "sample input",
        expected: algorithmicData.test_cases[0]?.expected_output || "expected output",
        step: "processing",
        result: "computed result",
      },
      highlight: ["result"],
    },
    {
      description: "Check final result",
      state: {
        input: algorithmicData.test_cases[0]?.input || "sample input",
        expected: algorithmicData.test_cases[0]?.expected_output || "expected output",
        step: "completion",
        result: "computed result",
        success: "true",
      },
      highlight: ["success"],
    },
  ];

  const [currentStep, setCurrentStep] = useState(
    (answer as AlgorithmicAnswerWithState)?.currentStep || 0
  );
  const [userSteps, setUserSteps] = useState<AlgorithmStep[]>(
    (answer as AlgorithmicAnswerWithState)?.userSteps || []
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [predictions, setPredictions] = useState<Record<string, any>>(
    (answer as AlgorithmicAnswerWithState)?.predictions || {}
  );
  const [submitted, setSubmitted] = useState(
    (answer as AlgorithmicAnswerWithState)?.submitted || false
  );
  const [score, setScore] = useState(
    (answer as AlgorithmicAnswerWithState)?.score || 0
  );
  const [mode, setMode] = useState<"trace" | "predict">(
    (answer as AlgorithmicAnswerWithState)?.mode || "trace"
  );

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

        const algorithmicAnswer: AlgorithmicAnswerWithState = {
          solution: "Algorithm trace completed",
          language: "algorithm",
          currentStep: newStep,
          userSteps: newUserSteps,
          mode,
        };

        onAnswerChange(algorithmicAnswer as AnswerDataType);
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

      const algorithmicAnswer: AlgorithmicAnswerWithState = {
        solution: "Algorithm trace completed",
        language: "algorithm",
        currentStep: step,
        userSteps: newUserSteps,
        mode,
      };

      onAnswerChange(algorithmicAnswer as AnswerDataType);
    }, 1500);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setUserSteps([]);
    setIsPlaying(false);
    setPredictions({});
    setSubmitted(false);
    setScore(0);

    const algorithmicAnswer: AlgorithmicAnswerWithState = {
      solution: "",
      language: "algorithm",
      currentStep: 0,
      userSteps: [],
      predictions: {},
      submitted: false,
      score: 0,
      mode,
    };

    onAnswerChange(algorithmicAnswer as AnswerDataType);
  };

  const handlePredictionChange = (
    stepIndex: number,
    key: string,
    value: any
  ) => {
    const newPredictions = {
      ...predictions,
      [`${stepIndex}-${key}`]: value,
    };
    setPredictions(newPredictions);

    const algorithmicAnswer: AlgorithmicAnswerWithState = {
      solution: "Algorithm predictions",
      language: "algorithm",
      predictions: newPredictions,
      mode: "predict",
    };

    onAnswerChange(algorithmicAnswer as AnswerDataType);
  };

  const validatePredictions = () => {
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
    setScore(calculatedScore);
    setSubmitted(true);

    const algorithmicAnswer: AlgorithmicAnswerWithState = {
      solution: "Algorithm predictions completed",
      language: "algorithm",
      predictions,
      submitted: true,
      score: calculatedScore,
      mode: "predict",
    };

    onAnswerChange(algorithmicAnswer as AnswerDataType);
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
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg">Problem</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("trace")}
              className={`px-3 py-1 text-sm rounded ${
                mode === "trace"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Trace Mode
            </button>
            <button
              onClick={() => setMode("predict")}
              className={`px-3 py-1 text-sm rounded ${
                mode === "predict"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Predict Mode
            </button>
          </div>
        </div>
        <p className="text-gray-700 whitespace-pre-wrap">
          {question.question_text}
        </p>

        <div className="mt-3 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600">Input Format: </span>
            <code className="bg-gray-100 px-2 py-0.5 rounded">
              {algorithmicData.input_format}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-600" />
            <span className="text-gray-600">Output Format: </span>
            <code className="bg-gray-100 px-2 py-0.5 rounded">
              {algorithmicData.output_format}
            </code>
          </div>
        </div>
      </div>

      {mode === "trace" && (
        <>
          {/* Algorithm Visualization */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Algorithm Trace</h3>
              <div className="text-sm text-gray-600">
                Step {currentStep + 1} of {algorithmSteps.length}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      ((currentStep + 1) / algorithmSteps.length) * 100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Current Step Description */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900 font-medium">
                {algorithmSteps[currentStep]?.description ||
                  "Initial State"}
              </p>
            </div>

            {/* State Visualization */}
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(getCurrentState()).map(([key, value]) => (
                <div
                  key={key}
                  className={`border rounded-lg p-3 transition-all ${
                    isHighlighted(key)
                      ? "border-yellow-400 bg-yellow-50 shadow-md"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    {key}
                  </div>
                  <div className="font-mono text-sm">
                    {renderStateValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <button
              onClick={handleStepForward}
              disabled={
                disabled ||
                isPlaying ||
                currentStep >= algorithmSteps.length - 1
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              <StepForward className="w-4 h-4" />
              Next Step
            </button>

            <button
              onClick={handlePlay}
              disabled={
                disabled ||
                isPlaying ||
                currentStep >= algorithmSteps.length - 1
              }
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              Auto Play
            </button>

            <button
              onClick={handleReset}
              disabled={disabled || isPlaying}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </>
      )}

      {mode === "predict" && (
        <>
          {/* Prediction Interface */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-4">
              Predict Algorithm States
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Fill in the values you predict for each step of the algorithm
              execution.
            </p>

            <div className="space-y-4">
              {algorithmSteps.map((step, stepIndex) => (
                <div
                  key={stepIndex}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="font-medium text-sm mb-3 text-gray-700">
                    Step {stepIndex + 1}: {step.description}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(step.state).map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">
                          {key}
                        </label>
                        <input
                          type="text"
                          value={predictions[`${stepIndex}-${key}`] || ""}
                          onChange={(e) =>
                            handlePredictionChange(
                              stepIndex,
                              key,
                              e.target.value
                            )
                          }
                          disabled={disabled || submitted}
                          placeholder="Enter value"
                          className={`w-full px-3 py-2 border rounded text-sm font-mono ${
                            submitted
                              ? String(predictions[`${stepIndex}-${key}`] || "").trim() === String(step.state[key]).trim()
                                ? "border-green-400 bg-green-50"
                                : "border-red-400 bg-red-50"
                              : "border-gray-300 bg-white"
                          } focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                        />
                        {submitted && (
                          <div className="flex items-center gap-1 text-xs">
                            {String(predictions[`${stepIndex}-${key}`] || "").trim() === String(step.state[key]).trim() ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span className="text-gray-600">
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

          {/* Submit Button */}
          {!submitted && (
            <button
              onClick={validatePredictions}
              disabled={disabled || Object.keys(predictions).length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Submit Predictions
            </button>
          )}

          {/* Score Display */}
          {submitted && (
            <div
              className={`border rounded-lg p-4 ${
                score >= 70
                  ? "border-green-200 bg-green-50"
                  : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {score >= 70 ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                )}
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    Score: {score.toFixed(0)}%
                  </h3>
                  <p className="text-sm text-gray-700">
                    {score >= 70
                      ? "Great job! You understand the algorithm well."
                      : "Review the correct values above and try again."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Test Cases */}
      {algorithmicData.test_cases && algorithmicData.test_cases.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3">Test Cases</h3>
          <div className="space-y-2">
            {algorithmicData.test_cases.map((testCase, idx) => (
              <div
                key={idx}
                className="bg-gray-50 border border-gray-200 rounded p-3"
              >
                <div className="text-sm">
                  <span className="font-medium">
                    Test Case {idx + 1}:
                  </span>
                  <div className="mt-1 font-mono text-xs">
                    Input: {testCase.input} → Expected Output:{" "}
                    {testCase.expected_output}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correct Answer */}
      {showCorrectAnswer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-900">
            Complete Algorithm Trace
          </h3>
          <div className="space-y-2">
            {algorithmSteps.map((step, idx) => (
              <div key={idx} className="bg-white rounded p-3">
                <div className="font-medium text-sm mb-2">
                  Step {idx + 1}: {step.description}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(step.state).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="font-medium text-gray-600">{key}:</span>{" "}
                      <span className="font-mono">
                        {renderStateValue(value)}
                      </span>
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
