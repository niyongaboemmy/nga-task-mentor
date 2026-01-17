import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface QuestionTimerProps {
  timeLeft: number;
  onTimeout?: () => void;
  className?: string;
}

export const QuestionTimer: React.FC<QuestionTimerProps> = ({
  timeLeft: initialTimeLeft,
  onTimeout,
  className = "",
}) => {
  const [timeLeft, setTimeLeft] = useState(
    Math.max(0, Math.floor(initialTimeLeft))
  );

  useEffect(() => {
    setTimeLeft(Math.max(0, Math.floor(initialTimeLeft)));
  }, [initialTimeLeft]);

  // Handle countdown and timeout
  useEffect(() => {
    if (timeLeft <= 0) {
      if (onTimeout) {
        onTimeout();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (onTimeout) {
            onTimeout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeout]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded border ${
        timeLeft < 30
          ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
          : timeLeft < 60
          ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300"
          : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
      } ${className}`}
    >
      <Clock className={`h-4 w-4 ${timeLeft < 60 ? "animate-spin" : ""}`} />
      <span className="font-mono font-medium text-sm">
        {formatTime(timeLeft)}
      </span>
    </div>
  );
};

export default QuestionTimer;
