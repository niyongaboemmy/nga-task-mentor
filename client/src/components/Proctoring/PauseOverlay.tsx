import React from "react";
import { createPortal } from "react-dom";
import { Pause, Play, AlertCircle } from "lucide-react";

interface PauseOverlayProps {
  isVisible: boolean;
  reason?: string;
  onResume?: () => void;
}

const PauseOverlay: React.FC<PauseOverlayProps> = ({
  isVisible,
  reason = "Exam has been paused by the instructor",
  onResume,
}) => {
  if (!isVisible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-gray-900/95 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {/* Pause Icon */}
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Pause className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Exam Paused
        </h2>

        {/* Reason */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200 text-left">
              {reason}
            </p>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
          Please wait until the instructor resumes your exam. You cannot answer
          questions while the exam is paused.
        </p>

        {/* Note about auto-resume */}
        <p className="text-xs text-gray-500 dark:text-gray-500">
          The exam will resume automatically when the instructor allows it.
        </p>
      </div>

      {/* Add animation */}
      <style>{`
        @keyframes pulse-gentle {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default PauseOverlay;
