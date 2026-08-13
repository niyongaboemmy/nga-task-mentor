import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import AssignmentCard, {
  type AssignmentInterface,
} from "../Assignments/AssignmentCard";
import CountdownTimer from "./CountdownTimer";
import {
  AlertTriangle,
  Clock,
  BookOpen,
  Award,
  CheckCircle,
  ListTodo,
  FileText,
  Download,
  Eye,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import ReportCardPreview from "../ReportCard/ReportCardPreview";
import AnnualReportCardPreview from "../ReportCard/AnnualReportCardPreview";
import { ReportCardApiService } from "../../services/reportCardApi";
import {
  StatCard,
  SectionCard,
  PillLink,
  ActivityRow,
  EmptyState,
  dashboardContainerVariants,
  dashboardItemVariants,
  type RecentActivity,
} from "./dashboardUi";

// Interfaces
interface DashboardStats {
  totalCourses: number;
  totalAssignments: number;
  pendingSubmissions: number;
  completedAssignments: number;
  totalEnrolledStudents?: number;
}

interface StudentDashboardData {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    roles?: Array<{ id: number; name: string }>;
  };
  stats: DashboardStats;
  pendingAssignments: AssignmentInterface[];
  recentActivity: RecentActivity[];
  publicQuizzes: any[];
  enrolledCourses: any[];
  availableQuizzes: any[];
}

const StudentDashboard: React.FC<{ data: StudentDashboardData }> = ({ data }) => {
  const { user } = useAuth();

  // ── Report Card state ──
  const [showPreview, setShowPreview] = useState(false);
  const [showAnnual, setShowAnnual] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const currentTerm = user?.currentAcademicTerm?.name as string | undefined;
  const currentAcademicYear = user?.currentAcademicYear?.name as string | undefined;

  const handleDownloadPdf = useCallback(async () => {
    if (!user?.id) return;
    setDownloadingPdf(true);
    try {
      const res = await ReportCardApiService.getStudentReportCard(
        parseInt(String(user.id), 10),
        { term: currentTerm, academic_year: currentAcademicYear },
      );
      if (!res.success) throw new Error("not_found");
      const blob = await ReportCardApiService.generatePdf(res.data.report_card.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ReportCard-${data.user.first_name}_${data.user.last_name}-${res.data.report_card.term}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not generate PDF. Your report card may not be available yet.");
    } finally {
      setDownloadingPdf(false);
    }
  }, [user, currentTerm, currentAcademicYear, data.user]);

  const enrolledCourseIds = React.useMemo(
    () => data.enrolledCourses.map((c) => String(c.id)),
    [data.enrolledCourses],
  );

  const filteredAssignments = React.useMemo(
    () => data.pendingAssignments.filter((a) => enrolledCourseIds.includes(String(a.course_id))),
    [data.pendingAssignments, enrolledCourseIds],
  );

  const filteredQuizzes = React.useMemo(
    () => data.availableQuizzes.filter((q) => enrolledCourseIds.includes(String(q.course_id))),
    [data.availableQuizzes, enrolledCourseIds],
  );

  const getUrgencyLevel = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue <= 24) return "critical";
    if (hoursUntilDue <= 48) return "urgent";
    if (hoursUntilDue <= 72) return "soon";
    return "normal";
  };

  return (
    <motion.div
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={dashboardItemVariants}>
        <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
          Welcome back, {data.user.first_name}!
        </h2>
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          You have {data.stats.pendingSubmissions} assignment{data.stats.pendingSubmissions === 1 ? "" : "s"} due soon.
        </p>
      </motion.div>

      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<Award className="w-6 h-6" />}
            value="View"
            label="Global Report"
            color="purple"
            to="/reports"
          />
          <StatCard
            icon={<BookOpen className="w-6 h-6" />}
            value={(data.stats.totalCourses ?? 0).toLocaleString()}
            label="Active Courses"
            color="blue"
          />
          <StatCard
            icon={<ListTodo className="w-6 h-6" />}
            value={(data.stats.totalAssignments ?? 0).toLocaleString()}
            label="Assignments"
            color="emerald"
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            value={(data.stats.pendingSubmissions ?? 0).toLocaleString()}
            label="Pending"
            color="amber"
          />
        </div>
      )}

      {filteredAssignments && filteredAssignments.length > 0 && (
        <SectionCard
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="amber"
          title="Assignments Due"
          subtitle="Tasks requiring your immediate attention"
          action={<PillLink to="/assignments">View All</PillLink>}
        >
          <div className="space-y-3">
            {filteredAssignments.slice(0, 3).map((assignment, index) => {
              const urgency = getUrgencyLevel(assignment.due_date);
              return (
                <Link
                  key={index + 1}
                  to={`/assignments/${assignment.id}`}
                  className={`block rounded-2xl p-1 border transition-colors ${
                    urgency === "critical"
                      ? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                      : urgency === "urgent"
                        ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30"
                        : "bg-surface-light dark:bg-surface-dark/50 border-border-light dark:border-border-dark/30"
                  }`}
                >
                  <AssignmentCard assignment={assignment} compact={true} showSubmissions={false} />
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}

      {filteredQuizzes && filteredQuizzes.length > 0 && (
        <SectionCard
          icon={<CheckCircle className="w-5 h-5" />}
          iconColor="emerald"
          title="Available Quizzes"
          subtitle="Assessments ready for you to take"
          action={<PillLink to="/courses">Go to Courses</PillLink>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuizzes.slice(0, 3).map((quiz: any, index: number) => {
              const deadline = quiz.deadline || quiz.end_date;
              const isExpired = deadline && new Date(deadline) < new Date();

              return (
                <div
                  key={quiz.id || index}
                  className="flex flex-col justify-between bg-surface-light dark:bg-surface-dark/50 rounded-2xl p-4"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium">
                        Quiz
                      </span>
                      {deadline && (
                        <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <CountdownTimer deadline={deadline} showLabel={false} className="font-mono" />
                        </div>
                      )}
                    </div>

                    <h4 className="font-semibold text-text-primary-light dark:text-text-primary-dark mb-1 line-clamp-2">
                      {quiz.title}
                    </h4>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 line-clamp-2 mb-3">
                      {quiz.course_name || "General Knowledge"}
                    </p>
                  </div>

                  <div className="pt-3 mt-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                      <span>{quiz.totalPoints || 100} pts</span>
                      <span>{quiz.totalQuestions || 10} questions</span>
                    </div>

                    <Link
                      to={`/quizzes/${quiz.id}/take`}
                      className={`w-full py-2.5 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        isExpired
                          ? "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                      onClick={(e) => isExpired && e.preventDefault()}
                    >
                      {isExpired ? "Closed" : "Start Quiz"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {data?.enrolledCourses && data.enrolledCourses.length > 0 && (
        <SectionCard
          icon={<BookOpen className="w-5 h-5" />}
          iconColor="blue"
          title="Course Deadlines"
          subtitle="Upcoming assignments and quiz deadlines"
          action={<PillLink to="/courses">View All</PillLink>}
        >
          <div className="space-y-3">
            {data.enrolledCourses.slice(0, 3).map((course, index) => {
              const nextDeadline = course.next_deadline || course.assignment_deadline || course.quiz_deadline;
              const isExpired = nextDeadline && new Date(nextDeadline) < new Date();
              const isUrgent =
                nextDeadline &&
                !isExpired &&
                new Date(nextDeadline).getTime() - new Date().getTime() < 48 * 60 * 60 * 1000;

              return (
                <Link
                  key={course.id || index}
                  to={`/courses/${course.id}`}
                  className={`block rounded-2xl p-4 border transition-colors ${
                    isExpired
                      ? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                      : isUrgent
                        ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30"
                        : "bg-surface-light dark:bg-surface-dark/50 border-border-light dark:border-border-dark/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs font-medium">
                          {course.code || course.subject}
                        </span>
                        <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                          {course.instructor_name || course.teacher}
                        </span>
                      </div>
                      <h4 className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                        {course.name || course.title}
                      </h4>
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 line-clamp-2 mt-0.5">
                        {course.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                    <span>{course.next_item_type ? `Next: ${course.next_item_type}` : ""}</span>
                    {nextDeadline && (
                      <CountdownTimer
                        deadline={nextDeadline}
                        variant={isExpired ? "expired" : isUrgent ? "urgent" : "default"}
                        showLabel={false}
                        className="text-xs"
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        icon={<Clock className="w-5 h-5" />}
        iconColor="violet"
        title="Recent Activity"
        subtitle="Your latest interactions and progress"
        action={<PillLink to="/assignments">View All</PillLink>}
      >
        {data?.recentActivity && data.recentActivity.length > 0 ? (
          <div className="space-y-1">
            {data.recentActivity.slice(0, 4).map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock className="w-6 h-6 text-text-secondary-light dark:text-text-secondary-dark/60" />}
            title="No recent activity yet"
            description="Activity will appear here as you interact with courses and assignments."
          />
        )}
      </SectionCard>

      <SectionCard
        icon={<FileText className="w-5 h-5" />}
        iconColor="indigo"
        title="My Report Cards"
        subtitle={
          currentTerm && currentAcademicYear ? `${currentTerm} · ${currentAcademicYear}` : "Current academic term"
        }
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10">
            <div className="w-11 h-13 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="font-semibold text-text-primary-light dark:text-text-primary-dark text-sm">
                Academic Report Card
              </p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-0.5">
                {currentTerm ?? "—"} · {currentAcademicYear ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 sm:flex-col">
            <button
              onClick={() => setShowPreview(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              <Eye className="w-4 h-4" />
              View
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloadingPdf ? "Generating…" : "Download PDF"}
            </button>

            {currentAcademicYear && (
              <button
                onClick={() => setShowAnnual(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
              >
                <GraduationCap className="w-4 h-4" />
                Annual Summary
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {showPreview && user?.id && (
        <ReportCardPreview
          studentId={parseInt(String(user.id), 10)}
          studentName={`${data.user.first_name} ${data.user.last_name}`}
          term={currentTerm}
          academicYear={currentAcademicYear}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showAnnual && user?.id && currentAcademicYear && (
        <AnnualReportCardPreview
          isOpen={showAnnual}
          onClose={() => setShowAnnual(false)}
          studentId={parseInt(String(user.id), 10)}
          studentName={`${data.user.first_name} ${data.user.last_name}`}
          academicYear={currentAcademicYear}
          academicYearId={(user?.currentAcademicYear as any)?.academic_year_id}
        />
      )}
    </motion.div>
  );
};

export default StudentDashboard;
