/* eslint-disable react-refresh/only-export-components -- a toast helper and its body belong together */
import { toast, type ToastOptions } from "react-toastify";

/** Toast body with one action button (e.g. Undo); clicking it runs the action and closes the toast. */
function ActionToast({ message, actionLabel, onAction, closeToast }: { message: string; actionLabel: string; onAction: () => void; closeToast?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm">{message}</span>
      <button
        type="button"
        data-testid="toast-action"
        onClick={() => {
          onAction();
          closeToast?.();
        }}
        className="flex-shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
      >
        {actionLabel}
      </button>
    </div>
  );
}

/** A success toast with an Undo button (kept open a little longer so there's time to use it). */
export function toastWithUndo(message: string, onUndo: () => void, opts: ToastOptions = {}) {
  return toast.success(({ closeToast }) => <ActionToast message={message} actionLabel="Undo" onAction={onUndo} closeToast={closeToast} />, {
    autoClose: 7000,
    ...opts,
  });
}
