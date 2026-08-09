import React, { useEffect, useState, useCallback } from "react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import StudentDashboard from "./StudentDashboard";
import InstructorDashboard from "./InstructorDashboard";
import AdminDashboard from "./AdminDashboard";

// Interfaces for data fetching
interface DashboardStats {
  totalCourses: number;
  totalAssignments: number;
  pendingSubmissions: number;
  completedAssignments: number;
  totalEnrolledStudents?: number;
}

interface RecentActivity {
  id: string;
  type: "assignment" | "submission" | "course";
  title: string;
  description: string;
  timestamp: string;
}

interface StudentDashboardData {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    roles?: Array<{ id: number; name: string }>;
  };
  stats: DashboardStats;
  pendingAssignments: any[];
  recentActivity: RecentActivity[];
  publicQuizzes: any[];
  enrolledCourses: any[];
  availableQuizzes: any[]; // Add available quizzes from enrolled courses
}

interface InstructorDashboardData {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
  stats: DashboardStats;
  courses?: any[];
  pendingGrading?: any[];
  recentActivity: RecentActivity[];
  activeProctoring?: number;
}

interface AdminDashboardData {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  gradingSummary: any[];
  gradeDistribution?: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
  gradingSummaryError?: boolean;
}

type DashboardData =
  | StudentDashboardData
  | InstructorDashboardData
  | AdminDashboardData;

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // Admin-only: "current" scopes stats/grading-summary to the active academic
  // term, "all" removes the term filter. Passed through as ?scope= on the
  // admin dashboard endpoints (see dashboardController.ts).
  const [adminScope, setAdminScope] = useState<"current" | "all">("current");

  const fetchDashboardData = useCallback(async () => {
    try {
      const endpoints = {
        student: [
          "/dashboard/student/stats",
          "/dashboard/student/pending-assignments",
          "/dashboard/activity",
          "/quizzes/public",
          "/courses", // Add enrolled courses with deadlines
          "/quizzes/available", // Add available quizzes from enrolled courses
        ],
        instructor: [
          "/dashboard/instructor/stats",
          "/dashboard/instructor/courses",
          "/dashboard/instructor/pending-grading",
          "/dashboard/activity",
          "/dashboard/instructor/active-proctoring",
        ],
        admin: [
          `/dashboard/admin/stats${adminScope === "all" ? "?scope=all" : ""}`,
          "/dashboard/activity",
          `/dashboard/admin/grading-summary${adminScope === "all" ? "?scope=all" : ""}`,
        ],
      };

      const role = user?.role || "student";
      const urls =
        endpoints[role as keyof typeof endpoints] || endpoints.student;

      const responses = await Promise.all(
        urls.map(async (url) => {
          try {
            return await axios.get(url);
          } catch (error) {
            return { error, url };
          }
        }),
      );

      // Type guard to check if response is an error response
      const isErrorResponse = (
        response: any,
      ): response is { error: unknown; url: string } => {
        return response && typeof response === "object" && "error" in response;
      };

      // Index into `responses` directly (not a filtered copy) so a failure on
      // one endpoint doesn't shift every later endpoint's data into the wrong
      // field — filtering out errors before indexing silently mismapped data
      // whenever a non-final call failed.
      const dataAt = (index: number) =>
        isErrorResponse(responses[index])
          ? undefined
          : (responses[index] as any)?.data?.data;
      const failedAt = (index: number) => isErrorResponse(responses[index]);

      const anyFailed = responses.some((response) => isErrorResponse(response));
      if (anyFailed) {
        console.error("Some dashboard API calls failed:");
        responses.forEach((response, index) => {
          if (isErrorResponse(response)) {
            console.error(
              `Failed to fetch ${urls[index]}:`,
              response.error instanceof Error
                ? response.error.message
                : response.error,
            );
          }
        });
      }

      if (role === "student") {
        setData({
          user: {
            user_id: user?.id || "",
            first_name: user?.first_name || "",
            last_name: user?.last_name || "",
            roles: user?.roles,
          },
          stats: dataAt(0) || {
            totalCourses: 0,
            totalAssignments: 0,
            pendingSubmissions: 0,
            completedAssignments: 0,
          },
          pendingAssignments: dataAt(1) || [],
          recentActivity: dataAt(2) || [],
          publicQuizzes: dataAt(3) || [],
          enrolledCourses: dataAt(4) || [],
          availableQuizzes: dataAt(5) || [], // Add available quizzes from enrolled courses
        });
      } else if (role === "instructor") {
        if (!user) {
          setLoading(false);
          return;
        }

        setData({
          user: {
            user_id: user.id || "",
            first_name: user.first_name || "",
            last_name: user.last_name || "",
          },
          stats: dataAt(0) || {
            totalCourses: 0,
            totalAssignments: 0,
            pendingSubmissions: 0,
            completedAssignments: 0,
            totalEnrolledStudents: 0,
          },
          courses: dataAt(1) || [],
          pendingGrading: dataAt(2) || [],
          recentActivity: dataAt(3) || [],
          activeProctoring: dataAt(4) || 0,
        } as InstructorDashboardData);
      } else {
        // This block is for admin
        const baseData = {
          user: {
            user_id: user?.id || "",
            first_name: user?.first_name || "",
            last_name: user?.last_name || "",
          },
          stats: dataAt(0) || {
            totalCourses: 0,
            totalAssignments: 0,
            pendingSubmissions: 0,
            completedAssignments: 0,
          },
          recentActivity: dataAt(1) || [],
        };

        const adminData = dataAt(2);
        setData({
          ...baseData,
          gradingSummary: adminData?.gradingSummary || [],
          gradeDistribution: adminData?.gradeDistribution || undefined,
          gradingSummaryError: failedAt(2),
        } as AdminDashboardData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.id, user?.first_name, user?.last_name, adminScope]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="relative">
          <div className="flex space-x-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-bounce"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "0.8s",
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center mt-8">
            <div className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
              Loading dashboard...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400">
            Unable to load dashboard data
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate dashboard based on user role
  switch (user?.role) {
    case "instructor":
      return <InstructorDashboard data={data as InstructorDashboardData} />;
    case "admin":
      return (
        <AdminDashboard
          data={data as AdminDashboardData}
          scope={adminScope}
          onScopeChange={setAdminScope}
        />
      );
    case "student":
    default:
      return <StudentDashboard data={data as StudentDashboardData} />;
  }
};

export default React.memo(Dashboard);
