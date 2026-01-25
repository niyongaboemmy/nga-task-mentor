import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// import TimezoneChecker from "./components/TimezoneChecker";
import Dashboard from "./components/Dashboard/Dashboard";
import AuthGuard from "./components/Auth/AuthGuard";
import Courses from "./components/Courses/Courses";
import Assignments from "./components/Assignments/Assignments";
import Submissions from "./components/Submissions/Submissions";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import Layout from "./components/Layout/Layout";
import Login from "./components/Auth/Login";
import CourseDetails from "./components/Courses/CourseDetails";
import AssignmentDetails from "./components/Assignments/AssignmentDetails";
import CreateAssignmentPage from "./components/Assignments/CreateAssignmentPage";
import StudentDetails from "./components/Students/StudentDetails";
import Students from "./components/Students/Students";
import UpdateAssignmentPage from "./components/Assignments/UpdateAssignmentPage";
import EditQuestionPage from "./components/Quizzes/EditQuestionPage";
import QuizView from "./components/Quizzes/QuizView";
import QuizTaker from "./components/Quizzes/QuizTaker";
import QuizResults from "./components/Quizzes/QuizResults";
import CreateQuestionPage from "./components/Quizzes/CreateQuestionPage";
import Profile from "./components/Profile/Profile";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import QuizTakingPage from "./pages/QuizTakingPage";
import QuizResultsPage from "./pages/QuizResultsPage";
import QuizSubmissionsPage from "./pages/QuizSubmissionsPage";
import StudentQuizzesPage from "./pages/StudentQuizzesPage";
import CreateQuizPage from "./components/Quizzes/CreateQuizPage";
import EditQuizPage from "./components/Quizzes/EditQuizPage";
import QuizProctoringPage from "./components/Quizzes/QuizProctoringPage";
import QuizAnalyticsPage from "./components/Quizzes/QuizAnalyticsPage";
import QuizProctoringSettingsPage from "./components/Quizzes/QuizProctoringSettingsPage";
import QuizProctoringMonitoringPage from "./components/Quizzes/QuizProctoringMonitoringPage";
import QuizProctoringAnalyticsPage from "./components/Quizzes/QuizProctoringAnalyticsPage";
import { LiveProctoringDashboard } from "./components/Proctoring";
import QuizListPage from "./pages/QuizListPage";
import CourseReportsPage from "./pages/CourseReportsPage";

// Wrapper components for routes that need useParams
const QuizViewWrapper = () => {
  const { quizId } = useParams<{ quizId: string }>();
  return <QuizView quizId={parseInt(quizId!)} />;
};

const QuizTakerWrapper = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  return <QuizTaker quiz={{} as any} submissionId={parseInt(submissionId!)} />;
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

const CreateQuizPageWrapper = () => {
  return <CreateQuizPage />;
};

const EditQuizPageWrapper = () => {
  return <EditQuizPage />;
};

const QuizTakingPageWrapper = () => {
  return <QuizTakingPage />;
};

const QuizResultsPageWrapper = () => {
  return <QuizResultsPage />;
};

const QuizProctoringPageWrapper = () => {
  return <QuizProctoringPage />;
};

const QuizAnalyticsPageWrapper = () => {
  return <QuizAnalyticsPage />;
};

const QuizProctoringSettingsPageWrapper = () => {
  return <QuizProctoringSettingsPage />;
};

const QuizProctoringMonitoringPageWrapper = () => {
  return <QuizProctoringMonitoringPage />;
};

const QuizProctoringAnalyticsPageWrapper = () => {
  return <QuizProctoringAnalyticsPage />;
};

const QuizSubmissionsPageWrapper = () => {
  return <QuizSubmissionsPage />;
};

function AppContent() {
  // const { user } = useAuth();
  // const [showProfilePicturePrompt, setShowProfilePicturePrompt] =
  //   useState(false);

  // Show profile picture prompt if user doesn't have a profile picture
  // useEffect(() => {
  //   if (user && !user.profile_image) {
  //     // Show prompt after a short delay to let the app load
  //     const timer = setTimeout(() => {
  //       setShowProfilePicturePrompt(true);
  //     }, 2000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [user]);

  return (
    <ErrorBoundary>
      <Router basename="/taskmentor">
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<AuthGuard />} />
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Courses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:courseId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CourseDetails />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:courseId/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CourseReportsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assignments"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Assignments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assignments/create"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateAssignmentPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assignments/:assignmentId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AssignmentDetails />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assignments/:assignmentId/edit"
              element={
                <ProtectedRoute>
                  <UpdateAssignmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submissions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Submissions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/students"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Students />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/students/:studentId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StudentDetails />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizViewWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/questions/create"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateQuestionPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/:submissionId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizTakerWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/:submissionId/results"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizResultsWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/questions/:questionId/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EditQuestionPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:courseId/quizzes/create"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateQuizPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:courseId/quizzes"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizListPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/public"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizListPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-quizzes"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StudentQuizzesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:id/take"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizTakingPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:id/results"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizResultsPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/proctoring/live"
              element={
                <ProtectedRoute>
                  <Layout>
                    <LiveProctoringDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EditQuizPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/proctoring"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizProctoringPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/analytics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizAnalyticsPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/proctoring/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizProctoringSettingsPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/proctoring/monitoring"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizProctoringMonitoringPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/proctoring/analytics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizProctoringAnalyticsPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/submissions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizSubmissionsPageWrapper />
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </div>
      </Router>

      {/* Profile Picture Prompt Modal */}
      {/* <ProfilePicturePrompt
        isOpen={showProfilePicturePrompt}
        onClose={() => setShowProfilePicturePrompt(false)}
      /> */}
    </ErrorBoundary>
  );
}

function App() {
  return (
    <Provider store={store}>
      {/* AuthProvider is already in main.tsx */}
      {/* <TimezoneChecker> */}
      <AppContent />
      {/* </TimezoneChecker> */}
    </Provider>
  );
}

export default App;
