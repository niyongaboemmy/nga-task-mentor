import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import { toast } from "react-toastify";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { fetchCourses } from "../store/slices/courseSlice";
import StudentGradeModal from "../components/Courses/StudentGradeModal";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

interface GradeData {
  course_id: string;
  students: StudentGrade[];
  assignments: AssessmentMeta[];
  quizzes: AssessmentMeta[];
}

interface StudentGrade {
  student: {
    id: number;
    name: string;
    email: string;
    profile_image?: string;
  };
  assignments: AssignmentGrade[];
  quizzes: QuizGrade[];
  summary: {
    total_points_earned: number;
    total_max_points: number;
    total_percentage: number;
    assignment_percentage: number;
    quiz_percentage: number;
  };
}

interface AssignmentGrade {
  assignment_id: number;
  title: string;
  max_score: number;
  submitted: boolean;
  grade: number | null;
  status: string;
}

interface QuizGrade {
  quiz_id: number;
  title: string;
  max_score: number;
  submitted: boolean;
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
}

interface AssessmentMeta {
  id: number;
  title: string;
  max_score: number;
}

const CourseReportsPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const [data, setData] = useState<GradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "passing" | "failing">(
    "all",
  );

  // Student Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentGrade | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Redux: Get Course Info
  const courseState = useSelector((state: RootState) => state.course);
  const currentCourse = courseState?.currentCourse;
  const courses = courseState?.courses || [];

  // Derive course data
  const course = React.useMemo(() => {
    if (currentCourse && String(currentCourse.id) === String(courseId)) {
      return currentCourse;
    }
    return courses.find((c) => String(c.id) === String(courseId)) || null;
  }, [currentCourse, courses, courseId]);

  useEffect(() => {
    // Fetch Course Info if not available
    if (courseId && !course) {
      dispatch(fetchCourses()); // Ensure list is loaded
    }
    fetchGrades();
  }, [courseId, dispatch]);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/courses/${courseId}/grades`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching grades:", error);
      toast.error("Failed to load course grades");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = (student: StudentGrade) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    if (!data) return;

    // Headers
    const headers = [
      "Student Name",
      "Email",
      ...data.assignments.map((a) => `Assignment: ${a.title} (${a.max_score})`),
      ...data.quizzes.map((q) => `Quiz: ${q.title} (${q.max_score})`),
      "Total Points",
      "Total Percentage",
      "Assignments Avg %",
      "Quizzes Avg %",
    ];

    // Rows
    const rows = data.students.map((student) => {
      return [
        student.student.name,
        student.student.email,
        ...data.assignments.map((a) => {
          const grade = student.assignments.find(
            (ag) => ag.assignment_id === a.id,
          );
          return grade?.grade !== null ? grade?.grade : "-";
        }),
        ...data.quizzes.map((q) => {
          const grade = student.quizzes.find((qg) => qg.quiz_id === q.id);
          return grade?.score !== null ? grade?.score : "-";
        }),
        student.summary.total_points_earned,
        `${student.summary.total_percentage}%`,
        `${student.summary.assignment_percentage}%`,
        `${student.summary.quiz_percentage}%`,
      ];
    });

    // Combine and download
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `course_grades_${courseId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter students
  const filteredStudents =
    data?.students.filter((student) => {
      const matchesSearch =
        student.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterType === "all"
          ? true
          : filterType === "passing"
            ? student.summary.total_percentage >= 60 // Assuming 60 is passing
            : student.summary.total_percentage < 60;

      return matchesSearch && matchesFilter;
    }) || [];

  // Calculate Statistics
  const averageGrade =
    data && data.students.length > 0
      ? data.students.reduce((sum, s) => sum + s.summary.total_percentage, 0) /
        data.students.length
      : 0;

  const passingCount =
    data?.students.filter((s) => s.summary.total_percentage >= 60).length || 0;
  const failingCount =
    data?.students.filter((s) => s.summary.total_percentage < 60).length || 0;

  // Chart Data Preparation
  const gradeDistribution = data?.students.reduce(
    (acc, student) => {
      const grade = student.summary.total_percentage;
      if (grade >= 90) acc["90-100"]++;
      else if (grade >= 80) acc["80-89"]++;
      else if (grade >= 70) acc["70-79"]++;
      else if (grade >= 60) acc["60-69"]++;
      else acc["<60"]++;
      return acc;
    },
    { "90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "<60": 0 },
  );

  const barChartData = {
    labels: ["<60%", "60-69%", "70-79%", "80-89%", "90-100%"],
    datasets: [
      {
        label: "Students",
        data: [
          gradeDistribution?.["<60"] || 0,
          gradeDistribution?.["60-69"] || 0,
          gradeDistribution?.["70-79"] || 0,
          gradeDistribution?.["80-89"] || 0,
          gradeDistribution?.["90-100"] || 0,
        ],
        backgroundColor: [
          "rgba(239, 68, 68, 0.5)", // Red
          "rgba(245, 158, 11, 0.5)", // Orange
          "rgba(251, 191, 36, 0.5)", // Yellow
          "rgba(59, 130, 246, 0.5)", // Blue
          "rgba(16, 185, 129, 0.5)", // Green
        ],
        borderColor: [
          "rgb(239, 68, 68)",
          "rgb(245, 158, 11)",
          "rgb(251, 191, 36)",
          "rgb(59, 130, 246)",
          "rgb(16, 185, 129)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const doughnutData = {
    labels: ["Passing", "Failing"],
    datasets: [
      {
        data: [passingCount, failingCount],
        backgroundColor: ["rgba(16, 185, 129, 0.5)", "rgba(239, 68, 68, 0.5)"],
        borderColor: ["rgb(16, 185, 129)", "rgb(239, 68, 68)"],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: false,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          No grade data available
        </h2>
        <Link
          to={`/courses/${courseId}`}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to Course
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Modal */}
      <StudentGradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={selectedStudent}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/courses/${courseId}`}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Back to Course
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-blue-600 font-medium">Reports</span>
          </div>
          <div className="flex items-center gap-3">
            {course && (
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl md:flex items-center justify-center shadow-lg text-white font-bold text-lg hidden">
                {course.code ? course.code.substring(0, 2) : "C"}
              </div>
            )}
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              {course
                ? `${course.title} Reports`
                : "Student Performance Reports"}
            </h1>
          </div>

          <p className="text-gray-500 dark:text-gray-400 mt-1 md:ml-14">
            {course ? `${course.code} • ` : ""} Comprehensive overview of
            student grades.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchGrades}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm flex items-center gap-2"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 font-medium"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Dashboard Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">
            Average Grade
          </h3>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">
            {Math.round(averageGrade)}%
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                averageGrade >= 80
                  ? "bg-green-500"
                  : averageGrade >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${averageGrade}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">
            Passing Students
          </h3>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">
            {passingCount}
          </p>
          <span className="text-green-500 text-sm font-medium">
            {Math.round((passingCount / (data.students.length || 1)) * 100)}% of
            class
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">
            Needs Attention (Failing)
          </h3>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">
            {failingCount}
          </p>
          <span className="text-red-500 text-sm font-medium">
            Students &lt; 60%
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">
            Total Students
          </h3>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">
            {data.students.length}
          </p>
          <span className="text-purple-500 text-sm font-medium">Enrolled</span>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Grade Distribution
          </h3>
          <div className="h-64 flex justify-center">
            <Bar data={barChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Class Performance Ratio
          </h3>
          <div className="h-64 flex justify-center">
            <Doughnut data={doughnutData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6 gap-4">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {["all", "passing", "failing"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === type
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 dark:bg-gray-900"
                >
                  Student
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-40 z-10 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
                >
                  Total Grade
                </th>
                {data.assignments.map((assignment) => (
                  <th
                    key={`h-a-${assignment.id}`}
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]"
                  >
                    <div className="flex flex-col">
                      <span
                        className="font-bold text-gray-700 dark:text-gray-300 truncate max-w-[150px]"
                        title={assignment.title}
                      >
                        {assignment.title}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        (Assign) / {assignment.max_score}
                      </span>
                    </div>
                  </th>
                ))}
                {data.quizzes.map((quiz) => (
                  <th
                    key={`h-q-${quiz.id}`}
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]"
                  >
                    <div className="flex flex-col">
                      <span
                        className="font-bold text-gray-700 dark:text-gray-300 truncate max-w-[150px]"
                        title={quiz.title}
                      >
                        {quiz.title}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        (Quiz) / {quiz.max_score}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStudents.map((student) => (
                <tr
                  key={student.student.id}
                  onClick={() => handleStudentClick(student)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 transition-colors border-r border-transparent">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {student.student.profile_image ? (
                          <img
                            className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                            src={student.student.profile_image}
                            alt=""
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                            {student.student.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {student.student.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {student.student.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center sticky left-40 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 border-r border-gray-200 dark:border-gray-700 transition-colors">
                    <div
                      className={`text-lg font-bold ${
                        student.summary.total_percentage >= 80
                          ? "text-green-600 dark:text-green-400"
                          : student.summary.total_percentage >= 60
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {student.summary.total_percentage}%
                    </div>
                    <div className="text-xs text-gray-400">
                      {student.summary.total_points_earned} /{" "}
                      {student.summary.total_max_points} pts
                    </div>
                  </td>

                  {/* Assignments */}
                  {data.assignments.map((assignment) => {
                    const grade = student.assignments.find(
                      (a) => a.assignment_id === assignment.id,
                    );
                    return (
                      <td
                        key={`g-a-${student.student.id}-${assignment.id}`}
                        className="px-6 py-4 whitespace-nowrap text-center"
                      >
                        {grade?.submitted ? (
                          grade.grade !== null ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {grade.grade}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              Pending
                            </span>
                          )
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xl">
                            -
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Quizzes */}
                  {data.quizzes.map((quiz) => {
                    const grade = student.quizzes.find(
                      (q) => q.quiz_id === quiz.id,
                    );
                    return (
                      <td
                        key={`g-q-${student.student.id}-${quiz.id}`}
                        className="px-6 py-4 whitespace-nowrap text-center"
                      >
                        {grade?.submitted ? (
                          grade.score !== null ? (
                            <div className="flex flex-col items-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                                  grade.passed
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                }`}
                              >
                                {grade.score}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              Pending
                            </span>
                          )
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xl">
                            -
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredStudents.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No students found based on your filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseReportsPage;
