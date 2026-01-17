import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function createQuizzes() {
  let connection;

  try {
    // Use the same database config as the server
    console.log('Connecting to database...');
    console.log('Host:', process.env.DB_HOST);
    console.log('Port:', process.env.DB_PORT);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'root',
      database: process.env.DB_NAME || 'taskmentor_dev'
    });

    console.log('✅ Database connected successfully');

    // First, check if there are any existing quizzes
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM quizzes');
    console.log('Current quiz count:', (rows as any)[0].count);

    // Create a public quiz
    console.log('📝 Creating public quiz...');
    const [publicQuizResult] = await connection.execute(`
      INSERT INTO quizzes (
        title, description, status, type, time_limit, max_attempts,
        passing_score, show_results_immediately, randomize_questions,
        show_correct_answers, is_public, course_id, created_by,
        start_date, end_date, created_at, updated_at
      ) VALUES (
        'JavaScript Fundamentals Quiz',
        'Test your knowledge of JavaScript basics including variables, functions, and data types.',
        'published', 'practice', 30, 3, 70, 1, 0, 1, 1, 1, 1,
        '2025-01-01 00:00:00', '2025-12-31 23:59:59', NOW(), NOW()
      )
    `);

    const publicQuizId = (publicQuizResult as any).insertId;
    console.log(`📊 Created public quiz with ID: ${publicQuizId}`);

    // Create questions for public quiz
    console.log('📝 Creating questions for public quiz...');
    await connection.execute(`
      INSERT INTO quiz_questions (
        quiz_id, question_text, question_type, question_data,
        correct_answer, points, explanation, \`order\`, is_required,
        created_at, updated_at
      ) VALUES
      (
        ${publicQuizId},
        'What is the correct way to declare a variable in JavaScript?',
        'multiple_choice',
        '{"options":["variable x = 5;","var x = 5;","v x = 5;","declare x = 5;"],"correct_option_indices":[1],"min_selections":1,"max_selections":1}',
        '{"correct_option_indices":[1]}',
        10,
        'The var keyword is used to declare variables in JavaScript.',
        1, 1, NOW(), NOW()
      ),
      (
        ${publicQuizId},
        'Which of the following is NOT a JavaScript data type?',
        'multiple_choice',
        '{"options":["string","number","boolean","character"],"correct_option_indices":[3],"min_selections":1,"max_selections":1}',
        '{"correct_option_indices":[3]}',
        10,
        'JavaScript does not have a character data type. It uses strings for text.',
        2, 1, NOW(), NOW()
      )
    `);

    // Create a course quiz for enrolled students
    console.log('📝 Creating course quiz...');
    const [courseQuizResult] = await connection.execute(`
      INSERT INTO quizzes (
        title, description, status, type, time_limit, max_attempts,
        passing_score, show_results_immediately, randomize_questions,
        show_correct_answers, is_public, course_id, created_by,
        start_date, end_date, created_at, updated_at
      ) VALUES (
        'Web Development Basics',
        'Test your understanding of web development fundamentals covered in the course.',
        'published', 'graded', 45, 2, 60, 0, 1, 1, 0, 2, 2,
        '2025-10-01 00:00:00', '2025-11-30 23:59:59', NOW(), NOW()
      )
    `);

    const courseQuizId = (courseQuizResult as any).insertId;
    console.log(`📊 Created course quiz with ID: ${courseQuizId}`);

    // Create questions for course quiz
    console.log('📝 Creating questions for course quiz...');
    await connection.execute(`
      INSERT INTO quiz_questions (
        quiz_id, question_text, question_type, question_data,
        correct_answer, points, explanation, \`order\`, is_required,
        created_at, updated_at
      ) VALUES
      (
        ${courseQuizId},
        'What does HTML stand for?',
        'multiple_choice',
        '{"options":["Hypertext Markup Language","High Tech Modern Language","Home Tool Markup Language","Hyperlink and Text Markup Language"],"correct_option_indices":[0],"min_selections":1,"max_selections":1}',
        '{"correct_option_indices":[0]}',
        15,
        'HTML stands for Hypertext Markup Language.',
        1, 1, NOW(), NOW()
      ),
      (
        ${courseQuizId},
        'Which CSS property is used to change the text color?',
        'multiple_choice',
        '{"options":["font-color","text-color","color","foreground-color"],"correct_option_indices":[2],"min_selections":1,"max_selections":1}',
        '{"correct_option_indices":[2]}',
        15,
        'The color property is used to set the color of text.',
        2, 1, NOW(), NOW()
      ),
      (
        ${courseQuizId},
        'What is the purpose of CSS in web development?',
        'multiple_choice',
        '{"options":["To structure web pages","To style web pages","To add interactivity","To connect to databases"],"correct_option_indices":[1],"min_selections":1,"max_selections":1}',
        '{"correct_option_indices":[1]}',
        20,
        'CSS (Cascading Style Sheets) is used to describe the presentation of a document written in HTML.',
        3, 1, NOW(), NOW()
      )
    `);

    // Verify quizzes were created
    const [finalRows] = await connection.execute('SELECT COUNT(*) as count FROM quizzes');
    console.log('Final quiz count:', (finalRows as any)[0].count);

    console.log('✅ Sample quizzes created successfully!');
    console.log(`📊 Public Quiz ID: ${publicQuizId} (Available to all users)`);
    console.log(`📊 Course Quiz ID: ${courseQuizId} (Available to enrolled students in SPEWI302)`);

    console.log('\n📋 Dashboard should now show:');
    console.log('- Public Quiz in the "Available Public Quizzes" section');
    console.log('- Course Quiz in the "Available Course Quizzes" section (for enrolled students)');

  } catch (error) {
    console.error('❌ Error creating quizzes:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createQuizzes();
