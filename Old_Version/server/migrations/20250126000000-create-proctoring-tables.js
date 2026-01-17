"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create proctoring_sessions table
    await queryInterface.createTable("proctoring_sessions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      quiz_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "quizzes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      proctor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      session_token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM(
          "setup",
          "active",
          "paused",
          "completed",
          "terminated",
          "flagged"
        ),
        allowNull: false,
        defaultValue: "setup",
      },
      mode: {
        type: Sequelize.ENUM(
          "live_proctoring",
          "automated_proctoring",
          "record_review"
        ),
        allowNull: false,
        defaultValue: "automated_proctoring",
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      browser_info: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      system_info: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      location_data: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      identity_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      environment_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      flags_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      risk_score: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 100,
        },
      },
      recording_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Create proctoring_events table
    await queryInterface.createTable("proctoring_events", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "proctoring_sessions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      event_type: {
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
      },
      severity: {
        type: Sequelize.ENUM("low", "medium", "high", "critical"),
        allowNull: false,
        defaultValue: "low",
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      screenshot_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      video_timestamp: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reviewed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Create proctoring_settings table
    await queryInterface.createTable("proctoring_settings", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      quiz_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "quizzes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      mode: {
        type: Sequelize.ENUM("automated", "live", "record_review", "disabled"),
        allowNull: false,
        defaultValue: "automated",
      },
      require_identity_verification: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      require_environment_scan: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      allow_screen_recording: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      allow_audio_monitoring: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      allow_video_monitoring: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lockdown_browser: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      prevent_tab_switching: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      prevent_window_minimization: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      prevent_copy_paste: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      prevent_right_click: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      max_flags_allowed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
        validate: {
          min: 0,
          max: 100,
        },
      },
      auto_terminate_on_high_risk: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      risk_threshold: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 75,
        validate: {
          min: 0,
          max: 100,
        },
      },
      require_proctor_approval: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      recording_retention_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 90,
        validate: {
          min: 1,
          max: 365,
        },
      },
      allow_multiple_faces: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      face_detection_sensitivity: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 70,
        validate: {
          min: 0,
          max: 100,
        },
      },
      suspicious_behavior_detection: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      alert_instructors: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      alert_emails: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      custom_instructions: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex("proctoring_sessions", ["session_token"]);
    await queryInterface.addIndex("proctoring_sessions", ["quiz_id"]);
    await queryInterface.addIndex("proctoring_sessions", ["student_id"]);
    await queryInterface.addIndex("proctoring_sessions", ["status"]);
    await queryInterface.addIndex("proctoring_sessions", ["start_time"]);

    await queryInterface.addIndex("proctoring_events", ["session_id"]);
    await queryInterface.addIndex("proctoring_events", ["event_type"]);
    await queryInterface.addIndex("proctoring_events", ["timestamp"]);
    await queryInterface.addIndex("proctoring_events", ["severity"]);

    await queryInterface.addIndex("proctoring_settings", ["quiz_id"]);
    await queryInterface.addIndex("proctoring_settings", ["enabled"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("proctoring_events");
    await queryInterface.dropTable("proctoring_sessions");
    await queryInterface.dropTable("proctoring_settings");
  },
};
