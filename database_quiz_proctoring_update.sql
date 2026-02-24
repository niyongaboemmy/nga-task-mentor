-- =====================================================
-- Quiz and Proctoring Module Database Update Script
-- Run this script to update your existing database
-- =====================================================

-- NOTE: Run these commands one by one or use a MySQL client that supports
-- stored procedures. For phpMyAdmin, run each section separately.

-- =====================================================
-- SECTION 1: QUIZZES TABLE UPDATES
-- =====================================================

-- Add enable_automatic_grading column (will warn if exists, that's ok)
ALTER TABLE `quizzes` 
ADD COLUMN `enable_automatic_grading` TINYINT(1) NOT NULL DEFAULT '1' AFTER `updated_at`;

-- Add require_manual_grading column (will warn if exists, that's ok)
ALTER TABLE `quizzes` 
ADD COLUMN `require_manual_grading` TINYINT(1) NOT NULL DEFAULT '0' AFTER `enable_automatic_grading`;

-- =====================================================
-- SECTION 2: QUIZ QUESTIONS TABLE UPDATES  
-- =====================================================

-- Add time_limit_seconds column
ALTER TABLE `quiz_questions` 
ADD COLUMN `time_limit_seconds` INT(11) DEFAULT NULL COMMENT 'Time limit for this specific question in seconds' AFTER `updated_at`;

-- =====================================================
-- SECTION 3: QUIZ SUBMISSIONS TABLE UPDATES
-- =====================================================

-- Add end_time column
ALTER TABLE `quiz_submissions` 
ADD COLUMN `end_time` DATETIME DEFAULT NULL COMMENT 'Calculated end time based on quiz duration' AFTER `updated_at`;

-- =====================================================
-- SECTION 4: CREATE PROCTORING TABLES
-- =====================================================

-- Create proctoring_sessions table
CREATE TABLE IF NOT EXISTS `proctoring_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quiz_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `submission_id` int(11) DEFAULT NULL,
  `status` enum('initializing','active','paused','completed','terminated','failed') NOT NULL DEFAULT 'initializing',
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT NULL,
  `total_violations` int(11) DEFAULT '0',
  `auto_terminated` tinyint(1) NOT NULL DEFAULT '0',
  `termination_reason` text,
  `browser_info` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `location_data` text,
  `system_info` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_quiz_id` (`quiz_id`),
  KEY `idx_student_id` (`student_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create proctoring_events table
CREATE TABLE IF NOT EXISTS `proctoring_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `event_type` enum('session_start','session_end','identity_verification','environment_scan','face_not_visible','multiple_faces','looking_away','tab_switch','window_minimized','browser_leave','suspicious_audio','device_disconnected','network_issue','screen_recording_start','screen_recording_stop','manual_flag','auto_flag','proctor_message','fullscreen_exited','camera_level_low','microphone_level_low','speaker_level_low','mobile_phone_detected','unauthorized_object_detected') COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'low',
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  `screenshot_url` text COLLATE utf8mb4_unicode_ci,
  `video_timestamp` int(11) DEFAULT NULL,
  `reviewed` tinyint(1) NOT NULL DEFAULT '0',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_severity` (`severity`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create proctoring_settings table
CREATE TABLE IF NOT EXISTS `proctoring_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quiz_id` int(11) NOT NULL,
  `enable_proctoring` tinyint(1) NOT NULL DEFAULT '0',
  `enable_face_detection` tinyint(1) NOT NULL DEFAULT '1',
  `enable_audio_monitoring` tinyint(1) NOT NULL DEFAULT '1',
  `enable_tab_switch_tracking` tinyint(1) NOT NULL DEFAULT '1',
  `enable_screen_recording` tinyint(1) NOT NULL DEFAULT '0',
  `require_fullscreen` tinyint(1) NOT NULL DEFAULT '1',
  `require_camera` tinyint(1) NOT NULL DEFAULT '1',
  `require_microphone` tinyint(1) NOT NULL DEFAULT '0',
  `min_camera_resolution` varchar(20) DEFAULT '640x480',
  `max_violations_allowed` int(11) DEFAULT '5',
  `violation_threshold_medium` int(11) DEFAULT '3',
  `violation_threshold_high` int(11) DEFAULT '1',
  `auto_terminate_on_high` tinyint(1) NOT NULL DEFAULT '0',
  `min_face_visibility_percent` int(11) DEFAULT '80',
  `min_microphone_level_percent` int(11) DEFAULT '50',
  `min_speaker_level_percent` int(11) DEFAULT '50',
  `allowed_browser_extensions` text,
  `block_screen_share` tinyint(1) NOT NULL DEFAULT '0',
  `block_print_screen` tinyint(1) NOT NULL DEFAULT '1',
  `enable_watermark` tinyint(1) NOT NULL DEFAULT '0',
  `watermark_text` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_quiz_proctoring` (`quiz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create quiz_analytics table
CREATE TABLE IF NOT EXISTS `quiz_analytics` (
  `quiz_id` int(11) DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  `course_id` int(11) DEFAULT NULL,
  `total_submissions` bigint(21) DEFAULT NULL,
  `average_score` decimal(9,6) DEFAULT NULL,
  `average_time_minutes` decimal(18,8) DEFAULT NULL,
  `pass_rate` decimal(29,4) DEFAULT NULL,
  `completed_submissions` bigint(21) DEFAULT NULL,
  `graded_submissions` bigint(21) DEFAULT NULL,
  KEY `idx_quiz_id` (`quiz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- =====================================================
-- SECTION 5: ADD INDEXES
-- =====================================================

ALTER TABLE `quizzes` ADD INDEX `idx_course_id` (`course_id`);
ALTER TABLE `quizzes` ADD INDEX `idx_status` (`status`);
ALTER TABLE `quiz_questions` ADD INDEX `idx_quiz_id` (`quiz_id`);
ALTER TABLE `quiz_submissions` ADD INDEX `idx_student_id` (`student_id`);

SELECT 'Database update completed!' as status;
