import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import { toast } from "react-toastify";
import { Bar, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";
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
import {
  BarChart3,
  Download,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle2,
  Award,
  Zap,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
    },
  },
};

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
  const authUser = useSelector((state: RootState) => state.auth.user);
  const isStudent = authUser?.role === "student";

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
      const response = await axios.get(`/courses/${courseId}/grades`);
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
    filteredStudents && filteredStudents.length > 0
      ? filteredStudents.reduce(
          (sum, s) => sum + (s.summary?.total_percentage || 0),
          0,
        ) / filteredStudents.length
      : 0;

  const passingCount =
    filteredStudents.filter((s) => (s.summary?.total_percentage || 0) >= 60)
      .length || 0;
  const failingCount =
    filteredStudents.filter((s) => (s.summary?.total_percentage || 0) < 60)
      .length || 0;

  // Chart Data Preparation
  const gradeDistribution = filteredStudents.reduce(
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
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900/50 rounded-3xl">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
    <motion.div
      className="min-h-screen"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Modal */}
      <StudentGradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={selectedStudent}
      />

      {/* Header */}
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6"
      >
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link
              to={`/courses/${courseId}`}
              className="group flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-gray-800/30 rounded-full border border-gray-200/50 dark:border-gray-700/50 text-sm font-bold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-all hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Course</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 transform rotate-3">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">
                {course ? `${course.title}` : "Course Reports"}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium flex items-center gap-2">
                {course ? (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-black uppercase tracking-wider">
                    {course.code}
                  </span>
                ) : (
                  ""
                )}
                <span>
                  {isStudent
                    ? "Academic Performance Dashboard"
                    : "Student Performance Analytics"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {!isStudent && (
          <div className="flex gap-3">
            <button
              onClick={fetchGrades}
              className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2 font-black text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Data</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-6 py-3 bg-blue-600 text-white rounded-3xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 font-black text-xs uppercase tracking-wider hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        )}
      </motion.div>

      {isStudent && data.students.length > 0 ? (
        // STUDENT VIEW
        (() => {
          const student = data.students[0];
          return (
            <motion.div className="space-y-6" variants={containerVariants}>
              {/* Student Summary Cards */}
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <motion.div
                  variants={itemVariants}
                  className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors duration-700" />

                  <div className="relative z-10">
                    <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                      <Award className="w-4 h-4" />
                      Total Grade
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-5xl font-black text-gray-900 dark:text-white tabular-nums">
                        {student.summary.total_percentage}%
                      </p>
                    </div>

                    <div className="mt-6 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          student.summary.total_percentage >= 80
                            ? "bg-green-500"
                            : student.summary.total_percentage >= 60
                              ? "bg-blue-500"
                              : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            student.summary.total_percentage,
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div className="relative z-10">
                    <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4" />
                      Points Earned
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-black text-gray-900 dark:text-white tabular-nums">
                        {student.summary.total_points_earned}
                      </p>
                      <span className="text-xl font-bold text-gray-400 dark:text-gray-600 uppercase tracking-tighter">
                        / {student.summary.total_max_points}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-400 mt-4 leading-relaxed">
                      You have accummulated{" "}
                      <span className="text-gray-900 dark:text-white font-bold">
                        {student.summary.total_points_earned} points
                      </span>{" "}
                      across all assignments and quizzes.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden"
                >
                  <div
                    className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-16 -mt-16 ${student.summary.total_percentage >= 60 ? "bg-green-500/5" : "bg-red-500/5"}`}
                  />
                  <div className="relative z-10">
                    <p
                      className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-4 ${student.summary.total_percentage >= 60 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {student.summary.total_percentage >= 60 ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      Current Status
                    </p>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider ${
                          student.summary.total_percentage >= 60
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {student.summary.total_percentage >= 60
                          ? "PASSING"
                          : "FAILING"}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-400 mt-4 leading-relaxed">
                      {student.summary.total_percentage >= 60
                        ? "Great job! Keep maintaining your performance."
                        : "Grade is below passing threshold. Review pending tasks."}
                    </p>
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Assignments Section */}
                {/* Assignments Section */}
                <motion.div
                  variants={itemVariants}
                  className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden"
                >
                  <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/30 dark:bg-black/20 backdrop-blur-sm">
                    <h3 className="font-black text-xl flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                      <span className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/10">
                        <BarChart3 className="w-5 h-5" />
                      </span>
                      Assignments
                    </h3>
                    <span className="text-xs font-black uppercase tracking-widest bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-4 py-1.5 rounded-xl">
                      Avg: {student.summary.assignment_percentage}%
                    </span>
                  </div>
                  <div className="p-6 space-y-4">
                    {student.assignments.length > 0 ? (
                      student.assignments.map((assignment) => (
                        <div
                          key={assignment.assignment_id}
                          className="flex items-center justify-between p-5 bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group"
                        >
                          <div className="flex-1 min-w-0 pr-6">
                            <p className="font-bold text-gray-900 dark:text-white truncate text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {assignment.title}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Max Score: {assignment.max_score}
                              </span>
                              {!assignment.submitted && (
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
                                  Missing
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {assignment.submitted ? (
                              assignment.grade !== null ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                                    {assignment.grade}
                                  </span>
                                  {assignment.max_score && (
                                    <div className="w-16 h-1 mt-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{
                                          width: `${(Number(assignment.grade) / Number(assignment.max_score)) * 100}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-xl">
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className="text-2xl font-black text-gray-200 dark:text-gray-700">
                                -
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300">
                          <BarChart3 className="w-8 h-8" />
                        </div>
                        <p className="text-gray-500 font-medium">
                          No assignments found.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Quizzes Section */}
                <motion.div
                  variants={itemVariants}
                  className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden"
                >
                  <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/30 dark:bg-black/20 backdrop-blur-sm">
                    <h3 className="font-black text-xl flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                      <span className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-lg shadow-purple-500/10">
                        <Zap className="w-5 h-5" />
                      </span>
                      Quizzes
                    </h3>
                    <span className="text-xs font-black uppercase tracking-widest bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-4 py-1.5 rounded-xl">
                      Avg: {student.summary.quiz_percentage}%
                    </span>
                  </div>
                  <motion.div variants={itemVariants} className="p-6 space-y-4">
                    {student.quizzes.length > 0 ? (
                      student.quizzes.map((quiz) => (
                        <div
                          key={quiz.quiz_id}
                          className="flex items-center justify-between p-5 bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group"
                        >
                          <div className="flex-1 min-w-0 pr-6">
                            <p className="font-bold text-gray-900 dark:text-white truncate text-base group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {quiz.title}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Max: {quiz.max_score}
                              </span>
                              {quiz.submitted && (
                                <span
                                  className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                    quiz.passed
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                  }`}
                                >
                                  {quiz.passed ? "PASSED" : "FAILED"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {quiz.submitted ? (
                              quiz.score !== null ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                                    {quiz.score}
                                  </span>
                                  <span className="text-[10px] font-bold text-gray-400">
                                    {quiz.percentage}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-xl">
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className="text-2xl font-black text-gray-200 dark:text-gray-700">
                                -
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300">
                          <Zap className="w-8 h-8" />
                        </div>
                        <p className="text-gray-500 font-medium">
                          No quizzes found.
                        </p>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>
          );
        })()
      ) : isStudent ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
          <p className="text-gray-500">No grade data available yet.</p>
        </div>
      ) : (
        <>
          {/* Dashboard Statistics Cards */}
          {/* Dashboard Statistics Cards */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
          >
            <motion.div
              variants={itemVariants}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500"></div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Average Grade
              </p>
              <p className="text-5xl font-black text-gray-900 dark:text-white mb-4">
                {Math.round(averageGrade)}
                <span className="text-2xl text-gray-400">%</span>
              </p>
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
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
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500"></div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Passing
              </p>
              <p className="text-5xl font-black text-gray-900 dark:text-white mb-2">
                {passingCount}
              </p>
              <span className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-black uppercase tracking-wider">
                {Math.round((passingCount / (data.students.length || 1)) * 100)}
                % of class
              </span>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500"></div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Needs Attention
              </p>
              <p className="text-5xl font-black text-gray-900 dark:text-white mb-2">
                {failingCount}
              </p>
              <span className="inline-flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-black uppercase tracking-wider">
                Student{failingCount !== 1 ? "s" : ""} &lt; 60%
              </span>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500"></div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                Total Students
              </p>
              <p className="text-5xl font-black text-gray-900 dark:text-white mb-2">
                {data.students.length}
              </p>
              <span className="inline-flex items-center px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-black uppercase tracking-wider">
                Currently Enrolled
              </span>
            </motion.div>
          </motion.div>

          {/* Analytics Section */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10"
          >
            <motion.div
              variants={itemVariants}
              className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none"
            >
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Grade Distribution
              </h3>
              <div className="h-64 flex justify-center">
                <Bar data={barChartData} options={chartOptions} />
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none"
            >
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" />
                Performance Ratio
              </h3>
              <div className="h-64 flex justify-center">
                <Doughnut data={doughnutData} options={chartOptions} />
              </div>
            </motion.div>
          </motion.div>

          {/* Filters & Controls */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none mb-8 gap-4"
          >
            <div className="relative w-full md:w-96 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-2xl leading-5 bg-gray-50 dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 sm:text-sm font-medium transition-all duration-300 ease-in-out shadow-sm"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-3xl">
              {["all", "passing", "failing"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type as any)}
                  className={`px-6 py-2 rounded-[1.5rem] text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                    filterType === type
                      ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md shadow-gray-200/50 dark:shadow-black/30 transform scale-105"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Data Table */}
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
                  <tr>
                    <th
                      scope="col"
                      className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] sticky left-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800"
                    >
                      Student
                    </th>
                    <th
                      scope="col"
                      className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] sticky left-[120px] md:left-[240px] z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 border-b shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)]"
                    >
                      Total Grade
                    </th>
                    {data.assignments.map((assignment) => (
                      <th
                        key={`h-a-${assignment.id}`}
                        scope="col"
                        className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[140px] border-b border-gray-100 dark:border-gray-800"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]"
                            title={assignment.title}
                          >
                            {assignment.title}
                          </span>
                          <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            Assign / {assignment.max_score}
                          </span>
                        </div>
                      </th>
                    ))}
                    {data.quizzes.map((quiz) => (
                      <th
                        key={`h-q-${quiz.id}`}
                        scope="col"
                        className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[140px] border-b border-gray-100 dark:border-gray-800"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]"
                            title={quiz.title}
                          >
                            {quiz.title}
                          </span>
                          <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            Quiz / {quiz.max_score}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-50 dark:divide-gray-800/50">
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.student.id}
                      onClick={() => handleStudentClick(student)}
                      className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group"
                    >
                      <td className="px-8 py-5 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 transition-colors">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 transition-transform group-hover:scale-110 duration-300">
                            {student.student.profile_image ? (
                              <img
                                className="h-10 w-10 rounded-2xl object-cover shadow-sm ring-2 ring-white dark:ring-gray-700"
                                src={student.student.profile_image}
                                alt=""
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20 text-sm">
                                {student.student.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {student.student.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              {student.student.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-center sticky left-[120px] md:left-[240px] z-10 bg-white dark:bg-gray-800 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 transition-colors border-r border-gray-100 dark:border-gray-800 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)]">
                        <div
                          className={`text-xl font-black ${
                            student.summary.total_percentage >= 80
                              ? "text-green-500"
                              : student.summary.total_percentage >= 60
                                ? "text-yellow-500"
                                : "text-red-500"
                          }`}
                        >
                          {student.summary.total_percentage}%
                        </div>
                        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mt-1">
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
                            className="px-6 py-5 whitespace-nowrap text-center"
                          >
                            {grade?.submitted ? (
                              grade.grade !== null ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 group-hover:bg-white dark:group-hover:bg-gray-600 group-hover:shadow-sm transition-all">
                                  {grade.grade}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400">
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className="text-gray-200 dark:text-gray-700 font-black text-lg">
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
                            className="px-6 py-5 whitespace-nowrap text-center"
                          >
                            {grade?.submitted ? (
                              grade.score !== null ? (
                                <div className="flex flex-col items-center">
                                  <span
                                    className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold ${
                                      grade.passed
                                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30"
                                        : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/30"
                                    } transition-colors`}
                                  >
                                    {grade.score}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400">
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className="text-gray-200 dark:text-gray-700 font-black text-lg">
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
              <div className="p-12 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300">
                  <Search className="w-8 h-8" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  No students found based on your filters.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default CourseReportsPage;
