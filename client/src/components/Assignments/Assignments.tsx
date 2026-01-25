import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import AssignmentCard, { type AssignmentInterface } from "./AssignmentCard";

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
  const [assignments, setAssignments] = useState<AssignmentInterface[]>([]);
  const [course, setCourse] = useState<Course | null>(courseData);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "published" | "draft" | "completed" | "removed"
  >("all");
  const { user } = useAuth();

  const fetchAssignments = useCallback(async () => {
    try {
      let endpoint: string;

      if (user?.role === "student") {
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
      if (user?.role === "student") {
        assignmentsData = assignmentsData.filter(
          (assignment: AssignmentInterface) => assignment.status !== "removed",
        );
      }

      setAssignments(assignmentsData);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentCourseId, user?.role]);

  const fetchCourse = useCallback(async () => {
    if (!currentCourseId) return;

    try {
      const response = await axios.get(`/courses/${currentCourseId}`);
      const courseData = response.data.data || response.data;

      // For students, check if they're enrolled in this course
      if (user?.role === "student") {
        // Check if student is enrolled by looking at course enrollment status
        // If the course doesn't have enrollment info or student is not enrolled, don't set course
        if (
          !courseData.students ||
          !courseData.students.some((student: any) => student.id === user.id)
        ) {
          setCourse(null);
          return;
        }
      }

      setCourse(courseData);
    } catch (error) {
      console.error("Error fetching course:", error);
      // For students, if they can't access the course, set course to null
      if (user?.role === "student") {
        setCourse(null);
      }
    }
  }, [currentCourseId, user?.role, user?.id]);

  useEffect(() => {
    fetchAssignments();
    // Only fetch course if it wasn't provided or if ID changed
    if (
      currentCourseId &&
      (!course || String(course.id) !== String(currentCourseId))
    ) {
      fetchCourse();
    }
  }, [currentCourseId, fetchAssignments, fetchCourse, course]);

  const handleStatusChange = useCallback(
    async (
      assignmentId: string,
      status: "draft" | "published" | "completed" | "removed",
    ) => {
      try {
        await axios.patch(`/assignments/${assignmentId}/status`, {
          status,
        });
        fetchAssignments();
      } catch (error) {
        console.error("Error updating assignment status:", error);
      }
    },
    [fetchAssignments],
  );

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      // Students should never see removed assignments
      if (user?.role === "student" && assignment.status === "removed") {
        return false;
      }

      if (filter === "all") return true;
      return assignment.status === filter;
    });
  }, [assignments, user?.role, filter]);

  const canManageAssignments = useMemo(() => {
    return user?.role === "instructor" || user?.role === "admin";
  }, [user?.role]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center justify-between w-full gap-3">
            {/* Filter */}
            {assignments && assignments.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Filter:</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
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
                  Create Assignment
                </Link>
              )}
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
                    canManage={
                      canManageAssignments &&
                      course?.instructor?.id === user?.id
                    }
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
                className="mx-auto h-12 w-12 text-gray-400"
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
              <h3 className="mt-2 text-base font-medium">
                {user?.role === "student"
                  ? "No assignments available"
                  : filter === "all"
                    ? "No assignments yet"
                    : `No ${filter} assignments`}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {user?.role === "student"
                  ? "You need to be enrolled in courses to see assignments."
                  : filter === "all"
                    ? "Assignments will appear here once they're created."
                    : `${filter} assignments will appear here.`}
              </p>
              {filter === "all" && showCreateButton && canManageAssignments && (
                <div className="mt-4">
                  <Link
                    to={`/assignments/create?courseId=${currentCourseId}`}
                    className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
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
