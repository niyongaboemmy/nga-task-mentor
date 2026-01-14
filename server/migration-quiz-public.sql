-- Migration: Update quiz status enum and add public visibility
-- Generated for MySQL database

-- Step 1: Add is_public column to quizzes table
ALTER TABLE `quizzes` ADD COLUMN `is_public` BOOLEAN NOT NULL DEFAULT FALSE AFTER `show_correct_answers`;

-- Step 2: Update any existing quizzes with "archived" status to "completed"
UPDATE `quizzes` SET `status` = 'completed' WHERE `status` = 'archived';

-- Step 3: Modify the status ENUM to use "completed" instead of "archived"
ALTER TABLE `quizzes` MODIFY COLUMN `status` ENUM('draft', 'published', 'completed') NOT NULL DEFAULT 'draft';

-- Step 4: Add index on is_public for better query performance (optional)
CREATE INDEX `idx_quizzes_is_public` ON `quizzes` (`is_public`);

-- Step 5: Add index on status and is_public combination for available quizzes query (optional)
CREATE INDEX `idx_quizzes_status_public` ON `quizzes` (`status`, `is_public`);

-- Migration completed successfully
-- The following changes have been applied:
-- 1. Added is_public boolean column (defaults to FALSE for private)
-- 2. Updated existing "archived" status records to "completed"
-- 3. Changed ENUM from ('draft', 'published', 'archived') to ('draft', 'published', 'completed')
-- 4. Added performance indexes for better query optimization
