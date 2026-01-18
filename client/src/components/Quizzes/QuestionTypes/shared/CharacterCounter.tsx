import React from "react";

interface CharacterCounterProps {
  current: number;
  max?: number;
  className?: string;
}

export const CharacterCounter: React.FC<CharacterCounterProps> = ({
  current,
  max,
  className = "",
}) => {
  const percentage = max ? (current / max) * 100 : 0;
  const isNearLimit = max ? percentage >= 80 : false;
  const isOverLimit = max ? current > max : false;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span
        className={`font-medium transition-colors ${
          isOverLimit
            ? "text-red-600 dark:text-red-400"
            : isNearLimit
              ? "text-yellow-600 dark:text-yellow-400"
              : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {current}
        {max && ` / ${max}`}
      </span>
      {max && (
        <div className="flex-1 max-w-[100px] h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isOverLimit
                ? "bg-red-500"
                : isNearLimit
                  ? "bg-yellow-500"
                  : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
