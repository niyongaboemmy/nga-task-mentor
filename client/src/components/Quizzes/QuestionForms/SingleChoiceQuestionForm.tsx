import React, { useMemo } from "react";
import { 
  CheckCircle2, 
  Trash2, 
  Plus, 
  AlertCircle, 
  List,
  HelpCircle
} from "lucide-react";
import type { SingleChoiceData } from "../../../types/quiz.types";

interface SingleChoiceQuestionFormProps {
  data: SingleChoiceData & { correct_answer?: number };
  onChange: (data: SingleChoiceData & { correct_answer?: number }) => void;
}

export const SingleChoiceQuestionForm: React.FC<
  SingleChoiceQuestionFormProps
> = ({ data, onChange }) => {
  // Ensure data has required properties with defaults
  const options = data?.options || [];
  const rawCorrectIndex = data?.correct_option_index ?? 0;
  const correct_option_index =
    typeof rawCorrectIndex === "number" &&
    rawCorrectIndex >= 0 &&
    rawCorrectIndex < options.length
      ? rawCorrectIndex
      : 0;

  // Validate correct answer before allowing submission
  const isValidCorrectAnswer =
    correct_option_index >= 0 && correct_option_index < options.length;

  // Set correct_answer for payload - only if valid
  const correct_answer = isValidCorrectAnswer ? correct_option_index : undefined;

  const safeData: SingleChoiceData & { correct_answer?: number } = {
    options,
    correct_option_index,
    correct_answer,
  };

  // Validation - memoize for performance
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (safeData.options.length === 0) {
      errs.push("At least one option is required");
    } else {
      const hasEmpty = safeData.options.some((opt: string) => !opt.trim());
      if (hasEmpty) errs.push("All options must have text");
      
      const isValid = safeData.correct_option_index >= 0 && safeData.correct_option_index < safeData.options.length;
      if (!isValid) errs.push("Please select a valid correct answer");
    }
    return errs;
  }, [safeData]);

  const updateData = (newData: any) => {
    onChange(newData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Single Choice Question
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create a question with only one correct answer.
          </p>
        </div>
      </div>

      {/* Options Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Answer Options
            </h4>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
             {safeData.options.length} Options
          </span>
        </div>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
           <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
           <p className="text-sm text-blue-700 dark:text-blue-300">
             Click the circle to mark an option as the <strong>correct answer</strong>.
           </p>
        </div>

        <div className="space-y-3">
          {safeData.options.map((option, index) => (
            <div key={index} className="flex items-center gap-3 group">
              <button
                type="button"
                onClick={() => {
                   const isValid = index >= 0 && index < safeData.options.length;
                   updateData({
                     ...safeData,
                     correct_option_index: index,
                     correct_answer: isValid ? index : undefined,
                   });
                }}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  safeData.correct_option_index === index
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-none"
                    : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 text-transparent"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              
              <div className="relative flex-1">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...safeData.options];
                    newOptions[index] = e.target.value;
                    const isValid = safeData.correct_option_index >= 0 && safeData.correct_option_index < newOptions.length;
                    updateData({
                      ...safeData,
                      options: newOptions,
                      correct_answer: isValid ? safeData.correct_option_index : undefined,
                    });
                  }}
                  placeholder={`Option ${index + 1}`}
                  className={`w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm ${
                    safeData.correct_option_index === index 
                      ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20" 
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
              </div>

              {safeData.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = safeData.options.filter((_: string, i: number) => i !== index);
                    let newCorrectIndex = safeData.correct_option_index;
                    if (newCorrectIndex >= index && newCorrectIndex > 0) {
                      newCorrectIndex--;
                    } else if (newCorrectIndex === index) {
                      newCorrectIndex = 0;
                    }
                    const isValid = newCorrectIndex >= 0 && newCorrectIndex < newOptions.length;
                    updateData({
                      ...safeData,
                      options: newOptions,
                      correct_option_index: newCorrectIndex,
                      correct_answer: isValid ? newCorrectIndex : undefined,
                    });
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Remove option"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={() => {
              const newOptions = [...safeData.options, ""];
              const isValid = safeData.correct_option_index >= 0 && safeData.correct_option_index < newOptions.length;
              updateData({
                ...safeData,
                options: newOptions,
                correct_answer: isValid ? safeData.correct_option_index : undefined,
              });
            }}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-gray-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2 mt-4 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add New Option
          </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
           <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
           <div>
             <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
               Configuration Errors
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
