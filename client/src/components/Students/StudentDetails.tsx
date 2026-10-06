import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileBadge,
  HelpCircle,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import api from "../../utils/axiosConfig";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../contexts/AuthContext";
import type { UserFullData } from "../../types/user.types";
import StudentReportCardDashboard from "../ReportCard/StudentReportCardDashboard";
import CourseTabs, { type CourseTabItem } from "../Courses/CourseTabs";
import {
  fetchStudentRecordedAssessments,
  summariseMarks,
  type RecordedSubject,
} from "../../services/studentProfileApi";
import {
  buildActivity,
  toMarkInputs,
  type ActivityItem,
  type ActivityKind,
  type RawStudentAssignment,
  type RawStudentQuiz,
} from "../../services/studentActivity";
import {
  computeStanding,
  fetchStudentStanding,
  subjectStandings,
  type StandingKindFilter,
  type StandingPayload,
} from "../../services/studentStandingApi";
import { attentionByKind, buildInsights, type Insight } from "../../services/studentInsights";
import StudentProfileHeader from "./profile/StudentProfileHeader";
import StudentOverviewPanel from "./profile/StudentOverviewPanel";
import StudentCoursesList from "./profile/StudentCoursesList";
import StudentActivityPanel, { type ActivityFilter } from "./profile/StudentActivityPanel";
import EnrollCoursesModal from "./profile/EnrollCoursesModal";
import type { ProfileSubject } from "./profile/profileTheme";

// ─── /students/:misUserId ─────────────────────────────────────────────────────
// Teacher-facing student profile. Data comes from four per-student endpoints
// (courses, assignments, quizzes, recorded marks) plus the class standing,
// which loads separately so a slow MIS roster never holds up the page.
// Every number on every tab is derived from one normalised activity list
// (services/studentActivity) so the tabs, the averages and the insights
// always agree.
//
// Tab, subject focus, kind and status filters live in the URL so a view can
// be shared or reloaded as-is.

interface UserCourse {
  enrollment_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  subject_description: string | null;
}

const TABS = ["overview", "courses", "assignments", "quizzes", "recorded", "report-cards"] as const;
type TabId = (typeof TABS)[number];

const TAB_KIND: Partial<Record<TabId, ActivityKind>> = {
  assignments: "assignment",
  quizzes: "quiz",
  recorded: "recorded",
};
const KIND_TAB: Record<ActivityKind, TabId> = {
  assignment: "assignments",
  quiz: "quizzes",
  recorded: "recorded",
};
const KIND_FILTERS: StandingKindFilter[] = ["all", "assignment", "quiz", "recorded"];
const ACTIVITY_FILTERS: ActivityFilter[] = ["all", "attention", "graded", "awaiting", "not_recorded", "todo", "overdue"];

const StudentDetails: React.FC = () => {
  // Every hook runs unconditionally, in the same order, before any early return.
  const { studentId } = useParams<{ studentId: string }>();
  const { can } = usePermissions();
  const { user } = useAuth();
  const canEnroll = can("GRADING_MANUAL_ASSESS");
  const canViewReportCards = can("REPORT_CARDS_VIEW_ALL");
  // Class rank / standing is the ranking switch in Roles & Permissions.
  const canViewStanding = can("RANKINGS_VIEW_ALL");

  const [student, setStudent] = useState<UserFullData | null>(null);
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [assignments, setAssignments] = useState<RawStudentAssignment[]>([]);
  const [quizzes, setQuizzes] = useState<RawStudentQuiz[]>([]);
  const [recorded, setRecorded] = useState<RecordedSubject[]>([]);
  const [loading, setLoading] = useState(true);

  const [standing, setStanding] = useState<StandingPayload | null>(null);
  const [standingLoading, setStandingLoading] = useState(canViewStanding);
  const [standingError, setStandingError] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);

  // ── URL state ──────────────────────────────────────────────────────────────
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab") as TabId | null;
  const activeTab: TabId =
    rawTab && TABS.includes(rawTab) && (rawTab !== "report-cards" || canViewReportCards) ? rawTab : "overview";
  const subjectId = params.get("subject");
  const rawKind = params.get("kind") as StandingKindFilter | null;
  const kind: StandingKindFilter = rawKind && KIND_FILTERS.includes(rawKind) ? rawKind : "all";
  const rawStatus = params.get("status") as ActivityFilter | null;
  const statusFilter: ActivityFilter = rawStatus && ACTIVITY_FILTERS.includes(rawStatus) ? rawStatus : "all";

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "" || value === "all" || (key === "tab" && value === "overview")) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const selectTab = useCallback(
    (tab: string, status: ActivityFilter | null = null) => updateParams({ tab, status }),
    [updateParams],
  );

  // ── Data ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const [studentRes, coursesRes, assignmentsRes, quizzesRes, recordedRes] = await Promise.all([
          api.get(`/users/${studentId}`),
          api.get(`/users/${studentId}/courses`),
          api.get(`/users/${studentId}/assignments`),
          api.get(`/users/${studentId}/quizzes`),
          // Best-effort: a missing recorded-marks feed must not blank the
          // whole profile, it just means that section stays empty.
          fetchStudentRecordedAssessments(studentId).catch(() => []),
        ]);
        if (cancelled) return;
        setStudent(studentRes.data.data);
        setCourses(coursesRes.data.data ?? []);
        setAssignments(assignmentsRes.data.data ?? []);
        setQuizzes(quizzesRes.data.data ?? []);
        setRecorded(recordedRes);
      } catch (error) {
        console.error("Error fetching student data:", error);
        if (!cancelled) toast.error("Failed to load student data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // The standing needs every subject's MIS roster — slower, and optional.
    if (canViewStanding) {
      fetchStudentStanding(studentId)
        .then((payload) => !cancelled && setStanding(payload))
        .catch(() => !cancelled && setStandingError(true))
        .finally(() => !cancelled && setStandingLoading(false));
    } else {
      setStanding(null);
      setStandingLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [studentId, canViewStanding]);

  const refreshCourses = useCallback(async () => {
    const res = await api.get(`/users/${studentId}/courses`);
    setCourses(res.data.data ?? []);
  }, [studentId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const subjects: ProfileSubject[] = useMemo(() => {
    const list: ProfileSubject[] = courses.map((c) => ({
      courseId: String(c.subject_id),
      name: c.subject_name,
      code: c.subject_code,
    }));
    for (const r of recorded) {
      if (!list.some((s) => s.courseId === String(r.course_id))) {
        list.push({ courseId: String(r.course_id), name: r.subject_name, code: r.subject_code });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [courses, recorded]);

  const items = useMemo(() => buildActivity(assignments, quizzes, recorded), [assignments, quizzes, recorded]);
  const summary = useMemo(() => summariseMarks(toMarkInputs(items)), [items]);
  const attention = useMemo(() => attentionByKind(items), [items]);
  const attentionTotal = attention.assignment + attention.quiz + attention.recorded;

  const overallStanding = useMemo(() => (standing ? computeStanding(standing, null, "all") : null), [standing]);
  const focusedStanding = useMemo(
    () => (standing ? computeStanding(standing, subjectId, kind) : null),
    [standing, subjectId, kind],
  );
  const perSubjectStanding = useMemo(() => (standing ? subjectStandings(standing, kind) : null), [standing, kind]);
  const perSubjectAll = useMemo(() => (standing ? subjectStandings(standing, "all") : null), [standing]);

  const insights = useMemo(
    () =>
      buildInsights({
        items,
        subjects,
        summary,
        standing: overallStanding,
        subjectStanding: perSubjectAll,
      }),
    [items, subjects, summary, overallStanding, perSubjectAll],
  );

  const linkFor = useCallback(
    (item: ActivityItem): string | null => {
      if (item.kind === "assignment") return can("ASSIGNMENTS_VIEW") ? `/assignments/${item.id}` : null;
      if (item.kind === "quiz") {
        if (item.submissionId && can("QUIZZES_GRADE")) return `/quizzes/${item.id}/submissions/${item.submissionId}`;
        return can("QUIZZES_EDIT") ? `/quizzes/${item.id}` : null;
      }
      return can("COURSES_VIEW") ? `/courses/${item.courseId}` : null;
    },
    [can],
  );

  const onInsight = useCallback(
    (insight: Insight) => {
      const target = insight.target;
      if (!target) return;
      if (target.type === "subject") {
        updateParams({ tab: "overview", subject: target.courseId });
        document.getElementById("standing-title")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      } else {
        updateParams({ tab: KIND_TAB[target.tab], status: target.status ?? null });
      }
    },
    [updateParams],
  );

  const onHeaderAttention = useCallback(() => {
    const kindWithMost = (Object.keys(attention) as ActivityKind[]).sort((a, b) => attention[b] - attention[a])[0];
    selectTab(KIND_TAB[kindWithMost], "attention");
  }, [attention, selectTab]);

  const fullName = `${student?.profile?.first_name ?? student?.user?.first_name ?? ""} ${
    student?.profile?.last_name ?? student?.user?.last_name ?? ""
  }`.trim();
  const period =
    user?.currentAcademicYear?.name && user?.currentAcademicTerm?.name
      ? `${user.currentAcademicYear.name} · ${user.currentAcademicTerm.name}`
      : null;

  // ── Early states (after every hook) ────────────────────────────────────────
  if (!studentId || (!loading && !student)) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark">
          {studentId ? "Student not found" : "Invalid Student ID"}
        </h3>
        <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {studentId ? "The student you're looking for doesn't exist." : "No student ID provided in the URL."}
        </p>
        <Link
          to="/students"
          className="mt-4 inline-flex items-center px-6 py-3 text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Students
        </Link>
      </div>
    );
  }

  if (loading || !student) {
    return (
      <div className="space-y-5 animate-pulse" data-testid="profile-loading">
        <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-1/3 rounded bg-gray-200 dark:bg-white/10" />
            <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-white/10" />
          </div>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const countOf = (k: ActivityKind) => items.filter((i) => i.kind === k).length;
  const tabs: CourseTabItem[] = [
    { id: "overview", label: "Overview", icon: <TrendingUp /> },
    { id: "courses", label: "Enrolled Courses", icon: <BookOpen />, count: subjects.length },
    { id: "assignments", label: "Assignments", icon: <ClipboardList />, count: countOf("assignment"), alert: attention.assignment },
    { id: "quizzes", label: "Quizzes", icon: <HelpCircle />, count: countOf("quiz"), alert: attention.quiz },
    { id: "recorded", label: "Recorded Assessments", icon: <ClipboardCheck />, count: countOf("recorded"), alert: attention.recorded },
    ...(canViewReportCards ? [{ id: "report-cards", label: "Report Cards", icon: <FileBadge /> }] : []),
  ];

  const activeKind = TAB_KIND[activeTab];

  return (
    <div className="space-y-5">
      <StudentProfileHeader
        student={student}
        fullName={fullName}
        average={summary.overallAverage}
        standing={overallStanding}
        standingLoading={standingLoading}
        showStanding={canViewStanding}
        attentionCount={attentionTotal}
        subjectCount={subjects.length}
        period={period}
        canEnroll={canEnroll}
        canViewReportCards={canViewReportCards}
        onEnroll={() => setEnrollOpen(true)}
        onReportCard={() => selectTab("report-cards")}
        onAttention={onHeaderAttention}
      />

      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-900/40 overflow-hidden">
        <CourseTabs
          ariaLabel="Student sections"
          tabs={tabs}
          activeId={activeTab}
          onSelect={(id) => selectTab(id)}
          actions={[
            ...(canEnroll
              ? [{ id: "enroll", label: "Enroll in course", icon: <UserPlus />, onClick: () => setEnrollOpen(true) }]
              : []),
            { id: "students", label: "All students", icon: <Users />, href: "/students" },
          ]}
        />

        <div className="p-3 sm:p-5">
          {activeTab === "overview" && (
            <StudentOverviewPanel
              items={items}
              subjects={subjects}
              summary={summary}
              insights={insights}
              standing={focusedStanding}
              subjectStanding={perSubjectStanding}
              standingLoading={standingLoading}
              standingError={standingError}
              showStanding={canViewStanding}
              subjectId={subjectId}
              onSubject={(id) => updateParams({ subject: id })}
              kind={kind}
              onKind={(k) => updateParams({ kind: k })}
              onInsight={onInsight}
            />
          )}

          {activeTab === "courses" && <StudentCoursesList subjects={subjects} items={items} summary={summary} />}

          {activeKind && (
            <StudentActivityPanel
              key={activeKind}
              kind={activeKind}
              items={items.filter((i) => i.kind === activeKind)}
              subjects={subjects}
              subjectId={subjectId}
              onSubject={(id) => updateParams({ subject: id })}
              filter={statusFilter}
              onFilter={(f) => updateParams({ status: f })}
              linkFor={linkFor}
            />
          )}

          {activeTab === "report-cards" && canViewReportCards && (
            <StudentReportCardDashboard
              studentId={parseInt(studentId, 10)}
              studentName={fullName || `Student #${studentId}`}
            />
          )}
        </div>
      </div>

      <EnrollCoursesModal
        open={enrollOpen}
        studentId={studentId}
        fullName={fullName}
        enrolledIds={courses.map((c) => String(c.subject_id))}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={refreshCourses}
      />
    </div>
  );
};

export default StudentDetails;
