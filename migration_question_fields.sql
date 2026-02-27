-- =====================================================================
-- Migration: Add blooms_taxonomy_level_id, tags, difficulty_level
--            to quiz_questions table
-- Date: 2026-02-27
-- =====================================================================

-- 1. Create the blooms_taxonomy_levels lookup table
CREATE TABLE IF NOT EXISTS `blooms_taxonomy_levels` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT         NULL,
  `level_order` INT          NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL,
  `updated_at`  DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_blooms_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed with the 6 standard Bloom's Taxonomy cognitive levels
INSERT IGNORE INTO `blooms_taxonomy_levels`
  (`name`, `description`, `level_order`, `created_at`, `updated_at`)
VALUES
  ('Remembering',   'Recall facts and basic concepts',            1, NOW(), NOW()),
  ('Understanding', 'Explain ideas or concepts',                  2, NOW(), NOW()),
  ('Applying',      'Use information in new situations',          3, NOW(), NOW()),
  ('Analyzing',     'Draw connections among ideas',               4, NOW(), NOW()),
  ('Evaluating',    'Justify a decision or course of action',     5, NOW(), NOW()),
  ('Creating',      'Produce new or original work',               6, NOW(), NOW());

-- 3. Add new columns to quiz_questions
ALTER TABLE `quiz_questions`
  ADD COLUMN `blooms_taxonomy_level_id` INT NULL DEFAULT NULL
    COMMENT 'FK to blooms_taxonomy_levels'
    AFTER `created_by`,

  ADD COLUMN `tags` TEXT NULL DEFAULT NULL
    COMMENT 'JSON array of string tags'
    AFTER `blooms_taxonomy_level_id`,

  ADD COLUMN `difficulty_level` ENUM('EASY','MEDIUM','DIFFICULT') NULL DEFAULT NULL
    COMMENT 'Cognitive difficulty of the question'
    AFTER `tags`;

-- 4. Add foreign key constraint
ALTER TABLE `quiz_questions`
  ADD CONSTRAINT `fk_quiz_questions_blooms`
    FOREIGN KEY (`blooms_taxonomy_level_id`)
    REFERENCES `blooms_taxonomy_levels` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- 5. Index for filtering by difficulty/level
CREATE INDEX `idx_qq_difficulty`
  ON `quiz_questions` (`difficulty_level`);

CREATE INDEX `idx_qq_blooms_level`
  ON `quiz_questions` (`blooms_taxonomy_level_id`);
