import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MonitorUp, Loader2 } from "lucide-react";
import axios from "../../utils/axiosConfig";
import { unsupportedDevice } from "../../utils/tmcodeRelease";
import TmcodeInstallHint, { TMCODE_DOWNLOAD_ROUTE, unsupportedDeviceText } from "../Projects/TmcodeInstallHint";

/**
 * "Open in TMCode": asks Task Mentor for a launch ticket (POST /tmcode/launch,
 * which also creates or resumes the attempt) and hands the tmcode:// link to
 * the desktop app. `required` is the tmcode_required wording, shown in place
 * of the web code editor. The page never moves on its own: after the click
 * an inline hint offers the install (and the unsigned-installer tip); on a
 * phone, tablet or Chromebook it says TMCode needs a computer instead.
 */
const OpenInTmcode: React.FC<{ quizId: number; required?: boolean; compact?: boolean }> = ({
  quizId,
  required = false,
  compact = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const unsupported = useMemo(() => unsupportedDevice(), []);

  const open = async () => {
    setError(null);
    // Don't start an attempt on a device that can't run TMCode.
    if (unsupported) {
      setShowHint(true);
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post("/tmcode/launch", { quiz_id: quizId });
      window.location.href = res.data.deeplink;
      setShowHint(true);
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string } } })?.response?.data;
      setError(data?.message || "Couldn't open TMCode. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 ${compact ? "p-3" : "p-5"}`}
      data-testid="open-in-tmcode"
    >
      {!compact && (
        <p className="text-sm text-gray-800 dark:text-gray-200 mb-3">
          {required
            ? "This exam's coding questions must be answered in TMCode, the NGA desktop code editor."
            : "You can answer the coding questions in TMCode, the NGA desktop code editor."}
        </p>
      )}
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorUp className="h-4 w-4" />}
        Open in TMCode
      </button>
      {showHint ? (
        <TmcodeInstallHint unsupported={unsupported} onDismiss={() => setShowHint(false)} className="mt-2" />
      ) : unsupported ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400" data-testid="tmcode-unsupported">
          {unsupportedDeviceText(unsupported)}
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Don&apos;t have TMCode yet?{" "}
          <Link className="font-semibold underline" to={TMCODE_DOWNLOAD_ROUTE}>
            Install TMCode
          </Link>
          , then click the button again.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
};

export default OpenInTmcode;
