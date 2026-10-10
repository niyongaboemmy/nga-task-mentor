import React from "react";
import { Link } from "react-router-dom";
import { Download, MonitorX, ShieldAlert, X } from "lucide-react";
import { detectOs, unsignedInstallerTip, type UnsupportedDevice } from "../../utils/tmcodeRelease";

/** The TMCode download page (App.tsx route of TmcodeDownloadPage). */
export const TMCODE_DOWNLOAD_ROUTE = "/tmcode";

const DEVICE_TEXT: Record<UnsupportedDevice, string> = {
  mobile: "TMCode needs a Windows, macOS or Linux computer: it doesn't run on phones or tablets.",
  chromeos: "TMCode needs a Windows, macOS or Linux computer: it doesn't run on Chromebooks.",
};

/** What to say on a device that can't run TMCode. */
export const unsupportedDeviceText = (device: UnsupportedDevice) => DEVICE_TEXT[device];

/**
 * Shown inline after "Open in TMCode" was clicked (the page never moves on
 * its own: the browser's "Open TMCode?" prompt may still be up). On a
 * desktop: "Didn't open? Install TMCode" plus the one-line tip for the
 * unsigned installers. On a phone, tablet or Chromebook: that TMCode needs a
 * Windows, macOS or Linux computer.
 */
const TmcodeInstallHint: React.FC<{
  unsupported?: UnsupportedDevice | null;
  onDismiss?: () => void;
  className?: string;
}> = ({ unsupported = null, onDismiss, className = "" }) => (
  <div
    role="status"
    data-testid="tmcode-fallback"
    className={`flex items-start gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-gray-900/80 dark:text-slate-200 ${className}`}
  >
    {unsupported ? (
      <>
        <MonitorX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="flex-1">{unsupportedDeviceText(unsupported)}</p>
      </>
    ) : (
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          Didn&apos;t open?{" "}
          <Link
            to={TMCODE_DOWNLOAD_ROUTE}
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Install TMCode
          </Link>
          , then click the button again.
        </p>
        <p className="flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400" data-testid="tmcode-unsigned-tip">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {unsignedInstallerTip(detectOs())}
        </p>
      </div>
    )}
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-lg p-0.5 text-slate-400 hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

export default TmcodeInstallHint;
