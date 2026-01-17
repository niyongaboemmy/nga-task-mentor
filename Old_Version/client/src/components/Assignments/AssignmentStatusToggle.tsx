import React, { useState, useRef, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Trophy, XCircle } from "lucide-react";

interface AssignmentStatusToggleProps {
  assignmentId: string;
  currentStatus: "draft" | "published" | "completed" | "removed";
  onStatusChange: (
    assignmentId: string,
    status: "draft" | "published" | "completed" | "removed"
  ) => void;
  canManage: boolean;
  variant?: "select" | "badge";
  size?: "sm" | "md" | "lg";
}

const AssignmentStatusToggle: React.FC<AssignmentStatusToggleProps> = ({
  assignmentId,
  currentStatus,
  onStatusChange,
  canManage,
  variant = "select",
  size = "md",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const statusOptions: Array<{
    value: "draft" | "published" | "completed" | "removed";
    label: string;
    color: string;
    bgColor: string;
    hoverColor: string;
    icon: React.ReactNode;
    shortDesc: string;
  }> = [
    {
      value: "draft",
      label: "Draft",
      color: "text-yellow-700 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      hoverColor: "hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
      icon: <AlertTriangle className="h-4 w-4" />,
      shortDesc: "In preparation",
    },
    {
      value: "published",
      label: "Published",
      color: "text-green-700 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      hoverColor: "hover:bg-green-100 dark:hover:bg-green-900/30",
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      shortDesc: "Live for students",
    },
    {
      value: "completed",
      label: "Completed",
      color: "text-blue-700 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      hoverColor: "hover:bg-blue-100 dark:hover:bg-blue-900/30",
      icon: <Trophy className="h-4 w-4" />,
      shortDesc: "Period ended",
    },
    {
      value: "removed",
      label: "Removed",
      color: "text-red-700 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      hoverColor: "hover:bg-red-100 dark:hover:bg-red-900/30",
      icon: <XCircle className="h-4 w-4" />,
      shortDesc: "No longer available",
    },
  ];

  const currentOption = statusOptions.find(
    (option) => option.value === currentStatus
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "px-2 py-1 text-xs";
      case "lg":
        return "px-3 py-2 text-sm";
      case "md":
      default:
        return "px-2.5 py-1.5 text-xs";
    }
  };

  const handleStatusChange = async (
    newStatus: "draft" | "published" | "completed" | "removed"
  ) => {
    if (!canManage || isChangingStatus || newStatus === currentStatus) return;

    setIsOpen(false);
    setIsChangingStatus(true);

    try {
      await onStatusChange(assignmentId, newStatus);
    } catch (error) {
      console.error("Error updating assignment status:", error);
    } finally {
      setIsChangingStatus(false);
    }
  };

  if (variant === "badge") {
    return (
      <div
        className={`${getSizeClasses()} ${currentOption?.bgColor} ${
          currentOption?.color
        } inline-flex items-center gap-1.5 py-2 px-2.5 rounded-full font-medium border transition-all duration-200`}
      >
        <span className="text-sm">{currentOption?.icon}</span>
        <div className="flex flex-col items-start">
          <span className="font-medium leading-tight">
            {currentOption?.label}
          </span>
          {/* <span className={`text-xs opacity-70 leading-tight`}>
            {currentOption?.shortDesc}
          </span> */}
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div
        className={`${getSizeClasses()} ${currentOption?.bgColor} ${
          currentOption?.color
        } inline-flex items-center gap-1.5 py-2 px-2.5 rounded-full font-medium border border-blue-100 dark:border-blue-800/40`}
      >
        <span className="text-sm">{currentOption?.icon}</span>
        <div className="flex flex-col items-start">
          <span className="font-medium leading-tight">
            {currentOption?.label}
          </span>
          {/* <span className={`text-xs opacity-70 leading-tight`}>
            {currentOption?.shortDesc}
          </span> */}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-[160px]" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChangingStatus}
        className={`
          ${getSizeClasses()}
          ${currentOption?.bgColor}
          ${currentOption?.color}
          border
          border-gray-200/60
          dark:border-gray-600/60
          rounded-xl
          font-medium
          cursor-pointer
          focus:outline-none
          focus:ring-1
          focus:ring-blue-500
          focus:ring-offset-1
          disabled:opacity-60
          disabled:cursor-not-allowed
          transition-all
          duration-200
          hover:shadow-sm
          hover:scale-[1.01]
          active:scale-[0.99]
          relative
          w-full
          min-w-[160px]
          text-left
          flex
          items-center
          justify-between
          group
        `}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm flex-shrink-0">{currentOption?.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{currentOption?.label}</div>
            <div className={`text-xs opacity-70`}>
              {currentOption?.shortDesc}
            </div>
          </div>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>

        {/* Loading Spinner */}
        {isChangingStatus && (
          <div className="absolute inset-0 flex items-center justify-center bg-current bg-opacity-10 rounded-lg">
            <svg
              className="w-3 h-3 animate-spin text-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px]">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg py-1">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                disabled={option.value === currentStatus}
                className={`
                  w-full px-3 py-2 text-left text-sm transition-all duration-150
                  flex items-center gap-2 min-h-[40px]
                  ${
                    option.value === currentStatus
                      ? `${option.bgColor} ${option.color} font-medium`
                      : `text-gray-700 dark:text-gray-300 ${option.hoverColor}`
                  }
                  ${
                    option.value === currentStatus
                      ? "bg-opacity-100"
                      : "hover:bg-opacity-60"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:bg-opacity-80
                `}
              >
                <span className="text-sm flex-shrink-0">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{option.label}</div>
                  <div className={`text-xs opacity-70`}>{option.shortDesc}</div>
                </div>
                {option.value === currentStatus && (
                  <svg
                    className="w-4 h-4 flex-shrink-0 ml-auto"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentStatusToggle;
