import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { motion } from "framer-motion";
import Assignments from "../Assignments/Assignments";
import { QuizList } from "../Quizzes/QuizList";
import { fetchCourse, fetchCourses } from "../../store/slices/courseSlice";
import type { RootState, AppDispatch } from "../../store";
import type { Course } from "../../types/course.types";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  FileText,
  Info,
  Library,
  Mail,
  PlusCircle,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../contexts/AuthContext";
import CourseReportCardsPanel from "../ReportCard/CourseReportCardsPanel";
import RecordedAssessmentsPanel from "./RecordedAssessmentsPanel";
import { useRecordedAssessments } from "./useRecordedAssessments";
import CourseTabs, { type CourseTabAction, type CourseTabItem } from "./CourseTabs";
import CourseOverviewPanel from "./CourseOverviewPanel";
import CourseRankingPanel from "./CourseRankingPanel";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 110,
      damping: 20,
    },
  },
};

const VALID_TABS = [
  "overview",
  "assignments",
  "quizzes",
  "recorded",
  "students",
  "ranking",
  "report-cards",
] as const;
type TabId = (typeof VALID_TABS)[number];

const getStoredTab = (courseId: string): TabId => {
  try {
    const stored = sessionStorage.getItem(`course-tab-${courseId}`);
    if (stored && VALID_TABS.includes(stored as TabId)) return stored as TabId;
  } catch {}
  return "overview";
};

const CourseDetails: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>(
    () => getStoredTab(courseId || ""),
  );

  const { can } = usePermissions();
  const isInstructorOrAdmin = can("COURSES_VIEW_STUDENTS");
  const canCreateQuizzes = can("QUIZZES_CREATE");
  const canViewQuestionBank = can("QUESTION_BANK_VIEW");
  const canViewReportCards = can("REPORT_CARDS_VIEW_ALL");
  // Staff get the subject leaderboard, students their own place in it; each
  // is its own switch in Roles & Permissions (the server checks the same).
  const canViewRanking = can(isInstructorOrAdmin ? "RANKINGS_VIEW_ALL" : "RANKINGS_VIEW_OWN");
  // The grade endpoint decides what a caller may see; this only picks the view.
  const canViewAllMarks = can("COURSES_VIEW_GRADES");
  const canEditMarks = can("MANUAL_ASSESSMENTS_EDIT");

  // Every tab shows the period picked in the app bar's academic switcher: the
  // session carries it, so /courses/:id, /courses/:id/grades and the
  // report-card endpoints are all scoped to it, and switching remounts this
  // page (Layout's key={academicPeriodVersion}). No tab keeps its own picker.
  const termName: string | undefined = user?.currentAcademicTerm?.name;
  const academicYearName: string | undefined = user?.currentAcademicYear?.name;
  const periodLabel =
    termName && academicYearName ? `${academicYearName} · ${termName}` : null;

  // Marks recorded by hand for this subject. Loaded here rather than inside the
  // tab so the tab label can carry the count before it is ever opened — and so
  // the Overview can build its dashboard from the same report.
  const recordedAssessments = useRecordedAssessments(courseId);

  // Get courses and loading state from Redux store
  const courseState = useSelector((state: RootState) => state.course);

  const currentCourse = courseState?.currentCourse;
  const courses = courseState?.courses || [];
  const loading = courseState?.loading?.course || false;

  // Derive course data - prioritize currentCourse if it matches the ID, otherwise fallback to list
  const course = React.useMemo<Course | null>(() => {
    if (currentCourse && String(currentCourse.id) === String(courseId)) {
      return currentCourse;
    }
    return courses.find((c) => String(c.id) === String(courseId)) || null;
  }, [currentCourse, courses, courseId]);

  useEffect(() => {
    const initializeCourse = async () => {
      if (!courseId) return;
      const courseIdNum = parseInt(courseId);

      setIsLoading(true);
      try {
        // 1. Ensure course list is loaded for basic info
        if (courses.length === 0) {
          await dispatch(fetchCourses()).unwrap();
        }

        // 2. Fetch stats and enrollment (merges into Redux)
        await dispatch(fetchCourse(courseIdNum)).unwrap();
      } catch (error: any) {
        console.error("Error fetching course details:", error);
        // Only set error if we don't have ANY info about this course
        if (
          !course &&
          !courses.find((c) => String(c.id) === String(courseId))
        ) {
          setErrorMessage(error.message || "Failed to load course details");
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeCourse();
  }, [courseId, dispatch]); // Removed courses.length as we handle it inside

  const selectTab = (tabId: TabId) => {
    setActiveTab(tabId);
    try {
      sessionStorage.setItem(`course-tab-${courseId}`, tabId);
    } catch {
      // Storage blocked (private mode) — the tab just won't be remembered.
    }
  };

  // A tab the caller can't open (e.g. a remembered "students" tab after a
  // permission change) falls back to the overview instead of a blank panel.
  const allowedTab =
    (activeTab === "students" && !isInstructorOrAdmin) ||
    (activeTab === "report-cards" && !canViewReportCards) ||
    (activeTab === "ranking" && !canViewRanking)
      ? "overview"
      : activeTab;

  const assignmentCount = course?.statistics?.assignments?.total || 0;
  const quizCount = course?.statistics?.quizzes?.total || 0;
  const studentCount = course?.enrolledStudents?.length || 0;

  const tabs = useMemo<CourseTabItem[]>(() => {
    const list: CourseTabItem[] = [
      { id: "overview", label: "Overview", icon: <Info /> },
      { id: "assignments", label: "Assignments", icon: <FileText />, count: assignmentCount },
      { id: "quizzes", label: "Quizzes", icon: <FileQuestion />, count: quizCount },
      {
        id: "recorded",
        label: "Recorded Assessments",
        icon: <ClipboardCheck />,
        count: recordedAssessments.loading ? undefined : recordedAssessments.recorded.length,
      },
    ];
    if (isInstructorOrAdmin) {
      list.push({ id: "students", label: "Students", icon: <Users />, count: studentCount });
    }
    if (canViewRanking) {
      list.push({ id: "ranking", label: "Ranking", icon: <Trophy /> });
    }
    if (canViewQuestionBank) {
      list.push({
        id: "question-bank",
        label: "Question Bank",
        icon: <Library />,
        href: `/courses/${courseId}/question-bank`,
      });
    }
    if (canViewReportCards) {
      list.push({ id: "report-cards", label: "Report Cards", icon: <ClipboardList /> });
    }
    return list;
  }, [
    assignmentCount,
    quizCount,
    studentCount,
    recordedAssessments.loading,
    recordedAssessments.recorded.length,
    isInstructorOrAdmin,
    canViewQuestionBank,
    canViewReportCards,
    canViewRanking,
    courseId,
  ]);

  const quickActions = useMemo<CourseTabAction[]>(() => {
    const list: CourseTabAction[] = [
      { id: "report", label: "Subject report", icon: <BarChart3 />, href: `/courses/${courseId}/reports` },
    ];
    if (canCreateQuizzes) {
      list.push({ id: "new-quiz", label: "Create a quiz", icon: <PlusCircle />, href: `/courses/${courseId}/quizzes/create` });
    }
    if (canViewReportCards) {
      list.push({ id: "builder", label: "Report card builder", icon: <ClipboardList />, href: `/grades/subjects/${courseId}` });
    }
    list.push({ id: "back", label: "All courses", icon: <ArrowLeft />, href: "/courses" });
    return list;
  }, [courseId, canCreateQuizzes, canViewReportCards]);

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary-light dark:text-text-secondary-dark/70 font-medium">
            Loading course details...
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="text-center py-12 px-4">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 dark:text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h3 className="mt-2 text-xl font-medium">Course Not Found</h3>
        <p className="mt-1 text-sm text-gray-500">{errorMessage}</p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Courses
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12 px-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Course not found</h3>
        <p className="mt-2 text-sm text-gray-500">
          The course you're looking for doesn't exist.
        </p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Courses
        </Link>
      </div>
    );
  }

  const stats: Array<{
    id: TabId;
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
  }> = [
    { id: "assignments", label: "Assignments", value: assignmentCount, icon: <BookOpen className="h-4 w-4 text-white" />, accent: "bg-blue-500" },
    { id: "quizzes", label: "Quizzes", value: quizCount, icon: <FileText className="h-4 w-4 text-white" />, accent: "bg-purple-500" },
  ];
  if (isInstructorOrAdmin) {
    stats.push({ id: "students", label: "Students", value: studentCount, icon: <Users className="h-4 w-4 text-white" />, accent: "bg-green-500" });
  }

  return (
    <motion.div
      className="space-y-3 md:space-y-5 min-w-0"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="bg-white/90 dark:bg-gray-900/80 dark:text-white backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/60 p-3 sm:p-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-xl sm:text-3xl">
                {course.code.substring(0, 2)}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight text-text-primary-light dark:text-text-primary-dark break-words">
                {course.title}
              </h1>
              <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
                {course.code} • {course.credits} Credits
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Active
                </span>
                {periodLabel && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/5 text-text-secondary-light dark:text-text-secondary-dark/80"
                    title="Change the period from the academic year/term switcher in the top bar"
                  >
                    <CalendarDays className="w-3 h-3" />
                    {periodLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 sm:justify-end flex-shrink-0">
            <Link
              to={`/courses/${courseId}/reports`}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 rounded-full border dark:border-2 border-blue-500 bg-white hover:bg-blue-500 hover:text-white dark:bg-blue-800/20 dark:border-blue-600 dark:hover:bg-blue-700 text-blue-600 dark:text-blue-400 dark:hover:text-white text-sm font-medium transition-all"
              title="View Course Reports"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Report</span>
            </Link>
            <Link
              to="/courses"
              className="flex-1 sm:flex-none text-center inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 border border-gray-300 text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-orange-300 dark:hover:border-blue-700 dark:hover:bg-blue-700 dark:hover:text-white dark:text-orange-300 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back <span className="hidden md:inline">to courses</span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Course Stats — each one opens its tab */}
      <motion.div
        variants={itemVariants}
        className={`grid gap-2 sm:gap-4 ${stats.length === 3 ? "grid-cols-3" : "grid-cols-2"} lg:max-w-4xl`}
      >
        {stats.map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={() => selectTab(stat.id)}
            className={`text-left bg-white/90 backdrop-blur-xl rounded-2xl border dark:bg-gray-900/70 p-2.5 sm:p-3 sm:px-4 transition-colors hover:border-blue-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
              allowedTab === stat.id
                ? "border-blue-400/70 dark:border-blue-500/50"
                : "border-gray-200/80 dark:border-gray-800/70"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-0">
              <div className={`h-8 w-8 flex-shrink-0 ${stat.accent} rounded-xl flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div className="sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark/70 truncate">
                  {stat.label}
                </p>
                <p className="text-xl sm:text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                  {stat.value}
                </p>
              </div>
            </div>
          </button>
        ))}
      </motion.div>

      {/* Tabs */}
      <motion.div
        variants={itemVariants}
        className="bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/70 dark:bg-gray-900/70 min-w-0"
      >
        <CourseTabs
          tabs={tabs}
          activeId={allowedTab}
          onSelect={(id) => selectTab(id as TabId)}
          actions={quickActions}
        />

        <div className="p-2 md:p-4 min-w-0">
          {allowedTab === "overview" && (
            <CourseOverviewPanel
              course={course}
              courseId={courseId!}
              state={recordedAssessments}
              canViewAll={canViewAllMarks}
              canViewReportCards={canViewReportCards}
              periodLabel={periodLabel}
              termName={termName}
              academicYearName={academicYearName}
              onNavigate={selectTab}
            />
          )}

          {allowedTab === "assignments" && (
            <Assignments
              courseId={courseId}
              courseData={course as any}
              showCreateButton={true}
              compact={false}
            />
          )}

          {allowedTab === "quizzes" && (
            <QuizList
              courseId={parseInt(courseId!)}
              showCreateButton={canCreateQuizzes}
              limit={10}
              showViewAllButton={true}
            />
          )}

          {allowedTab === "recorded" && (
            <RecordedAssessmentsPanel
              canViewAll={canViewAllMarks}
              canEdit={canEditMarks}
              state={recordedAssessments}
            />
          )}

          {allowedTab === "students" && (
            <StudentsList students={course.enrolledStudents || []} periodLabel={periodLabel} />
          )}

          {allowedTab === "ranking" && <CourseRankingPanel courseId={courseId!} />}

          {allowedTab === "report-cards" && (
            <CourseReportCardsPanel
              courseId={parseInt(courseId!)}
              courseName={course.title}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const AVATAR_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-sky-600",
];

type SortKey = "name" | "email";

const StudentsList: React.FC<{
  students: any[];
  periodLabel: string | null;
}> = ({ students, periodLabel }) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [showSort, setShowSort] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter((s) => {
        const name = `${s.profile?.first_name || s.user?.first_name || ""} ${s.profile?.last_name || s.user?.last_name || ""}`.toLowerCase();
        const email = (s.user?.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .sort((a, b) => {
        if (sortKey === "name") {
          const na = `${a.profile?.first_name || a.user?.first_name || ""} ${a.profile?.last_name || a.user?.last_name || ""}`;
          const nb = `${b.profile?.first_name || b.user?.first_name || ""} ${b.profile?.last_name || b.user?.last_name || ""}`;
          return na.localeCompare(nb);
        }
        return (a.user?.email || "").localeCompare(b.user?.email || "");
      });
  }, [students, search, sortKey]);

  return (
    <div className="p-1 sm:p-4 space-y-4">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <Users className="w-5 h-5 text-gray-400" />
          <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            Enrolled Students
          </h3>
          <span className="ml-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
            {students.length} active
          </span>
          {periodLabel && (
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
              <CalendarDays className="w-3 h-3" />
              {periodLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 md:contents">

        {/* Search */}
        <div className="relative flex-1 md:flex-none md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text-primary-light dark:text-text-primary-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSort((v) => !v)}
            aria-label={`Sort by ${sortKey}`}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap text-text-secondary-light dark:text-text-secondary-dark bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full hover:border-gray-300 dark:hover:border-gray-600 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Sort:</span> {sortKey === "name" ? "Name" : "Email"}
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden">
              {(["name", "email"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => { setSortKey(key); setShowSort(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors capitalize ${
                    sortKey === key
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                      : "text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Count hint when filtered */}
      {search && (
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
          Showing {filtered.length} of {students.length} students
        </p>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_1fr_auto] items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
            <span className="w-8" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">Name</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60 hidden sm:block">Email</span>
            <span className="w-5" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.map((student, idx) => {
              const id = student.user?.user_id || student.user?.id;
              const firstName = student.profile?.first_name || student.user?.first_name || "";
              const lastName = student.profile?.last_name || student.user?.last_name || "";
              const fullName = `${firstName} ${lastName}`.trim() || "Unknown";
              const email = student.user?.email || "";
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "?";

              return (
                <div
                  key={id}
                  className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_1fr_auto] items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors group"
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                  </div>
                  <Link to={`/students/${id}`} className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {fullName}
                    </p>
                    <p className="text-xs text-gray-400 truncate sm:hidden">{email}</p>
                  </Link>
                  <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 truncate">{email}</span>
                  </div>
                  <Link to={`/students/${id}`}>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark/60">
            {search ? "No students match your search." : "No students enrolled in this course."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseDetails;
