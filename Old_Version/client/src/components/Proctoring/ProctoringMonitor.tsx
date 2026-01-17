import React from "react";
import { X, Monitor } from "lucide-react";
import { Button } from "../ui/Button";
import LiveProctoringDashboard from "./LiveProctoringDashboard";

interface ProctoringMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProctoringMonitor: React.FC<ProctoringMonitorProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-7xl w-full h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Monitor className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Live Proctoring Monitor
            </h2>
          </div>
          <Button
            onClick={onClose}
            variant="secondary"
            size="sm"
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="h-full overflow-auto">
          <LiveProctoringDashboard />
        </div>
      </div>
    </div>
  );
};

export default ProctoringMonitor;
