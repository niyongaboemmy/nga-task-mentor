import React from "react";
import { Link } from "react-router-dom";

interface LogoProps {
  size?: "small" | "medium" | "large";
  className?: string;
  showText?: boolean;
  /**
   * If provided, Logo will render as a Link to this path.
   * If omitted, Logo renders as a plain non-anchor element (safe to nest).
   */
  to?: string | null;
}

const Logo: React.FC<React.PropsWithChildren<LogoProps>> = ({
  size = "medium",
  className = "",
  showText = true,
  to = null, // <-- default: NOT clickable
  // intentionally ignore children to avoid accidental nested anchors
}) => {
  const sizeClasses = {
    small: "w-6 h-6",
    medium: "w-8 h-8",
    large: "w-12 h-12",
  } as const;

  const textSizeClasses = {
    small: "text-lg",
    medium: "text-xl",
    large: "text-2xl",
  } as const;

  const iconSizes = {
    small: "w-4 h-4",
    medium: "w-5 h-5",
    large: "w-7 h-7",
  } as const;

  const inner = (
    <div
      className={`flex items-center space-x-2 ${className}`}
      aria-hidden={to ? undefined : true}
    >
      {/* Icon container */}
      <div
        className={`${sizeClasses[size]} relative bg-gradient-to-br from-blue-700 via-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105`}
      >
        {/* inner layer for depth */}
        <div className="absolute inset-1 bg-blue-500 rounded-md" />
        <svg
          className={`${iconSizes[size]} text-white relative z-10`}
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
          aria-label="TaskMentor logo"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>

      {showText && (
        <span
          className={`${textSizeClasses[size]} font-semibold text-gray-800 dark:text-gray-200 tracking-wide`}
          style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
        >
          TaskMentor
        </span>
      )}
    </div>
  );

  // If "to" provided, render Link explicitly. Otherwise render a plain div (safe to nest).
  return to ? <Link to={to}>{inner}</Link> : inner;
};

export default Logo;
