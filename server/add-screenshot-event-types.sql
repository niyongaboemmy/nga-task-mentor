-- Add new event types for instructor-captured screenshots
-- This adds 'instructor_screenshot' and 'instructor_interface_screenshot' to the event_type ENUM

-- First, check the current ENUM values and modify the column
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
  'instructor_warning',
  'instructor_screenshot',
  'instructor_interface_screenshot'
) NOT NULL;

-- Verify the change
SHOW COLUMNS FROM proctoring_events LIKE 'event_type';
