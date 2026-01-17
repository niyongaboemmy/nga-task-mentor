"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns to proctoring_settings table for specific rules
    await queryInterface.addColumn(
      "proctoring_settings",
      "require_fullscreen",
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Require student to stay in fullscreen mode during quiz",
      }
    );

    await queryInterface.addColumn("proctoring_settings", "min_camera_level", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 50.0,
      validate: {
        min: 0,
        max: 100,
      },
      comment: "Minimum camera activity level required (0-100%)",
    });

    await queryInterface.addColumn(
      "proctoring_settings",
      "min_microphone_level",
      {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 50.0,
        validate: {
          min: 0,
          max: 100,
        },
        comment: "Minimum microphone activity level required (0-100%)",
      }
    );

    await queryInterface.addColumn("proctoring_settings", "min_speaker_level", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 50.0,
      validate: {
        min: 0,
        max: 100,
      },
      comment: "Minimum speaker volume level required (0-100%)",
    });

    await queryInterface.addColumn(
      "proctoring_settings",
      "enable_face_detection",
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Enable face detection to ensure student face is visible",
      }
    );

    await queryInterface.addColumn(
      "proctoring_settings",
      "enable_object_detection",
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Enable object detection to prevent unauthorized materials",
      }
    );

    await queryInterface.addColumn(
      "proctoring_settings",
      "object_detection_sensitivity",
      {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 70.0,
        validate: {
          min: 0,
          max: 100,
        },
        comment: "Sensitivity for object detection (0-100%)",
      }
    );

    // Add new event types to the ENUM in proctoring_events table
    // First, we need to recreate the enum with new values
    await queryInterface.changeColumn("proctoring_events", "event_type", {
      type: Sequelize.ENUM(
        "session_start",
        "session_end",
        "identity_verification",
        "environment_scan",
        "face_not_visible",
        "multiple_faces",
        "looking_away",
        "tab_switch",
        "window_minimized",
        "browser_leave",
        "suspicious_audio",
        "device_disconnected",
        "network_issue",
        "screen_recording_start",
        "screen_recording_stop",
        "manual_flag",
        "auto_flag",
        "proctor_message",
        // New event types for the specific rules
        "fullscreen_exited",
        "camera_level_low",
        "microphone_level_low",
        "speaker_level_low",
        "mobile_phone_detected",
        "unauthorized_object_detected"
      ),
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the new columns from proctoring_settings
    await queryInterface.removeColumn(
      "proctoring_settings",
      "require_fullscreen"
    );
    await queryInterface.removeColumn(
      "proctoring_settings",
      "min_camera_level"
    );
    await queryInterface.removeColumn(
      "proctoring_settings",
      "min_microphone_level"
    );
    await queryInterface.removeColumn(
      "proctoring_settings",
      "min_speaker_level"
    );
    await queryInterface.removeColumn(
      "proctoring_settings",
      "enable_face_detection"
    );
    await queryInterface.removeColumn(
      "proctoring_settings",
      "enable_object_detection"
    );
    await queryInterface.removeColumn(
      "proctoring_settings",
      "object_detection_sensitivity"
    );

    // Revert the enum to original values
    await queryInterface.changeColumn("proctoring_events", "event_type", {
      type: Sequelize.ENUM(
        "session_start",
        "session_end",
        "identity_verification",
        "environment_scan",
        "face_not_visible",
        "multiple_faces",
        "looking_away",
        "tab_switch",
        "window_minimized",
        "browser_leave",
        "suspicious_audio",
        "device_disconnected",
        "network_issue",
        "screen_recording_start",
        "screen_recording_stop",
        "manual_flag",
        "auto_flag",
        "proctor_message"
      ),
      allowNull: false,
    });
  },
};
