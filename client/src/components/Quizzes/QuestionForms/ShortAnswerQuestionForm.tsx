import React, { useMemo } from "react";
import { 
  FileText, 
  MessageSquare, 
  Key, 
  Plus, 
  Trash2, 
  AlertCircle, 
  HelpCircle,
  Hash,
  TextCursor,
  List
} from "lucide-react";
import type { ShortAnswerData } from "../../../types/quiz.types";

interface ShortAnswerQuestionFormProps {
  data: ShortAnswerData;
  onChange: (data: any) => void;
}

export const ShortAnswerQuestionForm: React.FC<ShortAnswerQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Ensure data has default values
  const safeData = {
    max_length: data?.max_length || 500,
    keywords: data?.keywords || [],
    sample_answer: data?.sample_answer || "",
  };

  // Validation - memoize for performance
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!safeData.max_length || safeData.max_length <= 0) {
      errs.push("Maximum length must be greater than 0");
    }
    return errs;
  }, [safeData.max_length]);

  const updateData = (newData: any) => {
    onChange(newData);
  };

  const handleAddKeyword = (keyword: string) => {
    if (keyword.trim() && !safeData.keywords?.includes(keyword.trim())) {
      updateData({
        ...safeData,
        keywords: [...(safeData.keywords || []), keyword.trim()],
      });
    }
  };

  const handleRemoveKeyword = (index: number) => {
    const newKeywords = [...(safeData.keywords || [])];
    newKeywords.splice(index, 1);
    updateData({
      ...safeData,
      keywords: newKeywords,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
          <FileText className="w-6 h-6 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Short Answer Setup
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure expectations for open-ended text answers.
          </p>
        </div>
      </div>

      {/* Basic Settings Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Hash className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Length Constraints
          </h4>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
               <TextCursor className="w-3.5 h-3.5" />
               Maximum Character Length
            </label>
            <input
              type="number"
              value={safeData.max_length || ""}
              onChange={(e) =>
                updateData({
                  ...safeData,
                  max_length: parseInt(e.target.value) || 500,
                })
              }
              min="1"
              placeholder="e.g., 500"
              className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Sample Answer Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Reference Answer
          </h4>
        </div>
        
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
           <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
           <p className="text-sm text-blue-700 dark:text-blue-300">
             Provide a sample correct answer. This won't be shown to students but helps in grading.
           </p>
        </div>

        <textarea
          value={safeData.sample_answer || ""}
          onChange={(e) =>
            updateData({
              ...safeData,
              sample_answer: e.target.value,
            })
          }
          placeholder="Type the ideal sample answer here..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all text-sm resize-none"
        />
      </div>

      {/* Keywords Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Grading Keywords
            </h4>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
             {safeData.keywords?.length || 0} Keywords
          </span>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Define specific terms that should be present in a high-quality response.
        </p>

        <div className="flex flex-wrap gap-2 mb-4 min-h-[40px] p-3 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/10">
          {safeData.keywords?.length > 0 ? (
            safeData.keywords.map((keyword: string, index: number) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-md text-sm group"
              >
                <span>{keyword}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(index)}
                  className="text-rose-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <span className="text-xs text-gray-400 italic flex items-center gap-2">
               <List className="w-3.5 h-3.5" />
               No keywords added yet
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a keyword and press Enter..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddKeyword(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all"
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (input?.value) {
                handleAddKeyword(input.value);
                input.value = "";
              }
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Errors */}
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
