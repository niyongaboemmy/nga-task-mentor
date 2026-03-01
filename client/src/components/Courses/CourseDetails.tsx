import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { motion } from "framer-motion";
import Assignments from "../Assignments/Assignments";
import { QuizList } from "../Quizzes/QuizList";
import { fetchCourse, fetchCourses } from "../../store/slices/courseSlice";
import type { RootState, AppDispatch } from "../../store";
import type { Course } from "../../types/course.types";
import { Library } from "lucide-react";

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

const CourseDetails: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "assignments" | "quizzes" | "students" | "submissions"
  >("overview");

  // Get auth user for role checking
  const authUser = useSelector((state: RootState) => state.auth.user);

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
                    <div>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
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

        {["instructor", "admin"].includes(authUser?.role || "") && (
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
                  return ["instructor", "admin"].includes(
                    authUser?.role || "student",
                  );
                }
                return true;
              })
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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
            {["instructor", "admin"].includes(authUser?.role || "") && (
              <Link
                to={`/courses/${courseId}/question-bank`}
                className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Library className="h-4 w-4" />
                Question Bank
              </Link>
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
              showCreateButton={["instructor", "admin"].includes(
                authUser?.role || "",
              )}
              limit={10}
              showViewAllButton={true}
            />
          )}

          {activeTab === "students" && (
            <div className="space-y-6 p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-green-500 rounded-full"></span>
                  Enrolled Students
                </h3>
                <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold">
                  {course.enrolledStudents?.length || 0} Active
                </span>
              </div>

              {course.enrolledStudents && course.enrolledStudents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {course.enrolledStudents.map((student) => (
                    <Link
                      key={student.user?.user_id || student.user?.id}
                      to={`/students/${student.user?.user_id || student.user?.id}`}
                      className="flex items-center p-4 bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-blue-500/50 transition-all hover:shadow-lg group"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                          {student.profile?.first_name?.[0] ||
                            student.user?.first_name?.[0] ||
                            "U"}
                        </div>
                      </div>
                      <div className="ml-4 overflow-hidden">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate">
                          {student.profile?.first_name ||
                            student.user?.first_name}{" "}
                          {student.profile?.last_name ||
                            student.user?.last_name}
                        </h4>
                        <p className="text-gray-500 text-xs truncate">
                          {student.user?.email}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-800/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                  <p className="text-gray-500 font-medium mt-4">
                    No students enrolled in this course.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CourseDetails;
