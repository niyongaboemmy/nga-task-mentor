import React, { useEffect, useState } from "react";
import type { FillBlankData } from "../../../types/quiz.types";

interface FillBlankQuestionFormProps {
  data: FillBlankData;
  onChange: (data: any) => void;
}

interface BlankConfig {
  index: number;
  acceptable_answers: string[];
  case_sensitive: boolean;
}

export const FillBlankQuestionForm: React.FC<FillBlankQuestionFormProps> = ({
  data,
  onChange,
}) => {
  const [text, setText] = useState(data?.text_with_blanks || "");
  const [blanks, setBlanks] = useState<BlankConfig[]>([]);

  // Initialize blanks from data potentially
  useEffect(() => {
    // If we have existing correct_answer structure, try to use it
    const existingAnswers = (data as any).correct_answer;
    if (existingAnswers && Array.isArray(existingAnswers)) {
      setBlanks(
        existingAnswers.map((ans: any, i: number) => ({
          index: i,
          acceptable_answers: ans.answers || [],
          case_sensitive: ans.case_sensitive || false,
        }))
      );
    }
  }, []);

  // Sync text changes
  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // Count blanks in new text
    const blankCount = (newText.match(/__/g) || []).length;
    
    // Adjust blanks array size
    setBlanks((prev) => {
      const newBlanks = [...prev];
      if (blankCount > prev.length) {
        // Add new blanks
        for (let i = prev.length; i < blankCount; i++) {
          newBlanks.push({
            index: i,
            acceptable_answers: [],
            case_sensitive: false,
          });
        }
      } else if (blankCount < prev.length) {
        // Remove excess blanks
        newBlanks.splice(blankCount);
      }
      
      // Update payload
      updatePayload(newText, newBlanks);
      return newBlanks;
    });
  };

  const updateBlank = (index: number, updates: Partial<BlankConfig>) => {
    setBlanks((prev) => {
      const newBlanks = [...prev];
      newBlanks[index] = { ...newBlanks[index], ...updates };
      updatePayload(text, newBlanks);
      return newBlanks;
    });
  };

  const updatePayload = (currentText: string, currentBlanks: BlankConfig[]) => {
    onChange({
      text_with_blanks: currentText,
      correct_answer: currentBlanks.map((b) => ({
        index: b.index,
        answers: b.acceptable_answers,
        case_sensitive: b.case_sensitive,
      })),
    });
  };

  // Validation
  const hasBlanks = (text.match(/__/g) || []).length > 0;
  const allBlanksHaveAnswers = blanks.every(
    (b) => b.acceptable_answers.length > 0 && b.acceptable_answers.some(a => a.trim())
  );

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Text with Blanks
        </label>
        <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">__</code> (double underscore) to create a blank.
        </div>
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="e.g., The capital of France is __ and Germany is __."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
        {!hasBlanks && text.trim() && (
          <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
            No blanks detected. Add "__" to create a blank.
          </p>
        )}
      </div>

      {blanks.length > 0 && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Blank Answers
          </label>
          {blanks.map((blank, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Blank #{index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={blank.case_sensitive}
                      onChange={(e) =>
                        updateBlank(index, { case_sensitive: e.target.checked })
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Case Sensitive
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                {blank.acceptable_answers.map((answer, ansIndex) => (
                  <div key={ansIndex} className="flex gap-2">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => {
                        const newAnswers = [...blank.acceptable_answers];
                        newAnswers[ansIndex] = e.target.value;
                        updateBlank(index, { acceptable_answers: newAnswers });
                      }}
                      placeholder={`Acceptable answer ${ansIndex + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newAnswers = blank.acceptable_answers.filter(
                          (_, i) => i !== ansIndex
                        );
                        updateBlank(index, { acceptable_answers: newAnswers });
                      }}
                      className="text-red-500 hover:text-red-700 font-medium px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateBlank(index, {
                      acceptable_answers: [...blank.acceptable_answers, ""],
                    })
                  }
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Acceptable Answer
                </button>
              </div>
              
              {blank.acceptable_answers.length === 0 && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Add at least one acceptable answer.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!allBlanksHaveAnswers && blanks.length > 0 && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          All blanks must have at least one acceptable answer.
        </p>
      )}
    </div>
  );
};
