# Proctoring Rules Database Migration - SQL for MAMP

This document contains the SQL queries to run in MAMP (or phpMyAdmin) to add the new proctoring rules and warning tracking functionality.

## Overview of Changes

The migration adds new columns to the `proctoring_settings` table for specific proctoring rules and extends the `proctoring_events` table enum to include new event types for rule violations.

## SQL Queries to Execute

### 1. Add New Columns to proctoring_settings Table

```sql
-- Add require_fullscreen column
ALTER TABLE `proctoring_settings`
ADD COLUMN `require_fullscreen` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Require student to stay in fullscreen mode during quiz';

-- Add min_camera_level column
ALTER TABLE `proctoring_settings`
ADD COLUMN `min_camera_level` DECIMAL(5,2) NOT NULL DEFAULT 50.00 COMMENT 'Minimum camera activity level required (0-100%)';

-- Add min_microphone_level column
ALTER TABLE `proctoring_settings`
ADD COLUMN `min_microphone_level` DECIMAL(5,2) NOT NULL DEFAULT 50.00 COMMENT 'Minimum microphone activity level required (0-100%)';

-- Add min_speaker_level column
ALTER TABLE `proctoring_settings`
ADD COLUMN `min_speaker_level` DECIMAL(5,2) NOT NULL DEFAULT 50.00 COMMENT 'Minimum speaker volume level required (0-100%)';

-- Add enable_face_detection column
ALTER TABLE `proctoring_settings`
ADD COLUMN `enable_face_detection` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Enable face detection to ensure student face is visible';

-- Add enable_object_detection column
ALTER TABLE `proctoring_settings`
ADD COLUMN `enable_object_detection` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Enable object detection to prevent unauthorized materials';

-- Add object_detection_sensitivity column
ALTER TABLE `proctoring_settings`
ADD COLUMN `object_detection_sensitivity` DECIMAL(5,2) NOT NULL DEFAULT 70.00 COMMENT 'Sensitivity for object detection (0-100%)';
```

### 2. Update proctoring_events Table Enum

**Note:** MySQL/MariaDB doesn't support direct enum modification. You need to recreate the column with the new enum values.

```sql
-- First, add a temporary column with the new enum
ALTER TABLE `proctoring_events`
ADD COLUMN `event_type_new` ENUM(
  'session_start',
  'session_end',
  'identity_verification',
  'environment_scan',
  'face_not_visible',
  'multiple_faces',
  'looking_away',
  'tab_switch',
  'window_minimized',
  'browser_leave',
  'suspicious_audio',
  'device_disconnected',
  'network_issue',
  'screen_recording_start',
  'screen_recording_stop',
  'manual_flag',
  'auto_flag',
  'proctor_message',
  'fullscreen_exited',
  'camera_level_low',
  'microphone_level_low',
  'speaker_level_low',
  'mobile_phone_detected',
  'unauthorized_object_detected'
) NOT NULL;

-- Copy data from old column to new column
UPDATE `proctoring_events` SET `event_type_new` = `event_type`;

-- Drop the old column
ALTER TABLE `proctoring_events` DROP COLUMN `event_type`;

-- Rename the new column to the original name
ALTER TABLE `proctoring_events` CHANGE `event_type_new` `event_type` ENUM(
  'session_start',
  'session_end',
  'identity_verification',
  'environment_scan',
  'face_not_visible',
  'multiple_faces',
  'looking_away',
  'tab_switch',
  'window_minimized',
  'browser_leave',
  'suspicious_audio',
  'device_disconnected',
  'network_issue',
  'screen_recording_start',
  'screen_recording_stop',
  'manual_flag',
  'auto_flag',
  'proctor_message',
  'fullscreen_exited',
  'camera_level_low',
  'microphone_level_low',
  'speaker_level_low',
  'mobile_phone_detected',
  'unauthorized_object_detected'
) NOT NULL;
```

## Rollback SQL (if needed)

If you need to rollback these changes, execute the following queries in reverse order:

```sql
-- Remove the new columns
ALTER TABLE `proctoring_settings` DROP COLUMN `require_fullscreen`;
ALTER TABLE `proctoring_settings` DROP COLUMN `min_camera_level`;
ALTER TABLE `proctoring_settings` DROP COLUMN `min_microphone_level`;
ALTER TABLE `proctoring_settings` DROP COLUMN `min_speaker_level`;
ALTER TABLE `proctoring_settings` DROP COLUMN `enable_face_detection`;
ALTER TABLE `proctoring_settings` DROP COLUMN `enable_object_detection`;
ALTER TABLE `proctoring_settings` DROP COLUMN `object_detection_sensitivity`;

-- Revert the enum (this will require recreating the column again with original values)
ALTER TABLE `proctoring_events`
ADD COLUMN `event_type_old` ENUM(
  'session_start',
  'session_end',
  'identity_verification',
  'environment_scan',
  'face_not_visible',
  'multiple_faces',
  'looking_away',
  'tab_switch',
  'window_minimized',
  'browser_leave',
  'suspicious_audio',
  'device_disconnected',
  'network_issue',
  'screen_recording_start',
  'screen_recording_stop',
  'manual_flag',
  'auto_flag',
  'proctor_message'
) NOT NULL;

UPDATE `proctoring_events` SET `event_type_old` = `event_type`;
ALTER TABLE `proctoring_events` DROP COLUMN `event_type`;
ALTER TABLE `proctoring_events` CHANGE `event_type_old` `event_type` ENUM(
  'session_start',
  'session_end',
  'identity_verification',
  'environment_scan',
  'face_not_visible',
  'multiple_faces',
  'looking_away',
  'tab_switch',
  'window_minimized',
  'browser_leave',
  'suspicious_audio',
  'device_disconnected',
  'network_issue',
  'screen_recording_start',
  'screen_recording_stop',
  'manual_flag',
  'auto_flag',
  'proctor_message'
) NOT NULL;
```

## Verification

After running the migration, you can verify the changes with these queries:

```sql
-- Check new columns in proctoring_settings
DESCRIBE `proctoring_settings`;

-- Check updated enum in proctoring_events
DESCRIBE `proctoring_events`;

-- Verify enum values
SELECT DISTINCT `event_type` FROM `proctoring_events` ORDER BY `event_type`;
```

## Notes

- All new columns have appropriate default values
- The migration is designed to be non-destructive (no data loss)
- New proctoring rules will be enabled by default but can be configured per quiz
- The enum extension allows for tracking new types of proctoring violations
