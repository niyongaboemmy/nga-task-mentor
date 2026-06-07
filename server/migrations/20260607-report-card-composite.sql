-- =============================================================================
-- Composite Migration: Report Card Module
-- Generated : 2026-06-07
-- Target DB : MySQL 5.7+ / MariaDB 10.3+  (cPanel compatible)
-- Covers    : 20260607000000-create-report-card-tables
--             20260607120000-add-uuid-pdf-to-report-cards
--
-- Safe to run multiple times: all DDL is guarded with IF NOT EXISTS / IF EXISTS
-- or INFORMATION_SCHEMA checks.
--
-- NOTE on uuid column:
--   The UUID value is generated at application layer (Sequelize DataType.UUIDV4),
--   not by a DB expression default — so NO DEFAULT (UUID()) is used here,
--   keeping compatibility with MySQL 5.7 which does not support expression
--   defaults for non-TIMESTAMP columns.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = '';

-- -----------------------------------------------------------------------------
-- 1. report_cards
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `report_cards` (
  `id`                    INT(11)      NOT NULL AUTO_INCREMENT,
  `uuid`                  CHAR(36)     NOT NULL,
  `pdf_path`              VARCHAR(500)     NULL DEFAULT NULL,
  `student_id`            INT(11)      NOT NULL,
  `term`                  VARCHAR(50)  NOT NULL,
  `academic_year`         VARCHAR(20)  NOT NULL,
  `class_teacher_comment` TEXT             NULL,
  `attendance_present`    INT(11)      NOT NULL DEFAULT 0,
  `attendance_absent`     INT(11)      NOT NULL DEFAULT 0,
  `attendance_late`       INT(11)      NOT NULL DEFAULT 0,
  `created_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY  `report_cards_uuid_unique` (`uuid`),

  CONSTRAINT `fk_report_cards_student`
    FOREIGN KEY (`student_id`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Indexes: use a stored procedure so we can guard against duplicates on MySQL 5.7
-- (CREATE INDEX IF NOT EXISTS is MySQL 8.0+ only)
DROP PROCEDURE IF EXISTS _add_index;
DELIMITER $$
CREATE PROCEDURE _add_index(
  IN p_table  VARCHAR(64),
  IN p_index  VARCHAR(64),
  IN p_ddl    VARCHAR(512)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = p_table
      AND INDEX_NAME   = p_index
  ) THEN
    SET @_sql = p_ddl;
    PREPARE _s FROM @_sql;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END$$
DELIMITER ;

CALL _add_index('report_cards', 'idx_report_cards_student_id',
  'CREATE INDEX `idx_report_cards_student_id` ON `report_cards` (`student_id`)');

CALL _add_index('report_cards', 'idx_report_cards_year_term',
  'CREATE INDEX `idx_report_cards_year_term` ON `report_cards` (`academic_year`, `term`)');

-- -----------------------------------------------------------------------------
-- 2. report_card_attributes
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `report_card_attributes` (
  `id`             INT(11)                              NOT NULL AUTO_INCREMENT,
  `report_card_id` INT(11)                              NOT NULL,
  `attribute_name` VARCHAR(100)                         NOT NULL,
  `rating`         ENUM('Excellent','Very good','Good') NOT NULL,
  `created_at`     DATETIME                             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME                             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                        ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  CONSTRAINT `fk_rca_report_card`
    FOREIGN KEY (`report_card_id`)
    REFERENCES `report_cards` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CALL _add_index('report_card_attributes', 'idx_rca_report_card_id',
  'CREATE INDEX `idx_rca_report_card_id` ON `report_card_attributes` (`report_card_id`)');

-- -----------------------------------------------------------------------------
-- 3. report_card_assessments
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `report_card_assessments` (
  `id`              INT(11)                       NOT NULL AUTO_INCREMENT,
  `report_card_id`  INT(11)                       NOT NULL,
  `subject_id`      INT(11)                       NOT NULL,
  `assessment_type` ENUM('quiz','assignment')     NOT NULL,
  `assessment_id`   INT(11)                       NOT NULL,
  `category`        ENUM('CW','HW','MD','EOT')    NOT NULL,
  `created_at`      DATETIME                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME                      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  CONSTRAINT `fk_rcas_report_card`
    FOREIGN KEY (`report_card_id`)
    REFERENCES `report_cards` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CALL _add_index('report_card_assessments', 'idx_rcas_report_card_id',
  'CREATE INDEX `idx_rcas_report_card_id` ON `report_card_assessments` (`report_card_id`)');

CALL _add_index('report_card_assessments', 'idx_rcas_subject_id',
  'CREATE INDEX `idx_rcas_subject_id` ON `report_card_assessments` (`subject_id`)');

CALL _add_index('report_card_assessments', 'idx_rcas_type_assessment',
  'CREATE INDEX `idx_rcas_type_assessment` ON `report_card_assessments` (`assessment_type`, `assessment_id`)');

-- Cleanup helper procedure
DROP PROCEDURE IF EXISTS _add_index;

-- -----------------------------------------------------------------------------
-- 4. Add uuid and pdf_path to report_cards if not already present
--    (Covers databases where only 20260607000000 ran, not 20260607120000)
-- -----------------------------------------------------------------------------

-- uuid column
SET @_has_uuid = (
  SELECT COUNT(*)
  FROM   INFORMATION_SCHEMA.COLUMNS
  WHERE  TABLE_SCHEMA = DATABASE()
    AND  TABLE_NAME   = 'report_cards'
    AND  COLUMN_NAME  = 'uuid'
);

SET @_sql_uuid = IF(
  @_has_uuid = 0,
  'ALTER TABLE `report_cards`
     ADD COLUMN `uuid` CHAR(36) NOT NULL DEFAULT \'\' AFTER `id`',
  'SELECT \'uuid column already present\' AS info'
);
PREPARE _s FROM @_sql_uuid;
EXECUTE _s;
DEALLOCATE PREPARE _s;

-- Unique index on uuid (safe even if the ALTER TABLE above was skipped)
DROP PROCEDURE IF EXISTS _add_index2;
DELIMITER $$
CREATE PROCEDURE _add_index2()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'report_cards'
      AND INDEX_NAME   = 'report_cards_uuid_unique'
  ) THEN
    ALTER TABLE `report_cards`
      ADD UNIQUE KEY `report_cards_uuid_unique` (`uuid`);
  END IF;
END$$
DELIMITER ;
CALL _add_index2();
DROP PROCEDURE IF EXISTS _add_index2;

-- pdf_path column
SET @_has_pdf = (
  SELECT COUNT(*)
  FROM   INFORMATION_SCHEMA.COLUMNS
  WHERE  TABLE_SCHEMA = DATABASE()
    AND  TABLE_NAME   = 'report_cards'
    AND  COLUMN_NAME  = 'pdf_path'
);

SET @_sql_pdf = IF(
  @_has_pdf = 0,
  'ALTER TABLE `report_cards`
     ADD COLUMN `pdf_path` VARCHAR(500) NULL DEFAULT NULL AFTER `uuid`',
  'SELECT \'pdf_path column already present\' AS info'
);
PREPARE _s FROM @_sql_pdf;
EXECUTE _s;
DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- 5. Mark both migrations as applied in SequelizeMeta
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `SequelizeMeta` (
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `SequelizeMeta` (`name`) VALUES
  ('20260607000000-create-report-card-tables.js'),
  ('20260607120000-add-uuid-pdf-to-report-cards.js');

-- -----------------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- Verification query — run this after import to confirm:
--
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
-- FROM   INFORMATION_SCHEMA.COLUMNS
-- WHERE  TABLE_SCHEMA = DATABASE()
--   AND  TABLE_NAME   IN ('report_cards','report_card_attributes','report_card_assessments')
-- ORDER  BY TABLE_NAME, ORDINAL_POSITION;
-- =============================================================================
