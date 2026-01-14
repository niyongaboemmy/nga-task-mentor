import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, RotateCcw, Link2 } from "lucide-react";
import type {
  QuestionComponentProps,
  MatchingData,
  MatchingAnswer,
} from "../../../types/quiz.types";

export const MatchingQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining: _, // Timer functionality for future implementation
}) => {
  const matchingData: MatchingData = question.question_data as MatchingData;

  const [leftItems] = useState(matchingData.left_items);
  const [rightItems] = useState(matchingData.right_items);

  const [matches, setMatches] = useState<Record<string, string>>(
    (answer as MatchingAnswer)?.matches || {}
  );
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);

  useEffect(() => {
    if (answer) {
      setMatches((answer as MatchingAnswer).matches || {});
    }
  }, [answer]);

  const handleLeftClick = (leftId: string) => {
    if (disabled) return;

    if (selectedLeft === leftId) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(leftId);

      if (selectedRight) {
        createMatch(leftId, selectedRight);
      }
    }
  };

  const handleRightClick = (rightId: string) => {
    if (disabled) return;

    if (selectedRight === rightId) {
      setSelectedRight(null);
    } else {
      setSelectedRight(rightId);

      if (selectedLeft) {
        createMatch(selectedLeft, rightId);
      }
    }
  };

  const createMatch = (leftId: string, rightId: string) => {
    const newMatches = { ...matches };

    // Remove any existing matches for these items
    Object.keys(newMatches).forEach((key) => {
      if (newMatches[key] === rightId) {
        delete newMatches[key];
      }
    });

    newMatches[leftId] = rightId;

    setMatches(newMatches);
    setSelectedLeft(null);
    setSelectedRight(null);

    onAnswerChange({ matches: newMatches } as MatchingAnswer);
  };

  const removeMatch = (leftId: string) => {
    if (disabled) return;

    const newMatches = { ...matches };
    delete newMatches[leftId];

    setMatches(newMatches);
    onAnswerChange({ matches: newMatches } as MatchingAnswer);
  };

  const resetMatches = () => {
    setMatches({});
    setSelectedLeft(null);
    setSelectedRight(null);

    onAnswerChange({ matches: {} } as MatchingAnswer);
  };

  const isRightItemMatched = (rightId: string) => {
    return Object.values(matches).includes(rightId);
  };

  const getMatchedLeftId = (rightId: string) => {
    return Object.keys(matches).find((key) => matches[key] === rightId);
  };

  const getRightContent = (rightId: string) => {
    return rightItems.find((item) => item.id === rightId)?.text || "";
  };

  const isCorrectMatch = (leftId: string) => {
    if (!showCorrectAnswer) return null;
    const userMatch = matches[leftId];
    const correctMatch = matchingData.correct_matches[leftId];
    return userMatch === correctMatch;
  };

  return (
    <div className="space-y-6">
      {/* Question Text */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">
          Matching Question
        </h3>
        <p className="text-gray-700 dark:text-gray-300 mb-3">
          {question.question_text}
        </p>
      </div>

      {/* Matching Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div>
          <h3 className="font-semibold text-sm mb-3 text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              A
            </span>
            Terms/Items
          </h3>
          <div className="space-y-3">
            {leftItems.map((item) => {
              const isSelected = selectedLeft === item.id;
              const isMatched = !!matches[item.id];
              const correct = isCorrectMatch(item.id);

              return (
                <div key={item.id} className="relative">
                  <button
                    onClick={() => handleLeftClick(item.id)}
                    disabled={disabled}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      disabled
                        ? "cursor-not-allowed"
                        : "cursor-pointer hover:shadow-md"
                    } ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md"
                        : isMatched
                        ? correct === true
                          ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                          : correct === false
                          ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                          : "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium flex-1">
                        {item.text}
                      </span>
                      <div className="flex items-center gap-1">
                        {correct === true && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {correct === false && (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>

                    {isMatched && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Link2 className="w-3 h-3" />
                          <span className="italic">
                            {getRightContent(matches[item.id])}
                          </span>
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Remove match button - positioned outside the main button */}
                  {isMatched && !disabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMatch(item.id);
                      }}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all"
                      title="Remove match"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div>
          <h3 className="font-semibold text-sm mb-3 text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              B
            </span>
            Definitions/Matches
          </h3>
          <div className="space-y-3">
            {rightItems.map((item) => {
              const isSelected = selectedRight === item.id;
              const isMatched = isRightItemMatched(item.id);
              const matchedLeftId = getMatchedLeftId(item.id);
              const correct = matchedLeftId
                ? isCorrectMatch(matchedLeftId)
                : null;

              return (
                <button
                  key={item.id}
                  onClick={() => handleRightClick(item.id)}
                  disabled={disabled}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    disabled
                      ? "cursor-not-allowed"
                      : "cursor-pointer hover:shadow-md"
                  } ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : isMatched
                      ? correct === true
                        ? "border-green-400 bg-green-50"
                        : correct === false
                        ? "border-red-400 bg-red-50"
                        : "border-purple-400 bg-purple-50"
                      : "border-gray-300 bg-white hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm flex-1">{item.text}</span>
                    {isMatched && (
                      <div className="flex-shrink-0">
                        {correct === true && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {correct === false && (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        {!showCorrectAnswer && (
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selection Indicator */}
      {(selectedLeft || selectedRight) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            {selectedLeft &&
              !selectedRight &&
              "Now select an item on the right to create a match"}
            {selectedRight &&
              !selectedLeft &&
              "Now select an item on the left to create a match"}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={resetMatches}
          disabled={disabled || Object.keys(matches).length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">
            {Object.keys(matches).length} / {leftItems.length} matched
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${
                (Object.keys(matches).length / leftItems.length) * 100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Correct Answer Display */}
      {showCorrectAnswer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-900">
            Correct Matches
          </h3>
          <div className="space-y-2">
            {leftItems.map((leftItem) => {
              const rightItem = rightItems.find(
                (r) => r.id === matchingData.correct_matches[leftItem.id]
              );
              return (
                <div
                  key={leftItem.id}
                  className="bg-white rounded-lg p-3 border border-blue-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm font-medium text-gray-900">
                      {leftItem.text}
                    </div>
                    <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 text-sm text-gray-700">
                      {rightItem?.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchingQuestion;
