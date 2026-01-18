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
}

type DashboardData =
  | StudentDashboardData
  | InstructorDashboardData
  | AdminDashboardData;

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const endpoints = {
        student: [
          "/api/dashboard/student/stats",
          "/api/dashboard/student/pending-assignments",
          "/api/dashboard/activity",
          "/api/quizzes/public",
          "/api/courses/enrolled", // Add enrolled courses with deadlines
          "/api/quizzes/available", // Add available quizzes from enrolled courses
        ],
        instructor: [
          "/api/dashboard/instructor/stats",
          "/api/dashboard/instructor/courses",
          "/api/dashboard/instructor/pending-grading",
          "/api/dashboard/activity",
        ],
        admin: [
          "/api/dashboard/admin/stats",
          "/api/dashboard/activity",
          "/api/dashboard/admin/grading-summary",
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

      // Check if any responses have errors
      const validResponses = responses.filter(
        (response) => !isErrorResponse(response),
      );

      if (validResponses.length !== urls.length) {
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
          stats: (validResponses[0] as any)?.data?.data || {
            totalCourses: 0,
            totalAssignments: 0,
            pendingSubmissions: 0,
            completedAssignments: 0,
          },
          pendingAssignments: (validResponses[1] as any)?.data?.data || [],
          recentActivity: (validResponses[2] as any)?.data?.data || [],
          publicQuizzes: (validResponses[3] as any)?.data?.data || [],
          enrolledCourses: (validResponses[4] as any)?.data?.data || [],
          availableQuizzes: (validResponses[5] as any)?.data?.data || [], // Add available quizzes from enrolled courses
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
          stats: (validResponses[0] as any)?.data?.data || {
            totalCourses: 0,
            totalAssignments: 0,
            pendingSubmissions: 0,
            completedAssignments: 0,
            totalEnrolledStudents: 0,
          },
          courses: (validResponses[1] as any)?.data?.data || [],
          pendingGrading: (validResponses[2] as any)?.data?.data || [],
          recentActivity: (validResponses[3] as any)?.data?.data || [],
        } as InstructorDashboardData);
      } else {
        // This block is for admin
        const baseData = {
          user: {
            user_id: user?.id || "",
            first_name: user?.first_name || "",
            last_name: user?.last_name || "",
          },
          stats: (validResponses[0] as any)?.data?.data || {
            totalCourses: 0,
            totalAssignments: 0,
            pendingSubmissions: 0,
            completedAssignments: 0,
          },
          recentActivity: (validResponses[1] as any)?.data?.data || [],
        };

        if (role === "admin" && validResponses[2]) {
          // validResponses[2] should exist if no error
          const adminData = (validResponses[2] as any)?.data?.data;
          setData({
            ...baseData,
            gradingSummary: adminData?.gradingSummary || [],
            gradeDistribution: adminData?.gradeDistribution || null,
          } as AdminDashboardData);
        } else {
          // Fallback for non-admin or error in specific admin endpoint
          setData({
            ...baseData,
            gradingSummary: [],
            gradeDistribution: undefined,
          } as AdminDashboardData);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.id, user?.first_name, user?.last_name]);

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
      return <AdminDashboard data={data as AdminDashboardData} />;
    case "student":
    default:
      return <StudentDashboard data={data as StudentDashboardData} />;
  }
};

export default React.memo(Dashboard);
