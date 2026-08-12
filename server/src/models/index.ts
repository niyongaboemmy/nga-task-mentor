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
import BloomsTaxonomyLevel from "./BloomsTaxonomyLevel.model";
import QuestionBank from "./QuestionBank.model";
import ReportCard from "./ReportCard.model";
import ReportCardAttribute from "./ReportCardAttribute.model";
import ReportCardAssessment from "./ReportCardAssessment.model";
import ManualAssessment from "./ManualAssessment.model";
import ManualAssessmentScore from "./ManualAssessmentScore.model";
import DatabaseQueryLog from "./DatabaseQueryLog.model";

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
  // Note: Assignment <-> User (creator) and Assignment <-> Submission associations
  // are defined via decorators in Assignment.model.ts (as: "creator", "submissions").
  // Note: Submission <-> Assignment and Submission <-> User (student, submittedByUser)
  // associations are defined via decorators in Submission.model.ts.
  // Duplicate registrations are intentionally omitted to avoid Sequelize ambiguity errors.

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

  // ----------------------
  // QuestionBank Associations
  // ----------------------

  // A question bank entry belongs to BloomsTaxonomyLevel
  // Note: QuestionBank.belongsTo(BloomsTaxonomyLevel) is already declared
  // via the @BelongsTo decorator in QuestionBank.model.ts — no duplicate here.
  BloomsTaxonomyLevel.hasMany(QuestionBank, {
    foreignKey: "blooms_taxonomy_level_id",
    as: "bankQuestions",
  });

  // QuizQuestion (join table) belongs to QuestionBank is already defined in QuizQuestion.model.ts
  // via @BelongsTo decorator.

  // A QuestionBank entry can be assigned to many QuizQuestions
  QuestionBank.hasMany(QuizQuestion, {
    foreignKey: "question_id",
    as: "quizAssignments",
  });

  // ----------------------
  // Quiz Submission Associations
  // ----------------------
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

  // ----------------------
  // QuizAttempt Associations
  // ----------------------
  QuizQuestion.hasMany(QuizAttempt, {
    foreignKey: "question_id",
    as: "questionAttempts",
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

  // ----------------------
  // ReportCard Associations
  // Note: ReportCard.belongsTo(User), ReportCardAttribute.belongsTo(ReportCard),
  // and ReportCardAssessment.belongsTo(ReportCard) are registered via @BelongsTo
  // decorators in their model files — only the reverse hasMany goes here.
  // ----------------------
  User.hasMany(ReportCard, {
    foreignKey: "student_id",
    as: "reportCards",
  });

  ReportCard.hasMany(ReportCardAttribute, {
    foreignKey: "report_card_id",
    as: "attributes",
  });

  ReportCard.hasMany(ReportCardAssessment, {
    foreignKey: "report_card_id",
    as: "assessments",
  });

  // ----------------------
  // DatabaseQueryLog Associations
  // Note: DatabaseQueryLog.belongsTo(User) is already declared via the
  // @BelongsTo decorator in DatabaseQueryLog.model.ts — only the reverse
  // hasMany goes here.
  // ----------------------
  User.hasMany(DatabaseQueryLog, {
    foreignKey: "user_id",
    as: "databaseQueryLogs",
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
  BloomsTaxonomyLevel,
  QuestionBank,
  ReportCard,
  ReportCardAttribute,
  ReportCardAssessment,
  ManualAssessment,
  ManualAssessmentScore,
  DatabaseQueryLog,
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
  BloomsTaxonomyLevel,
  QuestionBank,
  ReportCard,
  ReportCardAttribute,
  ReportCardAssessment,
  ManualAssessment,
  ManualAssessmentScore,
  DatabaseQueryLog,
  setupAssociations,
};
