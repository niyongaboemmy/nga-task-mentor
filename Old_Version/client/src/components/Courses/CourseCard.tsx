import React from "react";
import { Link } from "react-router-dom";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  credits: number;
  department: string;
  instructor: {
    first_name: string;
    last_name: string;
  };
  is_active: boolean;
  start_date: string;
  end_date: string;
}

interface CourseCardProps {
  course: Course;
  compact?: boolean;
  showInstructor?: boolean;
  onClick?: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  compact = false,
  showInstructor = true,
  onClick,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Link to={onClick ? "#" : `/courses/${course.id}`} className="block group">
      <div
        className={`bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:bg-gray-900/60 dark:border-gray-800/50 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.01] ${
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
                {course.code} • {course.credits} Credits
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
              course.is_active
                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {course.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Description - only show in non-compact mode */}
        {!compact && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {course.description}
          </p>
        )}

        {/* Dates and instructor info - more compact */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="truncate">{formatDate(course.start_date)}</span>
          </div>

          {showInstructor && course.instructor && (
            <div className="flex items-center gap-1">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
              <span className="truncate max-w-[80px]">
                {course.instructor.first_name} {course.instructor.last_name}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
