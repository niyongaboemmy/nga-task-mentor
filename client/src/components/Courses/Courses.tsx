import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch, shallowEqual } from "react-redux";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import CourseCard from "./CourseCard";
import type { RootState, AppDispatch } from "../../store";
import { fetchCourses } from "../../store/slices/courseSlice";

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
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 18,
    },
  },
};

const Courses: React.FC = () => {
  const { can } = usePermissions();
  const isCourseManager = can("COURSES_VIEW_STUDENTS");
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [filter, _setFilter] = useState<"all" | "enrolled" | "teaching">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get courses from Redux store with defensive checks
  const { courses, loading, error } = useSelector(
    (state: RootState) => ({
      courses: state.course?.courses || [],
      loading: !!state.course?.loading?.courses,
      error: state.course?.error?.courses || null,
    }),
    shallowEqual,
  );

  useEffect(() => {
    // Prevent infinite retry loop when the initial fetch fails:
    // only attempt to load courses if we have no data yet, we're not
    // currently loading, and there is no recorded error.
    if (courses.length === 0 && !loading && !error) {
      dispatch(fetchCourses());
    }
  }, [courses.length, loading, error, dispatch]);

  // Filter courses based on search query
  const filteredCourses = useMemo(() => {
    if (!Array.isArray(courses)) return [];
    return courses.filter((course) => {
      if (!course) return false;
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      const title = (course.title || "").toLowerCase();
      const code = (course.code || "").toLowerCase();
      const description = (course.description || "").toLowerCase();

      return (
        title.includes(query) ||
        code.includes(query) ||
        description.includes(query)
      );
    });
  }, [courses, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Loading courses...
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-4 md:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/60 px-4 md:px-6 py-4 md:py-5"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center">
              <BookOpen className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                Courses
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                {!isCourseManager
                  ? "Your enrolled courses"
                  : filter === "all"
                    ? "All available courses"
                    : filter === "enrolled"
                      ? "Courses you're enrolled in"
                      : "Courses you're teaching"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {courses.length} course{courses.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mt-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search courses by title, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full font-normal pl-10 pr-3 py-2.5 text-sm rounded-2xl leading-5 bg-gray-50 dark:bg-gray-800/40 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
          />
        </div>
      </motion.div>

      {/* Courses List */}
      <motion.div variants={itemVariants} className="space-y-2 md:space-y-2.5">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12 bg-white/60 dark:bg-gray-900/60 border border-dashed border-gray-300/70 dark:border-gray-700/70 rounded-[1.6rem]">
            <svg
              className="mx-auto h-14 w-14 text-gray-400 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
              {courses.length === 0
                ? "No courses found"
                : "No courses match your search"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {courses.length === 0
                ? !isCourseManager
                  ? "You're not enrolled in any courses yet."
                  : filter === "all"
                    ? "No courses are available yet."
                    : filter === "enrolled"
                      ? "You're not enrolled in any courses yet."
                      : "You're not teaching any courses yet."
                : "Try adjusting your search terms or filters."}
            </p>
          </div>
        ) : (
          filteredCourses.map((course) => (
            <motion.div
              key={course.id}
              variants={itemVariants}
              layout
              className="will-change-transform"
            >
              <CourseCard
                course={course}
                compact={true}
                onClick={() =>
                  navigate(`/courses/${course.id}`, { state: { course } })
                }
              />
            </motion.div>
          ))
        )}
      </motion.div>
    </motion.div>
  );
};

export default React.memo(Courses);
