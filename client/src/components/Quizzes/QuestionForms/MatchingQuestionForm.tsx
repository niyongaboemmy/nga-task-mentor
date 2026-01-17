import React, { useMemo } from "react";
import { 
  Trash2, 
  Plus, 
  AlertCircle, 
  ArrowRight,
  Type,
  Link,
  Info,
  List
} from "lucide-react";
import type { MatchingData } from "../../../types/quiz.types";

interface MatchingQuestionFormProps {
  data: MatchingData & { correct_answer?: Record<string, string> };
  onChange: (data: MatchingData & { correct_answer?: Record<string, string> }) => void;
}

export const MatchingQuestionForm: React.FC<MatchingQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Validation - memoize for performance
  const errors = useMemo(() => {
    const errs: string[] = [];
    const leftIds = data.left_items.map((i: { id: string; text: string }) => i.id);
    const rightIds = data.right_items.map((i: { id: string; text: string }) => i.id);
    
    if (data.left_items.length === 0) errs.push("At least one item is required");
    
    const hasEmptyLeft = data.left_items.some((i: { id: string; text: string }) => !i.text.trim());
    const hasEmptyRight = data.right_items.some((i: { id: string; text: string }) => !i.text.trim());
    if (hasEmptyLeft || hasEmptyRight) errs.push("All items must have text");

    const hasAll = leftIds.every((id: string) => data.correct_matches[id]);
    const allValid = Object.values(data.correct_matches).every((id: string) => rightIds.includes(id));
    if (!hasAll || !allValid) errs.push("Please match all items with their correct definitions");

    return errs;
  }, [data]);

  const updateData = (newData: MatchingData & { correct_answer?: Record<string, string> }) => {
    // Determine validity for correct_answer inclusion
    const leftIds = newData.left_items.map(i => i.id);
    const rightIds = newData.right_items.map(i => i.id);
    
    const hasItems = newData.left_items.length > 0;
    const allTextFilled = 
      newData.left_items.every(i => !!i.text.trim()) && 
      newData.right_items.every(i => !!i.text.trim());
    
    const allMatched = leftIds.every(id => !!newData.correct_matches[id]);
    const matchesValid = Object.values(newData.correct_matches).every(id => rightIds.includes(id));
    
    const isValid = hasItems && allTextFilled && allMatched && matchesValid;

    onChange({
      ...newData,
      correct_answer: isValid ? newData.correct_matches : undefined
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
          <Link className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Matching Question
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
             Create pairs of items that must be matched correctly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Items Column */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> {/* Changed from ListNumbers to List */}
              <h4 className="font-semibold text-gray-900 dark:text-white">Left Items</h4>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
               {data.left_items.length} Items
            </span>
          </div>
          
          <div className="space-y-3">
            {data.left_items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <span className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => {
                    const newLeftItems = [...data.left_items];
                    newLeftItems[index] = { ...item, text: e.target.value };
                    updateData({ ...data, left_items: newLeftItems });
                  }}
                  placeholder={`Term ${index + 1}`}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newId = (Date.now() + Math.random()).toString();
                updateData({
                  ...data,
                  left_items: [...data.left_items, { id: newId, text: "" }],
                  right_items: [...data.right_items, { id: newId, text: "" }]
                });
              }}
              className="w-full py-2 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex items-center justify-center gap-2 mt-2 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Match Pair
            </button>
          </div>
        </div>

        {/* Right Items Column */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Type className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Right Items</h4>
            </div>
          </div>
          
          <div className="space-y-3">
            {data.right_items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <span className="w-6 h-6 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {String.fromCharCode(65 + index)}
                </span>
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => {
                    const newRightItems = [...data.right_items];
                    newRightItems[index] = { ...item, text: e.target.value };
                    updateData({ ...data, right_items: newRightItems });
                  }}
                  placeholder={`Definition ${String.fromCharCode(65 + index)}`}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                
                {data.left_items.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newLeftItems = data.left_items.filter((_: any, i: number) => i !== index);
                      const newRightItems = data.right_items.filter((_: any, i: number) => i !== index);
                      const newCorrectMatches = { ...data.correct_matches };
                      delete newCorrectMatches[data.left_items[index].id];
                      updateData({
                        ...data,
                        left_items: newLeftItems,
                        right_items: newRightItems,
                        correct_matches: newCorrectMatches
                      });
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Correct Matches Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Link className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">Set Correct Connections</h4>
        </div>
        
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2 border border-blue-100 dark:border-blue-800/50">
           <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
           <p className="text-sm text-blue-700 dark:text-blue-300">
             For each item on the left, choose the correct definition it should match with.
           </p>
        </div>

        <div className="space-y-3">
          {data.left_items.map((leftItem, leftIndex) => (
            <div
              key={leftItem.id}
              className="flex items-center gap-2 p-3 bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-gray-100 dark:border-gray-700 group hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all"
            >
              <div className="flex items-center gap-2 w-1/2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {leftIndex + 1}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {leftItem.text || `Term ${leftIndex + 1}`}
                </span>
              </div>
              
              <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
              
              <div className="flex-1 min-w-0">
                <select
                  value={data.correct_matches[leftItem.id] || ""}
                  onChange={(e) => {
                    const newMatches = { ...data.correct_matches };
                    if (e.target.value) newMatches[leftItem.id] = e.target.value;
                    else delete newMatches[leftItem.id];
                    updateData({ ...data, correct_matches: newMatches });
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select match...</option>
                  {data.right_items.map((rightItem, rightIndex) => (
                    <option key={rightItem.id} value={rightItem.id}>
                      {String.fromCharCode(65 + rightIndex)}: {rightItem.text || `Definition ${String.fromCharCode(65 + rightIndex)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
           <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
           <div>
             <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
               Configuration Issues
             </h4>
             <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
               {errors.map((err: string, i: number) => (
                 <li key={i}>{err}</li>
               ))}
             </ul>
           </div>
        </div>
      )}
    </div>
  );
};
