import React from "react";
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

  // Validation
  const isValidMaxLength = safeData.max_length && safeData.max_length > 0;

  const handleAddKeyword = (keyword: string) => {
    if (keyword.trim() && !safeData.keywords?.includes(keyword.trim())) {
      onChange({
        ...safeData,
        keywords: [...(safeData.keywords || []), keyword.trim()],
      });
    }
  };

  const handleRemoveKeyword = (index: number) => {
    const newKeywords = [...(safeData.keywords || [])];
    newKeywords.splice(index, 1);
    onChange({
      ...safeData,
      keywords: newKeywords,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Maximum Length
        </label>
        <input
          type="number"
          value={safeData.max_length || ""}
          onChange={(e) =>
            onChange({
              ...safeData,
              max_length: parseInt(e.target.value) || 500,
            })
          }
          min="1"
          placeholder="500"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
        {!isValidMaxLength && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Maximum length must be greater than 0.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Sample Answer (Optional)
        </label>
        <textarea
          value={safeData.sample_answer || ""}
          onChange={(e) =>
            onChange({
              ...safeData,
              sample_answer: e.target.value,
            })
          }
          placeholder="Enter a sample correct answer for reference..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          This will be used as a reference for grading
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Keywords (Optional)
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Add keywords that should appear in correct answers for automated grading assistance
        </p>
        
        {/* Keywords list */}
        <div className="flex flex-wrap gap-2 mb-3">
          {safeData.keywords?.map((keyword, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
            >
              <span>{keyword}</span>
              <button
                type="button"
                onClick={() => handleRemoveKeyword(index)}
                className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add keyword input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter a keyword and press Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddKeyword(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
};
