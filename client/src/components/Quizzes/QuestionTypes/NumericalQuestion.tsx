import React, { useState, useEffect } from "react";
import type {
  NumericalData,
  NumericalAnswer,
  QuestionComponentProps,
} from "../../../types/quiz.types";
import { ValidationMessage } from "./shared";

export const NumericalQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
}) => {
  const questionData = question.question_data as NumericalData;
  const currentAnswer = answer as NumericalAnswer | undefined;

  const [numericAnswer, setNumericAnswer] = useState<string>(
    currentAnswer?.answer?.toString() ?? "",
  );
  const [selectedUnit, setSelectedUnit] = useState<string>(
    currentAnswer?.units ?? "",
  );

  useEffect(() => {
    if (currentAnswer) {
      setNumericAnswer(currentAnswer.answer?.toString() ?? "");
      setSelectedUnit(currentAnswer.units ?? "");
    }
  }, [currentAnswer]);

  const handleAnswerChange = (value: string) => {
    // Allow only numbers, decimal point, and negative sign
    const numericValue = value.replace(/[^0-9.-]/g, "");

    // Prevent multiple decimal points
    const parts = numericValue.split(".");
    const cleanValue =
      parts.length > 2
        ? parts[0] + "." + parts.slice(1).join("")
        : numericValue;

    // Prevent multiple negative signs
    const negativeParts = cleanValue.split("-");
    const finalValue =
      negativeParts.length > 2
        ? "-" + negativeParts.slice(1).join("")
        : cleanValue;

    setNumericAnswer(finalValue);

    // Only submit if we have a valid number
    const numValue = parseFloat(finalValue);
    if (!isNaN(numValue)) {
      onAnswerChange({
        answer: numValue,
        units: questionData.units ? selectedUnit : undefined,
      });
    }
  };

  const handleUnitChange = (unit: string) => {
    setSelectedUnit(unit);
    const numValue = parseFloat(numericAnswer);
    if (!isNaN(numValue)) {
      onAnswerChange({
        answer: numValue,
        units: questionData.units ? unit : undefined,
      });
    }
  };

  const correctAnswer = questionData.correct_answer;
  const tolerance = questionData.tolerance || 0;
  const units = questionData.units;

  // Check if current answer is within tolerance
  const currentNumValue = parseFloat(numericAnswer);
  const isWithinTolerance =
    !isNaN(currentNumValue) &&
    typeof correctAnswer === "number" &&
    Math.abs(currentNumValue - correctAnswer) <= tolerance;

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="max-w-2xl mx-auto">
        <div className="space-y-4">
          {/* Number input */}
          <div>
            <label className="text-sm sm:text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              Enter your answer:
            </label>
            {questionData.tolerance !== undefined &&
              questionData.tolerance > 0 && (
                <div className="mb-3">
                  <ValidationMessage
                    type="info"
                    message={`Tolerance: ±${questionData.tolerance}`}
                  />
                </div>
              )}
            <div className="relative">
              <input
                type="text"
                value={numericAnswer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                disabled={disabled}
                placeholder="Enter a number..."
                className={`w-full px-4 sm:px-6 py-3 sm:py-4 text-lg sm:text-xl font-medium border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 transform ${
                  disabled
                    ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                    : showCorrectAnswer
                      ? isWithinTolerance
                        ? "border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 focus:border-green-600 focus:ring-green-200 shadow-md"
                        : "border-red-500 bg-gradient-to-r from-red-50 to-pink-50 focus:border-red-600 focus:ring-red-200 shadow-md"
                      : numericAnswer
                        ? "border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 focus:border-blue-600 focus:ring-blue-200 shadow-md"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200 hover:border-blue-400"
                } ${numericAnswer ? "scale-[1.02]" : ""}`}
              />
              {showCorrectAnswer && !isNaN(currentNumValue) && (
                <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 animate-slideInRight">
                  {isWithinTolerance ? (
                    <div className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs sm:text-sm font-bold rounded-full shadow-lg">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="hidden sm:inline">Correct</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs sm:text-sm font-bold rounded-full shadow-lg">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="hidden sm:inline">Incorrect</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Unit selection (if units are specified) */}
          {units && (
            <div
              className="animate-slideInLeft"
              style={{ animationDelay: "100ms" }}
            >
              <label className="text-sm sm:text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  />
                </svg>
                Select unit:
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
                disabled={disabled}
                className={`w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-medium border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 appearance-none bg-white ${
                  disabled
                    ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-200 hover:border-blue-400 cursor-pointer"
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 0.5rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5em 1.5em",
                  paddingRight: "2.5rem",
                }}
              >
                <option value="">Select a unit...</option>
                {units.split(",").map((unit, index) => (
                  <option key={index} value={unit.trim()}>
                    {unit.trim()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Answer feedback */}
          {showCorrectAnswer && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-sm animate-slideInLeft">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-900 mb-2">
                    Correct answer:
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-blue-900">
                    {correctAnswer}
                    {questionData.units && (
                      <span className="ml-2 text-lg sm:text-xl font-medium text-blue-700">
                        {questionData.units}
                      </span>
                    )}
                  </div>
                  {tolerance > 0 && (
                    <div className="text-sm text-blue-700 mt-2 font-medium">
                      Tolerance: ±{tolerance}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Acceptable range info */}
          {questionData.acceptable_range && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 rounded-r-xl shadow-sm animate-slideInRight">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm sm:text-base text-amber-900">
                  <strong className="font-bold">Acceptable range:</strong>{" "}
                  <span className="font-semibold">
                    {questionData.acceptable_range.min} -{" "}
                    {questionData.acceptable_range.max}
                  </span>
                  {questionData.units && (
                    <span className="ml-1 font-medium">
                      {questionData.units}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timer warning */}
      {timeRemaining !== undefined &&
        timeRemaining <= 30 &&
        timeRemaining > 0 && (
          <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-yellow-100 to-amber-100 border-l-4 border-yellow-500 rounded-r-lg shadow-sm animate-pulse">
            <div className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-700 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-yellow-900 font-semibold text-sm sm:text-base">
                Time remaining: {timeRemaining} seconds
              </span>
            </div>
          </div>
        )}
    </div>
  );
};

export default NumericalQuestion;
