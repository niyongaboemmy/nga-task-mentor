import React, { useEffect, useId, useState } from "react";
import { toast } from "react-toastify";
import { Loader2, Undo2 } from "lucide-react";
import Modal from "../ui/Modal";
import { apiErrorMessage, projectsApi } from "../../services/projectsApi";

/**
 * Teacher: send a submitted project back to the student. It goes back to
 * Draft (unlocked), the submission leaves the to-grade list, and the note is
 * recorded on the project's activity for the student to read.
 */
const ReturnForChangesDialog: React.FC<{
  open: boolean;
  projectId: number | null;
  studentName: string;
  onClose: () => void;
  onReturned: () => void;
}> = ({ open, projectId, studentName, onClose, onReturned }) => {
  const id = useId();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMessage("");
      setError(null);
    }
  }, [open]);

  const send = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      await projectsApi.returnForChanges(projectId, message.trim() || undefined);
      toast.success(`Returned to ${studentName} for changes.`);
      onReturned();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't return the project."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Return for changes" size="md">
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {studentName}&apos;s project goes back to <span className="font-semibold">Draft</span> so they can keep working
          and submit again. It leaves your to-grade list until then.
        </p>
        <div>
          <label htmlFor={`${id}-msg`} className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            What should they change? <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id={`${id}-msg`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="e.g. Handle empty input, and add comments to the main loop."
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Undo2 className="h-4 w-4" aria-hidden="true" />}
            Return to student
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ReturnForChangesDialog;
