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
      className={`bg-card-light dark:bg-card-dark/30 rounded-3xl shadow-sm border border-white dark:border-border-dark/30 hover:border-blue-200 dark:hover:border-blue-900 transition-colors cursor-pointer ${
        compact ? "p-4" : "p-5"
      }`}
      onClick={onClick}
    >
      {/* Header row with course code icon and status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 dark:text-blue-400 font-bold text-base">
              {(course.code || "??").substring(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={`font-semibold text-text-primary-light dark:text-text-primary-dark truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1 ${
                compact ? "text-base" : "text-base"
              }`}
            >
              {course.title}
            </h3>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 truncate">
              {course.code} • {course.credits || 0} Credits
            </p>
          </div>
        </div>
      </div>

      {/* Description - only show in non-compact mode */}
      {!compact && course.description && (
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 line-clamp-2 mb-3">
          {course.description}
        </p>
      )}
    </div>
  );
};

export default CourseCard;
