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
} from "lucide-react";

import Dashboard from "../components/Dashboard/Dashboard";
import Courses from "../components/Courses/Courses";
import Assignments from "../components/Assignments/Assignments";
import Submissions from "../components/Submissions/Submissions";
import CourseDetails from "../components/Courses/CourseDetails";
import AssignmentDetails from "../components/Assignments/AssignmentDetails";
import CreateAssignmentPage from "../components/Assignments/CreateAssignmentPage";
import StudentDetails from "../components/Students/StudentDetails";
import Students from "../components/Students/Students";
import UpdateAssignmentPage from "../components/Assignments/UpdateAssignmentPage";
import EditQuestionPage from "../components/Quizzes/EditQuestionPage";
import QuizView from "../components/Quizzes/QuizView";
import QuizTaker from "../components/Quizzes/QuizTaker";
import QuizResults from "../components/Quizzes/QuizResults";
import CreateQuestionPage from "../components/Quizzes/CreateQuestionPage";
import Profile from "../components/Profile/Profile";
import QuizTakingPage from "../pages/QuizTakingPage";
import QuizResultsPage from "../pages/QuizResultsPage";
import QuizSubmissionsPage from "../pages/QuizSubmissionsPage";
import StudentQuizzesPage from "../pages/StudentQuizzesPage";
import CreateQuizPage from "../components/Quizzes/CreateQuizPage";
import EditQuizPage from "../components/Quizzes/EditQuizPage";
import QuizProctoringPage from "../components/Quizzes/QuizProctoringPage";
import QuizAnalyticsPage from "../components/Quizzes/QuizAnalyticsPage";
import QuizProctoringSettingsPage from "../components/Quizzes/QuizProctoringSettingsPage";
import QuizProctoringMonitoringPage from "../components/Quizzes/QuizProctoringMonitoringPage";
import QuizProctoringAnalyticsPage from "../components/Quizzes/QuizProctoringAnalyticsPage";
import { LiveProctoringDashboard } from "../components/Proctoring";
import QuizListPage from "../pages/QuizListPage";
import CourseReportsPage from "../pages/CourseReportsPage";
import StudentReportsPage from "../pages/StudentReportsPage";
import ReportCardBuilderPage from "../pages/ReportCardBuilderPage";
import GeneralAttributesPage from "../pages/GeneralAttributesPage";
import BloomsTaxonomyManagementPage from "../components/Quizzes/BloomsTaxonomyManagementPage";
import QuestionBankPage from "../pages/QuestionBankPage";
import SubmissionDetailPage from "../pages/SubmissionDetailPage";
import GradesPage from "../pages/GradesPage";
import AssessmentMarksPage from "../pages/AssessmentMarksPage";
import DatabaseManagementPage from "../pages/DatabaseManagementPage";
import RolesPermissionsPage from "../pages/Admin/RolesPermissionsPage";

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
    path: "/courses",
    element: <Courses />,
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
    path: "/courses/:courseId/report-card-builder",
    element: <ReportCardBuilderPage />,
    permissions: ["REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT", "REPORT_CARDS_APPROVE"],
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
    element: <Assignments />,
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
    element: <Submissions />,
    permissions: ["SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"],
    navItem: { label: "Submissions", icon: FileText, group: "General" },
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
    path: "/quizzes/public",
    element: <QuizListPage />,
    permissions: ["QUIZZES_VIEW"],
    navItem: { label: "Quizzes", icon: HelpCircle, group: "General" },
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
    path: "/proctoring/live",
    element: <LiveProctoringDashboard />,
    permissions: ["PROCTORING_JOIN_LIVE_STREAM"],
    fullWidth: true,
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
