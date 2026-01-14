import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  deadline: string;
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "urgent" | "expired";
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  deadline,
  className = "",
  showLabel = true,
  variant = "default",
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds };
    };

    // Check if we have a saved timer state in localStorage
    const savedDeadline = localStorage.getItem(`countdown_${deadline}`);
    const savedTimeLeft = savedDeadline ? JSON.parse(savedDeadline) : null;

    if (savedTimeLeft && savedTimeLeft.deadline === deadline) {
      // Restore from localStorage if the deadline matches
      setTimeLeft(savedTimeLeft.timeLeft);
      setIsExpired(savedTimeLeft.isExpired);
    } else {
      // Initial calculation
      setTimeLeft(calculateTimeLeft());
    }

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      // Save to localStorage
      localStorage.setItem(
        `countdown_${deadline}`,
        JSON.stringify({
          deadline,
          timeLeft: newTimeLeft,
          isExpired:
            newTimeLeft.days === 0 &&
            newTimeLeft.hours === 0 &&
            newTimeLeft.minutes === 0 &&
            newTimeLeft.seconds === 0,
        })
      );
    }, 1000);

    return () => {
      clearInterval(timer);
      // Clean up localStorage when component unmounts
      localStorage.removeItem(`countdown_${deadline}`);
    };
  }, [deadline]);

  const getVariantStyles = () => {
    if (isExpired) {
      return {
        container:
          "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
        text: "text-red-700 dark:text-red-300",
        icon: "text-red-500",
        badge: "bg-red-500 text-white",
      };
    }

    switch (variant) {
      case "urgent":
        return {
          container:
            "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
          text: "text-orange-700 dark:text-orange-300",
          icon: "text-orange-500",
          badge: "bg-orange-500 text-white",
        };
      case "expired":
        return {
          container:
            "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
          text: "text-red-700 dark:text-red-300",
          icon: "text-red-500",
          badge: "bg-red-500 text-white",
        };
      default:
        return {
          container:
            "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
          text: "text-blue-700 dark:text-blue-300",
          icon: "text-blue-500",
          badge: "bg-blue-500 text-white",
        };
    }
  };

  const styles = getVariantStyles();

  if (isExpired) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${styles.container} ${className}`}
      >
        <Clock className={`h-3 w-3 ${styles.icon}`} />
        {showLabel && (
          <span className={`text-xs font-medium ${styles.text}`}>Expired</span>
        )}
      </div>
    );
  }

  const hasDays = timeLeft.days > 0;
  const hasHours = timeLeft.hours > 0 || hasDays;
  const hasMinutes = timeLeft.minutes > 0 || hasHours;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${styles.container} ${className}`}
    >
      <Clock className={`h-3 w-3 ${styles.icon}`} />
      {showLabel && (
        <span className={`text-xs font-medium ${styles.text}`}>Due in:</span>
      )}
      <span className={`text-xs font-mono font-bold ${styles.text}`}>
        {hasDays && `${timeLeft.days}d `}
        {hasHours && `${timeLeft.hours}h `}
        {hasMinutes && `${timeLeft.minutes}m `}
        {`${timeLeft.seconds}s`}
      </span>
    </div>
  );
};

export default CountdownTimer;
