import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, Loader2 } from "lucide-react";
import { formatBytes } from "../../../utils/fileList";

export interface UploadProgressState {
  /** "uploading" while bytes go up, "saving" once the server has them all. */
  phase: "uploading" | "saving";
  loaded: number;
  total: number;
  fileCount: number;
}

/** Full-screen progress card shown while an assignment (and its files) is saved. */
const UploadProgressOverlay: React.FC<{ state: UploadProgressState | null; label: string }> = ({
  state,
  label,
}) => {
  const pct = state && state.total > 0 ? Math.min(100, Math.round((state.loaded / state.total) * 100)) : 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  const uploading = state?.phase === "uploading" && state.fileCount > 0;

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
          data-testid="upload-progress"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 p-6 text-center"
          >
            <div className="relative mx-auto w-24 h-24">
              {uploading ? (
                <>
                  <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
                    <circle cx="40" cy="40" r={R} strokeWidth="6" className="fill-none stroke-gray-100 dark:stroke-gray-800" />
                    <motion.circle
                      cx="40"
                      cy="40"
                      r={R}
                      strokeWidth="6"
                      strokeLinecap="round"
                      className="fill-none stroke-blue-600"
                      strokeDasharray={C}
                      animate={{ strokeDashoffset: C - (pct / 100) * C }}
                      transition={{ ease: "easeOut", duration: 0.3 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">{pct}%</span>
                  </div>
                </>
              ) : (
                <div className="w-24 h-24 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
              )}
            </div>

            <p className="mt-4 font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center justify-center gap-2">
              {uploading ? (
                <>
                  <CloudUpload className="w-5 h-5 text-blue-600" />
                  Uploading {state.fileCount} file{state.fileCount > 1 ? "s" : ""}
                </>
              ) : (
                label
              )}
            </p>
            <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {uploading
                ? `${formatBytes(state.loaded)} of ${formatBytes(state.total)} — keep this page open`
                : "Almost done…"}
            </p>
            {uploading && (
              <div className="mt-4 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadProgressOverlay;
