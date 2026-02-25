-- Migration: Add instructor_warning to proctoring_events event_type enum
-- This adds support for the new warning event type

-- First, add the new enum values to the event_type column
-- Note: MySQL requires modifying the enum by changing the column

-- For MySQL 8.0+, you can use this approach:
ALTER TABLE proctoring_events 
MODIFY COLUMN event_type ENUM(
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
    'unauthorized_object_detected',
    'instructor_warning'
) NOT NULL;

-- Also add the new event types that were missing:
-- fullscreen_exited, camera_level_low, microphone_level_low, speaker_level_low, 
-- mobile_phone_detected, unauthorized_object_detected
