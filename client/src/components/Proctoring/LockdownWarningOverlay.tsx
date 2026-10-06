import React from "react";
import { AlertTriangle } from "lucide-react";
import type { LockdownIncident } from "../../hooks/useQuizLockdown";

/**
 * Shown when the quiz's restrictions catch something (leaving the window, a
 * blocked paste/copy). Browsers can't prevent leaving the window, so the
 * wording says it is monitored and recorded, not prevented.
 */
const LockdownWarningOverlay: React.FC<{
  incident: LockdownIncident | null;
  maxFlags: number | null;
  onDismiss: () => void;
}> = ({ incident, maxFlags, onDismiss }) => {
  if (!incident) return null;
  return (
    <div
      role="alertdialog"
      aria-labelledby="lockdown-warning-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h2 id="lockdown-warning-title" className="text-lg font-bold text-gray-900 dark:text-white">
            Recorded
          </h2>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">{incident.message}</p>
        <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white" data-testid="lockdown-count">
          {maxFlags
            ? `${incident.count} of ${maxFlags} allowed`
            : `${incident.count} recorded so far`}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Return to the quiz
        </button>
      </div>
    </div>
  );
};

export default LockdownWarningOverlay;
