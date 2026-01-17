import React, { useMemo } from "react";
import { 
  CheckSquare, 
  Trash2, 
  Plus, 
  AlertCircle, 
  ListChecks,
  HelpCircle,
  Settings
} from "lucide-react";
import type { MultipleChoiceData } from "../../../types/quiz.types";

interface MultipleChoiceQuestionFormProps {
  data: MultipleChoiceData & { correct_answer?: number[] };
  onChange: (data: MultipleChoiceData & { correct_answer?: number[] }) => void;
}

export const MultipleChoiceQuestionForm: React.FC<
  MultipleChoiceQuestionFormProps
> = ({ data, onChange }) => {
  // Ensure data has required properties with defaults
  const options = data?.options || [];
  const rawCorrectIndices = data?.correct_option_indices || [];
  const correct_option_indices = rawCorrectIndices.filter(
    (index: number) => typeof index === "number" && index >= 0 && index < options.length
  );

  // Set correct_answer for payload - only if valid
  const isValidCorrectAnswers = correct_option_indices.length > 0;
  const correct_answer = isValidCorrectAnswers ? correct_option_indices : undefined;

  const safeData: MultipleChoiceData & { correct_answer?: number[] } = {
    options,
    correct_option_indices,
    min_selections: data?.min_selections ?? 1,
    max_selections: data?.max_selections ?? options.length,
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
      
      if (safeData.correct_option_indices.length === 0) {
        errs.push("Select at least one correct answer");
      }
    }
    
    if (safeData.min_selections !== undefined && safeData.max_selections !== undefined) {
      if (safeData.min_selections > safeData.max_selections) {
        errs.push("Minimum selections cannot exceed maximum selections");
      }
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
        <div className="p-3 bg-sky-50 dark:bg-sky-900/30 rounded-lg">
          <CheckSquare className="w-6 h-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Multiple Choice Question
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create a question with one or more correct answers.
          </p>
        </div>
      </div>

      {/* Options Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-sky-600 dark:text-sky-400" />
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
             Select the checkboxes next to all <strong>correct answers</strong>.
           </p>
        </div>

        <div className="space-y-3">
          {safeData.options.map((option, index) => (
            <div key={index} className="flex items-center gap-3 group">
              <button
                type="button"
                onClick={() => {
                  const currentIndices = safeData.correct_option_indices || [];
                  let newIndices;
                  if (currentIndices.includes(index)) {
                     newIndices = currentIndices.filter((i: number) => i !== index);
                  } else {
                     newIndices = [...currentIndices, index];
                  }
                  const isValid = newIndices.length > 0;
                  updateData({
                    ...safeData,
                    correct_option_indices: newIndices,
                    correct_answer: isValid ? newIndices : undefined,
                  });
                }}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                  safeData.correct_option_indices.includes(index)
                    ? "border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-200 dark:shadow-none"
                    : "border-gray-300 dark:border-gray-600 hover:border-sky-400 text-transparent"
                }`}
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              
              <div className="relative flex-1">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...safeData.options];
                    newOptions[index] = e.target.value;
                    const isValid = safeData.correct_option_indices.length > 0;
                    updateData({
                      ...safeData,
                      options: newOptions,
                      correct_answer: isValid ? safeData.correct_option_indices : undefined,
                    });
                  }}
                  placeholder={`Option ${index + 1}`}
                  className={`w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-sm ${
                    safeData.correct_option_indices.includes(index)
                      ? "border-sky-200 dark:border-sky-900/50 bg-sky-50/30 dark:bg-sky-950/20" 
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
              </div>

              {safeData.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = safeData.options.filter((_: string, i: number) => i !== index);
                    const newIndices = safeData.correct_option_indices
                      .filter((i: number) => i !== index)
                      .map((i: number) => (i > index ? i - 1 : i));
                    const isValid = newIndices.length > 0;
                    updateData({
                      ...safeData,
                      options: newOptions,
                      correct_option_indices: newIndices,
                      correct_answer: isValid ? newIndices : undefined,
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
              const isValid = safeData.correct_option_indices.length > 0;
              updateData({
                ...safeData,
                options: newOptions,
                correct_answer: isValid ? safeData.correct_option_indices : undefined,
              });
            }}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-gray-500 hover:border-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all flex items-center justify-center gap-2 mt-4 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add New Option
          </button>
        </div>
      </div>

      {/* Settings Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Selection Constraints
          </h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Minimum Selections
             </label>
             <input
               type="number"
               min={1}
               max={safeData.options.length}
               value={safeData.min_selections}
               onChange={(e) => updateData({ ...safeData, min_selections: parseInt(e.target.value) || 1 })}
               className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 focus:outline-none focus:ring-1 focus:ring-sky-500"
             />
           </div>
           <div>
             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Maximum Selections
             </label>
             <input
               type="number"
               min={1}
               max={safeData.options.length}
               value={safeData.max_selections}
               onChange={(e) => updateData({ ...safeData, max_selections: parseInt(e.target.value) || 1 })}
               className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 focus:outline-none focus:ring-1 focus:ring-sky-500"
             />
           </div>
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
