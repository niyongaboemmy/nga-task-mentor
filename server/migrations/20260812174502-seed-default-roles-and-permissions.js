"use strict";

// Permission catalog and default role->permission mapping, duplicated here
// as a literal snapshot from src/constants/permissions.ts at the time this
// migration was authored (migrations are frozen; do not import from src).
// If the catalog changes later, add a NEW migration rather than editing
// this one.

const PERMISSIONS = [
  {
    "key": "USERS_VIEW_SELF",
    "category": "USERS",
    "description": "View own user profile"
  },
  {
    "key": "USERS_VIEW_ALL",
    "category": "USERS",
    "description": "View any user's profile"
  },
  {
    "key": "USERS_CREATE",
    "category": "USERS",
    "description": "Create user accounts"
  },
  {
    "key": "USERS_EDIT",
    "category": "USERS",
    "description": "Edit any user account"
  },
  {
    "key": "USERS_DELETE",
    "category": "USERS",
    "description": "Delete user accounts"
  },
  {
    "key": "USERS_MANAGE_ENROLLMENT",
    "category": "USERS",
    "description": "Enroll/withdraw users from courses"
  },
  {
    "key": "USERS_VIEW_OTHERS_ACTIVITY",
    "category": "USERS",
    "description": "View another user's assignments/quizzes/courses"
  },
  {
    "key": "COURSES_VIEW",
    "category": "COURSES",
    "description": "View course list/details"
  },
  {
    "key": "COURSES_CREATE",
    "category": "COURSES",
    "description": "Create courses"
  },
  {
    "key": "COURSES_EDIT",
    "category": "COURSES",
    "description": "Edit course details"
  },
  {
    "key": "COURSES_DELETE",
    "category": "COURSES",
    "description": "Delete courses"
  },
  {
    "key": "COURSES_VIEW_STUDENTS",
    "category": "COURSES",
    "description": "View a course's enrolled students"
  },
  {
    "key": "COURSES_VIEW_GRADES",
    "category": "COURSES",
    "description": "View all students' grades for a course"
  },
  {
    "key": "COURSES_VIEW_OWN_GRADES",
    "category": "COURSES",
    "description": "View own grades for a course"
  },
  {
    "key": "ASSIGNMENTS_VIEW",
    "category": "ASSIGNMENTS",
    "description": "View assignments"
  },
  {
    "key": "ASSIGNMENTS_CREATE",
    "category": "ASSIGNMENTS",
    "description": "Create assignments"
  },
  {
    "key": "ASSIGNMENTS_EDIT",
    "category": "ASSIGNMENTS",
    "description": "Edit/publish assignments"
  },
  {
    "key": "ASSIGNMENTS_DELETE",
    "category": "ASSIGNMENTS",
    "description": "Delete assignments"
  },
  {
    "key": "ASSIGNMENTS_VIEW_SUBMISSIONS",
    "category": "ASSIGNMENTS",
    "description": "View all submissions for an assignment"
  },
  {
    "key": "ASSIGNMENTS_MANAGE_ANY",
    "category": "ASSIGNMENTS",
    "description": "Edit/delete any assignment regardless of ownership (bypasses the owning-instructor check)"
  },
  {
    "key": "SUBMISSIONS_VIEW_OWN",
    "category": "SUBMISSIONS",
    "description": "View own submissions"
  },
  {
    "key": "SUBMISSIONS_VIEW_ALL",
    "category": "SUBMISSIONS",
    "description": "View any student's submissions"
  },
  {
    "key": "SUBMISSIONS_CREATE",
    "category": "SUBMISSIONS",
    "description": "Create/submit a submission"
  },
  {
    "key": "SUBMISSIONS_GRADE",
    "category": "SUBMISSIONS",
    "description": "Grade a submission"
  },
  {
    "key": "QUIZZES_VIEW",
    "category": "QUIZZES",
    "description": "View quizzes"
  },
  {
    "key": "QUIZZES_CREATE",
    "category": "QUIZZES",
    "description": "Create quizzes"
  },
  {
    "key": "QUIZZES_EDIT",
    "category": "QUIZZES",
    "description": "Edit quizzes"
  },
  {
    "key": "QUIZZES_DELETE",
    "category": "QUIZZES",
    "description": "Delete quizzes"
  },
  {
    "key": "QUIZZES_ATTEMPT",
    "category": "QUIZZES",
    "description": "Attempt/take a quiz"
  },
  {
    "key": "QUIZZES_VIEW_RESULTS_OWN",
    "category": "QUIZZES",
    "description": "View own quiz results"
  },
  {
    "key": "QUIZZES_VIEW_RESULTS_ALL",
    "category": "QUIZZES",
    "description": "View any student's quiz results"
  },
  {
    "key": "QUIZZES_GRADE",
    "category": "QUIZZES",
    "description": "Grade quiz submissions"
  },
  {
    "key": "QUIZ_QUESTIONS_VIEW_WITH_ANSWERS",
    "category": "QUIZ_QUESTIONS",
    "description": "View correct answers for quiz questions"
  },
  {
    "key": "QUIZ_QUESTIONS_USE_AI_HINT",
    "category": "QUIZ_QUESTIONS",
    "description": "Request AI hints for a question"
  },
  {
    "key": "QUIZ_QUESTIONS_RUN_CODE",
    "category": "QUIZ_QUESTIONS",
    "description": "Run/execute code for a coding question"
  },
  {
    "key": "QUESTION_BANK_VIEW",
    "category": "QUESTION_BANK",
    "description": "View a course's question bank"
  },
  {
    "key": "QUESTION_BANK_CREATE",
    "category": "QUESTION_BANK",
    "description": "Create question bank entries (incl. upload/AI-generate)"
  },
  {
    "key": "QUESTION_BANK_EDIT",
    "category": "QUESTION_BANK",
    "description": "Edit question bank entries"
  },
  {
    "key": "QUESTION_BANK_DELETE",
    "category": "QUESTION_BANK",
    "description": "Delete question bank entries"
  },
  {
    "key": "GRADING_MANUAL_ASSESS",
    "category": "GRADING",
    "description": "Perform manual (paper-based) assessment scoring"
  },
  {
    "key": "GRADING_OVERRIDE_SCORE",
    "category": "GRADING",
    "description": "Override an automatically computed score"
  },
  {
    "key": "PROCTORING_MANAGE_SETTINGS",
    "category": "PROCTORING",
    "description": "Create/edit proctoring settings for a quiz"
  },
  {
    "key": "PROCTORING_START_SESSION",
    "category": "PROCTORING",
    "description": "Start a proctoring session for own quiz attempt"
  },
  {
    "key": "PROCTORING_VIEW_SESSIONS",
    "category": "PROCTORING",
    "description": "View any student's proctoring sessions"
  },
  {
    "key": "PROCTORING_VIEW_OWN_SESSIONS",
    "category": "PROCTORING",
    "description": "View own proctoring sessions"
  },
  {
    "key": "PROCTORING_JOIN_LIVE_STREAM",
    "category": "PROCTORING",
    "description": "Join a student's live proctoring stream"
  },
  {
    "key": "PROCTORING_VIEW_ANALYTICS",
    "category": "PROCTORING",
    "description": "View proctoring analytics for a quiz"
  },
  {
    "key": "PROCTORING_LOG_EVENTS",
    "category": "PROCTORING",
    "description": "Log proctoring events during own attempt"
  },
  {
    "key": "REPORT_CARDS_VIEW_OWN",
    "category": "REPORT_CARDS",
    "description": "View own report card"
  },
  {
    "key": "REPORT_CARDS_VIEW_ALL",
    "category": "REPORT_CARDS",
    "description": "View any student's report card"
  },
  {
    "key": "REPORT_CARDS_CREATE",
    "category": "REPORT_CARDS",
    "description": "Create/build report cards"
  },
  {
    "key": "REPORT_CARDS_EDIT",
    "category": "REPORT_CARDS",
    "description": "Edit report cards"
  },
  {
    "key": "REPORT_CARDS_APPROVE",
    "category": "REPORT_CARDS",
    "description": "Approve submitted report cards"
  },
  {
    "key": "REPORT_CARDS_EXPORT_PDF",
    "category": "REPORT_CARDS",
    "description": "Export report cards as PDF"
  },
  {
    "key": "MANUAL_ASSESSMENTS_VIEW",
    "category": "MANUAL_ASSESSMENTS",
    "description": "View manual assessments"
  },
  {
    "key": "MANUAL_ASSESSMENTS_CREATE",
    "category": "MANUAL_ASSESSMENTS",
    "description": "Create manual assessments"
  },
  {
    "key": "MANUAL_ASSESSMENTS_EDIT",
    "category": "MANUAL_ASSESSMENTS",
    "description": "Edit manual assessments"
  },
  {
    "key": "MANUAL_ASSESSMENTS_DELETE",
    "category": "MANUAL_ASSESSMENTS",
    "description": "Delete manual assessments"
  },
  {
    "key": "DASHBOARD_VIEW_ADMIN",
    "category": "DASHBOARD",
    "description": "View the admin dashboard"
  },
  {
    "key": "DASHBOARD_VIEW_INSTRUCTOR",
    "category": "DASHBOARD",
    "description": "View the instructor dashboard"
  },
  {
    "key": "DASHBOARD_VIEW_STUDENT",
    "category": "DASHBOARD",
    "description": "View the student dashboard"
  },
  {
    "key": "ACADEMICS_VIEW",
    "category": "ACADEMICS",
    "description": "View academic years/terms"
  },
  {
    "key": "ACADEMICS_MANAGE_PERIODS",
    "category": "ACADEMICS",
    "description": "Switch/manage academic periods"
  },
  {
    "key": "DATABASE_ADMIN_ACCESS",
    "category": "DATABASE_ADMIN",
    "description": "Access the raw database administration tool"
  },
  {
    "key": "ROLES_PERMISSIONS_VIEW",
    "category": "ROLES_PERMISSIONS",
    "description": "View roles and the permission catalog"
  },
  {
    "key": "ROLES_PERMISSIONS_MANAGE",
    "category": "ROLES_PERMISSIONS",
    "description": "Create/edit/delete roles and assign permissions"
  }
];

const DEFAULT_ROLE_PERMISSIONS = {
  "admin": [
    "USERS_VIEW_SELF",
    "USERS_VIEW_ALL",
    "USERS_CREATE",
    "USERS_EDIT",
    "USERS_DELETE",
    "USERS_MANAGE_ENROLLMENT",
    "USERS_VIEW_OTHERS_ACTIVITY",
    "COURSES_VIEW",
    "COURSES_CREATE",
    "COURSES_EDIT",
    "COURSES_DELETE",
    "COURSES_VIEW_STUDENTS",
    "COURSES_VIEW_GRADES",
    "COURSES_VIEW_OWN_GRADES",
    "ASSIGNMENTS_VIEW",
    "ASSIGNMENTS_CREATE",
    "ASSIGNMENTS_EDIT",
    "ASSIGNMENTS_DELETE",
    "ASSIGNMENTS_VIEW_SUBMISSIONS",
    "ASSIGNMENTS_MANAGE_ANY",
    "SUBMISSIONS_VIEW_OWN",
    "SUBMISSIONS_VIEW_ALL",
    "SUBMISSIONS_CREATE",
    "SUBMISSIONS_GRADE",
    "QUIZZES_VIEW",
    "QUIZZES_CREATE",
    "QUIZZES_EDIT",
    "QUIZZES_DELETE",
    "QUIZZES_ATTEMPT",
    "QUIZZES_VIEW_RESULTS_OWN",
    "QUIZZES_VIEW_RESULTS_ALL",
    "QUIZZES_GRADE",
    "QUIZ_QUESTIONS_VIEW_WITH_ANSWERS",
    "QUIZ_QUESTIONS_USE_AI_HINT",
    "QUIZ_QUESTIONS_RUN_CODE",
    "QUESTION_BANK_VIEW",
    "QUESTION_BANK_CREATE",
    "QUESTION_BANK_EDIT",
    "QUESTION_BANK_DELETE",
    "GRADING_MANUAL_ASSESS",
    "GRADING_OVERRIDE_SCORE",
    "PROCTORING_MANAGE_SETTINGS",
    "PROCTORING_START_SESSION",
    "PROCTORING_VIEW_SESSIONS",
    "PROCTORING_VIEW_OWN_SESSIONS",
    "PROCTORING_JOIN_LIVE_STREAM",
    "PROCTORING_VIEW_ANALYTICS",
    "PROCTORING_LOG_EVENTS",
    "REPORT_CARDS_VIEW_OWN",
    "REPORT_CARDS_VIEW_ALL",
    "REPORT_CARDS_CREATE",
    "REPORT_CARDS_EDIT",
    "REPORT_CARDS_APPROVE",
    "REPORT_CARDS_EXPORT_PDF",
    "MANUAL_ASSESSMENTS_VIEW",
    "MANUAL_ASSESSMENTS_CREATE",
    "MANUAL_ASSESSMENTS_EDIT",
    "MANUAL_ASSESSMENTS_DELETE",
    "DASHBOARD_VIEW_ADMIN",
    "DASHBOARD_VIEW_INSTRUCTOR",
    "DASHBOARD_VIEW_STUDENT",
    "ACADEMICS_VIEW",
    "ACADEMICS_MANAGE_PERIODS",
    "DATABASE_ADMIN_ACCESS",
    "ROLES_PERMISSIONS_VIEW",
    "ROLES_PERMISSIONS_MANAGE"
  ],
  "instructor": [
    "COURSES_VIEW",
    "COURSES_EDIT",
    "COURSES_VIEW_STUDENTS",
    "COURSES_VIEW_GRADES",
    "ASSIGNMENTS_VIEW",
    "ASSIGNMENTS_CREATE",
    "ASSIGNMENTS_EDIT",
    "ASSIGNMENTS_DELETE",
    "ASSIGNMENTS_VIEW_SUBMISSIONS",
    "SUBMISSIONS_VIEW_ALL",
    "SUBMISSIONS_GRADE",
    "QUIZZES_VIEW",
    "QUIZZES_CREATE",
    "QUIZZES_EDIT",
    "QUIZZES_DELETE",
    "QUIZZES_VIEW_RESULTS_ALL",
    "QUIZZES_GRADE",
    "QUIZ_QUESTIONS_VIEW_WITH_ANSWERS",
    "QUIZ_QUESTIONS_USE_AI_HINT",
    "QUIZ_QUESTIONS_RUN_CODE",
    "QUESTION_BANK_VIEW",
    "QUESTION_BANK_CREATE",
    "QUESTION_BANK_EDIT",
    "QUESTION_BANK_DELETE",
    "GRADING_MANUAL_ASSESS",
    "GRADING_OVERRIDE_SCORE",
    "PROCTORING_MANAGE_SETTINGS",
    "PROCTORING_VIEW_SESSIONS",
    "PROCTORING_JOIN_LIVE_STREAM",
    "PROCTORING_VIEW_ANALYTICS",
    "REPORT_CARDS_VIEW_ALL",
    "REPORT_CARDS_CREATE",
    "REPORT_CARDS_EDIT",
    "REPORT_CARDS_EXPORT_PDF",
    "MANUAL_ASSESSMENTS_VIEW",
    "MANUAL_ASSESSMENTS_CREATE",
    "MANUAL_ASSESSMENTS_EDIT",
    "MANUAL_ASSESSMENTS_DELETE",
    "DASHBOARD_VIEW_INSTRUCTOR",
    "ACADEMICS_VIEW",
    "USERS_VIEW_ALL",
    "USERS_VIEW_OTHERS_ACTIVITY",
    "USERS_MANAGE_ENROLLMENT"
  ],
  "student": [
    "USERS_VIEW_SELF",
    "COURSES_VIEW",
    "COURSES_VIEW_OWN_GRADES",
    "ASSIGNMENTS_VIEW",
    "SUBMISSIONS_VIEW_OWN",
    "SUBMISSIONS_CREATE",
    "QUIZZES_VIEW",
    "QUIZZES_ATTEMPT",
    "QUIZZES_VIEW_RESULTS_OWN",
    "QUIZ_QUESTIONS_USE_AI_HINT",
    "QUIZ_QUESTIONS_RUN_CODE",
    "PROCTORING_START_SESSION",
    "PROCTORING_VIEW_OWN_SESSIONS",
    "PROCTORING_LOG_EVENTS",
    "REPORT_CARDS_VIEW_OWN",
    "REPORT_CARDS_EXPORT_PDF",
    "DASHBOARD_VIEW_STUDENT",
    "ACADEMICS_VIEW"
  ]
};

const SYSTEM_ROLES = [
  { name: "admin", description: "Full access to all system features", is_system: true },
  { name: "instructor", description: "Manages courses, assignments, quizzes, and grading", is_system: true },
  { name: "student", description: "Attempts quizzes/assignments and views own results", is_system: true },
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // Insert permission catalog
    await queryInterface.bulkInsert(
      "permissions",
      PERMISSIONS.map((p) => ({
        key: p.key,
        category: p.category,
        description: p.description,
        created_at: now,
        updated_at: now,
      }))
    );

    // Insert the 3 seeded system roles
    await queryInterface.bulkInsert(
      "roles",
      SYSTEM_ROLES.map((r) => ({
        name: r.name,
        description: r.description,
        is_system: r.is_system,
        created_at: now,
        updated_at: now,
      }))
    );

    // Look up generated ids
    const [roleRows] = await queryInterface.sequelize.query(
      "SELECT id, name FROM roles"
    );
    const [permissionRows] = await queryInterface.sequelize.query(
      "SELECT id, `key` FROM permissions"
    );

    const roleIdByName = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));
    const permissionIdByKey = Object.fromEntries(
      permissionRows.map((p) => [p.key, p.id])
    );

    const rolePermissionRows = [];
    for (const [roleName, permissionKeys] of Object.entries(
      DEFAULT_ROLE_PERMISSIONS
    )) {
      const roleId = roleIdByName[roleName];
      for (const key of permissionKeys) {
        const permissionId = permissionIdByKey[key];
        if (!roleId || !permissionId) continue;
        rolePermissionRows.push({
          role_id: roleId,
          permission_id: permissionId,
          created_at: now,
        });
      }
    }

    await queryInterface.bulkInsert("role_permissions", rolePermissionRows);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete("role_permissions", null);
    await queryInterface.bulkDelete("roles", {
      name: SYSTEM_ROLES.map((r) => r.name),
    });
    await queryInterface.bulkDelete("permissions", {
      key: PERMISSIONS.map((p) => p.key),
    });
  },
};
