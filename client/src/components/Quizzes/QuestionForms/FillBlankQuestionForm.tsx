import React, { useEffect, useState, useMemo } from "react";
import {
  Type,
  TextCursorInput,
  CaseSensitive,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  CheckCircle,
  List,
} from "lucide-react";
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
    // If we have existing acceptable_answers structure, try to use it
    const existingAnswers = data.acceptable_answers;
    if (existingAnswers && Array.isArray(existingAnswers)) {
      setBlanks(
        existingAnswers.map((ans: any) => ({
          index: ans.blank_index,
          acceptable_answers: ans.answers || [],
          case_sensitive: ans.case_sensitive || false,
        })),
      );
    }
  }, []);

  // Sync text changes
  const handleTextChange = (newText: string) => {
    setText(newText);

    // Count blanks in new text - now looking for {{blank}}
    const blankCount = (newText.match(/\{\{blank\}\}/g) || []).length;

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
      acceptable_answers: currentBlanks.map((b) => ({
        blank_index: b.index,
        answers: b.acceptable_answers,
        case_sensitive: b.case_sensitive,
      })),
    });
  };

  // Validation - useMemo to prevent resize loops or flickering if used in effects
  const errors = useMemo(() => {
    const errs: string[] = [];
    const hasBlanks = (text.match(/\{\{blank\}\}/g) || []).length > 0;
    if (!hasBlanks && text.trim())
      errs.push("No blanks detected. Add '{{blank}}' to create a blank.");

    if (blanks.length > 0) {
      const allBlanksHaveAnswers = blanks.every(
        (b) =>
          b.acceptable_answers.length > 0 &&
          b.acceptable_answers.some((a) => a.trim()),
      );
      if (!allBlanksHaveAnswers)
        errs.push("All blanks must have at least one acceptable answer.");
    }
    return errs;
  }, [text, blanks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
          <Type className="w-6 h-6 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Fill-in-the-Blank Setup
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create sentences with missing words for students to complete.
          </p>
        </div>
      </div>

      {/* Text Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TextCursorInput className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Question Text
          </h4>
        </div>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Type your sentence below and use{" "}
            <code className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-mono text-xs font-bold mx-1">
              {"{{blank}}"}
            </code>{" "}
            to create a blank space.
          </p>
        </div>

        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="e.g., The capital of France is {{blank}} and Germany is {{blank}}."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm resize-none"
        />
      </div>

      {/* Blanks Configuration */}
      {blanks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Blank Constraints
              </h4>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
              {blanks.length} Blanks Detected
            </span>
          </div>

          <div className="space-y-4">
            {blanks.map((blank, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:border-teal-300 dark:hover:border-teal-700 transition-all group"
              >
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Blank Position #{index + 1}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group/toggle">
                    <input
                      type="checkbox"
                      checked={blank.case_sensitive}
                      onChange={(e) =>
                        updateBlank(index, { case_sensitive: e.target.checked })
                      }
                      className="peer sr-only"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600 relative"></div>
                    <span className="text-xs font-medium text-gray-500 group-hover/toggle:text-gray-700 dark:text-gray-400 dark:group-hover/toggle:text-gray-300 flex items-center gap-1">
                      <CaseSensitive className="w-3.5 h-3.5" />
                      Case Sensitive
                    </span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Acceptable Answers
                  </label>
                  {blank.acceptable_answers.map((answer, ansIndex) => (
                    <div key={ansIndex} className="flex gap-2">
                      <div className="relative flex-1">
                        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => {
                            const newAnswers = [...blank.acceptable_answers];
                            newAnswers[ansIndex] = e.target.value;
                            updateBlank(index, {
                              acceptable_answers: newAnswers,
                            });
                          }}
                          placeholder={`Acceptable answer ${ansIndex + 1}`}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newAnswers = blank.acceptable_answers.filter(
                            (_, i) => i !== ansIndex,
                          );
                          updateBlank(index, {
                            acceptable_answers: newAnswers,
                          });
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove answer"
                      >
                        <Trash2 className="w-4 h-4" />
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
                    className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium flex items-center gap-1 py-1 px-1 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 w-fit transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Acceptable Answer
                  </button>
                </div>

                {blank.acceptable_answers.length === 0 && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    At least one acceptable answer is required.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
              Validation Errors
            </h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
