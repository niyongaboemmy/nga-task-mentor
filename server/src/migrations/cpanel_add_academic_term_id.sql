-- =============================================================================
-- Migration: Add academic_term_id to quizzes, assignments, question_bank,
--            proctoring_sessions + backfill all existing rows with term id 5
-- Database : taskmentor_dev  (rename to your cPanel DB name before running)
-- Run via  : cPanel > phpMyAdmin > SQL tab  (or import as .sql file)
-- Safe to re-run: each ALTER is guarded by a column-existence check
-- =============================================================================

-- ─── 1. quizzes ──────────────────────────────────────────────────────────────

SET @col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'quizzes'
    AND COLUMN_NAME  = 'academic_term_id'
);

SET @sql = IF(
  @col = 0,
  'ALTER TABLE `quizzes` ADD COLUMN `academic_term_id` INT(11) DEFAULT NULL AFTER `course_id`',
  'SELECT ''quizzes.academic_term_id already exists, skipping ALTER'' AS info'
);

PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 2. assignments ───────────────────────────────────────────────────────────

SET @col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'assignments'
    AND COLUMN_NAME  = 'academic_term_id'
);

SET @sql = IF(
  @col = 0,
  'ALTER TABLE `assignments` ADD COLUMN `academic_term_id` INT(11) DEFAULT NULL AFTER `course_id`',
  'SELECT ''assignments.academic_term_id already exists, skipping ALTER'' AS info'
);

PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 3. question_bank ─────────────────────────────────────────────────────────

SET @col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'question_bank'
    AND COLUMN_NAME  = 'academic_term_id'
);

SET @sql = IF(
  @col = 0,
  'ALTER TABLE `question_bank` ADD COLUMN `academic_term_id` INT(11) DEFAULT NULL AFTER `created_by`',
  'SELECT ''question_bank.academic_term_id already exists, skipping ALTER'' AS info'
);

PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 4. proctoring_sessions ───────────────────────────────────────────────────

SET @col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'proctoring_sessions'
    AND COLUMN_NAME  = 'academic_term_id'
);

SET @sql = IF(
  @col = 0,
  'ALTER TABLE `proctoring_sessions` ADD COLUMN `academic_term_id` INT(11) DEFAULT NULL AFTER `proctor_id`',
  'SELECT ''proctoring_sessions.academic_term_id already exists, skipping ALTER'' AS info'
);

PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =============================================================================
-- Backfill: set academic_term_id = 5 on every row that still has NULL
-- (rows already assigned a term are left untouched)
-- =============================================================================

UPDATE `quizzes`             SET `academic_term_id` = 5 WHERE `academic_term_id` IS NULL;
UPDATE `assignments`         SET `academic_term_id` = 5 WHERE `academic_term_id` IS NULL;
UPDATE `question_bank`       SET `academic_term_id` = 5 WHERE `academic_term_id` IS NULL;
UPDATE `proctoring_sessions` SET `academic_term_id` = 5 WHERE `academic_term_id` IS NULL;

-- =============================================================================
-- Verification: run these SELECTs after import to confirm everything is correct
-- =============================================================================

SELECT 'quizzes'             AS `table`, COUNT(*) AS total_rows, SUM(academic_term_id = 5) AS term5_rows, SUM(academic_term_id IS NULL) AS null_rows FROM `quizzes`
UNION ALL
SELECT 'assignments',             COUNT(*), SUM(academic_term_id = 5), SUM(academic_term_id IS NULL) FROM `assignments`
UNION ALL
SELECT 'question_bank',           COUNT(*), SUM(academic_term_id = 5), SUM(academic_term_id IS NULL) FROM `question_bank`
UNION ALL
SELECT 'proctoring_sessions',     COUNT(*), SUM(academic_term_id = 5), SUM(academic_term_id IS NULL) FROM `proctoring_sessions`;
