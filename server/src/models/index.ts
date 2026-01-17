import User from "./User.model";
import Assignment from "./Assignment.model";
import Submission from "./Submission.model";
import Quiz from "./Quiz.model";
import QuizQuestion from "./QuizQuestion.model";
import QuizAttempt from "./QuizAttempt.model";
import QuizSubmission from "./QuizSubmission.model";
import ProctoringSession from "./ProctoringSession.model";
import ProctoringEvent from "./ProctoringEvent.model";
import ProctoringSettings from "./ProctoringSettings.model";

// Set up associations after all models are imported
const setupAssociations = () => {
  // ----------------------
  // User Associations
  // ----------------------
  User.hasMany(Assignment, {
    foreignKey: "created_by",
    as: "assignmentsCreated",
  });

  User.hasMany(Submission, {
    foreignKey: "student_id",
    as: "submissionsMade",
  });

  // ----------------------
  // Assignment Associations
  // ----------------------
  Assignment.belongsTo(User, {
    foreignKey: "created_by",
    as: "assignmentCreator",
  });

  Assignment.hasMany(Submission, {
    foreignKey: "assignment_id",
    as: "assignmentSubmissions",
  });

  // ----------------------
  // Submission Associations
  // ----------------------
  Submission.belongsTo(Assignment, {
    foreignKey: "assignment_id",
    as: "submissionAssignment",
  });

  Submission.belongsTo(User, {
    foreignKey: "student_id",
    as: "submissionStudent",
  });

  // ----------------------
  // Quiz Associations
  // ----------------------

  Quiz.belongsTo(User, {
    foreignKey: "created_by",
    as: "quizCreator",
  });

  User.hasMany(Quiz, {
    foreignKey: "created_by",
    as: "quizzesCreated",
  });

  Quiz.hasMany(QuizQuestion, {
    foreignKey: "quiz_id",
    as: "quizQuestions",
  });

  QuizQuestion.belongsTo(Quiz, {
    foreignKey: "quiz_id",
    as: "questionQuiz",
  });

  Quiz.hasMany(QuizSubmission, {
    foreignKey: "quiz_id",
    as: "quizSubmissions",
  });

  QuizSubmission.belongsTo(Quiz, {
    foreignKey: "quiz_id",
    as: "submissionQuiz",
  });

  User.hasMany(QuizSubmission, {
    foreignKey: "student_id",
    as: "quizSubmissions",
  });

  QuizSubmission.belongsTo(User, {
    foreignKey: "student_id",
    as: "submissionStudent",
  });

  User.hasMany(QuizSubmission, {
    foreignKey: "graded_by",
    as: "gradedSubmissions",
  });

  QuizSubmission.belongsTo(User, {
    foreignKey: "graded_by",
    as: "submissionGrader",
  });

  QuizQuestion.hasMany(QuizAttempt, {
    foreignKey: "question_id",
    as: "questionAttempts",
  });

  QuizAttempt.belongsTo(QuizQuestion, {
    foreignKey: "question_id",
    as: "attemptQuestion",
  });

  Quiz.hasMany(QuizAttempt, {
    foreignKey: "quiz_id",
    as: "quizAttempts",
  });

  QuizAttempt.belongsTo(Quiz, {
    foreignKey: "quiz_id",
    as: "attemptQuiz",
  });

  User.hasMany(QuizAttempt, {
    foreignKey: "student_id",
    as: "questionAttempts",
  });

  QuizAttempt.belongsTo(User, {
    foreignKey: "student_id",
    as: "attemptStudent",
  });

  // ----------------------
  // Proctoring Associations
  // ----------------------
  // Note: Most proctoring associations are already defined in model decorators
  // Only define the reverse associations that aren't covered by decorators

  ProctoringSettings.belongsTo(Quiz, {
    foreignKey: "quiz_id",
    as: "settingsQuiz",
  });

  ProctoringSession.belongsTo(Quiz, {
    foreignKey: "quiz_id",
    as: "sessionQuiz",
  });

  ProctoringSession.belongsTo(User, {
    foreignKey: "student_id",
    as: "sessionStudent",
  });

  ProctoringSession.belongsTo(User, {
    foreignKey: "proctor_id",
    as: "sessionProctor",
  });

  ProctoringEvent.belongsTo(ProctoringSession, {
    foreignKey: "session_id",
    as: "eventSession",
  });

  ProctoringEvent.belongsTo(User, {
    foreignKey: "reviewed_by",
    as: "eventReviewer",
  });
};

// Export as named exports for compatibility
export {
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
  setupAssociations,
};

export default {
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
  setupAssociations,
};
