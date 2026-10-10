import React, { useMemo, useState } from "react";
import { Loader2, MonitorUp } from "lucide-react";
import { apiErrorMessage, projectsApi } from "../../services/projectsApi";
import { unsupportedDevice } from "../../utils/tmcodeRelease";
import TmcodeInstallHint from "./TmcodeInstallHint";

/**
 * An "Open in TMCode" button for any tmcode:// deep link: asks Task Mentor
 * for the link (`getLink`) and hands it to the OS. The page never moves on
 * its own (the browser's "Open TMCode?" prompt may still be showing): after
 * the click an inline hint offers "Didn't open? Install TMCode" with the
 * tip for the unsigned installers. On a phone, tablet or Chromebook the
 * link isn't opened; the hint says TMCode needs a Windows, macOS or Linux
 * computer.
 */
export const TmcodeDeepLinkButton: React.FC<{
  getLink: () => Promise<string>;
  label?: string;
  trackKey?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  testId?: string;
  /** Called once the link was handed to the OS. */
  onOpened?: () => void;
}> = ({
  getLink,
  label = "Open in TMCode",
  trackKey,
  disabled = false,
  className = "",
  buttonClassName = "",
  testId,
  onOpened,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const unsupported = useMemo(() => unsupportedDevice(), []);

  const open = async () => {
    setError(null);
    if (unsupported) {
      setShowHint(true);
      return;
    }
    setBusy(true);
    try {
      const deeplink = await getLink();
      window.location.href = deeplink;
      setShowHint(true);
      onOpened?.();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't get a TMCode link. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col items-stretch gap-1.5 ${className}`}>
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
      {showHint && <TmcodeInstallHint unsupported={unsupported} onDismiss={() => setShowHint(false)} className="max-w-xs" />}
      {error && (
        <p role="alert" className="max-w-xs text-xs text-rose-600 dark:text-rose-400">
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
