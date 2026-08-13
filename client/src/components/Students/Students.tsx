import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { fetchCourses } from "../../store/slices/courseSlice";

type SortField = "first_name" | "last_name" | "email" | "createdAt";
type SortDirection = "asc" | "desc";

interface UserSearchInterface {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  gender: string;
  class_group_name: string;
  grade_name: string;
  program_name: string;
  enrolled_at: string;
}

const Students: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  // Instructors (who see USERS_VIEW_ALL but not the admin-only USERS_CREATE)
  // must pick which of their own courses to scope the roster to; admins
  // browse across all courses without needing to pick one.
  const isInstructorLike = can("USERS_VIEW_ALL") && !can("USERS_CREATE");
  const dispatch = useDispatch<AppDispatch>();
  const { courses } = useSelector(
    (state: RootState) => state.course || { courses: [] },
  );

  const [students, setStudents] = useState<UserSearchInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("last_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch courses for instructors on mount (only if not already loaded)
  useEffect(() => {
    if (isInstructorLike && courses.length === 0) {
      setCoursesLoading(true);
      dispatch(fetchCourses()).finally(() => setCoursesLoading(false));
    }
  }, [isInstructorLike, courses.length, dispatch]);

  // Select first course by default when courses are loaded
  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0].id.toString());
    }
  }, [courses, selectedCourse]);

  // Fetch students when selectedCourse or searchTerm changes
  useEffect(() => {
    // Don't fetch if no course selected (except for non-instructors)
    if (isInstructorLike && !selectedCourse) {
      return;
    }

    const fetchStudents = async () => {
      setLoading(true);
      try {
        const params: any = { role: "student" };
        if (searchTerm) {
          params.search = searchTerm;
        }
        if (selectedCourse) {
          params.subjectId = selectedCourse;
          params.termId = user?.currentAcademicTerm?.academic_term_id || 4;
        }

        const response = await axios.get<{
          success: boolean;
          count: string;
          data: UserSearchInterface[];
        }>("/users", { params });
        setStudents(response.data.data);
      } catch (error) {
        console.error("Error fetching students:", error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [searchTerm, selectedCourse, user]);

  // Filter and sort students
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = students.filter((student) => {
      const firstName = student?.first_name || student?.first_name || "";
      const lastName = student?.last_name || student?.last_name || "";
      const email = student?.username || "";

      const matchesSearch =
        `${firstName} ${lastName}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    // Sort students
    filtered.sort((studentA, studentB) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === "createdAt") {
        aValue = studentA.user_id || studentA.user_id || 0;
        bValue = studentB.user_id || studentB.user_id || 0;
      } else {
        const getFieldValue = (s: UserSearchInterface, field: string) => {
          if (field === "first_name" || field === "last_name") {
            return s?.[field] || "";
          }
          return "";
        };
        aValue =
          (getFieldValue(studentA, sortField) as string)?.toLowerCase() || "";
        bValue =
          (getFieldValue(studentB, sortField) as string)?.toLowerCase() || "";
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [students, searchTerm, sortField, sortDirection, roleFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStudents = filteredAndSortedStudents.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setSortField("createdAt");
    setSortDirection("desc");
    setCurrentPage(1);
  };

  // Show loading indicator while fetching courses or students
  if (loading || coursesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 py-4 px-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Students Enrolled
            </h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mt-1 text-sm">
              Manage and view all students enrolled in the system (
              {filteredAndSortedStudents.length} total)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {filteredAndSortedStudents.length} of {students.length} students
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 bg-surface-light dark:bg-surface-dark/50 border border-transparent rounded-xl focus:outline-none text-sm text-text-primary-light dark:text-text-primary-dark focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
            <svg
              className="absolute left-3 top-3 h-5 w-5 text-text-secondary-light dark:text-text-secondary-dark/60"
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
        </div>

        {/* Role Filter */}
        <div className="w-full lg:w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-light dark:bg-surface-dark/50 border border-transparent text-sm rounded-xl focus:outline-none text-text-primary-light dark:text-text-primary-dark focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="instructor">Instructors</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {/* Course Filter for Instructors */}
        {isInstructorLike && (
          <div className="w-full lg:w-64">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-light dark:bg-surface-dark/50 border border-transparent text-sm rounded-xl focus:outline-none text-text-primary-light dark:text-text-primary-dark focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            >
              <option value="">Select Course...</option>
              {courses.map((course, c) => (
                <option key={c + 1} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Filters */}
        <button
          onClick={resetFilters}
          className="px-4 py-2.5 bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-gray-200 dark:hover:bg-gray-700 text-sm rounded-xl transition-colors duration-200"
        >
          Reset
        </button>
      </div>

      {/* Students Table/List */}
      <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-text-secondary-light dark:text-text-secondary-dark/50"
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
            <h3 className="mt-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {searchTerm || roleFilter !== "all"
                ? "No students found"
                : "No students registered"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              {searchTerm || roleFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Students will appear here once they register."}
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="px-6 py-4 bg-surface-light dark:bg-surface-dark/50 border-b border-border-light dark:border-border-dark/30">
              <div className="hidden sm:grid grid-cols-12 gap-4 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                <div
                  className="col-span-7 cursor-pointer transition-colors hover:text-text-primary-light dark:hover:text-text-primary-dark"
                  onClick={() => handleSort("first_name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>First Name</span>
                    {sortField === "first_name" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </div>
                <div
                  className="col-span-4 cursor-pointer transition-colors hover:text-text-primary-light dark:hover:text-text-primary-dark"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Email</span>
                    {sortField === "email" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </div>
                <div
                  className="col-span-1 cursor-pointer transition-colors hover:text-text-primary-light dark:hover:text-text-primary-dark"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Joined</span>
                    {sortField === "createdAt" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Student List */}
            <div className="divide-y divide-border-light dark:divide-border-dark/30">
              {paginatedStudents.map((student, s) => (
                <Link
                  key={s + 1}
                  to={`/students/${student?.user_id || student?.user_id}`}
                  className="block px-6 py-3 hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors duration-200 group"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 sm:items-center">
                    <div className="sm:col-span-7">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {student?.first_name?.[0] ||
                                student?.first_name?.[0] ||
                                "U"}
                              {student?.last_name?.[0] ||
                                student?.last_name?.[0] ||
                                ""}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {student?.first_name || student?.first_name}{" "}
                            {student?.last_name || student?.last_name}
                          </h3>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 capitalize">
                            {"Student"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-4 pl-11 sm:pl-0">
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate">
                        {student.username}
                      </p>
                    </div>
                    <div className="sm:col-span-1 pl-11 sm:pl-0">
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                        ID: {student?.user_id}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-surface-light dark:bg-surface-dark/50 border-t border-border-light dark:border-border-dark/30 flex items-center justify-between">
                <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(
                    startIndex + itemsPerPage,
                    filteredAndSortedStudents.length,
                  )}{" "}
                  of {filteredAndSortedStudents.length} results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark/50 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark/50 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Students;
