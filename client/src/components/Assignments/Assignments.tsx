import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, RefreshCw } from "lucide-react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import AssignmentCard, { type AssignmentInterface } from "./AssignmentCard";
import { onAcademicPeriodChanged } from "../../utils/academicPeriodEvents";

// Module-level cache: keyed by courseId, holds the last fetched assignments list.
// The server scopes /assignments to the caller's current academic term, so this
// cache is implicitly term-scoped too -- it must be dropped when the viewed
// term changes, since it lives outside the React tree Layout remounts on switch.
const assignmentsCache: Map<string, AssignmentInterface[]> = new Map();
onAcademicPeriodChanged(() => assignmentsCache.clear());

interface Course {
  id: string;
  code: string;
  title: string;
  instructor?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface AssignmentsProps {
  courseId?: string;
  courseData?: Course | null;
  showCreateButton?: boolean;
  compact?: boolean;
}

const Assignments: React.FC<AssignmentsProps> = ({
  courseId,
  courseData = null,
  showCreateButton = true,
  compact = false,
}) => {
  const { courseId: paramCourseId } = useParams<{ courseId: string }>();
  const currentCourseId = courseId || paramCourseId;
  const cacheKey = currentCourseId ?? "__none__";
  const cached = assignmentsCache.get(cacheKey);
  const [assignments, setAssignments] = useState<AssignmentInterface[]>(cached ?? []);
  const [course, setCourse] = useState<Course | null>(courseData);
  const [isLoading, setIsLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "published" | "draft" | "completed" | "removed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const { can } = usePermissions();
  const isStudentView = can("SUBMISSIONS_CREATE");

  const fetchAssignments = useCallback(async (force = false) => {
    // Skip network request if we have cached data and this isn't a forced refresh
    if (!force && assignmentsCache.has(cacheKey)) {
      setIsLoading(false);
      return;
    }
    try {
      let endpoint: string;

      if (isStudentView) {
        if (currentCourseId) {
          endpoint = `/courses/${currentCourseId}/assignments`;
        } else {
          endpoint = "/assignments/enrolled";
        }
      } else {
        endpoint = currentCourseId
          ? `/courses/${currentCourseId}/assignments`
          : "/assignments";
      }

      const response = await axios.get(endpoint);
      let assignmentsData = response.data.data || response.data;

      // For students, filter out deleted assignments
      if (isStudentView) {
        assignmentsData = assignmentsData.filter(
          (assignment: AssignmentInterface) => assignment.status !== "removed",
        );
      }

      assignmentsCache.set(cacheKey, assignmentsData);
      setAssignments(assignmentsData);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentCourseId, isStudentView, cacheKey]);

  const fetchCourse = useCallback(async () => {
    if (!currentCourseId) return;

    try {
      const response = await axios.get(`/courses/${currentCourseId}`);
      const courseData = response.data.data || response.data;

      // For students, check if they're enrolled in this course
      if (isStudentView) {
        // Check if student is enrolled by looking at course enrollment status
        // If the course doesn't have enrollment info or student is not enrolled, don't set course
        if (
          !courseData.students ||
          !courseData.students.some(
            (student: any) => student.id.toString() === user?.id?.toString(),
          )
        ) {
          setCourse(null);
          return;
        }
      }

      setCourse(courseData);
    } catch (error) {
      console.error("Error fetching course:", error);
      // For students, if they can't access the course, set course to null
      if (isStudentView) {
        setCourse(null);
      }
    }
  }, [currentCourseId, isStudentView, user?.id]);

  useEffect(() => {
    // fetchAssignments skips the network if cache is warm
    fetchAssignments();
    // Only fetch course if it wasn't provided or if ID changed
    if (
      currentCourseId &&
      (!course || String(course.id) !== String(currentCourseId))
    ) {
      fetchCourse();
    }
  }, [currentCourseId, fetchAssignments, fetchCourse, course]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAssignments(true);
  }, [fetchAssignments]);

  const handleStatusChange = useCallback(
    async (
      assignmentId: string,
      status: "draft" | "published" | "completed" | "removed",
    ) => {
      try {
        await axios.patch(`/assignments/${assignmentId}/status`, {
          status,
        });
        // Force-refresh after a mutation so cache is up to date
        fetchAssignments(true);
      } catch (error) {
        console.error("Error updating assignment status:", error);
      }
    },
    [fetchAssignments],
  );

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      // Students should only see published, completed, or public assignments
      if (isStudentView) {
        return (
          assignment.status === "published" || assignment.status === "completed"
        );
      }

      if (filter !== "all" && assignment.status !== filter) {
        return false;
      }

      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      const title = (assignment.title || "").toLowerCase();
      const courseCode = assignment.course?.code?.toLowerCase() || "";
      const courseTitle = assignment.course?.title?.toLowerCase() || "";

      return (
        title.includes(query) ||
        courseCode.includes(query) ||
        courseTitle.includes(query)
      );
    });
  }, [assignments, isStudentView, filter, searchQuery]);

  const canManageAssignments = useMemo(() => {
    return can("ASSIGNMENTS_CREATE");
  }, [can]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            Loading assignments...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 px-5 py-4">
          <div className="flex flex-col gap-4">
            {compact && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 md:w-7 md:h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                      Assignments
                    </h1>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm mt-1">
                      {currentCourseId
                        ? "Manage and review assignments for this course"
                        : isStudentView
                          ? "Your course assignments"
                          : "All course assignments"}
                    </p>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark">
                    {assignments.length} item
                    {assignments.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Search */}
              <div className="w-full relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-text-secondary-light dark:text-text-secondary-dark/60"
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
                  placeholder="Search assignments by title or course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full font-normal pl-10 pr-3 py-2.5 text-sm rounded-2xl leading-5 bg-surface-light dark:bg-surface-dark/50 placeholder-text-secondary-light dark:placeholder-text-secondary-dark/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-text-primary-light dark:text-text-primary-dark border border-transparent"
                />
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3">
                {/* Refresh button */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isLoading}
                  title="Refresh assignments"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark/50 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {/* Filter */}
                {assignments && assignments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      Filter:
                    </span>
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as any)}
                      className="text-sm rounded-2xl px-3 py-2.5 bg-surface-light dark:bg-surface-dark border border-transparent dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Status</option>
                      <option value="published">Published</option>
                      <option value="completed">Completed</option>
                      {/* Only show removed filter for instructors/admins */}
                      {canManageAssignments && (
                        <option value="removed">Removed</option>
                      )}
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                )}

                {/* Create Button */}
                {showCreateButton &&
                  canManageAssignments &&
                  assignments.length > 0 && (
                    <Link
                      to={`/assignments/create?courseId=${currentCourseId}`}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <div className="truncate">Create Assignment</div>
                    </Link>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Assignment List */}
        <AnimatePresence mode="popLayout">
          {filteredAssignments.length > 0 ? (
            <motion.div
              layout
              className={`grid gap-4 ${
                compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-1"
              }`}
            >
              {filteredAssignments.map((assignment, index) => (
                <motion.div
                  key={assignment.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.3,
                    delay: compact ? 0 : index * 0.05,
                  }}
                  className="relative"
                >
                  <AssignmentCard
                    assignment={assignment}
                    showSubmissions={!compact}
                    compact={compact}
                    canManage={canManageAssignments}
                    onStatusChange={handleStatusChange}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 pt-0"
            >
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                {isStudentView
                  ? "No assignments available"
                  : filter === "all"
                    ? "No assignments yet"
                    : `No ${filter} assignments`}
              </h3>
              <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                {isStudentView
                  ? "You need to be enrolled in courses to see assignments."
                  : filter === "all"
                    ? "Assignments will appear here once they're created."
                    : `${filter} assignments will appear here.`}
              </p>
              {filter === "all" && showCreateButton && canManageAssignments && (
                <div className="mt-4">
                  <Link
                    to={`/assignments/create?courseId=${currentCourseId}`}
                    className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    <svg
                      className="h-4 w-4 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Create First Assignment
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default React.memo(Assignments);
