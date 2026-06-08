-- Migration: add manual_assessments and manual_assessment_scores tables
-- and extend report_card_assessments.assessment_type ENUM

-- 1. Extend ENUM on report_card_assessments
ALTER TABLE report_card_assessments
  MODIFY COLUMN assessment_type ENUM('quiz','assignment','manual') NOT NULL;

-- 2. Create manual_assessments table
CREATE TABLE IF NOT EXISTS manual_assessments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  course_id       INT          NOT NULL,
  title           VARCHAR(255) NOT NULL,
  max_score       FLOAT        NOT NULL,
  term            VARCHAR(50)  NOT NULL,
  academic_year   VARCHAR(20)  NOT NULL,
  created_by      INT          NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_manual_assessments_course (course_id),
  INDEX idx_manual_assessments_term   (term, academic_year)
);

-- 3. Create manual_assessment_scores table
CREATE TABLE IF NOT EXISTS manual_assessment_scores (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  manual_assessment_id  INT   NOT NULL,
  student_id            INT   NOT NULL,
  score                 FLOAT NOT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_manual_score (manual_assessment_id, student_id),
  FOREIGN KEY (manual_assessment_id) REFERENCES manual_assessments(id) ON DELETE CASCADE
);
