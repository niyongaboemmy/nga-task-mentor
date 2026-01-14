const mysql = require("mysql2/promise");

async function createGradingTestQuiz() {
  let connection;

  try {
    // Create connection using environment variables
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 8889,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "root",
      database: process.env.DB_NAME || "taskmentor_dev",
    });

    console.log("✅ Database connected successfully");

    // Create a grading test quiz
    console.log("📝 Creating grading test quiz...");
    const [quizResult] = await connection.execute(`
      INSERT INTO quizzes (
        title, description, status, type, time_limit, max_attempts,
        passing_score, show_results_immediately, randomize_questions,
        show_correct_answers, is_public, course_id, created_by,
        start_date, end_date, created_at, updated_at
      ) VALUES (
        'Grading System Test Quiz',
        'Comprehensive quiz to test all question types and grading functionality.',
        'published', 'practice', 60, 5, 80, 1, 0, 1, 1, 1, 1,
        '2025-01-01 00:00:00', '2025-12-31 23:59:59', NOW(), NOW()
      )
    `);

    const quizId = quizResult.insertId;
    console.log(`📊 Created grading test quiz with ID: ${quizId}`);

    // Create comprehensive questions for all types
    console.log("📝 Creating test questions for all grading types...");
    await connection.execute(`
      INSERT INTO quiz_questions (
        quiz_id, question_text, question_type, question_data,
        correct_answer, points, explanation, \`order\`, is_required,
        created_at, updated_at, created_by
      ) VALUES
      (
        ${quizId},
        'What is the capital of France?',
        'single_choice',
        '{"options":["London","Berlin","Paris","Madrid"],"correct_option_index":2}',
        NULL,
        10,
        'Paris is the capital and most populous city of France.',
        1, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'Which of the following are programming languages?',
        'multiple_choice',
        '{"options":["Python","HTML","JavaScript","CSS"],"correct_option_indices":[0,2],"min_selections":1,"max_selections":4}',
        NULL,
        15,
        'Python and JavaScript are programming languages, while HTML and CSS are markup and styling languages.',
        2, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'The Earth is flat.',
        'true_false',
        '{"correct_answer":false}',
        NULL,
        5,
        'Scientific evidence shows that the Earth is an oblate spheroid.',
        3, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'What is 15 + 27?',
        'numerical',
        '{"correct_answer":42,"tolerance":0}',
        NULL,
        10,
        '15 + 27 = 42',
        4, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'Calculate the area of a circle with radius 5. Use π ≈ 3.14159.',
        'numerical',
        '{"correct_answer":78.54,"tolerance":0.1,"units":"square units"}',
        NULL,
        15,
        'Area = πr² = 3.14159 × 5² = 3.14159 × 25 = 78.53975 ≈ 78.54',
        5, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'Complete the sentence: The quick brown ___ jumps over the lazy dog.',
        'fill_blank',
        '{"acceptable_answers":[{"answers":["fox"],"case_sensitive":false}]}',
        NULL,
        10,
        'The classic pangram sentence uses "fox".',
        6, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'Match the programming languages with their creators.',
        'matching',
        '{"left_items":[{"id":"1","text":"Python"},{"id":"2","text":"JavaScript"},{"id":"3","text":"Java"}],"right_items":[{"id":"1","text":"Guido van Rossum"},{"id":"2","text":"Brendan Eich"},{"id":"3","text":"James Gosling"}],"correct_matches":{"1":"1","2":"2","3":"3"}}',
        NULL,
        20,
        'Python was created by Guido van Rossum, JavaScript by Brendan Eich, and Java by James Gosling.',
        7, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'Order the steps of the software development lifecycle.',
        'ordering',
        '{"items":[{"id":"1","text":"Planning","order":1},{"id":"2","text":"Design","order":2},{"id":"3","text":"Implementation","order":3},{"id":"4","text":"Testing","order":4},{"id":"5","text":"Deployment","order":5}]}',
        NULL,
        15,
        'The typical SDLC order is: Planning → Design → Implementation → Testing → Deployment.',
        8, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'Select the correct HTML tag for creating a hyperlink.',
        'dropdown',
        '{"dropdown_options":[{"text":"Choose the correct tag","options":["<div>","<a>","<p>","<span>"]}],"correct_selections":[["<a>"]]}',
        NULL,
        10,
        'The <a> tag defines a hyperlink in HTML.',
        9, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'Write a function that returns the sum of two numbers.',
        'coding',
        '{"language":"javascript","test_cases":[{"id":"1","input":"5, 3","expected_output":"8","points":10,"is_hidden":false},{"id":"2","input":"-1, 1","expected_output":"0","points":10,"is_hidden":false},{"id":"3","input":"0, 0","expected_output":"0","points":10,"is_hidden":true}],"constraints":"Write a function named sum that takes two parameters and returns their sum."}',
        NULL,
        25,
        'A simple function that adds two numbers together.',
        10, 1, NOW(), NOW(), 1
      ),
      (
        ${quizId},
        'What are the main benefits of using version control systems?',
        'short_answer',
        '{"keywords":["collaboration","history","backup","branching"],"min_length":20,"max_length":500}',
        NULL,
        15,
        'Version control systems provide collaboration, maintain history, serve as backup, and enable branching.',
        11, 1, NOW(), NOW(), 1
      )
    `);

    console.log("✅ Grading test quiz created successfully!");
    console.log(`📊 Quiz ID: ${quizId}`);
    console.log("\n📋 This quiz includes:");
    console.log("- Single Choice Question");
    console.log("- Multiple Choice Question (with partial credit)");
    console.log("- True/False Question");
    console.log("- Numerical Questions (exact and with tolerance)");
    console.log("- Fill in the Blank");
    console.log("- Matching Question");
    console.log("- Ordering Question");
    console.log("- Dropdown Question");
    console.log("- Coding Question (with test cases)");
    console.log("- Short Answer Question (keyword-based)");

    console.log("\n🧪 Use this quiz to test the grading system functionality.");
  } catch (error) {
    console.error("❌ Error creating grading test quiz:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createGradingTestQuiz();
