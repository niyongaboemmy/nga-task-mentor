const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Testing database connection...');

    // Check if user_courses table has data for student ID 3
    const [userCourses] = await connection.execute(
      'SELECT * FROM user_courses WHERE user_id = 3 AND status = "enrolled"'
    );
    console.log('User courses for student 3:', userCourses);

    // Check if quizzes table has data for the courses
    const courseIds = userCourses.map(uc => uc.course_id);
    if (courseIds.length > 0) {
      const [quizzes] = await connection.execute(
        `SELECT q.*, c.title as course_title
         FROM quizzes q
         LEFT JOIN courses c ON q.course_id = c.id
         WHERE q.course_id IN (${courseIds.join(',')})
         AND (q.status = 'published' OR q.is_public = 1)`
      );
      console.log('Available quizzes:', quizzes);

      // Check quiz_questions for these quizzes
      if (quizzes.length > 0) {
        const quizIds = quizzes.map(q => q.id);
        const [questions] = await connection.execute(
          `SELECT COUNT(*) as count FROM quiz_questions WHERE quiz_id IN (${quizIds.join(',')})`
        );
        console.log('Quiz questions count:', questions);
      }
    }

  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    await connection.end();
  }
}

testDatabase();
