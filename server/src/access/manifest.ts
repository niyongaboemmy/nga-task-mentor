import { CapabilityDef, defineManifest, Depth, Domain } from "../vendor/nga-access";

/**
 * Task Mentor capability manifest (access control v2 -- see
 * nga_central_mis/ACCESS_LEVELS_RBAC_IMPLEMENTATION_PLAN.md and
 * nga_central_mis/packages/access/README.md).
 *
 * Keys are the existing permission keys (constants/permissions.ts), so no call
 * site is renamed. "*_OWN" / "*_SELF" keys are granted at SELF scope; "*_ALL"
 * and grade/result views carry a read depth: `summary` (aggregates, never
 * names) or `detail` (records). REPORT_CARDS_COMMENT and REPORT_CARDS_PUBLISH
 * are new: they split the report-card chain (plan §10) -- class teacher
 * comments, DOS approves, head publishes.
 *
 * Published to MIS on deploy (npm run access:publish).
 */

const R = (label: string, domain: Domain, depths: Depth[] = ["detail"], extra: Partial<CapabilityDef> = {}): CapabilityDef =>
  ({ label, domain, kind: "READ", depths, ...extra });
const W = (label: string, domain: Domain, extra: Partial<CapabilityDef> = {}): CapabilityDef =>
  ({ label, domain, kind: "WRITE", ...extra });
const SCHOOL_ONLY = { scopeable: false };

export const TM_MANIFEST = defineManifest({
  app: "tm",
  name: "Task Mentor",
  version: "2026.09.27",
  capabilities: {
    USERS_VIEW_SELF: R("View own profile", "PEOPLE"),
    USERS_VIEW_ALL: R("View students and staff", "PEOPLE"),
    USERS_CREATE: W("Create local accounts", "PEOPLE", SCHOOL_ONLY),
    USERS_EDIT: W("Edit local accounts", "PEOPLE", SCHOOL_ONLY),
    USERS_DELETE: W("Delete local accounts", "PEOPLE", SCHOOL_ONLY),
    USERS_MANAGE_ENROLLMENT: W("Manage enrolment", "ACADEMICS"),
    USERS_VIEW_OTHERS_ACTIVITY: R("View others' activity", "PEOPLE"),

    COURSES_VIEW: R("View courses (subjects)", "CURRICULUM"),
    COURSES_CREATE: W("Create courses", "CURRICULUM"),
    COURSES_EDIT: W("Edit courses", "CURRICULUM"),
    COURSES_DELETE: W("Delete courses", "CURRICULUM"),
    COURSES_VIEW_STUDENTS: R("View course rosters", "PEOPLE"),
    COURSES_VIEW_GRADES: R("View grades", "ASSESSMENT", ["summary", "detail"]),
    COURSES_VIEW_OWN_GRADES: R("View own grades", "ASSESSMENT"),

    ASSIGNMENTS_VIEW: R("View assignments", "ASSESSMENT"),
    ASSIGNMENTS_CREATE: W("Create assignments", "ASSESSMENT"),
    ASSIGNMENTS_EDIT: W("Edit assignments", "ASSESSMENT"),
    ASSIGNMENTS_DELETE: W("Delete assignments", "ASSESSMENT"),
    ASSIGNMENTS_VIEW_SUBMISSIONS: R("View assignment submissions", "ASSESSMENT", ["summary", "detail"]),
    ASSIGNMENTS_MANAGE_ANY: W("Manage anyone's assignments", "ASSESSMENT"),

    SUBMISSIONS_VIEW_OWN: R("View own submissions", "ASSESSMENT"),
    SUBMISSIONS_VIEW_ALL: R("View submissions", "ASSESSMENT", ["summary", "detail"]),
    SUBMISSIONS_CREATE: W("Submit work", "ASSESSMENT"),
    SUBMISSIONS_GRADE: W("Grade submissions", "ASSESSMENT"),

    QUIZZES_VIEW: R("View quizzes", "ASSESSMENT"),
    QUIZZES_CREATE: W("Create quizzes", "ASSESSMENT"),
    QUIZZES_EDIT: W("Edit quizzes", "ASSESSMENT"),
    QUIZZES_DELETE: W("Delete quizzes", "ASSESSMENT"),
    QUIZZES_ATTEMPT: W("Attempt quizzes", "ASSESSMENT"),
    QUIZZES_VIEW_RESULTS_OWN: R("View own quiz results", "ASSESSMENT"),
    QUIZZES_VIEW_RESULTS_ALL: R("View quiz results", "ASSESSMENT", ["summary", "detail"]),
    QUIZZES_GRADE: W("Grade quizzes", "ASSESSMENT"),
    QUIZZES_MANAGE_ANY: W("Manage anyone's quizzes", "ASSESSMENT"),

    QUIZ_QUESTIONS_VIEW_WITH_ANSWERS: R("View questions with answers", "ASSESSMENT"),
    QUIZ_QUESTIONS_USE_AI_HINT: W("Use AI hints", "ASSESSMENT"),
    QUIZ_QUESTIONS_RUN_CODE: W("Run code in questions", "ASSESSMENT"),

    QUESTION_BANK_VIEW: R("View the question bank", "CURRICULUM"),
    QUESTION_BANK_CREATE: W("Add to the question bank", "CURRICULUM"),
    QUESTION_BANK_EDIT: W("Edit the question bank", "CURRICULUM"),
    QUESTION_BANK_DELETE: W("Delete from the question bank", "CURRICULUM"),
    QUESTION_BANK_MANAGE_ANY: W("Curate anyone's questions", "CURRICULUM"),

    GRADING_MANUAL_ASSESS: W("Record manual assessments", "ASSESSMENT"),
    GRADING_OVERRIDE_SCORE: W("Override a score (audited)", "ASSESSMENT"),

    PROCTORING_MANAGE_SETTINGS: W("Configure proctoring", "ASSESSMENT"),
    PROCTORING_START_SESSION: W("Start proctored sessions", "ASSESSMENT"),
    PROCTORING_VIEW_SESSIONS: R("View proctoring sessions", "ASSESSMENT", ["summary", "detail"]),
    PROCTORING_VIEW_OWN_SESSIONS: R("View own proctoring sessions", "ASSESSMENT"),
    PROCTORING_JOIN_LIVE_STREAM: R("Watch live proctoring", "ASSESSMENT"),
    PROCTORING_VIEW_ANALYTICS: R("View proctoring analytics", "ASSESSMENT", ["summary", "detail"]),
    PROCTORING_LOG_EVENTS: W("Log proctoring events", "ASSESSMENT"),

    REPORT_CARDS_VIEW_OWN: R("View own report cards", "ASSESSMENT"),
    REPORT_CARDS_VIEW_ALL: R("View report cards", "ASSESSMENT", ["summary", "detail"]),
    REPORT_CARDS_CREATE: W("Create report cards", "ASSESSMENT"),
    REPORT_CARDS_EDIT: W("Enter report-card marks", "ASSESSMENT"),
    REPORT_CARDS_COMMENT: W("Write the class-teacher comment", "ASSESSMENT"),
    REPORT_CARDS_APPROVE: W("Approve report cards", "ASSESSMENT"),
    REPORT_CARDS_PUBLISH: W("Publish report cards", "ASSESSMENT"),
    REPORT_CARDS_EXPORT_PDF: W("Export report cards (PDF)", "ASSESSMENT"),

    MANUAL_ASSESSMENTS_VIEW: R("View manual assessments", "ASSESSMENT", ["summary", "detail"]),
    MANUAL_ASSESSMENTS_CREATE: W("Create manual assessments", "ASSESSMENT"),
    MANUAL_ASSESSMENTS_EDIT: W("Edit manual assessments", "ASSESSMENT"),
    MANUAL_ASSESSMENTS_DELETE: W("Delete manual assessments", "ASSESSMENT"),

    DASHBOARD_VIEW_ADMIN: R("School dashboard", "REPORTING", ["summary"]),
    DASHBOARD_VIEW_INSTRUCTOR: R("Instructor dashboard", "REPORTING"),
    DASHBOARD_VIEW_STUDENT: R("Student dashboard", "REPORTING"),

    ACADEMICS_VIEW: R("View academic periods", "ACADEMICS"),
    ACADEMICS_MANAGE_PERIODS: W("Manage academic periods", "ACADEMICS", SCHOOL_ONLY),
    DATABASE_ADMIN_ACCESS: W("Database admin tool", "SYSTEM", SCHOOL_ONLY),
    ROLES_PERMISSIONS_VIEW: R("View roles & permissions", "ACCESS", ["detail"], SCHOOL_ONLY),
    ROLES_PERMISSIONS_MANAGE: W("Manage roles & permissions", "ACCESS", SCHOOL_ONLY),
  },
  insights: {
    "results.average": { label: "Average result", capability: "COURSES_VIEW_GRADES", minDepth: "summary", levels: ["SCHOOL", "PROGRAM", "GRADE", "CLASS_GROUP", "DEPARTMENT"] },
    "results.distribution": { label: "Result distribution", capability: "COURSES_VIEW_GRADES", minDepth: "summary", levels: ["SCHOOL", "PROGRAM", "GRADE", "CLASS_GROUP", "DEPARTMENT"] },
    "assessments.completion": { label: "Assessment completion", capability: "SUBMISSIONS_VIEW_ALL", minDepth: "summary", levels: ["SCHOOL", "PROGRAM", "GRADE", "CLASS_GROUP"] },
    "report_cards.progress": { label: "Report cards progress", capability: "REPORT_CARDS_VIEW_ALL", minDepth: "summary", levels: ["SCHOOL", "PROGRAM", "GRADE", "CLASS_GROUP"] },
    "proctoring.violations_rate": { label: "Proctoring violations", capability: "PROCTORING_VIEW_ANALYTICS", minDepth: "summary", levels: ["SCHOOL", "PROGRAM", "GRADE"] },
  },
});

export default TM_MANIFEST;
