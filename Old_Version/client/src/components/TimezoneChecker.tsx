import React, { useState, useEffect } from "react";
import { AlertTriangle, Clock, Settings } from "lucide-react";

interface TimezoneCheckerProps {
  children: React.ReactNode;
}

const TimezoneChecker: React.FC<TimezoneCheckerProps> = ({ children }) => {
  const [isCorrectTimezone, setIsCorrectTimezone] = useState<boolean | null>(
    null
  );
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    checkTimezone();
  }, []);

  const checkTimezone = () => {
    try {
      // Get current system timezone
      const systemTime = new Date();
      const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Check if system timezone is Kigali (Africa/Kigali) or equivalent
      const kigaliTimezones = [
        "Africa/Kigali",
        "Africa/Nairobi", // Same timezone as Kigali (UTC+2)
        "Africa/Addis_Ababa",
        "Africa/Dar_es_Salaam",
        "Indian/Comoro",
        "Indian/Mayotte",
      ];

      const isKigaliTimezone = kigaliTimezones.some(
        (tz) =>
          systemTimezone === tz ||
          systemTimezone.includes("Kigali") ||
          systemTimezone.includes("Nairobi")
      );

      // Also check if the time difference matches Kigali timezone (UTC+2)
      const kigaliOffset = 2 * 60; // UTC+2 in minutes
      const systemOffset = systemTime.getTimezoneOffset();

      // Kigali is UTC+2, so offset should be -120 minutes from UTC
      // (Note: getTimezoneOffset returns minutes behind UTC, so -120 for UTC+2)
      const isCorrectOffset = Math.abs(systemOffset - -kigaliOffset) <= 5; // 5 minute tolerance

      const isTimezoneCorrect = isKigaliTimezone && isCorrectOffset;

      setIsCorrectTimezone(isTimezoneCorrect);

      if (!isTimezoneCorrect) {
        setShowWarning(true);
      }
    } catch (error) {
      console.error("Error checking timezone:", error);
      // Default to showing warning if we can't determine timezone
      setIsCorrectTimezone(false);
      setShowWarning(true);
    }
  };

  // Check if user has already accepted the warning today
  useEffect(() => {
    const today = new Date().toDateString();
    const lastWarningDate = localStorage.getItem("timezoneWarningLastShown");
    const warningAccepted = localStorage.getItem("timezoneWarningAccepted");

    if (warningAccepted === "true" && lastWarningDate === today) {
      setShowWarning(false);
    } else if (isCorrectTimezone === false) {
      setShowWarning(true);
      localStorage.setItem("timezoneWarningLastShown", today);
    }
  }, [isCorrectTimezone]);

  if (isCorrectTimezone === null) {
    // Still checking timezone, show loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Clock className="h-20 w-20 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Checking system time...
          </p>
        </div>
      </div>
    );
  }

  if (showWarning) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">System Time Mismatch</h2>
                <p className="text-red-100">Your device time needs attention</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-4">
                <Clock className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Kigali Timezone Required
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    This application requires your device to be set to Kigali
                    timezone (UTC+2, Central Africa Time) for accurate
                    assignment deadlines and proper functionality.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">
                    Current System Information:
                  </span>
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <p>
                    Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                  <p>Current Time: {new Date().toLocaleString()}</p>
                  <p>Required: Africa/Kigali (UTC+2)</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  How to Fix This:
                </h4>

                {/* macOS Instructions */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                    For macOS (MacBook/iMac):
                  </h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>Click the Apple menu () in the top-left corner</li>
                    <li>
                      Select "System Settings" (or "System Preferences" on older
                      macOS)
                    </li>
                    <li>
                      Click "General" in the sidebar, then click "Date & Time"
                    </li>
                    <li>
                      Click the lock icon to make changes (you may need to enter
                      your password)
                    </li>
                    <li>
                      Turn off "Set time and date automatically" if it's on
                    </li>
                    <li>
                      Click "Time Zone" and select "Africa/Kigali" from the map
                      or list
                    </li>
                    <li>Turn "Set time and date automatically" back on</li>
                    <li>Close System Settings and refresh this page</li>
                  </ol>
                </div>

                {/* Windows Instructions */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                    For Windows:
                  </h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>Click the Start button and search for "Settings"</li>
                    <li>Click "Time & Language"</li>
                    <li>Click "Date & time" in the sidebar</li>
                    <li>
                      Under "Time zone", click the dropdown and select
                      "(UTC+02:00) Nairobi"
                    </li>
                    <li>Make sure "Set time automatically" is turned on</li>
                    <li>Click "Sync now" to update your time</li>
                    <li>Close Settings and refresh this page</li>
                  </ol>
                </div>

                {/* Mobile Instructions */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                    For Mobile Devices (iOS/Android):
                  </h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>Open Settings</li>
                    <li>Search for "Time" or "Date & Time"</li>
                    <li>
                      Turn off "Automatic time zone" or "Set automatically"
                    </li>
                    <li>
                      Select your time zone as "Nairobi" or search for "Kigali"
                    </li>
                    <li>Turn automatic time back on</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              >
                Check Again
              </button>
            </div>

            {/* Footer Note */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
                ⚠️ Note: Incorrect system time may cause assignment deadlines to
                display incorrectly. Please set your device to Kigali timezone
                for the best experience.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If timezone is correct, render children normally
  return <>{children}</>;
};

export default TimezoneChecker;
