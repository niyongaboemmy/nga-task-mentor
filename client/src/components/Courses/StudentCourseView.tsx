import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";
import { formatDateTimeLocal, isPastDate } from "../../utils/dateUtils";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: string;
  submission_type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    first_name: string;
    last_name: string;
  };
  submissions: Array<{
    id: string;
    status: string;
    submitted_at: string;
    grade?: string;
    feedback?: string;
    text_submission?: string;
    file_submissions?: string[];
    student_id?: string;
    student?: {
      id: string;
      first_name: string;
      last_name: string;
      profile_image?: string;
    };
  }>;
}

const StudentCourseView: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("due_date");
  const { user } = useAuth();

  useEffect(() => {
    const fetchStudentAssignments = async () => {
      try {
        const response = await axios.get(
          `/api/courses/${courseId}/assignments`
        );
        const assignmentsData = response.data.data.filter(
          (itm: Assignment) => itm.status === "published"
        );
        setAssignments(assignmentsData);
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (courseId) {
      fetchStudentAssignments();
    }
  }, [courseId, user?.id]);

  // Filter and search logic
  const filteredAndSortedAssignments = useMemo(() => {
    let filtered = [...assignments];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (assignment) =>
          assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          assignment.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          assignment.creator.first_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          assignment.creator.last_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((assignment) => {
        const userSubmission = assignment.submissions.find(
          (submission) => submission.student?.id === user?.id
        );

        switch (statusFilter) {
          case "graded":
            return userSubmission && userSubmission.status === "graded";
          case "submitted":
            return userSubmission && userSubmission.status === "submitted";
          case "pending":
            return !userSubmission;
          case "overdue":
            return (
              !userSubmission && isPastDate(new Date(assignment.due_date))
            );
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "due_date":
          return (
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          );
        case "max_score":
          return parseInt(b.max_score) - parseInt(a.max_score);
        case "creator":
          return `${a.creator.first_name} ${a.creator.last_name}`.localeCompare(
            `${b.creator.first_name} ${b.creator.last_name}`
          );
        default:
          return 0;
      }
    });

    return filtered;
  }, [assignments, searchTerm, statusFilter, sortBy, user?.id]);

  // Re-group filtered assignments
  const filteredGroupedAssignments = useMemo(() => {
    const grouped = {
      submitted: filteredAndSortedAssignments.filter(
        (assignment: Assignment) => {
          const userSubmission = assignment.submissions.find(
            (submission) => submission.student?.id === user?.id
          );
          return userSubmission && userSubmission.status === "submitted";
        }
      ),
      graded: filteredAndSortedAssignments.filter((assignment: Assignment) => {
        const userSubmission = assignment.submissions.find(
          (submission) => submission.student?.id === user?.id
        );
        return userSubmission && userSubmission.status === "graded";
      }),
      pending: filteredAndSortedAssignments.filter((assignment: Assignment) => {
        const userSubmission = assignment.submissions.find(
          (submission) => submission.student?.id === user?.id
        );
        return !userSubmission;
      }),
      overdue: filteredAndSortedAssignments.filter((assignment: Assignment) => {
        const userSubmission = assignment.submissions.find(
          (submission) => submission.student?.id === user?.id
        );
        return !userSubmission && isPastDate(new Date(assignment.due_date));
      }),
    };

    return grouped;
  }, [filteredAndSortedAssignments, user?.id]);

  const getStatusColor = (assignments: Assignment[]) => {
    if (
      assignments.some((a) => a.submissions.some((s) => s.status === "graded"))
    ) {
      return "bg-green-50 border-green-200";
    }
    if (
      assignments.some((a) =>
        a.submissions.some((s) => s.status === "submitted")
      )
    ) {
      return "bg-blue-50 border-blue-200";
    }
    if (assignments.some((a) => isPastDate(new Date(a.due_date)))) {
      return "bg-red-50 border-red-200";
    }
    return "bg-gray-50 border-gray-200";
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeLocal(new Date(dateString), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleCardExpansion = (assignmentId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(assignmentId)) {
      newExpanded.delete(assignmentId);
    } else {
      newExpanded.add(assignmentId);
    }
    setExpandedCards(newExpanded);
  };

  const handleViewAssignment = (assignmentId: string) => {
    navigate(`/assignments/${assignmentId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statusGroups = [
    { key: "graded", title: "Graded", icon: "✅" },
    { key: "submitted", title: "Submitted", icon: "📤" },
    { key: "pending", title: "Pending", icon: "⏳" },
    { key: "overdue", title: "Overdue", icon: "⚠️" },
  ];

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Link
          to={`/courses`}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 hover:shadow-md transition-all duration-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Courses
        </Link>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:border-gray-800/70 dark:bg-gray-900/60 p-3 md:p-4 md:px-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          My Assignments
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          View and manage your course assignments
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white/80 dark:bg-gray-900 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:border-gray-800/70 dark:bg-gray-900/60 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
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
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="graded">Graded</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Sort Options */}
          <div className="w-full md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="due_date">Sort by Due Date</option>
              <option value="title">Sort by Title</option>
              <option value="max_score">Sort by Points</option>
              <option value="creator">Sort by Instructor</option>
            </select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredAndSortedAssignments.length} of {assignments.length}{" "}
          assignments
          {searchTerm && ` for "${searchTerm}"`}
          {statusFilter !== "all" && ` with status "${statusFilter}"`}
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:border-gray-800/70 dark:bg-gray-900/60 p-12 text-center">
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
          <h3 className="mt-2 text-sm font-medium">No assignments yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Assignments will appear here once they're created by your
            instructor.
          </p>
        </div>
      ) : filteredAndSortedAssignments.length === 0 ? (
        <div className="bg-white/80 dark:bg-gray-900 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:border-gray-800/70 dark:bg-gray-900/60 p-12 text-center">
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
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.881-5.72-2.291"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No assignments match your filters
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search terms or filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {statusGroups.map(({ key, title, icon }) => {
            const groupAssignments =
              filteredGroupedAssignments[
                key as keyof typeof filteredGroupedAssignments
              ];
            if (groupAssignments.length === 0) return null;

            return (
              <div
                key={key}
                className={`rounded-xl dark:bg-gray-950 border ${getStatusColor(
                  groupAssignments
                )} p-3 dark:p-0 dark:border-none`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {title} ({groupAssignments.length})
                    </h3>
                  </div>
                </div>

                <div className="space-y-2">
                  {groupAssignments.map((assignment: Assignment) => {
                    const userSubmission = assignment.submissions.find(
                      (submission) => submission.student?.id === user?.id
                    );
                    const isExpanded = expandedCards.has(assignment.id);

                    return (
                      <div
                        key={assignment.id}
                        className={`bg-white/60 dark:bg-gray-800/60 rounded-xl border border-gray-200/50 dark:border-gray-700/40 p-3 transition-all duration-200 ${
                          isExpanded ? "shadow-lg" : "shadow-sm hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                                {assignment.title}
                              </h4>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  userSubmission?.status === "graded"
                                    ? "bg-green-100 text-green-800"
                                    : userSubmission?.status === "submitted"
                                    ? "bg-blue-100 text-blue-800"
                                    : isPastDate(new Date(assignment.due_date))
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {userSubmission?.status === "graded"
                                  ? "Graded"
                                  : userSubmission?.status === "submitted"
                                  ? "Submitted"
                                  : isPastDate(new Date(assignment.due_date))
                                  ? "Overdue"
                                  : "Pending"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              Due: {formatDate(assignment.due_date)} •{" "}
                              {assignment.max_score} pts
                            </p>
                          </div>

                          <div className="flex items-center gap-2 ml-3">
                            <button
                              onClick={() => toggleCardExpansion(assignment.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                              <svg
                                className={`w-4 h-4 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() =>
                                handleViewAssignment(assignment.id)
                              }
                              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            >
                              View Details
                            </button>
                          </div>
                        </div>

                        {isExpanded && userSubmission && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900 dark:text-white">
                                  Your Submission
                                </h5>
                                <span className="text-sm text-gray-500">
                                  Submitted:{" "}
                                  {formatDate(userSubmission.submitted_at)}
                                </span>
                              </div>

                              {userSubmission.grade && (
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Grade:
                                  </span>
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                                      parseFloat(userSubmission.grade) >= 80
                                        ? "bg-green-100 text-green-800"
                                        : parseFloat(userSubmission.grade) >= 60
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {userSubmission.grade}/100
                                  </span>
                                </div>
                              )}

                              {userSubmission.feedback && (
                                <div className="mt-2">
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Feedback:
                                  </span>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {userSubmission.feedback}
                                  </p>
                                </div>
                              )}

                              {!userSubmission.grade &&
                                !userSubmission.feedback && (
                                  <p className="text-sm text-gray-500 italic">
                                    Submission is being reviewed by your
                                    instructor.
                                  </p>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentCourseView;
