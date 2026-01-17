require('dotenv').config({ path: './server/.env' });
const { sequelize } = require('./server/src/config/database');
const Quiz = require('./server/src/models/Quiz.model');
const QuizSubmission = require('./server/src/models/QuizSubmission.model');

// Register models with sequelize
sequelize.addModels([Quiz, QuizSubmission]);

async function debugQuizzes() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Get all quizzes
    const allQuizzes = await Quiz.findAll({
      attributes: ['id', 'title', 'status', 'is_public', 'start_date', 'end_date'],
      order: [['id', 'ASC']]
    });

    console.log(`\n=== ALL QUIZZES (${allQuizzes.length}) ===`);
    allQuizzes.forEach(quiz => {
      console.log(`Quiz ${quiz.id}: "${quiz.title}"`);
      console.log(`  Status: ${quiz.status}`);
      console.log(`  Is Public: ${quiz.is_public}`);
      console.log(`  Start Date: ${quiz.start_date || 'Not set'}`);
      console.log(`  End Date: ${quiz.end_date || 'Not set'}`);
      console.log(`  Is Available: ${quiz.is_available}`);
      console.log('');
    });

    // Get public quizzes only
    const publicQuizzes = await Quiz.findAll({
      where: { is_public: true },
      attributes: ['id', 'title', 'status', 'is_public', 'start_date', 'end_date']
    });

    console.log(`\n=== PUBLIC QUIZZES (${publicQuizzes.length}) ===`);
    publicQuizzes.forEach(quiz => {
      console.log(`Quiz ${quiz.id}: "${quiz.title}" (Status: ${quiz.status})`);
    });

    // Get published quizzes only
    const publishedQuizzes = await Quiz.findAll({
      where: { status: 'published' },
      attributes: ['id', 'title', 'status', 'is_public', 'start_date', 'end_date']
    });

    console.log(`\n=== PUBLISHED QUIZZES (${publishedQuizzes.length}) ===`);
    publishedQuizzes.forEach(quiz => {
      console.log(`Quiz ${quiz.id}: "${quiz.title}" (Public: ${quiz.is_public})`);
    });

    // Get completed submissions count
    const completedCount = await QuizSubmission.count({
      where: { status: 'completed' }
    });

    console.log(`\n=== COMPLETED SUBMISSIONS: ${completedCount} ===`);

    await sequelize.close();
  } catch (error) {
    console.error('Database error:', error);
  }
}

debugQuizzes();
