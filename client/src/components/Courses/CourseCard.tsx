import React from "react";
import type { Course } from "../../types/course.types";

interface CourseCardProps {
  course: Course;
  compact?: boolean;
  onClick?: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  compact = false,
  onClick,
}) => {
  return (
    <div
      className={`bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:bg-gray-900/60 dark:border-gray-800/50 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.01] cursor-pointer ${
        compact ? "p-3" : "p-4"
      }`}
      onClick={onClick}
    >
      {/* Header row with course code icon and status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base">
              {course.code.substring(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={`font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-white group-hover:underline transition-colors mb-1 ${
                compact ? "text-base" : "text-base"
              }`}
            >
              {course.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {course.code} • {course.credits || 0} Credits
            </p>
          </div>
        </div>
      </div>

      {/* Description - only show in non-compact mode */}
      {!compact && course.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {course.description}
        </p>
      )}
    </div>
  );
};

export default CourseCard;
