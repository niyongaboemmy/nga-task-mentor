import React, { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import type {
  QuestionComponentProps,
  ShortAnswerData,
  ShortAnswerAnswer,
} from "../../../types/quiz.types";
import { CharacterCounter } from "./shared";

export const ShortAnswerQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining: _, // Timer functionality for future implementation
}) => {
  const shortAnswerData: ShortAnswerData =
    question.question_data as ShortAnswerData;

  const [text, setText] = useState((answer as ShortAnswerAnswer)?.answer || "");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (answer) {
      setText((answer as ShortAnswerAnswer).answer || "");
    }
  }, [answer]);

  useEffect(() => {
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 0);
    setWordCount(words.length);
    setCharCount(text.length);
  }, [text]);

  const handleTextChange = (value: string) => {
    if (disabled) return;

    if (
      shortAnswerData.max_length &&
      value.length > shortAnswerData.max_length
    ) {
      return;
    }

    setText(value);
    onAnswerChange({ answer: value } as ShortAnswerAnswer);
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onAnswerChange({ answer: text } as ShortAnswerAnswer);
  };

  const handleReset = () => {
    setText("");
    onAnswerChange({ answer: "" } as ShortAnswerAnswer);
  };

  const canSubmit = text.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Question Text */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-lg mb-2">Short Answer Question</h3>
        <p className="text-gray-700 mb-3">{question.question_text}</p>
      </div>

      {/* Text Input Area */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Your Answer</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">{wordCount} words</span>
            <CharacterCounter
              current={charCount}
              max={shortAnswerData.max_length}
            />
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Type your answer here..."
          disabled={disabled}
          className="w-full p-4 bg-white border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
          style={{ minHeight: "200px" }}
        />
        {/* Character/Length Warnings */}
        {shortAnswerData.max_length &&
          text.length > 0 &&
          text.length > shortAnswerData.max_length && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200">
              <p className="text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Answer is too long. Maximum {shortAnswerData.max_length}{" "}
                characters allowed.
              </p>
            </div>
          )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={disabled || !canSubmit}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Submit Answer
        </button>

        {text.length > 0 && (
          <button
            onClick={handleReset}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Keywords */}
      {shortAnswerData.keywords && shortAnswerData.keywords.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2 text-blue-900">
            Key Concepts to Include:
          </h3>
          <div className="flex flex-wrap gap-2">
            {shortAnswerData.keywords.map((keyword: string, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1 bg-white border border-blue-300 text-blue-800 rounded text-sm"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sample Answer */}
      {showCorrectAnswer && shortAnswerData.sample_answer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2 text-blue-900">
            Sample Answer
          </h3>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">
            {shortAnswerData.sample_answer}
          </p>
        </div>
      )}
    </div>
  );
};

export default ShortAnswerQuestion;
