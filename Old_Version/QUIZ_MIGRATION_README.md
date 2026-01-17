# Quiz Status and Public Visibility Migration

This migration adds support for public quiz visibility and updates the quiz status system.

## Changes Made

### Frontend Changes
- ✅ Updated `QuizStatus` enum from `"draft" | "published" | "archived"` to `"draft" | "published" | "completed"`
- ✅ Added `is_public` field to Quiz interface and API request types
- ✅ Updated QuizList component with public status badges and toggle functionality
- ✅ Updated QuizView component with public status display and edit controls
- ✅ Updated CreateQuiz and EditQuizPage forms with public accessibility options

### Backend Changes
- ✅ Updated QuizStatus type in backend types to use "completed" instead of "archived"
- ✅ Added `is_public` field to CreateQuizRequest and UpdateQuizRequest interfaces
- ✅ Updated Quiz model with `is_public` column and updated status ENUM
- ✅ Modified quiz controller to handle public visibility and updated status validation
- ✅ Updated access control logic to allow public quiz access
- ✅ Enhanced available quizzes query to include public quizzes

### Database Changes
- ✅ Added `is_public` boolean column to quizzes table (defaults to `false`)
- ✅ Updated status ENUM from `('draft', 'published', 'archived')` to `('draft', 'published', 'completed')`
- ✅ Migrated existing "archived" status records to "completed"
- ✅ Added performance indexes for public status queries

## Migration Files

### Option 1: Direct SQL (Recommended for immediate deployment)
Run the SQL queries in `/server/migration-quiz-public.sql` directly on your database:

```bash
mysql -u username -p database_name < server/migration-quiz-public.sql
```

### Option 2: Sequelize Migration (For development workflow)
1. Ensure you have Sequelize CLI installed:
```bash
npm install -g @sequelize/cli
```

2. Configure Sequelize (`.sequelizerc` file created):
```bash
cd server
npx sequelize-cli db:migrate
```

## API Usage

### Update Quiz Status and Public Visibility
```typescript
// Update quiz to be public
PUT /api/quizzes/:id
{
  "status": "published",
  "is_public": true,
  "title": "Updated Quiz Title"
}

// Update quiz to be private
PUT /api/quizzes/:id
{
  "status": "completed",
  "is_public": false,
  "title": "Private Completed Quiz"
}
```

### Access Control
- **Public quizzes**: Accessible by anyone regardless of enrollment status
- **Private quizzes**: Only accessible by enrolled students or instructors
- **Published status**: Required for availability (for both public and private)
- **Completed status**: For finished/graded quizzes

## Testing

After migration, test the following:

1. **Create a public quiz**: Should appear in available quizzes for all students
2. **Toggle quiz visibility**: Public/private toggle should work in UI
3. **Status updates**: Draft → Published → Completed workflow
4. **Access permissions**: Ensure proper access control for public vs private quizzes

## Rollback

If you need to rollback the changes:

### SQL Rollback
```sql
-- Remove public column and revert status
ALTER TABLE `quizzes` DROP INDEX `idx_quizzes_status_public`;
ALTER TABLE `quizzes` DROP INDEX `idx_quizzes_is_public`;
ALTER TABLE `quizzes` MODIFY COLUMN `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft';
UPDATE `quizzes` SET `status` = 'archived' WHERE `status` = 'completed';
ALTER TABLE `quizzes` DROP COLUMN `is_public`;
```

### Sequelize Rollback
```bash
cd server
npx sequelize-cli db:migrate:undo
```

## Notes

- All existing quizzes will be set to private (`is_public = false`) by default
- Existing "archived" quizzes will be converted to "completed" status
- Public quizzes are accessible regardless of course enrollment
- The migration includes both up and down paths for safe rollback
