import React from "react";
import type { MatchingData } from "../../../types/quiz.types";

interface MatchingQuestionFormProps {
  data: MatchingData & { correct_answer?: Record<string, string> };
  onChange: (data: MatchingData & { correct_answer?: Record<string, string> }) => void;
}

export const MatchingQuestionForm: React.FC<MatchingQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Validate correct matches
  const leftItemIds = data.left_items.map(item => item.id);
  const rightItemIds = data.right_items.map(item => item.id);
  
  // Check if all left items have matches and all matches reference valid right items
  const hasAllMatches = leftItemIds.every(leftId => data.correct_matches[leftId]);
  const allMatchesValid = Object.values(data.correct_matches).every(
    rightId => rightItemIds.includes(rightId)
  );
  const isValidCorrectAnswer = hasAllMatches && allMatchesValid && leftItemIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Left Items */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Left Items (Terms/Items to Match)
        </label>
        <div className="space-y-3">
          {data.left_items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                {index + 1}
              </span>
              <input
                type="text"
                value={item.text}
                onChange={(e) => {
                  const newLeftItems = [...data.left_items];
                  newLeftItems[index] = { ...item, text: e.target.value };
                  const newData = {
                    ...data,
                    left_items: newLeftItems,
                  };
                  // Revalidate
                  const leftIds = newData.left_items.map(i => i.id);
                  const rightIds = newData.right_items.map(i => i.id);
                  const hasAll = leftIds.every(id => newData.correct_matches[id]);
                  const allValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
                  const isValid = hasAll && allValid && leftIds.length > 0;
                  onChange({
                    ...newData,
                    correct_answer: isValid ? newData.correct_matches : undefined,
                  });
                }}
                placeholder={`Term ${index + 1}`}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                required
              />
              {data.left_items.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newLeftItems = data.left_items.filter(
                      (_, i) => i !== index
                    );
                    const newRightItems = data.right_items.filter(
                      (_, i) => i !== index
                    );
                    const newCorrectMatches = {
                      ...data.correct_matches,
                    };
                    // Remove matches for deleted items
                    Object.keys(newCorrectMatches).forEach((key) => {
                      if (!newLeftItems.find((item) => item.id === key)) {
                        delete newCorrectMatches[key];
                      }
                    });
                    const newData = {
                      ...data,
                      left_items: newLeftItems,
                      right_items: newRightItems,
                      correct_matches: newCorrectMatches,
                    };
                    // Revalidate
                    const leftIds = newData.left_items.map(i => i.id);
                    const rightIds = newData.right_items.map(i => i.id);
                    const hasAll = leftIds.every(id => newData.correct_matches[id]);
                    const allValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
                    const isValid = hasAll && allValid && leftIds.length > 0;
                    onChange({
                      ...newData,
                      correct_answer: isValid ? newData.correct_matches : undefined,
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newId = (data.left_items.length + 1).toString();
              const newLeftItems = [
                ...data.left_items,
                { id: newId, text: "" },
              ];
              const newRightItems = [
                ...data.right_items,
                { id: newId, text: "" },
              ];
              const newData = {
                ...data,
                left_items: newLeftItems,
                right_items: newRightItems,
              };
              // Revalidate
              const leftIds = newData.left_items.map(i => i.id);
              const rightIds = newData.right_items.map(i => i.id);
              const hasAll = leftIds.every(id => newData.correct_matches[id]);
              const allValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
              const isValid = hasAll && allValid && leftIds.length > 0;
              onChange({
                ...newData,
                correct_answer: isValid ? newData.correct_matches : undefined,
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Right Items */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Right Items (Definitions/Matches)
        </label>
        <div className="space-y-3">
          {data.right_items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 flex items-center justify-center text-xs font-bold">
                {String.fromCharCode(65 + index)}
              </span>
              <input
                type="text"
                value={item.text}
                onChange={(e) => {
                  const newRightItems = [...data.right_items];
                  newRightItems[index] = {
                    ...item,
                    text: e.target.value,
                  };
                  const newData = {
                    ...data,
                    right_items: newRightItems,
                  };
                  // Revalidate
                  const leftIds = newData.left_items.map(i => i.id);
                  const rightIds = newData.right_items.map(i => i.id);
                  const hasAll = leftIds.every(id => newData.correct_matches[id]);
                  const allValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
                  const isValid = hasAll && allValid && leftIds.length > 0;
                  onChange({
                    ...newData,
                    correct_answer: isValid ? newData.correct_matches : undefined,
                  });
                }}
                placeholder={`Definition ${String.fromCharCode(65 + index)}`}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 transition-colors duration-200"
                required
              />
              {data.right_items.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newLeftItems = data.left_items.filter(
                      (_, i) => i !== index
                    );
                    const newRightItems = data.right_items.filter(
                      (_, i) => i !== index
                    );
                    const newCorrectMatches = {
                      ...data.correct_matches,
                    };
                    // Remove matches that point to deleted right items
                    Object.keys(newCorrectMatches).forEach((key) => {
                      if (newCorrectMatches[key] === item.id) {
                        delete newCorrectMatches[key];
                      }
                    });
                    const newData = {
                      ...data,
                      left_items: newLeftItems,
                      right_items: newRightItems,
                      correct_matches: newCorrectMatches,
                    };
                    // Revalidate
                    const leftIds = newData.left_items.map(i => i.id);
                    const rightIds = newData.right_items.map(i => i.id);
                    const hasAll = leftIds.every(id => newData.correct_matches[id]);
                    const allValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
                    const isValid = hasAll && allValid && leftIds.length > 0;
                    onChange({
                      ...newData,
                      correct_answer: isValid ? newData.correct_matches : undefined,
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newId = (data.right_items.length + 1).toString();
              const newLeftItems = [
                ...data.left_items,
                { id: newId, text: "" },
              ];
              const newRightItems = [
                ...data.right_items,
                { id: newId, text: "" },
              ];
              const newData = {
                ...data,
                left_items: newLeftItems,
                right_items: newRightItems,
              };
              // Revalidate
              const leftIds = newData.left_items.map(i => i.id);
              const rightIds = newData.right_items.map(i => i.id);
              const hasAll = leftIds.every(id => newData.correct_matches[id]);
              const allValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
              const isValid = hasAll && allValid && leftIds.length > 0;
              onChange({
                ...newData,
                correct_answer: isValid ? newData.correct_matches : undefined,
              });
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Definition
          </button>
        </div>
      </div>

      {/* Correct Matches Setup */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Set Correct Matches
        </label>
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600 rounded-2xl p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            For each left item, select the corresponding right item that
            represents the correct match.
          </p>
          <div className="space-y-4">
            {data.left_items.map((leftItem, leftIndex) => (
              <div
                key={leftItem.id}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-600"
              >
                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                  {leftIndex + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
                  {leftItem.text || `Term ${leftIndex + 1}`}
                </span>
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <select
                  value={data.correct_matches[leftItem.id] || ""}
                  onChange={(e) => {
                    const newCorrectMatches = {
                      ...data.correct_matches,
                    };
                    if (e.target.value) {
                      newCorrectMatches[leftItem.id] = e.target.value;
                    } else {
                      delete newCorrectMatches[leftItem.id];
                    }
                    const newData = {
                      ...data,
                      correct_matches: newCorrectMatches,
                    };
                    // Revalidate
                    const leftIds = newData.left_items.map(i => i.id);
                    const rightIds = newData.right_items.map(i => i.id);
                    const hasAll = leftIds.every(id => newData.correct_matches[id]);
                    const allValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
                    const isValid = hasAll && allValid && leftIds.length > 0;
                    onChange({
                      ...newData,
                      correct_answer: isValid ? newData.correct_matches : undefined,
                    });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 transition-colors duration-200"
                >
                  <option value="">Select match...</option>
                  {data.right_items.map((rightItem, rightIndex) => (
                    <option key={rightItem.id} value={rightItem.id}>
                      {String.fromCharCode(65 + rightIndex)} -{" "}
                      {rightItem.text ||
                        `Definition ${String.fromCharCode(65 + rightIndex)}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!isValidCorrectAnswer && leftItemIds.length > 0 && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Please match all items with their correct definitions.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
