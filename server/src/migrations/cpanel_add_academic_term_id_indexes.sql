-- =============================================================================
-- Migration: Performance indexes for academic_term_id
-- Database : uruzjktk_taskmentor
-- MySQL    : 5.7  |  cPanel / phpMyAdmin compatible
-- Run via  : phpMyAdmin > SQL tab — paste and click Go
--
-- IMPORTANT: If you see "Duplicate key name" on a CREATE INDEX line it means
--            that index already ran successfully on a previous attempt.
--            It is safe to ignore and the remaining statements will still run.
-- =============================================================================


-- ─── STEP 1: Clean up duplicate session_token indexes on proctoring_sessions ──
-- Sequelize sync() can leave dozens of duplicate unique indexes (session_token_2,
-- session_token_3, …).  MySQL allows max 64 indexes per table; those duplicates
-- must be removed before we can add our new one.
-- Each DROP INDEX below is safe to skip if the index does not exist on your DB.

ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_2`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_3`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_4`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_5`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_6`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_7`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_8`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_9`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_10`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_11`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_12`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_13`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_14`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_15`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_16`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_17`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_18`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_19`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_20`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_21`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_22`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_23`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_24`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_25`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_26`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_27`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_28`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_29`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_30`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_31`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_32`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_33`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_34`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_35`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_36`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_37`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_38`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_39`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_40`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_41`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_42`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_43`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_44`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_45`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_46`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_47`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_48`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_49`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_50`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_51`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_52`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_53`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_54`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_55`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_56`;
ALTER TABLE `proctoring_sessions` DROP INDEX `session_token_57`;


-- ─── STEP 2: Create the 6 performance indexes ─────────────────────────────────

CREATE INDEX idx_quizzes_course_term
  ON `quizzes` (`course_id`, `academic_term_id`);

CREATE INDEX idx_quizzes_term_status
  ON `quizzes` (`academic_term_id`, `status`);

CREATE INDEX idx_assignments_course_term
  ON `assignments` (`course_id`, `academic_term_id`);

CREATE INDEX idx_assignments_status_term
  ON `assignments` (`status`, `academic_term_id`);

CREATE INDEX idx_question_bank_course_term
  ON `question_bank` (`course_id`, `academic_term_id`);

CREATE INDEX idx_proctoring_sessions_quiz_term
  ON `proctoring_sessions` (`quiz_id`, `academic_term_id`);


-- ─── STEP 3: Verify — run each line separately in the SQL tab ─────────────────
-- Expected: each SHOW INDEX should return at least 1 row with the index name.

SHOW INDEX FROM `quizzes`             WHERE Key_name IN ('idx_quizzes_course_term', 'idx_quizzes_term_status');
SHOW INDEX FROM `assignments`         WHERE Key_name IN ('idx_assignments_course_term', 'idx_assignments_status_term');
SHOW INDEX FROM `question_bank`       WHERE Key_name  = 'idx_question_bank_course_term';
SHOW INDEX FROM `proctoring_sessions` WHERE Key_name  = 'idx_proctoring_sessions_quiz_term';
