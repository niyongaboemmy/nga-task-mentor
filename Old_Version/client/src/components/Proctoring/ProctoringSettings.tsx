import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import axios from "../../utils/axiosConfig";

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
    lockdown_browser: true,
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
        `/api/proctoring/quizzes/${quizId}/proctoring-settings`
      );

      if (response.data.success && response.data.data) {
        setSettings(response.data.data);
      } else {
        // No settings exist, keep default settings
        console.log(
          "No proctoring settings found for this quiz, using defaults"
        );
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
        `/api/proctoring/quizzes/${quizId}/proctoring-settings`,
        settings
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
        error.response?.data?.message || "Network error while saving settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (
    field: keyof ProctoringSettingsData,
    value: any
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
        <CardHeader className="pb-4 px-4 rounded-t-3xl">
          <CardTitle className="text-xl text-gray-900 dark:text-white">
            Proctoring Settings
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Configure online proctoring features for this quiz to ensure
            academic integrity.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enable online proctoring for this quiz
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
                  Proctoring Mode
                </label>
                <select
                  value={settings.mode}
                  onChange={(e) => handleInputChange("mode", e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                >
                  <option value="disabled">Disabled</option>
                  <option value="automated">Automated Monitoring</option>
                  <option value="live">Live Proctoring</option>
                  <option value="record_review">Record & Review</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Sessions with risk scores above this threshold will be flagged
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
                  Max Flags Allowed
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={settings.max_flags_allowed}
                  onChange={(e) =>
                    handleInputChange(
                      "max_flags_allowed",
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                      parseInt(e.target.value)
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
            <h3 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
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
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
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
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Require environment scan
                </span>
              </label>
            </div>
          </div>

          {/* Monitoring Features */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
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
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
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
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
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
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
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
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Suspicious behavior detection
                </span>
              </label>
            </div>
          </div>

          {/* Specific Proctoring Rules */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
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
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Require fullscreen mode
                  </span>
                </label>
              </div>

              {/* Media Level Thresholds */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    disabled={!settings.enabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Minimum camera activity required
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    disabled={!settings.enabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Minimum microphone activity required
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                    disabled={!settings.enabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                        e.target.checked
                      )
                    }
                    className="mr-2"
                    disabled={!settings.enabled}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
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
                        e.target.checked
                      )
                    }
                    className="mr-2"
                    disabled={!settings.enabled}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enable object detection (mobile phones, etc.)
                  </span>
                </label>
              </div>

              {/* Object Detection Sensitivity */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Sensitivity for detecting unauthorized objects (higher = more
                  sensitive)
                </p>
              </div>
            </div>
          </div>

          {/* Browser Restrictions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
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
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Lockdown browser mode
                </span>
              </label>

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
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Prevent tab switching
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.prevent_window_minimization}
                  onChange={(e) =>
                    handleInputChange(
                      "prevent_window_minimization",
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Prevent window minimization
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
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Prevent copy/paste
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
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Prevent right-click
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
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Allow multiple faces
                </span>
              </label>
            </div>
          </div>

          {/* Automated Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
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
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-terminate sessions with high risk scores
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.require_proctor_approval}
                  onChange={(e) =>
                    handleInputChange(
                      "require_proctor_approval",
                      e.target.checked
                    )
                  }
                  className="mr-2"
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Require proctor approval for flagged sessions
                </span>
              </label>
            </div>
          </div>

          {/* Alerts and Notifications */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
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
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Alert instructors on violations
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Comma-separated list of email addresses to receive alerts
                </p>
              </div>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
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
