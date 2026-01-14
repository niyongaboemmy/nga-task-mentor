-- SQL Script to create proctoring tables for SPWMS
-- Run this script in your MySQL database to add proctoring functionality

-- Create proctoring_sessions table
CREATE TABLE IF NOT EXISTS `proctoring_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `student_id` int NOT NULL,
  `proctor_id` int DEFAULT NULL,
  `session_token` varchar(255) NOT NULL,
  `status` enum('setup','active','paused','completed','terminated','flagged') NOT NULL DEFAULT 'setup',
  `mode` enum('live_proctoring','automated_proctoring','record_review') NOT NULL DEFAULT 'automated_proctoring',
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration_minutes` int DEFAULT NULL,
  `browser_info` text,
  `system_info` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `location_data` text,
  `identity_verified` tinyint(1) NOT NULL DEFAULT 0,
  `environment_verified` tinyint(1) NOT NULL DEFAULT 0,
  `flags_count` int NOT NULL DEFAULT 0,
  `risk_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `recording_url` text,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `quiz_id` (`quiz_id`),
  KEY `student_id` (`student_id`),
  KEY `proctor_id` (`proctor_id`),
  KEY `status` (`status`),
  KEY `start_time` (`start_time`),
  CONSTRAINT `proctoring_sessions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `proctoring_sessions_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `proctoring_sessions_ibfk_3` FOREIGN KEY (`proctor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create proctoring_events table
CREATE TABLE IF NOT EXISTS `proctoring_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `event_type` enum('session_start','session_end','identity_verification','environment_scan','face_not_visible','multiple_faces','looking_away','tab_switch','window_minimized','browser_leave','suspicious_audio','device_disconnected','network_issue','screen_recording_start','screen_recording_stop','manual_flag','auto_flag','proctor_message') NOT NULL,
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `description` text NOT NULL,
  `metadata` text,
  `screenshot_url` text,
  `video_timestamp` int DEFAULT NULL,
  `reviewed` tinyint(1) NOT NULL DEFAULT 0,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `session_id` (`session_id`),
  KEY `event_type` (`event_type`),
  KEY `timestamp` (`timestamp`),
  KEY `severity` (`severity`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `proctoring_events_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `proctoring_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `proctoring_events_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create proctoring_settings table
CREATE TABLE IF NOT EXISTS `proctoring_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `mode` enum('automated','live','record_review','disabled') NOT NULL DEFAULT 'automated',
  `require_identity_verification` tinyint(1) NOT NULL DEFAULT 1,
  `require_environment_scan` tinyint(1) NOT NULL DEFAULT 1,
  `allow_screen_recording` tinyint(1) NOT NULL DEFAULT 1,
  `allow_audio_monitoring` tinyint(1) NOT NULL DEFAULT 1,
  `allow_video_monitoring` tinyint(1) NOT NULL DEFAULT 1,
  `lockdown_browser` tinyint(1) NOT NULL DEFAULT 1,
  `prevent_tab_switching` tinyint(1) NOT NULL DEFAULT 1,
  `prevent_window_minimization` tinyint(1) NOT NULL DEFAULT 1,
  `prevent_copy_paste` tinyint(1) NOT NULL DEFAULT 1,
  `prevent_right_click` tinyint(1) NOT NULL DEFAULT 1,
  `max_flags_allowed` int NOT NULL DEFAULT 5,
  `auto_terminate_on_high_risk` tinyint(1) NOT NULL DEFAULT 0,
  `risk_threshold` decimal(5,2) NOT NULL DEFAULT 75.00,
  `require_proctor_approval` tinyint(1) NOT NULL DEFAULT 0,
  `recording_retention_days` int NOT NULL DEFAULT 90,
  `allow_multiple_faces` tinyint(1) NOT NULL DEFAULT 0,
  `face_detection_sensitivity` decimal(5,2) NOT NULL DEFAULT 70.00,
  `suspicious_behavior_detection` tinyint(1) NOT NULL DEFAULT 1,
  `alert_instructors` tinyint(1) NOT NULL DEFAULT 1,
  `alert_emails` text,
  `custom_instructions` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_id` (`quiz_id`),
  KEY `enabled` (`enabled`),
  CONSTRAINT `proctoring_settings_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS `idx_proctoring_sessions_session_token` ON `proctoring_sessions` (`session_token`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_sessions_quiz_id` ON `proctoring_sessions` (`quiz_id`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_sessions_student_id` ON `proctoring_sessions` (`student_id`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_sessions_status` ON `proctoring_sessions` (`status`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_sessions_start_time` ON `proctoring_sessions` (`start_time`);

CREATE INDEX IF NOT EXISTS `idx_proctoring_events_session_id` ON `proctoring_events` (`session_id`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_events_event_type` ON `proctoring_events` (`event_type`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_events_timestamp` ON `proctoring_events` (`timestamp`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_events_severity` ON `proctoring_events` (`severity`);

CREATE INDEX IF NOT EXISTS `idx_proctoring_settings_quiz_id` ON `proctoring_settings` (`quiz_id`);
CREATE INDEX IF NOT EXISTS `idx_proctoring_settings_enabled` ON `proctoring_settings` (`enabled`);

-- Insert sample proctoring settings for existing quizzes (optional)
-- Uncomment the following lines if you want to enable proctoring for all existing quizzes with default settings
/*
INSERT IGNORE INTO `proctoring_settings` (
  `quiz_id`, `enabled`, `mode`, `require_identity_verification`, `require_environment_scan`,
  `allow_screen_recording`, `allow_audio_monitoring`, `allow_video_monitoring`,
  `lockdown_browser`, `prevent_tab_switching`, `prevent_window_minimization`,
  `prevent_copy_paste`, `prevent_right_click`, `max_flags_allowed`,
  `auto_terminate_on_high_risk`, `risk_threshold`, `require_proctor_approval`,
  `recording_retention_days`, `allow_multiple_faces`, `face_detection_sensitivity`,
  `suspicious_behavior_detection`, `alert_instructors`, `created_at`, `updated_at`
)
SELECT
  `id` as `quiz_id`,
  0 as `enabled`, -- Disabled by default
  'automated' as `mode`,
  1 as `require_identity_verification`,
  1 as `require_environment_scan`,
  1 as `allow_screen_recording`,
  1 as `allow_audio_monitoring`,
  1 as `allow_video_monitoring`,
  1 as `lockdown_browser`,
  1 as `prevent_tab_switching`,
  1 as `prevent_window_minimization`,
  1 as `prevent_copy_paste`,
  1 as `prevent_right_click`,
  5 as `max_flags_allowed`,
  0 as `auto_terminate_on_high_risk`,
  75.00 as `risk_threshold`,
  0 as `require_proctor_approval`,
  90 as `recording_retention_days`,
  0 as `allow_multiple_faces`,
  70.00 as `face_detection_sensitivity`,
  1 as `suspicious_behavior_detection`,
  1 as `alert_instructors`,
  NOW() as `created_at`,
  NOW() as `updated_at`
FROM `quizzes`
WHERE NOT EXISTS (
  SELECT 1 FROM `proctoring_settings` WHERE `proctoring_settings`.`quiz_id` = `quizzes`.`id`
);
*/