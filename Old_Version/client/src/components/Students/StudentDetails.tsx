import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  profile_image?: string;
  createdAt: string;
}

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  credits: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  max_students: string;
  instructor_id: string;
  createdAt: string;
  updatedAt: string;
  courseInstructor: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface UserCourse {
  id: string;
  user_id: string;
  course_id: string;
  enrollment_date: string;
  completion_date: string;
  status: string;
  grade: string | null;
  createdAt: string;
  updatedAt: string;
  courseInUserCourse: {
    id: string;
    code: string;
    title: string;
    description: string;
    credits: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
    max_students: string;
    instructor_id: string;
    createdAt: string;
    updatedAt: string;
    courseInstructor: {
      id: string;
      first_name: string;
      last_name: string;
    };
  };
}

const StudentDetails: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();

  if (!studentId) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">
          Invalid Student ID
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          No student ID provided in the URL.
        </p>
        <Link
          to="/students"
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Students
        </Link>
      </div>
    );
  }

  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("courses");

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const studentResponse = await axios.get(`/api/users/${studentId}`);
        setStudent(studentResponse.data.data);

        const coursesResponse = await axios.get(
          `/api/users/${studentId}/courses`
        );
        setCourses(coursesResponse.data.data);

        const allCoursesResponse = await axios.get("/api/courses");
        setAvailableCourses(allCoursesResponse.data.data);
      } catch (error) {
        console.error("Error fetching student data:", error);
        alert("Failed to load student data");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [studentId]);

  const filteredAvailableCourses = useMemo(() => {
    const unenrolled = availableCourses.filter(
      (course) =>
        !courses.some(
          (enrolledCourse) => enrolledCourse.courseInUserCourse.id === course.id
        )
    );

    if (!searchTerm) return unenrolled;

    return unenrolled.filter(
      (course) =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${course.courseInstructor.first_name} ${course.courseInstructor.last_name}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
    );
  }, [availableCourses, courses, searchTerm]);

  const unenrolledCourses = useMemo(() => {
    return availableCourses.filter(
      (course) =>
        !courses.some(
          (enrolledCourse) => enrolledCourse.courseInUserCourse.id === course.id
        )
    );
  }, [availableCourses, courses]);

  const handleCourseSelection = (courseId: string) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleAssignCourses = async () => {
    if (selectedCourses.length === 0) return;

    setIsAssigning(true);

    try {
      await Promise.all(
        selectedCourses.map((courseId) =>
          axios.post(`/api/courses/${courseId}/enroll-students`, {
            studentIds: [studentId],
          })
        )
      );

      const coursesResponse = await axios.get(
        `/api/users/${studentId}/courses`
      );
      setCourses(coursesResponse.data.data);

      setSelectedCourses([]);
      setSearchTerm("");

      const notification = document.createElement("div");
      notification.className =
        "fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[100] max-w-md animate-in slide-in-from-right";
      notification.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
          </svg>
          <span class="font-medium">${
            selectedCourses.length === 1
              ? "Course assigned successfully!"
              : `${selectedCourses.length} courses assigned successfully!`
          }</span>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 4000);
    } catch (error) {
      console.error("Error assigning courses:", error);

      const notification = document.createElement("div");
      notification.className =
        "fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-[100] max-w-md";
      notification.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          <span class="font-medium">Failed to assign courses. Please try again.</span>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 5000);
    } finally {
      setIsAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-blue-950/20 rounded-[1.8rem] shadow border-4 border-white/20 dark:border-blue-800/20 p-4 md:p-8">
          <div className="animate-pulse">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-gray-300 dark:bg-gray-700 rounded-2xl"></div>
              </div>
              <div className="flex-1 min-w-0 space-y-4">
                <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="flex gap-4">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Student not found</h3>
        <p className="mt-2 text-sm text-gray-500">
          The student you're looking for doesn't exist.
        </p>
        <Link
          to="/students"
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Students
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-blue-950/20 rounded-3xl shadow border-4 border-white dark:border-blue-800/20 p-6 md:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSIjOTNjNWZkIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9Ii4xIi8+PC9nPjwvc3ZnPg==')] opacity-30"></div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
            <div className="flex-shrink-0">
              <div className="relative">
                {student.profile_image ? (
                  <img
                    src={`${
                      import.meta.env.VITE_API_BASE_URL ||
                      "https://tm.universalbridge.rw"
                    }/uploads/profile-pictures/${student.profile_image}`}
                    alt={`${student.first_name} ${student.last_name}`}
                    className="w-24 h-24 rounded-2xl object-cover shadow-2xl ring-4 ring-white/50 dark:ring-gray-800/50"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-white/50 dark:ring-gray-800/50">
                    <span className="text-white font-bold text-4xl">
                      {student.first_name[0]}
                      {student.last_name[0]}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-400 rounded-full border-4 border-white dark:border-gray-800 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {student.first_name} {student.last_name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="capitalize font-medium">{student.role}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{student.email}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-lg border border-white/20 dark:border-gray-700/50">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {courses.length}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Total Courses
                </div>
              </div>
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-lg border border-white/20 dark:border-gray-700/50">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {courses.filter((c) => c.courseInUserCourse.is_active).length}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Active
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              to="/students"
              className="inline-flex items-center px-6 py-2.5 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full font-medium transition-all duration-200 shadow-md hover:shadow-lg border border-white/20 dark:border-gray-700/50"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span className="text-sm">Back to Students</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl shadow border border-white/20 dark:border-gray-800/50 overflow-hidden">
        <div className="border-b border-gray-200/50 dark:border-gray-700/50">
          <nav className="flex space-x-0 px-6">
            <button
              onClick={() => setActiveTab("courses")}
              className={`${
                activeTab === "courses"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
              } flex items-center gap-2 whitespace-nowrap py-4 px-6 border-b-2 font-semibold text-sm transition-all duration-200`}
            >
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Enrolled Courses
              <span className="ml-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs font-bold">
                {courses.length}
              </span>
            </button>
            {(user?.role === "instructor" || user?.role === "admin") && (
              <button
                onClick={() => setActiveTab("assign")}
                className={`${
                  activeTab === "assign"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                } flex items-center gap-2 whitespace-nowrap py-4 px-6 border-b-2 font-semibold text-sm transition-all duration-200`}
              >
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Assign Courses
                {unenrolledCourses.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-bold">
                    {unenrolledCourses.length}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "courses" && (
            <div className="space-y-4">
              {courses.length > 0 ? (
                courses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.course_id}`}
                    className="group relative block"
                  >
                    <div className="relative bg-white/60 dark:bg-gray-800/20 backdrop-blur-sm rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-300 hover:scale-[1.01]">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-200">
                            <svg
                              className="w-7 h-7 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
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

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                                {course.courseInUserCourse.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                {course.courseInUserCourse.description}
                              </p>
                            </div>
                            <span
                              className={`ml-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                course.courseInUserCourse.is_active
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}
                            >
                              {course.courseInUserCourse.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                />
                              </svg>
                              <span className="font-medium">
                                {course.courseInUserCourse.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span>
                                {course.courseInUserCourse.credits} Credits
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              <span>
                                {
                                  course.courseInUserCourse.courseInstructor
                                    .first_name
                                }{" "}
                                {
                                  course.courseInUserCourse.courseInstructor
                                    .last_name
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <svg
                            className="w-6 h-6 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-10 h-10 text-blue-400 dark:text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    No courses enrolled
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                    This student is not enrolled in any courses yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "assign" &&
            (user?.role === "instructor" || user?.role === "admin") && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-5 border border-blue-200/50 dark:border-blue-800/50 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Available
                        </p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {unenrolledCourses.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-5 border border-green-200/50 dark:border-green-800/50 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500 rounded-xl shadow-lg">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Enrolled
                        </p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {courses.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-5 border border-purple-200/50 dark:border-purple-800/50 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-500 rounded-xl shadow-lg">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                          Selected
                        </p>
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {selectedCourses.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {unenrolledCourses.length === 0 ? (
                  <div className="text-center py-16 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-2xl border border-green-200/50 dark:border-green-800/50">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                      <svg
                        className="w-10 h-10 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      All courses assigned! ✨
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                      {student?.first_name} is already enrolled in all available
                      courses.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Search and Action Bar */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div className="relative flex-1 w-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
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
                          placeholder="Search by course title, code, or instructor..."
                          className="block w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={handleAssignCourses}
                        disabled={selectedCourses.length === 0 || isAssigning}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-normal rounded-full transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center gap-2 whitespace-nowrap"
                      >
                        {isAssigning ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Assigning...</span>
                          </>
                        ) : (
                          <>
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
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                            <span>
                              Assign{" "}
                              {selectedCourses.length > 0
                                ? `(${selectedCourses.length})`
                                : "Courses"}
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Course Selection Grid */}
                    <div>
                      {filteredAvailableCourses.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
                          <svg
                            className="mx-auto h-16 w-16 text-gray-400 mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No courses found
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {searchTerm
                              ? `No courses match "${searchTerm}"`
                              : "No available courses to assign"}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {filteredAvailableCourses.map((course) => (
                            <div
                              key={course.id}
                              onClick={() => handleCourseSelection(course.id)}
                              className={`relative bg-white dark:bg-gray-800/50 rounded-2xl p-5 border-2 transition-all duration-300 cursor-pointer group ${
                                selectedCourses.includes(course.id)
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-xl scale-[1.02] ring-2 ring-blue-500 ring-opacity-50"
                                  : "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:scale-[1.01]"
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0">
                                  <div
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                      selectedCourses.includes(course.id)
                                        ? "bg-blue-500 shadow-lg"
                                        : "bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30"
                                    }`}
                                  >
                                    {selectedCourses.includes(course.id) ? (
                                      <svg
                                        className="w-6 h-6 text-white"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    ) : (
                                      <svg
                                        className={`w-6 h-6 transition-colors ${
                                          selectedCourses.includes(course.id)
                                            ? "text-white"
                                            : "text-gray-400 dark:text-gray-500 group-hover:text-blue-500"
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                        />
                                      </svg>
                                    )}
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1 flex-1 pr-2">
                                      {course.title}
                                    </h4>
                                    <span
                                      className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                        course.is_active
                                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      }`}
                                    >
                                      {course.is_active ? "Active" : "Inactive"}
                                    </span>
                                  </div>

                                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                                    {course.description}
                                  </p>

                                  <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                                      <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                        />
                                      </svg>
                                      <span className="font-medium">
                                        {course.code}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                                      <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                      </svg>
                                      <span>{course.credits} Credits</span>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                      <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                      </svg>
                                      <span className="font-medium">
                                        {course.courseInstructor.first_name}{" "}
                                        {course.courseInstructor.last_name}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {selectedCourses.includes(course.id) && (
                                <div className="absolute top-3 right-3">
                                  <div className="bg-blue-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg animate-in slide-in-from-top duration-200">
                                    Selected
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Courses Summary */}
                    {selectedCourses.length > 0 && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-800/50 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-lg">
                              <svg
                                className="w-5 h-5 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                Ready to Assign
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {selectedCourses.length} course
                                {selectedCourses.length !== 1 ? "s" : ""}{" "}
                                selected for {student?.first_name}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedCourses([])}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
                          >
                            Clear All
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {availableCourses
                            .filter((course) =>
                              selectedCourses.includes(course.id)
                            )
                            .map((course) => (
                              <div
                                key={course.id}
                                className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm"
                              >
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {course.code}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCourseSelection(course.id);
                                  }}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default StudentDetails;
