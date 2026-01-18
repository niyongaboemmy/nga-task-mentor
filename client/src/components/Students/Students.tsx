import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
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
  const dispatch = useDispatch<AppDispatch>();
  const { courses } = useSelector(
    (state: RootState) => state.course || { courses: [] },
  );

  const [students, setStudents] = useState<UserSearchInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("last_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch courses for instructors on mount
  useEffect(() => {
    if (user?.role === "instructor" && courses.length === 0) {
      dispatch(fetchCourses());
    }
  }, [user, courses.length, dispatch]);

  // Select first course by default when courses are loaded
  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0].id.toString());
    }
  }, [courses, selectedCourse]);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const params: any = { role: "student" };
        if (searchTerm) {
          params.search = searchTerm;
        }
        if (selectedCourse) {
          params.subjectId = selectedCourse;
          params.termId = 4; // Default term as requested
        }

        const response = await axios.get<{
          success: boolean;
          count: string;
          data: UserSearchInterface[];
        }>("/api/users", { params });
        setStudents(response.data.data);
      } catch (error) {
        console.error("Error fetching students:", error);
        // Don't alert here to avoid spamming 403s before course selection
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [searchTerm, selectedCourse]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-3">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 dark:border-gray-900/50 p-4 px-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage and view all students in the system (
              {filteredAndSortedStudents.length} total)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
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
              className="w-full px-4 py-2.5 pl-10 bg-white/50 border border-gray-200 dark:border-gray-800 dark:bg-gray-900 rounded-xl focus:outline-none text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
            <svg
              className="absolute left-3 top-3 h-5 w-5 text-gray-400"
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
            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200 text-sm rounded-xl focus:outline-none dark:border-gray-800 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="instructor">Instructors</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {/* Course Filter for Instructors */}
        {user?.role === "instructor" && (
          <div className="w-full lg:w-64">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/50 border border-gray-200 text-sm rounded-xl focus:outline-none dark:border-gray-800 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            >
              <option value="">Select Course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Filters */}
        <button
          onClick={resetFilters}
          className="px-4 py-2.5 bg-white dark:bg-gray-900 dark:text-white hover:bg-gray-200 text-gray-700 text-sm rounded-xl transition-colors duration-200"
        >
          Reset
        </button>
      </div>

      {/* Students Table/List */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl shadow border border-white/20 dark:border-gray-900/50 overflow-hidden">
        {paginatedStudents.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {searchTerm || roleFilter !== "all"
                ? "No students found"
                : "No students registered"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || roleFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Students will appear here once they register."}
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-900">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500">
                <div
                  className="col-span-7 cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort("first_name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>First Name</span>
                    {sortField === "first_name" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </div>
                {/* <div
                  className="col-span-4 cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort("last_name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Last Name</span>
                    {sortField === "last_name" && (
                      <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </div> */}
                <div
                  className="col-span-4 cursor-pointer hover:text-gray-700"
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
                  className="col-span-1 cursor-pointer hover:text-gray-700"
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
            <div className="divide-y divide-gray-200 dark:divide-gray-900">
              {paginatedStudents.map((student) => (
                <Link
                  key={student?.user_id || student?.user_id}
                  to={`/students/${student?.user_id || student?.user_id}`}
                  className="block px-6 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-900 transition-colors duration-200 group"
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-7">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 dark:from-blue-600 to-blue-500 dark:to-blue-800 rounded-full flex items-center justify-center">
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
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                            {student?.first_name || student?.first_name}{" "}
                            {student?.last_name || student?.last_name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                            {"Student"}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* <div className="col-span-4">
                      <p className="text-sm text-gray-900 dark:text-gray-500">
                        {student.last_name}
                      </p>
                    </div> */}
                    <div className="col-span-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {student.username}
                      </p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {/* {new Date(student.createdAt).toLocaleDateString()} */}
                        ID: {student?.user_id}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200 dark:bg-gray-900 dark:border-gray-900 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
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
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
