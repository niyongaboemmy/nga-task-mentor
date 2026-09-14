import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, HelpCircle, X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button and icon as a destructive action (orange, not red — see project palette). */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Replaces the browser's native `confirm()` — which can't be styled, blocks
// the whole tab, and looks nothing like the rest of the app — with a themed
// modal consistent with every other dialog in the Report Card module.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-sm bg-white dark:bg-gray-900 border border-white/20 dark:border-white/[0.1] rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/60 overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
            >
              <div className="p-5 flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    danger
                      ? "bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700/40"
                      : "bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/40"
                  }`}
                >
                  {danger ? (
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-300" />
                  ) : (
                    <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h3 id="confirm-dialog-title" className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                    {title}
                  </h3>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1 leading-relaxed">
                    {description}
                  </p>
                </div>
                <button
                  onClick={onCancel}
                  className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2.5 px-5 pb-5">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-white/[0.06] text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-colors"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  autoFocus
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 shadow-lg ${
                    danger
                      ? "bg-orange-600 hover:bg-orange-500 shadow-orange-900/20 dark:shadow-orange-900/40"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 dark:shadow-blue-900/40"
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
