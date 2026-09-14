import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Mail,
  UserCircle2,
  BookOpen,
  ClipboardList,
  HelpCircle,
  ClipboardCheck,
  UserPlus,
  Search,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Award,
} from "lucide-react";
import api from "../../utils/axiosConfig";
import { CourseApiService } from "../../services/courseApi";
import { usePermissions } from "../../hooks/usePermissions";
import { getProfileImageUrl } from "../../utils/imageUrl";
import type { UserFullData } from "../../types/user.types";
import type { Course } from "../../types/course.types";
import StudentReportCardDashboard from "../ReportCard/StudentReportCardDashboard";

interface UserCourse {
  enrollment_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  subject_description: string | null;
  academic_term_id: string;
  academic_term_name: string;
  academic_year_name: string;
  enrolled_at: string;
}

interface AssignmentSubmission {
  id: number;
  grade: string | null;
  status: string;
  submitted_at: string | null;
}

interface StudentAssignment {
  id: number;
  title: string;
  course_id: number;
  max_score: number;
  due_date: string;
  submissions: AssignmentSubmission[];
  subject: {
    subject_name: string;
    subject_code: string;
  } | null;
}

interface QuizSubmissionRecord {
  id: number;
  total_score: number | string;
  percentage: number | string;
  passed: boolean;
  attempt_number: number;
  completed_at: string;
}

interface StudentQuiz {
  id: number;
  title: string;
  course_id: number;
  passing_score: number | string;
  quizSubmissions: QuizSubmissionRecord[];
  subject: {
    subject_name: string;
    subject_code: string;
  } | null;
}

const TABS = ["overview", "courses", "assignments", "quizzes", "report-cards"] as const;
type TabId = (typeof TABS)[number];

const TAB_META: Record<TabId, { label: string; icon: React.ElementType }> = {
  overview: { label: "Overview", icon: TrendingUp },
  courses: { label: "Enrolled Courses", icon: BookOpen },
  assignments: { label: "Assignments", icon: ClipboardList },
  quizzes: { label: "Quizzes", icon: HelpCircle },
  "report-cards": { label: "Report Cards", icon: ClipboardCheck },
};

const StudentDetails: React.FC = () => {
  // All hooks are called unconditionally, in the same order every render —
  // the "invalid/not-found" states below are plain `if` returns placed
  // *after* every hook, never before (calling hooks behind an early return
  // violates the Rules of Hooks and was a pre-existing bug in this file).
  const { studentId } = useParams<{ studentId: string }>();
  const { can } = usePermissions();
  const canEnroll = can("GRADING_MANUAL_ASSESS");
  const canViewReportCards = can("REPORT_CARDS_VIEW_ALL");

  const [student, setStudent] = useState<UserFullData | null>(null);
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // ── Enroll modal ───────────────────────────────────────────────────────────
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const visibleTabs = TABS.filter((t) => t !== "report-cards" || canViewReportCards);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    const fetchStudentData = async () => {
      try {
        const [studentRes, coursesRes, assignmentsRes, quizzesRes] =
          await Promise.all([
            api.get(`/users/${studentId}`),
            api.get(`/users/${studentId}/courses`),
            api.get(`/users/${studentId}/assignments`),
            api.get(`/users/${studentId}/quizzes`),
          ]);

        setStudent(studentRes.data.data);
        setCourses(coursesRes.data.data);
        setAssignments(assignmentsRes.data.data);
        setQuizzes(quizzesRes.data.data);
      } catch (error) {
        console.error("Error fetching student data:", error);
        toast.error("Failed to load student data.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [studentId]);

  // ── Enroll flow: fetch the full course catalog lazily, only once the
  // enroll modal is actually opened ──────────────────────────────────────────
  const openEnrollModal = useCallback(async () => {
    setEnrollOpen(true);
    if (allCourses.length > 0) return;
    setCatalogLoading(true);
    try {
      const res = await CourseApiService.getCourses();
      setAllCourses(res.data ?? []);
    } catch {
      toast.error("Failed to load the course catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }, [allCourses.length]);

  const availableCourses = useMemo(() => {
    const enrolledIds = new Set(courses.map((c) => String(c.subject_id)));
    const unenrolled = allCourses.filter((c) => !enrolledIds.has(String(c.id)));
    if (!searchTerm.trim()) return unenrolled;
    const q = searchTerm.toLowerCase();
    return unenrolled.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
  }, [allCourses, courses, searchTerm]);

  const handleCourseSelection = (courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const closeEnrollModal = () => {
    setEnrollOpen(false);
    setSelectedCourseIds([]);
    setSearchTerm("");
  };

  const handleAssignCourses = async () => {
    if (selectedCourseIds.length === 0) return;
    setIsAssigning(true);
    try {
      await Promise.all(
        selectedCourseIds.map((courseId) =>
          api.post(`/courses/${courseId}/enroll-students`, {
            studentIds: [studentId],
          }),
        ),
      );

      const coursesResponse = await api.get(`/users/${studentId}/courses`);
      setCourses(coursesResponse.data.data);

      toast.success(
        selectedCourseIds.length === 1
          ? "Course assigned successfully!"
          : `${selectedCourseIds.length} courses assigned successfully!`,
      );
      closeEnrollModal();
    } catch (error) {
      console.error("Error assigning courses:", error);
      toast.error("Failed to assign courses. Please try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  const fullName = `${student?.profile?.first_name ?? student?.user?.first_name ?? ""} ${
    student?.profile?.last_name ?? student?.user?.last_name ?? ""
  }`.trim();

  if (!studentId) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark">
          Invalid Student ID
        </h3>
        <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          No student ID provided in the URL.
        </p>
        <Link
          to="/students"
          className="mt-4 inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Students
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 p-4 md:p-8">
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
        <h3 className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark">Student not found</h3>
        <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          The student you're looking for doesn't exist.
        </p>
        <Link
          to="/students"
          className="mt-4 inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Students
        </Link>
      </div>
    );
  }

  const gradedAssignments = assignments.filter((a) => a.submissions?.[0]?.grade);
  const avgGrade =
    gradedAssignments.length === 0
      ? null
      : Math.round(
          gradedAssignments.reduce((sum, a) => {
            const grade = parseFloat(a.submissions[0].grade!);
            return sum + (grade / a.max_score) * 100;
          }, 0) / gradedAssignments.length,
        );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <div className="flex-shrink-0">
            <div className="relative">
              {student.user?.profile_image ? (
                <img
                  src={getProfileImageUrl(student.user.profile_image) || ""}
                  alt={fullName}
                  className="w-24 h-24 rounded-2xl object-cover shadow-sm ring-2 ring-white dark:ring-gray-800"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-gray-800">
                  <span className="text-white font-bold text-4xl">
                    {(student.profile?.first_name?.[0] || student.user?.first_name?.[0] || "U")}
                    {(student.profile?.last_name?.[0] || student.user?.last_name?.[0] || "")}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 rounded-full border-4 border-white dark:border-gray-800 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl lg:text-4xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
              {fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
              <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full">
                <UserCircle2 className="w-4 h-4" />
                <span className="capitalize font-medium">{student.user?.role || "Student"}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full">
                <Mail className="w-4 h-4" />
                <span>{student.user?.email || "No email provided"}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              {canEnroll && (
                <button
                  onClick={openEnrollModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <UserPlus className="w-4 h-4" /> Enroll in Course
                </button>
              )}
              {canViewReportCards && (
                <button
                  onClick={() => setActiveTab("report-cards")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm font-semibold transition-colors"
                >
                  <Award className="w-4 h-4" /> Report Card
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-sm border border-white/20 dark:border-gray-700/50">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{courses.length}</div>
              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">Courses</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-sm border border-white/20 dark:border-gray-700/50">
              <div className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{assignments.length}</div>
              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">Assignments</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-sm border border-white/20 dark:border-gray-700/50">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{quizzes.length}</div>
              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">Quizzes</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            to="/students"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark rounded-full font-medium transition-all shadow-sm hover:shadow-md border border-white/20 dark:border-gray-700/50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Students</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl shadow border border-white/20 dark:border-gray-800/50 overflow-hidden">
        <div className="border-b border-gray-200/50 dark:border-gray-700/50 overflow-x-auto">
          <nav className="flex space-x-0 px-4">
            {visibleTabs.map((tabId) => {
              const meta = TAB_META[tabId];
              const Icon = meta.icon;
              const count =
                tabId === "courses" ? courses.length
                : tabId === "assignments" ? assignments.length
                : tabId === "quizzes" ? quizzes.length
                : null;
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`${
                    activeTab === tabId
                      ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
                      : "border-transparent text-text-secondary-light dark:text-text-secondary-dark/70 hover:text-text-primary-light dark:hover:text-text-primary-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                  } flex items-center gap-2 whitespace-nowrap py-4 px-5 border-b-2 font-semibold text-sm transition-all duration-200`}
                >
                  <Icon className="w-4 h-4" />
                  {meta.label}
                  {count != null && (
                    <span className="ml-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs font-bold">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-xl">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Total Courses</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{courses.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800/40 rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gray-600 rounded-xl">
                      <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Assignments</p>
                      <p className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
                        {assignments.filter((a) => a.submissions?.[0]).length}/{assignments.length}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-700 rounded-xl">
                      <HelpCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Quiz Pass Rate</p>
                      <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                        {quizzes.filter((q) => q.quizSubmissions?.[0]?.passed).length}/
                        {quizzes.filter((q) => q.quizSubmissions?.[0]).length || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-5 border border-orange-200/50 dark:border-orange-800/50">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-500 rounded-xl">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Avg Grade</p>
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {avgGrade == null ? "N/A" : `${avgGrade}%`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-gray-800/20 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50">
                  <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">Course Performance</h3>
                </div>
                <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                  {courses.length === 0 ? (
                    <p className="p-5 text-sm text-text-secondary-light dark:text-text-secondary-dark/60">
                      Not enrolled in any courses yet.
                    </p>
                  ) : (
                    courses.map((course) => {
                      const courseAssignments = assignments.filter((a) => a.subject?.subject_code === course.subject_code);
                      const courseQuizzes = quizzes.filter((q) => q.subject?.subject_code === course.subject_code);
                      const submittedAssignments = courseAssignments.filter((a) => a.submissions?.[0]);
                      const attemptedQuizzes = courseQuizzes.filter((q) => q.quizSubmissions?.[0]);

                      return (
                        <div key={course.subject_id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                                {course.subject_name}
                              </h4>
                              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">{course.subject_code}</p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-center">
                                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">Assignments</p>
                                <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                  {submittedAssignments.length}/{courseAssignments.length}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">Quizzes</p>
                                <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                  {attemptedQuizzes.length}/{courseQuizzes.length}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Courses */}
          {activeTab === "courses" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {courses.length > 0 ? (
                courses.map((course) => (
                  <Link key={course.enrollment_id} to={`/courses/${course.subject_id}`} className="group relative block">
                    <div className="relative bg-white/60 dark:bg-gray-800/20 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-300">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {course.subject_name}
                              </h3>
                              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5 line-clamp-2">
                                {course.subject_description}
                              </p>
                            </div>
                            <span className="ml-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              Active
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                            <span className="font-medium">{course.subject_code}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full text-center py-16">
                  <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-10 h-10 text-blue-400 dark:text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">No courses enrolled</h3>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-sm mx-auto">
                    This student is not enrolled in any courses yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Assignments */}
          {activeTab === "assignments" && (
            <div className="space-y-4">
              {assignments.length > 0 ? (
                <div className="bg-white/60 dark:bg-gray-800/20 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  {assignments.map((assignment, index) => {
                    const submission = assignment.submissions?.[0];
                    return (
                      <div
                        key={assignment.id}
                        className={`flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                          index !== assignments.length - 1 ? "border-b border-gray-200/50 dark:border-gray-700/50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${submission ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                            <ClipboardList className={`w-4 h-4 ${submission ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{assignment.title}</h4>
                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 truncate">
                              {assignment.subject?.subject_name || "Unknown Course"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-base font-bold ${submission ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>
                            {submission ? (submission.grade ? parseFloat(submission.grade).toFixed(1) : "Grading…") : "—"}
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-0.5">/ {assignment.max_score}</span>
                          </div>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                            {submission ? new Date(submission.submitted_at!).toLocaleDateString() : "Not submitted"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">No assignments found</h3>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                    No assignments are available for the enrolled courses.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quizzes */}
          {activeTab === "quizzes" && (
            <div className="space-y-4">
              {quizzes.length > 0 ? (
                <div className="bg-white/60 dark:bg-gray-800/20 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  {quizzes.map((quiz, index) => {
                    const submission = quiz.quizSubmissions?.[0];
                    return (
                      <div
                        key={quiz.id}
                        className={`flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                          index !== quizzes.length - 1 ? "border-b border-gray-200/50 dark:border-gray-700/50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${submission ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                            <HelpCircle className={`w-4 h-4 ${submission ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{quiz.title}</h4>
                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 truncate">
                              {quiz.subject?.subject_name || "Unknown Course"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className={`text-sm font-bold ${
                            submission ? (submission.passed ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400") : "text-gray-400 dark:text-gray-500"
                          }`}>
                            {submission ? `${parseFloat(String(submission.percentage)).toFixed(1)}%` : "0%"}
                          </div>
                          {submission ? (
                            <>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                submission.passed
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              }`}>
                                {submission.passed ? "Passed" : "Failed"}
                              </span>
                              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                                Attempt {submission.attempt_number}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Not attempted
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <HelpCircle className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">No quizzes found</h3>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                    No quizzes are available for the enrolled courses.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Report Cards */}
          {activeTab === "report-cards" && canViewReportCards && (
            <StudentReportCardDashboard
              studentId={parseInt(studentId, 10)}
              studentName={fullName || `Student #${studentId}`}
            />
          )}
        </div>
      </div>

      {/* Enroll modal */}
      {enrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={closeEnrollModal} />

          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-white/20 dark:border-gray-700/40 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-light dark:border-gray-700/40 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Enroll in Course</h2>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-0.5">
                  Assign {fullName || "this student"} to one or more courses.
                </p>
              </div>
              <button
                onClick={closeEnrollModal}
                className="p-1.5 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-border-light dark:border-gray-700/40 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by course title, code, or description…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                </div>
              ) : availableCourses.length === 0 ? (
                <div className="text-center py-14">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
                  <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">No courses found</h3>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                    {searchTerm ? `No courses match "${searchTerm}"` : "No available courses to assign — the student may already be enrolled in everything."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableCourses.map((course) => {
                    const selected = selectedCourseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => handleCourseSelection(course.id)}
                        className={`text-left relative rounded-2xl p-4 border-2 transition-all ${
                          selected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30"
                            : "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selected ? "bg-blue-600" : "bg-gray-100 dark:bg-gray-700"}`}>
                            {selected ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <BookOpen className="w-5 h-5 text-text-secondary-light dark:text-text-secondary-dark/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-1">{course.title}</h4>
                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark line-clamp-2 mt-0.5">{course.description}</p>
                            <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark">
                              {course.code}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border-light dark:border-gray-700/40 bg-surface-light/60 dark:bg-gray-950/40 flex-shrink-0">
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {selectedCourseIds.length} course{selectedCourseIds.length !== 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEnrollModal}
                  className="px-5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignCourses}
                  disabled={selectedCourseIds.length === 0 || isAssigning}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isAssigning ? "Assigning…" : `Assign${selectedCourseIds.length > 0 ? ` (${selectedCourseIds.length})` : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetails;
