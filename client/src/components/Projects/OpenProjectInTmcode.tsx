import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, MonitorUp, X } from "lucide-react";
import { apiErrorMessage, projectsApi } from "../../services/projectsApi";

/** How long to wait for the OS to hand the tmcode:// link to TMCode. */
export const OPEN_FALLBACK_MS = 2000;

/**
 * An "Open in TMCode" button for any tmcode:// deep link: asks Task Mentor
 * for the link (`getLink`) and hands it to the OS. When TMCode is installed,
 * the browser loses focus (the OS prompt or the app comes forward); if
 * nothing like that happens within ~2 s, TMCode probably isn't installed:
 * `fallback="hint"` shows a "Don't have TMCode? Download" hint, and
 * `fallback="download"` goes to the /tmcode download page.
 */
export const TmcodeDeepLinkButton: React.FC<{
  getLink: () => Promise<string>;
  label?: string;
  trackKey?: string;
  fallback?: "hint" | "download";
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  testId?: string;
}> = ({
  getLink,
  label = "Open in TMCode",
  trackKey,
  fallback = "hint",
  disabled = false,
  className = "",
  buttonClassName = "",
  testId,
}) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const open = async () => {
    cleanup.current?.();
    setBusy(true);
    setError(null);
    setShowFallback(false);
    try {
      const deeplink = await getLink();
      let handled = false;
      const markHandled = () => {
        handled = true;
      };
      const onVisibility = () => document.visibilityState === "hidden" && markHandled();
      window.addEventListener("blur", markHandled);
      window.addEventListener("pagehide", markHandled);
      document.addEventListener("visibilitychange", onVisibility);
      const timer = window.setTimeout(() => {
        if (!handled) {
          if (fallback === "download") navigate("/tmcode");
          else setShowFallback(true);
        }
        cleanup.current?.();
      }, OPEN_FALLBACK_MS);
      cleanup.current = () => {
        window.clearTimeout(timer);
        window.removeEventListener("blur", markHandled);
        window.removeEventListener("pagehide", markHandled);
        document.removeEventListener("visibilitychange", onVisibility);
        cleanup.current = null;
      };
      window.location.href = deeplink;
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't get a TMCode link. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={open}
        disabled={busy || disabled}
        data-track={trackKey}
        data-testid={testId}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-gray-900 ${buttonClassName}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MonitorUp className="h-4 w-4" aria-hidden="true" />}
        {label}
      </button>
      <AnimatePresence>
        {showFallback && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            role="status"
            data-testid="tmcode-fallback"
            className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-3 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 text-slate-700 dark:text-slate-200">
                Nothing opened? TMCode may not be installed on this computer.
              </p>
              <button
                type="button"
                onClick={() => setShowFallback(false)}
                aria-label="Dismiss"
                className="rounded-lg p-0.5 text-slate-400 hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Link
              to="/tmcode"
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Don&apos;t have TMCode? Download
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <p role="alert" className="mt-1.5 max-w-xs text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
};

/** "Open in TMCode" for a project (GET /tmcode/projects/:id/open-link). */
const OpenProjectInTmcode: React.FC<{ projectId: number; className?: string }> = ({ projectId, className }) => (
  <TmcodeDeepLinkButton
    getLink={() => projectsApi.openLink(projectId)}
    trackKey="tm.project.open_in_tmcode"
    className={className}
  />
);

export default OpenProjectInTmcode;
