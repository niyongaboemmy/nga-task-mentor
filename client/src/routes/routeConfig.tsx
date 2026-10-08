import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  FileText,
  Users,
  HelpCircle,
  ShieldCheck,
  Database,
  GraduationCap,
  BarChart3,
  User as UserIcon,
  Radio,
  Award,
  Library,
  Trophy,
  FolderCode,
  MonitorDot,
} from "lucide-react";

import { usePermissions } from "../hooks/usePermissions";
import { lazyPage } from "./lazyPage";

// Every page loads on first visit (see lazyPage), so the quiz page doesn't
// wait for all the others.
const Dashboard = lazyPage(() => import("../components/Dashboard/Dashboard"));
const Courses = lazyPage(() => import("../components/Courses/Courses"));
const AssignmentsPage = lazyPage(() => import("../pages/AssignmentsPage"));
const SubmissionsPage = lazyPage(() => import("../pages/SubmissionsPage"));
const CourseDetails = lazyPage(() => import("../components/Courses/CourseDetails"));
const AssignmentDetails = lazyPage(() => import("../components/Assignments/AssignmentDetails"));
const CreateAssignmentPage = lazyPage(() => import("../components/Assignments/CreateAssignmentPage"));
const StudentDetails = lazyPage(() => import("../components/Students/StudentDetails"));
const Students = lazyPage(() => import("../components/Students/Students"));
const UpdateAssignmentPage = lazyPage(() => import("../components/Assignments/UpdateAssignmentPage"));
const EditQuestionPage = lazyPage(() => import("../components/Quizzes/EditQuestionPage"));
const QuizView = lazyPage(() => import("../components/Quizzes/QuizView"));
const QuizTaker = lazyPage(() => import("../components/Quizzes/QuizTaker"));
const QuizResults = lazyPage(() => import("../components/Quizzes/QuizResults"));
const CreateQuestionPage = lazyPage(() => import("../components/Quizzes/CreateQuestionPage"));
const Profile = lazyPage(() => import("../components/Profile/Profile"));
const QuizTakingPage = lazyPage(() => import("../pages/QuizTakingPage"));
const QuizResultsPage = lazyPage(() => import("../pages/QuizResultsPage"));
const QuizSubmissionsPage = lazyPage(() => import("../pages/QuizSubmissionsPage"));
const PaperSheetsPage = lazyPage(() => import("../pages/PaperSheetsPage"));
const StudentQuizzesPage = lazyPage(() => import("../pages/StudentQuizzesPage"));
const CreateQuizPage = lazyPage(() => import("../components/Quizzes/CreateQuizPage"));
const EditQuizPage = lazyPage(() => import("../components/Quizzes/EditQuizPage"));
const QuizProctoringPage = lazyPage(() => import("../components/Quizzes/QuizProctoringPage"));
const QuizAnalyticsPage = lazyPage(() => import("../components/Quizzes/QuizAnalyticsPage"));
const QuizProctoringSettingsPage = lazyPage(() => import("../components/Quizzes/QuizProctoringSettingsPage"));
const QuizProctoringMonitoringPage = lazyPage(() => import("../components/Quizzes/QuizProctoringMonitoringPage"));
const QuizProctoringAnalyticsPage = lazyPage(() => import("../components/Quizzes/QuizProctoringAnalyticsPage"));
const LiveProctoringDashboard = lazyPage(() =>
  import("../components/Proctoring").then((m) => ({ default: m.LiveProctoringDashboard })),
);
const QuizListPage = lazyPage(() => import("../pages/QuizListPage"));
const QuizzesPage = lazyPage(() => import("../pages/QuizzesPage"));
const CourseReportsPage = lazyPage(() => import("../pages/CourseReportsPage"));
const StudentReportsPage = lazyPage(() => import("../pages/StudentReportsPage"));
const SubjectGradesPage = lazyPage(() => import("../pages/SubjectGradesPage"));
const SubjectAssessmentReportPage = lazyPage(() => import("../pages/SubjectAssessmentReportPage"));
const GeneralAttributesPage = lazyPage(() => import("../pages/GeneralAttributesPage"));
const BloomsTaxonomyManagementPage = lazyPage(() => import("../components/Quizzes/BloomsTaxonomyManagementPage"));
const QuestionBankPage = lazyPage(() => import("../pages/QuestionBankPage"));
const QuestionBankHubPage = lazyPage(() => import("../pages/QuestionBankHubPage"));
const SubmissionDetailPage = lazyPage(() => import("../pages/SubmissionDetailPage"));
const GradesPage = lazyPage(() => import("../pages/GradesPage"));
const AssessmentMarksPage = lazyPage(() => import("../pages/AssessmentMarksPage"));
const DatabaseManagementPage = lazyPage(() => import("../pages/DatabaseManagementPage"));
const RolesPermissionsPage = lazyPage(() => import("../pages/Admin/RolesPermissionsPage"));
const RankingPage = lazyPage(() => import("../pages/RankingPage"));
const AdminSubjectsPage = lazyPage(() => import("../pages/AdminSubjectsPage"));
const ProjectsPage = lazyPage(() => import("../pages/ProjectsPage"));
const ProjectDetailPage = lazyPage(() => import("../pages/ProjectDetailPage"));
const ProjectMonitorPage = lazyPage(() => import("../pages/ProjectMonitorPage"));
const PracticalGradingPage = lazyPage(() => import("../pages/PracticalGradingPage"));

// School-wide viewers get the subjects report; everyone else their course grid.
const CoursesEntry = () => {
  const { can } = usePermissions();
  return can("DASHBOARD_VIEW_ADMIN") ? <AdminSubjectsPage /> : <Courses />;
};

// Wrapper components for routes that need useParams
const QuizViewWrapper = () => {
  const { quizId } = useParams<{ quizId: string }>();
  return <QuizView quizId={parseInt(quizId!)} />;
};

const QuizTakerWrapper = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  return <QuizTaker submissionId={parseInt(submissionId!)} />;
};

const EditQuestionPageWrapper = () => {
  const { quizId, questionId } = useParams<{
    quizId: string;
    questionId: string;
  }>();
  return (
    <EditQuestionPage
      quizId={parseInt(quizId!)}
      questionId={parseInt(questionId!)}
    />
  );
};

const CreateQuestionPageWrapper = () => {
  const { quizId } = useParams<{ quizId: string }>();
  return <CreateQuestionPage quizId={parseInt(quizId!)} />;
};

const QuizResultsWrapper = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  return <QuizResults submissionId={parseInt(submissionId!)} />;
};

export interface NavItemConfig {
  label: string;
  icon: LucideIcon;
  group: "General" | "Teaching" | "Admin";
}

export interface AppRoute {
  path: string;
  element: ReactNode;
  /** OR semantics — omit to allow any authenticated user. */
  permissions?: string[];
  /** Full-width layout (bypasses the default content max-width), e.g. data tables. */
  fullWidth?: boolean;
  /** Edge-to-edge layout — also strips the shell's content padding, e.g. a
   * video-wall/monitoring surface that should touch the viewport edges. */
  noPadding?: boolean;
  /** Renders standalone, without the app shell (Sidebar/TopBar) — e.g. a
   * fullscreen quiz-taking or editing experience. */
  noLayout?: boolean;
  /** Present only for routes that should appear as a top-level sidebar item. */
  navItem?: NavItemConfig;
}

export const appRoutes: AppRoute[] = [
  {
    path: "/dashboard",
    element: <Dashboard />,
    permissions: ["DASHBOARD_VIEW_ADMIN", "DASHBOARD_VIEW_INSTRUCTOR", "DASHBOARD_VIEW_STUDENT"],
    navItem: { label: "Dashboard", icon: LayoutDashboard, group: "General" },
  },
  { path: "/profile", element: <Profile /> },
  {
    // The server decides whether the caller gets their own position (students,
    // RANKINGS_VIEW_OWN) or a leaderboard (teachers and admins,
    // RANKINGS_VIEW_ALL). Either key opens the page; with neither, the menu
    // item and the route are gone.
    path: "/ranking",
    element: <RankingPage />,
    permissions: ["RANKINGS_VIEW_OWN", "RANKINGS_VIEW_ALL"],
    navItem: { label: "Overall Ranking", icon: Trophy, group: "General" },
  },
  {
    path: "/courses",
    element: <CoursesEntry />,
    permissions: ["COURSES_VIEW"],
    navItem: { label: "Courses", icon: BookOpen, group: "General" },
  },
  { path: "/courses/:courseId", element: <CourseDetails />, permissions: ["COURSES_VIEW"] },
  {
    path: "/reports",
    element: <StudentReportsPage />,
    permissions: ["REPORT_CARDS_VIEW_OWN"],
    navItem: { label: "My Reports", icon: Award, group: "General" },
  },
  {
    path: "/courses/:courseId/reports",
    element: <CourseReportsPage />,
    permissions: ["REPORT_CARDS_VIEW_OWN", "REPORT_CARDS_VIEW_ALL"],
  },
  {
    path: "/courses/:courseId/report-card-attributes",
    element: <GeneralAttributesPage />,
    permissions: ["REPORT_CARDS_EDIT"],
  },
  {
    path: "/courses/:courseId/question-bank",
    element: <QuestionBankPage />,
    permissions: ["QUESTION_BANK_VIEW"],
  },
  {
    path: "/assignments",
    element: <AssignmentsPage />,
    permissions: ["ASSIGNMENTS_VIEW"],
    navItem: { label: "Assignments", icon: ClipboardList, group: "General" },
  },
  {
    path: "/assignments/create",
    element: <CreateAssignmentPage />,
    permissions: ["ASSIGNMENTS_CREATE"],
  },
  {
    path: "/assignments/:assignmentId",
    element: <AssignmentDetails />,
    permissions: ["ASSIGNMENTS_VIEW"],
  },
  {
    path: "/assignments/:assignmentId/edit",
    element: <UpdateAssignmentPage />,
    permissions: ["ASSIGNMENTS_EDIT"],
    noLayout: true,
  },
  {
    path: "/submissions",
    element: <SubmissionsPage />,
    permissions: ["SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"],
    navItem: { label: "Submissions", icon: FileText, group: "General" },
  },
  {
    // TMCode Projects (PROJECTS_PLAN.md §5): personal coding projects worked
    // on in TMCode. VIEW_ALL / MONITOR holders reach other people's projects
    // read-only, so the project page accepts any of the three keys.
    path: "/projects",
    element: <ProjectsPage />,
    permissions: ["PROJECTS_USE", "PROJECTS_VIEW_ALL"],
    navItem: { label: "Projects", icon: FolderCode, group: "General" },
  },
  {
    path: "/projects/monitor",
    element: <ProjectMonitorPage />,
    permissions: ["PROJECTS_MONITOR"],
    navItem: { label: "Project Monitor", icon: MonitorDot, group: "Teaching" },
  },
  {
    path: "/projects/:id",
    element: <ProjectDetailPage />,
    permissions: ["PROJECTS_USE", "PROJECTS_VIEW_ALL", "PROJECTS_MONITOR"],
  },
  {
    // Grading workspace for TMCode practicals (assignment or quiz question).
    path: "/grading/practical/:type/:id",
    element: <PracticalGradingPage />,
    permissions: ["PROJECTS_MONITOR", "PROJECTS_VIEW_ALL"],
  },
  {
    path: "/students",
    element: <Students />,
    permissions: ["USERS_VIEW_ALL"],
    navItem: { label: "Students", icon: Users, group: "Teaching" },
  },
  {
    path: "/students/:studentId",
    element: <StudentDetails />,
    permissions: ["USERS_VIEW_ALL"],
  },
  { path: "/quizzes/:quizId", element: <QuizViewWrapper />, permissions: ["QUIZZES_EDIT"] },
  {
    path: "/quizzes/:quizId/questions/create",
    element: <CreateQuestionPageWrapper />,
    permissions: ["QUIZZES_EDIT"],
  },
  { path: "/quiz/:submissionId", element: <QuizTakerWrapper />, permissions: ["QUIZZES_ATTEMPT"] },
  {
    path: "/quiz/:submissionId/results",
    element: <QuizResultsWrapper />,
    permissions: ["QUIZZES_VIEW_RESULTS_OWN"],
  },
  {
    path: "/quizzes/:quizId/questions/:questionId/edit",
    element: <EditQuestionPageWrapper />,
    permissions: ["QUIZZES_EDIT"],
  },
  {
    path: "/courses/:courseId/quizzes/create",
    element: <CreateQuizPage />,
    permissions: ["QUIZZES_CREATE"],
  },
  {
    path: "/courses/:courseId/quizzes",
    element: <QuizListPage />,
    permissions: ["QUIZZES_VIEW"],
  },
  {
    path: "/quizzes",
    element: <QuizzesPage />,
    permissions: ["QUIZZES_EDIT"],
    navItem: { label: "Quizzes", icon: HelpCircle, group: "General" },
  },
  {
    // Back-compat: older links (e.g. the dashboard shortcut) used /quizzes/public
    path: "/quizzes/public",
    element: <QuizzesPage />,
    permissions: ["QUIZZES_EDIT"],
  },
  {
    path: "/my-quizzes",
    element: <StudentQuizzesPage />,
    permissions: ["QUIZZES_ATTEMPT"],
    navItem: { label: "My Quizzes", icon: HelpCircle, group: "General" },
  },
  {
    path: "/quizzes/:id/take",
    element: <QuizTakingPage />,
    permissions: ["QUIZZES_ATTEMPT"],
    noLayout: true,
  },
  {
    path: "/quizzes/:id/results",
    element: <QuizResultsPage />,
    permissions: ["QUIZZES_VIEW_RESULTS_OWN"],
  },
  {
    // Teacher-only hub: every assigned subject's bank in one place
    // (cross-subject dashboard + per-subject question list).
    path: "/question-bank",
    element: <QuestionBankHubPage />,
    permissions: ["QUESTION_BANK_HUB_VIEW"],
    navItem: { label: "Question Bank", icon: Library, group: "Teaching" },
  },
  {
    path: "/proctoring/live",
    element: <LiveProctoringDashboard />,
    permissions: ["PROCTORING_JOIN_LIVE_STREAM"],
    fullWidth: true,
    noPadding: true,
    navItem: { label: "Live Proctoring", icon: Radio, group: "Teaching" },
  },
  {
    path: "/quizzes/:quizId/settings",
    element: <EditQuizPage />,
    permissions: ["QUIZZES_EDIT"],
  },
  {
    path: "/quizzes/:quizId/proctoring",
    element: <QuizProctoringPage />,
    permissions: ["PROCTORING_MANAGE_SETTINGS"],
  },
  {
    path: "/quizzes/:quizId/analytics",
    element: <QuizAnalyticsPage />,
    permissions: ["QUIZZES_VIEW_RESULTS_ALL"],
  },
  {
    path: "/quizzes/:quizId/proctoring/settings",
    element: <QuizProctoringSettingsPage />,
    permissions: ["PROCTORING_MANAGE_SETTINGS"],
  },
  {
    path: "/quizzes/:quizId/proctoring/monitoring",
    element: <QuizProctoringMonitoringPage />,
    permissions: ["PROCTORING_VIEW_SESSIONS"],
  },
  {
    path: "/quizzes/:quizId/proctoring/analytics",
    element: <QuizProctoringAnalyticsPage />,
    permissions: ["PROCTORING_VIEW_ANALYTICS"],
  },
  {
    path: "/quizzes/:quizId/submissions",
    element: <QuizSubmissionsPage />,
    permissions: ["QUIZZES_GRADE"],
  },
  {
    path: "/quizzes/:quizId/paper-sheets",
    element: <PaperSheetsPage />,
    permissions: ["QUIZZES_GRADE"],
  },
  {
    path: "/quizzes/:quizId/submissions/:submissionId",
    element: <SubmissionDetailPage />,
    permissions: ["QUIZZES_GRADE"],
  },
  {
    path: "/grades",
    element: <GradesPage />,
    permissions: ["MANUAL_ASSESSMENTS_VIEW"],
    navItem: { label: "Grades", icon: GraduationCap, group: "Teaching" },
  },
  {
    path: "/grades/subjects/:courseId/report",
    element: <SubjectAssessmentReportPage />,
    permissions: ["COURSES_VIEW_GRADES"],
  },
  {
    path: "/grades/subjects/:courseId",
    element: <SubjectGradesPage />,
    permissions: ["REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT", "REPORT_CARDS_APPROVE"],
  },
  {
    path: "/grades/:assessmentId/marks",
    element: <AssessmentMarksPage />,
    permissions: ["MANUAL_ASSESSMENTS_EDIT"],
  },
  {
    path: "/admin/blooms-taxonomy",
    element: <BloomsTaxonomyManagementPage />,
    permissions: ["QUIZZES_CREATE"],
    navItem: { label: "Bloom's Taxonomy", icon: BarChart3, group: "Admin" },
  },
  {
    path: "/admin/database-management",
    element: <DatabaseManagementPage />,
    permissions: ["DATABASE_ADMIN_ACCESS"],
    fullWidth: true,
    navItem: { label: "Database Management", icon: Database, group: "Admin" },
  },
  {
    path: "/admin/roles-permissions",
    element: <RolesPermissionsPage />,
    permissions: ["ROLES_PERMISSIONS_VIEW", "ROLES_PERMISSIONS_MANAGE"],
    navItem: { label: "Roles & Permissions", icon: ShieldCheck, group: "Admin" },
  },
];

/** Icon used for the Profile link, which isn't part of appRoutes' sidebar
 * items (no navItem) but is always reachable from the top bar avatar menu. */
export const PROFILE_ICON = UserIcon;
