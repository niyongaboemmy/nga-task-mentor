import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { motion } from "framer-motion";
import axios from "../../utils/axiosConfig";
import Assignments from "../Assignments/Assignments";
import { QuizList } from "../Quizzes/QuizList";
import { fetchCourse, fetchCourses } from "../../store/slices/courseSlice";
import type { RootState, AppDispatch } from "../../store";
import type { Course } from "../../types/course.types";
import { Library, Search, Users, Mail, ChevronRight, SlidersHorizontal, ClipboardList } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import CourseReportCardsPanel from "../ReportCard/CourseReportCardsPanel";
import AcademicPeriodPicker, {
  type SelectedPeriod,
} from "../Common/AcademicPeriodPicker";

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

const VALID_TABS = ["overview", "assignments", "quizzes", "students", "report-cards"] as const;
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>(
    () => getStoredTab(courseId || ""),
  );

  const { user: authContext } = useAuth();
  const currentTerm = authContext?.currentAcademicTerm?.name as string | undefined;
  const currentYear = authContext?.currentAcademicYear?.name as string | undefined;
  const { can } = usePermissions();
  const isInstructorOrAdmin = can("COURSES_VIEW_STUDENTS");
  const canCreateQuizzes = can("QUIZZES_CREATE");
  const canViewQuestionBank = can("QUESTION_BANK_VIEW");
  const canViewReportCards = can("REPORT_CARDS_VIEW_ALL");
  const canApproveReportCards = can("REPORT_CARDS_APPROVE");

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

  // Viewing a past academic year/term's roster (Students tab only) — a local,
  // page-scoped override that does NOT touch the Redux `course` (which always
  // reflects the requester's live current-term data used by other tabs).
  const [viewPeriod, setViewPeriod] = useState<SelectedPeriod | null>(null);
  const [historicalStudents, setHistoricalStudents] = useState<any[] | null>(null);
  const [loadingHistoricalStudents, setLoadingHistoricalStudents] = useState(false);

  useEffect(() => {
    if (!viewPeriod || !courseId) {
      setHistoricalStudents(null);
      return;
    }
    let cancelled = false;
    setLoadingHistoricalStudents(true);
    axios
      .get(`/courses/${courseId}`, {
        params: { academicTermId: viewPeriod.academicTermId },
      })
      .then((res) => {
        if (!cancelled) {
          setHistoricalStudents(res.data?.data?.enrolledStudents || []);
        }
      })
      .catch((err) => {
        console.error("Error fetching historical roster:", err);
        if (!cancelled) setHistoricalStudents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistoricalStudents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewPeriod, courseId]);

  const displayedStudents = viewPeriod
    ? historicalStudents ?? []
    : course?.enrolledStudents || [];

  // Stable students array for CourseReportCardsPanel — avoids fetchOverview firing on every render
  const reportCardStudents = useMemo(() => {
    if (!course) return [];
    return (course.enrolledStudents ?? [])
      .map((s: any) => ({
        id: s.user?.id || s.user?.user_id,
        name: `${s.profile?.first_name || s.user?.first_name || ""} ${s.profile?.last_name || s.user?.last_name || ""}`.trim()
          || `Student #${s.user?.id}`,
      }))
      .filter((s: any) => s.id);
  }, [course]);

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

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Loading course details...
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="text-center py-12">
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
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Courses
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Course not found</h3>
        <p className="mt-2 text-sm text-gray-500">
          The course you're looking for doesn't exist.
        </p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-3 md:space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="bg-white/90 dark:bg-gray-900/80 dark:text-white backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/60 p-3 md:p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex gap-3 md:gap-4 w-full">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-3xl">
                  {course.code.substring(0, 2)}
                </span>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between gap-3 w-full">
              <div className="text-sm">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {course.title}
                </h1>
                <p className="text-gray-600 mt-1 dark:text-gray-400">
                  {course.code} • {course.credits} Credits
                </p>
                <p className="pt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Active
                  </span>
                </p>
              </div>
              <div>
                <div className="flex items-center justify-end gap-3">
                  <Link
                    to={`/courses/${courseId}/reports`}
                    className="flex items-center justify-center gap-2 p-1.5 px-4 rounded-full border dark:border-2 border-blue-500 bg-white hover:bg-blue-500 hover:text-white dark:bg-blue-800/20 dark:border-blue-600 dark:hover:bg-blue-700 text-blue-600 dark:text-blue-400 dark:hover:text-white transition-all"
                    title="View Course Reports"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Report</span>
                  </Link>
                  <Link
                    to="/courses"
                    className="text-center inline-flex items-center px-5 py-2 border border-gray-300 text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-orange-300 dark:hover:border-blue-700 dark:hover:bg-blue-700 dark:hover:text-white dark:text-orange-300 transition-all duration-200"
                  >
                    Back <span className="hidden md:block">to courses</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Course Stats */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6"
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-[1.4rem] border border-gray-200/80 dark:border-gray-800/70 dark:bg-gray-900/70 p-2 px-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Assignments
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {course.statistics?.assignments?.total || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-[1.4rem] border border-gray-200/80 dark:border-gray-800/70 dark:bg-gray-900/70 p-2 px-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-purple-500 rounded-xl flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Quizzes
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {course.statistics?.quizzes?.total || 0}
              </p>
            </div>
          </div>
        </div>

        {isInstructorOrAdmin && (
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/70 dark:bg-gray-900/70 p-2 px-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Students
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {course.enrolledStudents?.length || 0}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div
        variants={itemVariants}
        className="bg-white/90 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/70 dark:bg-gray-900/70"
      >
        <div className="border-b border-gray-200 dark:border-gray-800">
          <nav className="-mb-px flex space-x-0 px-8">
            {[
              {
                id: "overview",
                label: "Overview",
                icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                id: "assignments",
                label: `Assignments (${course.statistics?.assignments?.total || 0})`,
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              },
              {
                id: "quizzes",
                label: `Quizzes (${course.statistics?.quizzes?.total || 0})`,
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              },
              {
                id: "students",
                label: `Students (${course.enrolledStudents?.length || 0})`,
                icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
                restricted: true,
              },
            ]
              .filter((tab: any) => {
                if (tab.restricted) {
                  return isInstructorOrAdmin;
                }
                return true;
              })
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    const tabId = tab.id as TabId;
                    setActiveTab(tabId);
                    try {
                      sessionStorage.setItem(`course-tab-${courseId}`, tabId);
                    } catch {}
                  }}
                  className={`${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-500"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={tab.icon}
                    />
                  </svg>
                  {tab.label}
                </button>
              ))}

            {/* Question Bank Link */}
            {canViewQuestionBank && (
              <Link
                to={`/courses/${courseId}/question-bank`}
                className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Library className="h-4 w-4" />
                Question Bank
              </Link>
            )}

            {/* Report Cards tab — requires REPORT_CARDS_VIEW_ALL */}
            {canViewReportCards && (
              <button
                onClick={() => {
                  setActiveTab("report-cards");
                  try { sessionStorage.setItem(`course-tab-${courseId}`, "report-cards"); } catch {}
                }}
                className={`${
                  activeTab === "report-cards"
                    ? "border-violet-500 text-violet-600 dark:text-violet-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
              >
                <ClipboardList className="h-4 w-4" />
                Report Cards
              </button>
            )}
          </nav>
        </div>

        <div className="p-2 md:p-4">
          {activeTab === "overview" && (
            <div className="space-y-8 p-3">
              <div>
                <div className="font-bold mb-2 text-xl">{course.title}</div>
                <div className="text-sm font-light mb-1 opacity-60">
                  {course.description || "No description available."}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                    Course Information
                  </h4>
                  <dl className="space-y-3">
                    <div className="flex gap-2">
                      <dt className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Course Code:
                      </dt>
                      <dd className="text-sm font-semibold">{course.code}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Credits:
                      </dt>
                      <dd className="text-sm font-semibold">
                        {course.credits}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Enrollment:
                      </dt>
                      <dd className="text-sm font-semibold">
                        {course.enrolledStudents?.length || 0} students enrolled
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {activeTab === "assignments" && (
            <Assignments
              courseId={courseId}
              courseData={course as any}
              showCreateButton={true}
              compact={false}
            />
          )}

          {activeTab === "quizzes" && (
            <QuizList
              courseId={parseInt(courseId!)}
              showCreateButton={canCreateQuizzes}
              limit={10}
              showViewAllButton={true}
            />
          )}

          {activeTab === "students" && (
            <div className="space-y-4">
              {isInstructorOrAdmin && (
                <div className="flex items-center justify-end">
                  <AcademicPeriodPicker onChange={setViewPeriod} />
                  {loadingHistoricalStudents && (
                    <span className="ml-3 text-xs text-gray-400">
                      Loading roster…
                    </span>
                  )}
                </div>
              )}
              <StudentsList
                students={displayedStudents}
                courseId={courseId!}
                currentTerm={viewPeriod?.termName ?? currentTerm}
                currentYear={viewPeriod?.yearName ?? currentYear}
                isInstructorOrAdmin={isInstructorOrAdmin}
              />
            </div>
          )}

          {activeTab === "report-cards" && canViewReportCards && (
            <CourseReportCardsPanel
              courseId={parseInt(courseId!)}
              courseName={course.title}
              students={reportCardStudents}
              currentTerm={currentTerm}
              currentYear={currentYear}
              isAdmin={canApproveReportCards}
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
  courseId: string;
  currentTerm?: string;
  currentYear?: string;
  isInstructorOrAdmin: boolean;
}> = ({ students, courseId, currentTerm, currentYear, isInstructorOrAdmin }) => {
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
    <div className="p-4 space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Users className="w-5 h-5 text-gray-400" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Enrolled Students
          </h3>
          <span className="ml-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
            {students.length} active
          </span>
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSort((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Sort: {sortKey === "name" ? "Name" : "Email"}
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
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Count hint when filtered */}
      {search && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Showing {filtered.length} of {students.length} students
        </p>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          {/* Table header */}
          <div className={`grid ${isInstructorOrAdmin ? "grid-cols-[auto_1fr_1fr_auto_auto]" : "grid-cols-[auto_1fr_1fr_auto]"} items-center gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800`}>
            <span className="w-8" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Name</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hidden sm:block">Email</span>
            {isInstructorOrAdmin && (
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hidden sm:block">Report Card</span>
            )}
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

              const builderUrl = `/courses/${courseId}/report-card-builder?studentId=${id}&name=${encodeURIComponent(fullName)}${currentTerm ? `&term=${encodeURIComponent(currentTerm)}` : ""}${currentYear ? `&year=${encodeURIComponent(currentYear)}` : ""}`;

              return (
                <div
                  key={id}
                  className={`grid ${isInstructorOrAdmin ? "grid-cols-[auto_1fr_1fr_auto_auto]" : "grid-cols-[auto_1fr_1fr_auto]"} items-center gap-4 px-4 py-3 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors group`}
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                  </div>
                  <Link to={`/students/${id}`} className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {fullName}
                    </p>
                    <p className="text-xs text-gray-400 truncate sm:hidden">{email}</p>
                  </Link>
                  <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{email}</span>
                  </div>
                  {isInstructorOrAdmin && (
                    <Link
                      to={builderUrl}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-800/50 transition-colors whitespace-nowrap"
                      title="Open Report Card Builder for this student"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Build
                    </Link>
                  )}
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
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
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
