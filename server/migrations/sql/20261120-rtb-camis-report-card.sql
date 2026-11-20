-- Report card builders (Normal + TVET) and the RTB / CAMIS format (TM). Safe to re-run; run before deploying.
ALTER TABLE report_card_assessments MODIFY COLUMN category ENUM('CW','HW','MD','EOT','IA','FA','CA') NOT NULL;
ALTER TABLE subject_assessment_mappings MODIFY COLUMN category ENUM('CW','HW','MD','EOT','IA','FA','CA') NOT NULL;
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_cards' AND COLUMN_NAME = 'behaviour_mark');
SET @sql := IF(@has = 0, 'ALTER TABLE report_cards ADD COLUMN behaviour_mark DECIMAL(5,2) NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
