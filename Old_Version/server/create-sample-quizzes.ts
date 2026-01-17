import dotenv from 'dotenv';
import { sequelize } from './src/config/database.js';
import { Quiz, QuizQuestion } from './src/models/index.js';

dotenv.config();

async function createSampleQuizzes() {
  try {
    // Authenticate database connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Sync database to ensure tables exist
    await sequelize.sync();
    console.log('✅ Database synchronized');

    // Create a public quiz
    console.log('📝 Creating public quiz...');
    const publicQuiz = await Quiz.create({
      title: 'JavaScript Fundamentals Quiz',
      description: 'Test your knowledge of JavaScript basics including variables, functions, and data types.',
      status: 'published',
      type: 'practice',
      time_limit: 30,
      max_attempts: 3,
      passing_score: 70,
      show_results_immediately: true,
      randomize_questions: false,
      show_correct_answers: true,
      is_public: true,
      course_id: 1, // Test Course
      created_by: 1, // Test Instructor
      start_date: new Date('2025-01-01'),
      end_date: new Date('2025-12-31')
    });

    // Create questions for public quiz
    console.log('📝 Creating questions for public quiz...');
    await QuizQuestion.create({
      quiz_id: publicQuiz.id,
      question_text: 'What is the correct way to declare a variable in JavaScript?',
      question_type: 'multiple_choice',
      question_data: {
        options: [
          'variable x = 5;',
          'var x = 5;',
          'v x = 5;',
          'declare x = 5;'
        ],
        correct_option_indices: [1],
        min_selections: 1,
        max_selections: 1
      },
      correct_answer: { correct_option_indices: [1] },
      points: 10,
      explanation: 'The var keyword is used to declare variables in JavaScript.',
      order: 1,
      is_required: true
    });

    await QuizQuestion.create({
      quiz_id: publicQuiz.id,
      question_text: 'Which of the following is NOT a JavaScript data type?',
      question_type: 'multiple_choice',
      question_data: {
        options: [
          'string',
          'number',
          'boolean',
          'character'
        ],
        correct_option_indices: [3],
        min_selections: 1,
        max_selections: 1
      },
      correct_answer: { correct_option_indices: [3] },
      points: 10,
      explanation: 'JavaScript does not have a character data type. It uses strings for text.',
      order: 2,
      is_required: true
    });

    // Create a course quiz for enrolled students
    console.log('📝 Creating course quiz...');
    const courseQuiz = await Quiz.create({
      title: 'Web Development Basics',
      description: 'Test your understanding of web development fundamentals covered in the course.',
      status: 'published',
      type: 'graded',
      time_limit: 45,
      max_attempts: 2,
      passing_score: 60,
      show_results_immediately: false,
      randomize_questions: true,
      show_correct_answers: true,
      is_public: false,
      course_id: 2, // SPEWI302 Course
      created_by: 2, // Emmanuel Instructor
      start_date: new Date('2025-10-01'),
      end_date: new Date('2025-11-30')
    });

    // Create questions for course quiz
    console.log('📝 Creating questions for course quiz...');
    await QuizQuestion.create({
      quiz_id: courseQuiz.id,
      question_text: 'What does HTML stand for?',
      question_type: 'multiple_choice',
      question_data: {
        options: [
          'Hypertext Markup Language',
          'High Tech Modern Language',
          'Home Tool Markup Language',
          'Hyperlink and Text Markup Language'
        ],
        correct_option_indices: [0],
        min_selections: 1,
        max_selections: 1
      },
      correct_answer: { correct_option_indices: [0] },
      points: 15,
      explanation: 'HTML stands for Hypertext Markup Language.',
      order: 1,
      is_required: true
    });

    await QuizQuestion.create({
      quiz_id: courseQuiz.id,
      question_text: 'Which CSS property is used to change the text color?',
      question_type: 'multiple_choice',
      question_data: {
        options: [
          'font-color',
          'text-color',
          'color',
          'foreground-color'
        ],
        correct_option_indices: [2],
        min_selections: 1,
        max_selections: 1
      },
      correct_answer: { correct_option_indices: [2] },
      points: 15,
      explanation: 'The color property is used to set the color of text.',
      order: 2,
      is_required: true
    });

    await QuizQuestion.create({
      quiz_id: courseQuiz.id,
      question_text: 'What is the purpose of CSS in web development?',
      question_type: 'multiple_choice',
      question_data: {
        options: [
          'To structure web pages',
          'To style web pages',
          'To add interactivity',
          'To connect to databases'
        ],
        correct_option_indices: [1],
        min_selections: 1,
        max_selections: 1
      },
      correct_answer: { correct_option_indices: [1] },
      points: 20,
      explanation: 'CSS (Cascading Style Sheets) is used to describe the presentation of a document written in HTML.',
      order: 3,
      is_required: true
    });

    console.log('✅ Sample quizzes created successfully!');
    console.log(`📊 Public Quiz ID: ${publicQuiz.id} (Available to all users)`);
    console.log(`📊 Course Quiz ID: ${courseQuiz.id} (Available to enrolled students in SPEWI302)`);

    console.log('\n📋 Dashboard should now show:');
    console.log('- Public Quiz in the "Available Public Quizzes" section');
    console.log('- Course Quiz in the "Available Course Quizzes" section (for enrolled students)');

  } catch (error: any) {
    console.error('❌ Error creating sample quizzes:', error.message);
    console.error('Full error:', error);
  } finally {
    await sequelize.close();
  }
}

createSampleQuizzes();
