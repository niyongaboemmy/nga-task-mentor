import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "../../contexts/AuthContext";
import CourseCard from "./CourseCard";
import type { RootState, AppDispatch } from "../../store";
import { fetchCourses } from "../../store/slices/courseSlice";

const Courses: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [filter, _setFilter] = useState<"all" | "enrolled" | "teaching">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get courses from Redux store
  // Get courses from Redux store with defensive checks
  const { courses, loading } = useSelector((state: RootState) => ({
    courses: state.course?.courses || [],
    loading: !!state.course?.loading?.courses,
  }));

  useEffect(() => {
    if (courses.length === 0 && !loading) {
      dispatch(fetchCourses());
    }
  }, [courses.length, loading, dispatch]);

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className=" space-y-2 md:space-y-3">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:bg-gray-900 dark:border-gray-800/40 p-3 md:px-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Courses</h1>
              <p className="text-gray-600 text-sm dark:text-gray-500 mt-0.5">
                {user?.role === "student"
                  ? "Your enrolled courses"
                  : filter === "all"
                    ? "All available courses"
                    : filter === "enrolled"
                      ? "Courses you're enrolled in"
                      : "Courses you're teaching"}
              </p>
            </div>

            {(user?.role === "instructor" || user?.role === "admin") && (
              <Link to="/courses/new">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full text-base">
                  Create Course
                </button>
              </Link>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
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
              className="block w-full font-normal pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl leading-5 bg-white/50 dark:bg-gray-800/30 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
      </div>
      {/* Courses List */}
      <div className="space-y-3">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
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
            <h3 className="mt-2 text-lg font-normal">
              {courses.length === 0
                ? "No courses found"
                : "No courses match your search"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {courses.length === 0
                ? user?.role === "student"
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
            <CourseCard
              key={course.id}
              course={course}
              compact={true}
              onClick={() =>
                navigate(`/courses/${course.id}`, { state: { course } })
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

export default React.memo(Courses);
