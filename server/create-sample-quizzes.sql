-- Sample quizzes for testing dashboard functionality
-- Run this script in your MySQL database

-- Insert sample public quiz
INSERT INTO quizzes (
    title,
    description,
    status,
    type,
    time_limit,
    max_attempts,
    passing_score,
    show_results_immediately,
    randomize_questions,
    show_correct_answers,
    is_public,
    course_id,
    created_by,
    start_date,
    end_date,
    created_at,
    updated_at
) VALUES (
    'JavaScript Fundamentals Quiz',
    'Test your knowledge of JavaScript basics including variables, functions, and data types.',
    'published',
    'practice',
    30,
    3,
    70,
    1,
    0,
    1,
    1,
    1,
    1,
    '2025-01-01 00:00:00',
    '2025-12-31 23:59:59',
    NOW(),
    NOW()
);

-- Get the quiz ID that was just created
SET @public_quiz_id = LAST_INSERT_ID();

-- Insert questions for public quiz
INSERT INTO quiz_questions (
    quiz_id,
    question_text,
    question_type,
    question_data,
    correct_answer,
    points,
    explanation,
    order,
    created_at,
    updated_at
) VALUES
(
    @public_quiz_id,
    'What is the correct way to declare a variable in JavaScript?',
    'multiple_choice',
    '{"options":[{"id":"a","text":"variable x = 5;"},{"id":"b","text":"var x = 5;"},{"id":"c","text":"v x = 5;"},{"id":"d","text":"declare x = 5;"}]}',
    'b',
    10,
    'The var keyword is used to declare variables in JavaScript.',
    1,
    NOW(),
    NOW()
),
(
    @public_quiz_id,
    'Which of the following is NOT a JavaScript data type?',
    'multiple_choice',
    '{"options":[{"id":"a","text":"string"},{"id":"b","text":"number"},{"id":"c","text":"boolean"},{"id":"d","text":"character"}]}',
    'd',
    10,
    'JavaScript does not have a character data type. It uses strings for text.',
    2,
    NOW(),
    NOW()
);

-- Insert sample course quiz
INSERT INTO quizzes (
    title,
    description,
    status,
    type,
    time_limit,
    max_attempts,
    passing_score,
    show_results_immediately,
    randomize_questions,
    show_correct_answers,
    is_public,
    course_id,
    created_by,
    start_date,
    end_date,
    created_at,
    updated_at
) VALUES (
    'Web Development Basics',
    'Test your understanding of web development fundamentals covered in the course.',
    'published',
    'graded',
    45,
    2,
    60,
    0,
    1,
    1,
    0,
    2,
    2,
    '2025-10-01 00:00:00',
    '2025-11-30 23:59:59',
    NOW(),
    NOW()
);

-- Get the course quiz ID
SET @course_quiz_id = LAST_INSERT_ID();

-- Insert questions for course quiz
INSERT INTO quiz_questions (
    quiz_id,
    question_text,
    question_type,
    question_data,
    correct_answer,
    points,
    explanation,
    order,
    created_at,
    updated_at
) VALUES
(
    @course_quiz_id,
    'What does HTML stand for?',
    'multiple_choice',
    '{"options":[{"id":"a","text":"Hypertext Markup Language"},{"id":"b","text":"High Tech Modern Language"},{"id":"c","text":"Home Tool Markup Language"},{"id":"d","text":"Hyperlink and Text Markup Language"}]}',
    'a',
    15,
    'HTML stands for Hypertext Markup Language.',
    1,
    NOW(),
    NOW()
),
(
    @course_quiz_id,
    'Which CSS property is used to change the text color?',
    'multiple_choice',
    '{"options":[{"id":"a","text":"font-color"},{"id":"b","text":"text-color"},{"id":"c","text":"color"},{"id":"d","text":"foreground-color"}]}',
    'c',
    15,
    'The color property is used to set the color of text.',
    2,
    NOW(),
    NOW()
),
(
    @course_quiz_id,
    'What is the purpose of CSS in web development?',
    'multiple_choice',
    '{"options":[{"id":"a","text":"To structure web pages"},{"id":"b","text":"To style web pages"},{"id":"c","text":"To add interactivity"},{"id":"d","text":"To connect to databases"}]}',
    'b',
    20,
    'CSS (Cascading Style Sheets) is used to describe the presentation of a document written in HTML.',
    3,
    NOW(),
    NOW()
);

-- Show created quizzes
SELECT 'Created quizzes:' as message;
SELECT
    q.id,
    q.title,
    q.status,
    q.is_public,
    c.title as course_name,
    q.created_at
FROM quizzes q
JOIN courses c ON q.course_id = c.id
ORDER BY q.created_at DESC;
