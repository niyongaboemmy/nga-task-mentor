-- Add mis_user_id column to users table

ALTER TABLE users ADD COLUMN mis_user_id INT NULL UNIQUE COMMENT 'MIS system user ID';

-- Add index for performance

CREATE INDEX idx_users_mis_user_id ON users (mis_user_id);