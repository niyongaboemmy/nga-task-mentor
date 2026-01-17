import React, { useMemo } from "react";
import { 
  CheckCircle2, 
  AlertCircle, 
  Info,
  ThumbsUp,
  ThumbsDown,
  CircleEqual
} from "lucide-react";
import type { TrueFalseData } from "../../../types/quiz.types";

interface TrueFalseQuestionFormProps {
  data: TrueFalseData & { correct_answer?: boolean };
  onChange: (data: TrueFalseData & { correct_answer?: boolean }) => void;
}

export const TrueFalseQuestionForm: React.FC<TrueFalseQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Ensure data has required properties with defaults
  const correct_answer = data?.correct_answer;

  // Validation - memoize for performance
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (correct_answer === undefined || correct_answer === null) {
      errs.push("Please select the correct statement");
    }
    return errs;
  }, [correct_answer]);

  const updateData = (val: boolean) => {
    onChange({ correct_answer: val });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
          <CircleEqual className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             True/False Setup
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
             Define if the statement is factually true or false.
          </p>
        </div>
      </div>

      {/* Selection Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
             Select Correct Statement
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
           {/* True Option */}
           <button
             type="button"
             onClick={() => updateData(true)}
             className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 ${
               correct_answer === true
                 ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-md shadow-emerald-100 dark:shadow-none"
                 : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 hover:border-emerald-200"
             }`}
           >
             <div className={`p-3 rounded-full ${
               correct_answer === true 
                 ? "bg-emerald-500 text-white" 
                 : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
             }`}>
               <ThumbsUp className="w-6 h-6" />
             </div>
             <span className={`font-bold text-lg ${
               correct_answer === true ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
             }`}>
               TRUE
             </span>
             {correct_answer === true && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 absolute top-3 right-3" />
             )}
           </button>

           {/* False Option */}
           <button
             type="button"
             onClick={() => updateData(false)}
             className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 ${
               correct_answer === false
                 ? "border-rose-500 bg-rose-50 dark:bg-rose-950/20 shadow-md shadow-rose-100 dark:shadow-none"
                 : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 hover:border-rose-200"
             }`}
           >
             <div className={`p-3 rounded-full ${
               correct_answer === false 
                 ? "bg-rose-500 text-white" 
                 : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
             }`}>
               <ThumbsDown className="w-6 h-6" />
             </div>
             <span className={`font-bold text-lg ${
               correct_answer === false ? "text-rose-700 dark:text-rose-400" : "text-gray-500 dark:text-gray-400"
             }`}>
               FALSE
             </span>
             {correct_answer === false && (
                <CheckCircle2 className="w-5 h-5 text-rose-500 absolute top-3 right-3" />
             )}
           </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 max-w-md mx-auto">
           <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
           <div>
             <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
               Validation
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
