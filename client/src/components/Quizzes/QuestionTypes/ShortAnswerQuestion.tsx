import React, { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import type {
  QuestionComponentProps,
  ShortAnswerData,
  ShortAnswerAnswer,
} from "../../../types/quiz.types";
import RichTextDisplay from "../../Common/RichTextDisplay";

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
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSubmit = async () => {
    if (!text.trim() || disabled) return;
    setIsSaving(true);
    try {
      await onAnswerChange({ answer: text } as ShortAnswerAnswer, true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setText("");
    onAnswerChange({ answer: "" } as ShortAnswerAnswer);
  };

  const canSubmit = text.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Text Input Area */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden transition-all duration-200">
        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Your Answer
          </span>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{wordCount} words</span>
            <span>
              {charCount}
              {shortAnswerData.max_length &&
                ` / ${shortAnswerData.max_length}`}{" "}
              characters
            </span>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Type your answer here..."
          disabled={disabled}
          className="w-full p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none disabled:bg-gray-50 dark:disabled:bg-gray-800/50 disabled:cursor-not-allowed transition-colors"
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
          disabled={disabled || isSaving || !canSubmit}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Answer
            </>
          )}
        </button>

        {text.length > 0 && (
          <button
            onClick={handleReset}
            disabled={disabled}
            className="flex items-center gap-2 px-6 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-2xl hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Keywords */}
      {shortAnswerData.keywords && shortAnswerData.keywords.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-sm mb-4 text-blue-900 dark:text-blue-300 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Key Concepts to Include
          </h3>
          <div className="flex flex-wrap gap-2">
            {shortAnswerData.keywords.map((keyword: string, idx: number) => (
              <span
                key={idx}
                className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200 rounded-xl text-sm font-bold shadow-sm hover:scale-105 transition-transform"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sample Answer */}
      {showCorrectAnswer && shortAnswerData.sample_answer && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6 shadow-sm animate-slideInUp">
          <h3 className="font-bold text-lg mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Sample Answer
          </h3>
          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-blue-200 dark:border-blue-700 shadow-inner">
            <RichTextDisplay
              content={shortAnswerData.sample_answer}
              className="text-sm sm:text-base text-gray-800 dark:text-gray-200 bg-transparent prose-p:my-1"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ShortAnswerQuestion;
