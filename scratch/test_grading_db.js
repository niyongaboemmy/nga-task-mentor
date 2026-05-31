require('dotenv').config({ path: 'server/.env' });
const path = require('path');
const serverPath = path.join(__dirname, '../server/dist');

// Mock express/dotenv if needed, but here we just need sequelize
const { sequelize } = require(path.join(serverPath, 'config/database'));
const { 
  QuizQuestion, 
  QuestionBank, 
  User,
  Assignment,
  Submission,
  Quiz,
  QuizAttempt,
  QuizSubmission,
  ProctoringSession,
  ProctoringEvent,
  ProctoringSettings,
  BloomsTaxonomyLevel,
  setupAssociations 
} = require(path.join(serverPath, 'models'));
const { AdvancedQuizGrader } = require(path.join(serverPath, 'utils/quizGrader'));

async function testGrading() {
  try {
    // Add models to Sequelize
    sequelize.addModels([
      User,
      Assignment,
      Submission,
      Quiz,
      QuizQuestion,
      QuizAttempt,
      QuizSubmission,
      ProctoringSession,
      ProctoringEvent,
      ProctoringSettings,
      BloomsTaxonomyLevel,
      QuestionBank,
    ]);

    setupAssociations();
    
    // Load question 12
    const questionId = 12;
    const question = await QuizQuestion.findByPk(questionId, {
      include: [{ model: QuestionBank, as: 'questionBank' }]
    });

    if (!question) {
      console.log('Question not found');
      return;
    }

    console.log('--- Question Data ---');
    console.log('ID:', question.id);
    console.log('Type:', question.questionBank.question_type);
    console.log('Question Data:', JSON.stringify(question.questionBank.question_data, null, 2));
    console.log('Correct Answer column:', JSON.stringify(question.questionBank.correct_answer, null, 2));
    console.log('Points:', question.points);

    const answerData = { selected_option_index: 1 };
    console.log('\n--- Grading with answer: {"selected_option_index": 1} ---');
    
    const result = await AdvancedQuizGrader.gradeWithConfig(question, answerData);
    console.log('Grading Result:', JSON.stringify(result, null, 2));

    // Also test question 13 for comparison
    const question13 = await QuizQuestion.findByPk(13, {
      include: [{ model: QuestionBank, as: 'questionBank' }]
    });
    if (question13) {
        console.log('\n--- Question 13 Data (for comparison) ---');
        console.log('Question Data:', JSON.stringify(question13.questionBank.question_data, null, 2));
        const res13 = await AdvancedQuizGrader.gradeWithConfig(question13, answerData);
        console.log('Grading Result for 13:', JSON.stringify(res13, null, 2));
    }

  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    process.exit();
  }
}

testGrading();
