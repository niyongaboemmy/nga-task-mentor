import React, { useState, useEffect } from "react";
import { tmcodePolicySummary } from "../../utils/tmcodePolicySummary";
import { toast } from "react-toastify";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import axios from "../../utils/axiosConfig";
import Select from "../ui/Select";

interface ProctoringSettingsProps {
  quizId: string;
  onSettingsSaved: () => void;
}

interface ProctoringSettingsData {
  id?: number;
  quiz_id: number;
  enabled: boolean;
  mode: "automated" | "live" | "record_review" | "disabled";
  require_identity_verification: boolean;
  require_environment_scan: boolean;
  allow_screen_recording: boolean;
  allow_audio_monitoring: boolean;
  allow_video_monitoring: boolean;
  lockdown_browser: boolean;
  /** SEB Config Key (64 hex); never returned to students. */
  seb_config_key?: string | null;
  /** How coding questions are answered: web editor or the TMCode desktop app. */
  tmcode_delivery?: "web" | "tmcode_optional" | "tmcode_required";
  tmcode_policy?: TmcodePolicy | null;
  prevent_tab_switching: boolean;
  prevent_window_minimization: boolean;
  prevent_copy_paste: boolean;
  prevent_right_click: boolean;
  max_flags_allowed: number;
  auto_terminate_on_high_risk: boolean;
  risk_threshold: number;
  require_proctor_approval: boolean;
  recording_retention_days: number;
  allow_multiple_faces: boolean;
  face_detection_sensitivity: number;
  suspicious_behavior_detection: boolean;
  alert_instructors: boolean;
  alert_emails?: string;
  custom_instructions?: string;
  // New fields for specific proctoring rules
  require_fullscreen: boolean;
  min_camera_level: number;
  min_microphone_level: number;
  min_speaker_level: number;
  enable_face_detection: boolean;
  enable_object_detection: boolean;
  object_detection_sensitivity: number;
}

/** TMCode session policy (nga-tmcode packages/protocol/src/policy.ts). */
interface TmcodePolicy {
  mode: "practice" | "monitored" | "secure";
  intelligence: "none" | "basic" | "diagnostics" | "full";
  paste: "allow" | "internal_only" | "block";
  terminal: "off" | "restricted" | "full";
  internet_in_preview: boolean;
  allow_offline_grace_minutes: number;
  /** Run and Debug in the exam (off unless turned on). */
  debugger: boolean;
  /** Oldest TMCode version that may take the exam ("x.y.z"); empty = any. */
  min_app_version?: string;
}

const TMCODE_POLICY_DEFAULTS: TmcodePolicy = {
  mode: "monitored",
  intelligence: "basic",
  paste: "internal_only",
  terminal: "off",
  internet_in_preview: false,
  allow_offline_grace_minutes: 10,
  debugger: false,
};

const ProctoringSettings: React.FC<ProctoringSettingsProps> = ({
  quizId,
  onSettingsSaved,
}) => {
  const [settings, setSettings] = useState<ProctoringSettingsData>({
    quiz_id: parseInt(quizId),
    enabled: false,
    mode: "automated",
    require_identity_verification: true,
    require_environment_scan: true,
    allow_screen_recording: true,
    allow_audio_monitoring: true,
    allow_video_monitoring: true,
    // Requires Safe Exam Browser: opt-in only.
    lockdown_browser: false,
    seb_config_key: null,
    tmcode_delivery: "web",
    tmcode_policy: null,
    prevent_tab_switching: true,
    prevent_window_minimization: true,
    prevent_copy_paste: true,
    prevent_right_click: true,
    max_flags_allowed: 5,
    auto_terminate_on_high_risk: false,
    risk_threshold: 75,
    require_proctor_approval: false,
    recording_retention_days: 90,
    allow_multiple_faces: false,
    face_detection_sensitivity: 70,
    suspicious_behavior_detection: true,
    alert_instructors: true,
    // New default values for specific proctoring rules
    require_fullscreen: true,
    min_camera_level: 50,
    min_microphone_level: 50,
    min_speaker_level: 50,
    enable_face_detection: true,
    enable_object_detection: true,
    object_detection_sensitivity: 70,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [quizId]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `/proctoring/quizzes/${quizId}/proctoring-settings`,
      );

      if (response.data.success && response.data.data) {
        setSettings(response.data.data);
      } else {
        // No settings exist, keep default settings
      }
    } catch (error: any) {
      console.error("Error loading proctoring settings:", error);
      setError(error.response?.data?.message || "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const isCreating = !settings.id;
      const method = isCreating ? "post" : "put";

      const response = await axios[method](
        `/proctoring/quizzes/${quizId}/proctoring-settings`,
        settings,
      );

      if (response.data.success) {
        setSettings(response.data.data);
        onSettingsSaved();
        toast.success("Proctoring settings saved successfully!");
      } else {
        setError(response.data.message || "Failed to save settings");
      }
    } catch (error: any) {
      console.error("Error saving proctoring settings:", error);
      setError(
        error.response?.data?.message || "Network error while saving settings",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (
    field: keyof ProctoringSettingsData,
    value: any,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-xl mb-4 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      <Card className="">
        <CardHeader className="pb-4 px-4 rounded-t-2xl">
          <CardTitle className="text-xl text-text-primary-light dark:text-text-primary-dark">
            Proctoring Settings
          </CardTitle>
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm">
            Configure online proctoring features for this quiz to ensure
            academic integrity.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Enable Proctoring
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) =>
                      handleInputChange("enabled", e.target.checked)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Enable online proctoring for this quiz
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Proctoring Mode
                </label>
                <Select variant="outline"
                  value={settings.mode}
                  onChange={(e) => handleInputChange("mode", e.target.value)}
                  className="w-full"
                  disabled={!settings.enabled}
                >
                  <option value="disabled">Disabled</option>
                  <option value="automated">Automated Monitoring</option>
                  <option value="live">Live Proctoring</option>
                  <option value="record_review">Record & Review</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Risk Threshold (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.risk_threshold}
                  onChange={(e) =>
                    handleInputChange(
                      "risk_threshold",
                      parseInt(e.target.value),
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">
                  Sessions with risk scores above this threshold will be flagged
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Max Flags Allowed (tab switches, blocked pastes…)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={settings.max_flags_allowed}
                  onChange={(e) =>
                    handleInputChange(
                      "max_flags_allowed",
                      parseInt(e.target.value),
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Recording Retention (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.recording_retention_days}
                  onChange={(e) =>
                    handleInputChange(
                      "recording_retention_days",
                      parseInt(e.target.value),
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Face Detection Sensitivity (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.face_detection_sensitivity}
                  onChange={(e) =>
                    handleInputChange(
                      "face_detection_sensitivity",
                      parseInt(e.target.value),
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
              </div>
            </div>
          </div>

          {/* Verification Requirements */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-text-primary-light dark:text-text-primary-dark">
              Verification Requirements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.require_identity_verification}
                  onChange={(e) =>
                    handleInputChange(
                      "require_identity_verification",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Require identity verification
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.require_environment_scan}
                  onChange={(e) =>
                    handleInputChange(
                      "require_environment_scan",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Require environment scan
                </span>
              </label>
            </div>
          </div>

          {/* Monitoring Features */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-text-primary-light dark:text-text-primary-dark">
              Monitoring Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allow_video_monitoring}
                  onChange={(e) =>
                    handleInputChange(
                      "allow_video_monitoring",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Video monitoring
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allow_audio_monitoring}
                  onChange={(e) =>
                    handleInputChange(
                      "allow_audio_monitoring",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Audio monitoring
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allow_screen_recording}
                  onChange={(e) =>
                    handleInputChange(
                      "allow_screen_recording",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Screen recording
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.suspicious_behavior_detection}
                  onChange={(e) =>
                    handleInputChange(
                      "suspicious_behavior_detection",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Suspicious behavior detection
                </span>
              </label>
            </div>
          </div>

          {/* Specific Proctoring Rules */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-text-primary-light dark:text-text-primary-dark">
              Specific Proctoring Rules
            </h3>
            <div className="space-y-4">
              {/* Fullscreen Requirement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.require_fullscreen}
                    onChange={(e) =>
                      handleInputChange("require_fullscreen", e.target.checked)
                    }
                    className="mr-2"
                    disabled={!settings.enabled}
                  />
                  <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Require fullscreen mode
                  </span>
                </label>
              </div>

              {/* Media Level Thresholds */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                    Min Camera Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.min_camera_level}
                    onChange={(e) =>
                      handleInputChange(
                        "min_camera_level",
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    disabled={!settings.enabled}
                  />
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">
                    Minimum camera activity required
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                    Min Microphone Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.min_microphone_level}
                    onChange={(e) =>
                      handleInputChange(
                        "min_microphone_level",
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    disabled={!settings.enabled}
                  />
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">
                    Minimum microphone activity required
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                    Min Speaker Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.min_speaker_level}
                    onChange={(e) =>
                      handleInputChange(
                        "min_speaker_level",
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    disabled={!settings.enabled}
                  />
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">
                    Minimum speaker volume required
                  </p>
                </div>
              </div>

              {/* Detection Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enable_face_detection}
                    onChange={(e) =>
                      handleInputChange(
                        "enable_face_detection",
                        e.target.checked,
                      )
                    }
                    className="mr-2"
                    disabled={!settings.enabled}
                  />
                  <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Enable face detection
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enable_object_detection}
                    onChange={(e) =>
                      handleInputChange(
                        "enable_object_detection",
                        e.target.checked,
                      )
                    }
                    className="mr-2"
                    disabled={!settings.enabled}
                  />
                  <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Enable object detection (mobile phones, etc.)
                  </span>
                </label>
              </div>

              {/* Object Detection Sensitivity */}
              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Object Detection Sensitivity (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.object_detection_sensitivity}
                  onChange={(e) =>
                    handleInputChange(
                      "object_detection_sensitivity",
                      parseInt(e.target.value),
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">
                  Sensitivity for detecting unauthorized objects (higher = more
                  sensitive)
                </p>
              </div>
            </div>
          </div>

          {/* TMCode delivery (applies whether or not proctoring is on) */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4" data-testid="tmcode-settings">
            <h3 className="text-base font-medium mb-3 text-text-primary-light dark:text-text-primary-dark">
              Coding questions: delivery
            </h3>
            <label htmlFor="tmcode-delivery" className="block text-sm mb-1 text-text-secondary-light dark:text-text-secondary-dark">
              Delivery
            </label>
            <Select variant="outline"
              id="tmcode-delivery"
              value={settings.tmcode_delivery ?? "web"}
              onChange={(e) => handleInputChange("tmcode_delivery", e.target.value)}
              className="w-full"
            >
              <option value="web">Web editor (in the browser)</option>
              <option value="tmcode_optional">TMCode optional (desktop app or web)</option>
              <option value="tmcode_required">TMCode required (desktop app only)</option>
            </Select>
            {settings.tmcode_delivery && settings.tmcode_delivery !== "web" && (() => {
              const policy = { ...TMCODE_POLICY_DEFAULTS, ...(settings.tmcode_policy ?? {}) };
              const setPolicy = (patch: Partial<TmcodePolicy>) =>
                handleInputChange("tmcode_policy", { ...policy, ...patch });
              // [value, label, one-line help for that choice, not available yet?]
              type PolicyOption = [string, string, string, boolean?];
              const help = "mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70";
              const select = (id: keyof TmcodePolicy, label: string, options: PolicyOption[]) => {
                const current = options.find(([v]) => v === String(policy[id]));
                return (
                  <div>
                    <label htmlFor={`tmcode-${id}`} className="block text-xs mb-1 text-text-secondary-light dark:text-text-secondary-dark">
                      {label}
                    </label>
                    <Select variant="outline"
                      id={`tmcode-${id}`}
                      value={String(policy[id])}
                      onChange={(e) => setPolicy({ [id]: e.target.value } as Partial<TmcodePolicy>)}
                      className="w-full"
                    >
                      {options.map(([v, l, , unavailable]) => (
                        // A value saved before it was marked unavailable still shows as selected.
                        <option key={v} value={v} disabled={!!unavailable && v !== String(policy[id])}>
                          {l}
                        </option>
                      ))}
                    </Select>
                    {current && (
                      <p className={help} data-testid={`tmcode-${id}-help`}>
                        {current[2]}
                      </p>
                    )}
                  </div>
                );
              };
              return (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {select("mode", "Mode", [
                    ["practice", "Practice (no restrictions)", "No exam rules: students work as they would at home."],
                    ["monitored", "Monitored (logged)", "Students work normally; TMCode records the session for you to review."],
                    [
                      "secure",
                      "Secure (lab lockdown) — not available yet",
                      "Not available yet: TMCode can't lock down the computer, so choose Monitored.",
                      true,
                    ],
                  ])}
                  {select("intelligence", "Editor help", [
                    ["none", "None", "A plain editor: no suggestions, hover tips or error markers."],
                    ["basic", "Basic (syntax colours, brackets)", "Syntax colours and bracket matching only; no suggestions."],
                    ["diagnostics", "Diagnostics (errors shown)", "Errors are marked as students type; no code completion."],
                    ["full", "Full (completion, no AI)", "Code completion and hover tips, never AI."],
                  ])}
                  {select("paste", "Paste", [
                    ["allow", "Allow", "Students can paste anything into the editor."],
                    ["internal_only", "Only text copied inside the exam", "Students can paste only text they copied inside this exam."],
                    ["block", "Block", "Pasting into the editor and the terminal is blocked."],
                  ])}
                  {select("terminal", "Terminal", [
                    ["off", "Off", "No terminal in TMCode."],
                    [
                      "restricted",
                      "Restricted console (currently: terminal off)",
                      "For now this turns the terminal off, exactly like Off. A limited console comes later.",
                    ],
                    ...(policy.mode === "practice"
                      ? [["full", "Full (practice only)", "A full terminal on the student's computer. Practice mode only."] as PolicyOption]
                      : []),
                  ])}
                  <div>
                    <label className="flex items-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={policy.internet_in_preview}
                        onChange={(e) => setPolicy({ internet_in_preview: e.target.checked })}
                      />
                      Internet in the web preview
                    </label>
                    <p className={help}>Lets a student's web page load files and fonts from the internet in the preview.</p>
                  </div>
                  <div>
                    <label className="flex items-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      <input
                        type="checkbox"
                        className="mr-2"
                        data-testid="tmcode-debugger"
                        checked={!!policy.debugger}
                        onChange={(e) => setPolicy({ debugger: e.target.checked })}
                      />
                      Debugger (breakpoints, stepping)
                    </label>
                    <p className={help}>Students can pause their program and inspect it. Running code is always allowed.</p>
                  </div>
                  <div>
                    <label htmlFor="tmcode-grace" className="block text-xs mb-1 text-text-secondary-light dark:text-text-secondary-dark">
                      Offline grace after the deadline (minutes, 0–30)
                    </label>
                    <input
                      id="tmcode-grace"
                      type="number"
                      min={0}
                      max={30}
                      value={policy.allow_offline_grace_minutes}
                      onChange={(e) =>
                        setPolicy({
                          allow_offline_grace_minutes: Math.max(0, Math.min(30, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    />
                    <p className={help}>Work saved offline before the deadline can still be uploaded for this many minutes.</p>
                  </div>
                  <div>
                    <label htmlFor="tmcode-min-version" className="block text-xs mb-1 text-text-secondary-light dark:text-text-secondary-dark">
                      Minimum TMCode version (optional)
                    </label>
                    <input
                      id="tmcode-min-version"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 0.12.0"
                      value={policy.min_app_version ?? ""}
                      onChange={(e) => setPolicy({ min_app_version: e.target.value.trim() })}
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    />
                    <p className={help}>Older TMCode apps are asked to update before the exam. Leave empty to allow any version.</p>
                  </div>
                  <div
                    className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20"
                    data-testid="tmcode-policy-summary"
                  >
                    <p className="mb-1 text-xs font-semibold text-blue-900 dark:text-blue-200">What students will see</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-blue-900/90 dark:text-blue-100/90">
                      {tmcodePolicySummary(policy, settings.tmcode_delivery ?? "web").map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Browser Restrictions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-text-primary-light dark:text-text-primary-dark">
              Browser Restrictions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.lockdown_browser}
                  onChange={(e) =>
                    handleInputChange("lockdown_browser", e.target.checked)
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Require Safe Exam Browser
                </span>
              </label>
              {settings.lockdown_browser && (
                <div className="md:col-span-2">
                  <label
                    htmlFor="seb-config-key"
                    className="block text-xs font-medium mb-1 text-text-secondary-light dark:text-text-secondary-dark"
                  >
                    Safe Exam Browser Config Key (SEB Config Tool → Config Key). Students
                    can only start or answer from SEB with this configuration.
                  </label>
                  <input
                    id="seb-config-key"
                    type="text"
                    spellCheck={false}
                    value={settings.seb_config_key ?? ""}
                    onChange={(e) =>
                      handleInputChange("seb_config_key", e.target.value.trim())
                    }
                    placeholder="64 hexadecimal characters"
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-mono"
                    disabled={!settings.enabled}
                  />
                </div>
              )}

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.prevent_tab_switching}
                  onChange={(e) =>
                    handleInputChange("prevent_tab_switching", e.target.checked)
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Detect and log tab switching
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.prevent_window_minimization}
                  onChange={(e) =>
                    handleInputChange(
                      "prevent_window_minimization",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Detect and log leaving the quiz window
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.prevent_copy_paste}
                  onChange={(e) =>
                    handleInputChange("prevent_copy_paste", e.target.checked)
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Block copying the quiz and pasting from outside (logged)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.prevent_right_click}
                  onChange={(e) =>
                    handleInputChange("prevent_right_click", e.target.checked)
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Block the right-click menu
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allow_multiple_faces}
                  onChange={(e) =>
                    handleInputChange("allow_multiple_faces", e.target.checked)
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Allow multiple faces
                </span>
              </label>
            </div>
          </div>

          {/* Automated Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-text-primary-light dark:text-text-primary-dark">
              Automated Actions
            </h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.auto_terminate_on_high_risk}
                  onChange={(e) =>
                    handleInputChange(
                      "auto_terminate_on_high_risk",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Submit the quiz automatically when a student goes over the max flags
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.require_proctor_approval}
                  onChange={(e) =>
                    handleInputChange(
                      "require_proctor_approval",
                      e.target.checked,
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Require proctor approval for flagged sessions
                </span>
              </label>
            </div>
          </div>

          {/* Alerts and Notifications */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-text-primary-light dark:text-text-primary-dark">
              Alerts & Notifications
            </h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.alert_instructors}
                  onChange={(e) =>
                    handleInputChange("alert_instructors", e.target.checked)
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Alert instructors on violations
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                  Additional Alert Emails
                </label>
                <input
                  type="text"
                  placeholder="email1@example.com, email2@example.com"
                  value={settings.alert_emails || ""}
                  onChange={(e) =>
                    handleInputChange("alert_emails", e.target.value)
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">
                  Comma-separated list of email addresses to receive alerts
                </p>
              </div>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-primary-light dark:text-text-primary-dark">
                Custom Instructions for Students
              </label>
              <textarea
                placeholder="Enter any special instructions for students taking this proctored quiz..."
                value={settings.custom_instructions || ""}
                onChange={(e) =>
                  handleInputChange("custom_instructions", e.target.value)
                }
                className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl h-24 text-sm resize-none"
                disabled={!settings.enabled}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProctoringSettings;
