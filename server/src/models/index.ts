import User from "./User.model";
import Course from "./Course.model";
import Assignment from "./Assignment.model";
import Submission from "./Submission.model";
import UserCourse from "./UserCourse.model";
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

  User.belongsToMany(Course, {
    through: UserCourse,
    foreignKey: "user_id",
    otherKey: "course_id",
    as: "enrolledCourses",
  });

  // ----------------------
  // Course Associations
  // ----------------------
  Course.belongsTo(User, {
    foreignKey: "instructor_id",
    as: "courseInstructor",
  });

  Course.hasMany(Assignment, {
    foreignKey: "course_id",
    as: "courseAssignments",
  });

  Course.belongsToMany(User, {
    through: UserCourse,
    foreignKey: "course_id",
    otherKey: "user_id",
    as: "studentsEnrolled",
  });

  // ----------------------
  // Assignment Associations
  // ----------------------
  Assignment.belongsTo(Course, {
    foreignKey: "course_id",
    as: "assignmentCourse",
  });

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
  // UserCourse Associations
  // ----------------------
  UserCourse.belongsTo(User, {
    foreignKey: "user_id",
    as: "userInCourse",
  });

  UserCourse.belongsTo(Course, {
    foreignKey: "course_id",
    as: "courseInUserCourse",
  });

  // Add reverse associations for complete relationship
  User.hasMany(UserCourse, {
    foreignKey: "user_id",
    as: "userCourses",
  });

  Course.hasMany(UserCourse, {
    foreignKey: "course_id",
    as: "courseUserCourses",
  });

  // ----------------------
  // Quiz Associations
  // ----------------------
  Course.hasMany(Quiz, {
    foreignKey: "course_id",
    as: "courseQuizzes",
  });

  Quiz.belongsTo(Course, {
    foreignKey: "course_id",
    as: "quizCourse",
  });

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
  Course,
  Assignment,
  Submission,
  UserCourse,
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
  Course,
  Assignment,
  Submission,
  UserCourse,
  Quiz,
  QuizQuestion,
  QuizAttempt,
  QuizSubmission,
  ProctoringSession,
  ProctoringEvent,
  ProctoringSettings,
  setupAssociations,
};
