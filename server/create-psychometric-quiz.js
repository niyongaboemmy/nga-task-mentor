const mysql = require("mysql2/promise");

async function createPsychometricQuiz() {
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

    // Create psychometric quiz
    console.log("📝 Creating psychometric quiz...");
    const [quizResult] = await connection.execute(`
      INSERT INTO quizzes (
        title, description, status, type, time_limit, max_attempts,
        passing_score, show_results_immediately, randomize_questions,
        show_correct_answers, is_public, course_id, created_by,
        start_date, end_date, enable_automatic_grading, require_manual_grading,
        created_at, updated_at
      ) VALUES (
        'Psychometric Test for Web Developer',
        'A comprehensive psychometric assessment to evaluate web development skills, knowledge, and aptitude.',
        'published', 'exam', 60, 1, 70, 0, 1, 0, 1, 1, 1,
        '2025-01-01 00:00:00', '2025-12-31 23:59:59', 1, 0,
        NOW(), NOW()
      )
    `);

    const quizId = quizResult.insertId;
    console.log(`📊 Created psychometric quiz with ID: ${quizId}`);

    // Create questions
    console.log("📝 Creating questions...");

    // Single choice questions (1-4)
    await connection.execute(`
      INSERT INTO quiz_questions (
        quiz_id, question_text, question_type, question_data,
        correct_answer, points, explanation, \`order\`, is_required,
        time_limit_seconds, created_by, created_at, updated_at
      ) VALUES
      (
        ${quizId},
        'Which of the following is NOT a valid way to declare a variable in JavaScript?',
        'single_choice',
        '{"options":["let myVar = 5;","const myVar = 5;","variable myVar = 5;","var myVar = 5;"]}',
        '{"correct_option_index":2}',
        10,
        'The keyword "variable" is not valid in JavaScript. Use let, const, or var instead.',
        1, 1, 60, 1, NOW(), NOW()
      ),
      (
        ${quizId},
        'What does CSS stand for?',
        'single_choice',
        '{"options":["Computer Style Sheets","Creative Style Sheets","Cascading Style Sheets","Colorful Style Sheets"]}',
        '{"correct_option_index":2}',
        10,
        'CSS stands for Cascading Style Sheets.',
        2, 1, 60, 1, NOW(), NOW()
      ),
      (
        ${quizId},
        'Which HTML tag is used to create a hyperlink?',
        'single_choice',
        '{"options":["<link>","<a>","<href>","<url>"]}',
        '{"correct_option_index":1}',
        10,
        'The <a> tag defines a hyperlink in HTML.',
        3, 1, 60, 1, NOW(), NOW()
      ),
      (
        ${quizId},
        'What is the purpose of the alt attribute in an <img> tag?',
        'single_choice',
        '{"options":["To specify image alignment","To provide alternative text for screen readers","To set image dimensions","To define image source"]}',
        '{"correct_option_index":1}',
        10,
        'The alt attribute provides alternative text when the image cannot be displayed.',
        4, 1, 60, 1, NOW(), NOW()
      )
    `);

    // True/False questions (5-7)
    await connection.execute(`
      INSERT INTO quiz_questions (
        quiz_id, question_text, question_type, question_data,
        correct_answer, points, explanation, \`order\`, is_required,
        time_limit_seconds, created_by, created_at, updated_at
      ) VALUES
      (
        ${quizId},
        'JavaScript is a server-side programming language.',
        'true_false',
        '{}',
        '{"answer":false}',
        10,
        'JavaScript is primarily a client-side language, though it can also run on servers with Node.js.',
        5, 1, 45, 1, NOW(), NOW()
      ),
      (
        ${quizId},
        'The <div> element is a block-level element in HTML.',
        'true_false',
        '{}',
        '{"answer":true}',
        10,
        '<div> is indeed a block-level element that takes up the full width available.',
        6, 1, 45, 1, NOW(), NOW()
      ),
      (
        ${quizId},
        'CSS Grid is newer than CSS Flexbox.',
        'true_false',
        '{}',
        '{"answer":false}',
        10,
        'CSS Flexbox was introduced before CSS Grid. Grid is more recent but both are modern CSS features.',
        7, 1, 45, 1, NOW(), NOW()
      )
    `);

    // Matching questions (8-10)
    await connection.execute(`
      INSERT INTO quiz_questions (
        quiz_id, question_text, question_type, question_data,
        correct_answer, points, explanation, \`order\`, is_required,
        time_limit_seconds, created_by, created_at, updated_at
      ) VALUES
      (
        ${quizId},
        'Match the HTTP status codes with their meanings:',
        'matching',
        '{"left_items":[{"id":"1","text":"200"},{"id":"2","text":"404"},{"id":"3","text":"500"}],"right_items":[{"id":"a","text":"OK"},{"id":"b","text":"Not Found"},{"id":"c","text":"Internal Server Error"}]}',
        '{"mappings":{"1":"a","2":"b","3":"c"}}',
        15,
        '200 OK indicates success, 404 Not Found indicates the requested resource was not found, 500 Internal Server Error indicates a server-side error.',
        8, 1, 120, 1, NOW(), NOW()
      ),
      (
        ${quizId},
        'Match the programming languages with their primary use in web development:',
        'matching',
        '{"left_items":[{"id":"1","text":"HTML"},{"id":"2","text":"CSS"},{"id":"3","text":"JavaScript"}],"right_items":[{"id":"a","text":"Structure"},{"id":"b","text":"Styling"},{"id":"c","text":"Interactivity"}]}',
        '{"mappings":{"1":"a","2":"b","3":"c"}}',
        15,
        'HTML provides structure, CSS handles styling, and JavaScript adds interactivity.',
        9, 1, 120, 1, NOW(), NOW()
      ),
      (
        ${quizId},
        'Match the CSS properties with their purposes:',
        'matching',
        '{"left_items":[{"id":"1","text":"margin"},{"id":"2","text":"padding"},{"id":"3","text":"border"}],"right_items":[{"id":"a","text":"Space outside element"},{"id":"b","text":"Space inside element"},{"id":"c","text":"Element outline"}]}',
        '{"mappings":{"1":"a","2":"b","3":"c"}}',
        15,
        'Margin creates space outside the element, padding creates space inside, and border creates the element outline.',
        10, 1, 120, 1, NOW(), NOW()
      )
    `);

    // Create proctoring settings
    console.log("📝 Creating proctoring settings...");
    await connection.execute(`
      INSERT INTO proctoring_settings (
        quiz_id, enabled, mode, require_identity_verification,
        require_environment_scan, allow_screen_recording, allow_audio_monitoring,
        allow_video_monitoring, lockdown_browser, prevent_tab_switching,
        prevent_window_minimization, prevent_copy_paste, prevent_right_click,
        max_flags_allowed, auto_terminate_on_high_risk, risk_threshold,
        require_proctor_approval, recording_retention_days, allow_multiple_faces,
        face_detection_sensitivity, suspicious_behavior_detection, alert_instructors,
        require_fullscreen, min_camera_level, min_microphone_level, min_speaker_level,
        enable_face_detection, enable_object_detection, object_detection_sensitivity,
        created_at, updated_at
      ) VALUES (
        ${quizId}, 1, 'automated', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        5, 0, 75.00, 0, 90, 0, 70.00, 1, 1, 1, 50.00, 50.00, 50.00,
        1, 1, 70.00, NOW(), NOW()
      )
    `);

    console.log("✅ Psychometric quiz created successfully!");
    console.log(`📊 Quiz ID: ${quizId}`);
    console.log("📋 Features:");
    console.log("- 10 questions (4 single choice, 3 true/false, 3 matching)");
    console.log("- Proctoring enabled with automated monitoring");
    console.log("- Automatic grading enabled");
    console.log("- 60-minute time limit");
    console.log("- Available as public quiz");
  } catch (error) {
    console.error("❌ Error creating psychometric quiz:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createPsychometricQuiz();
