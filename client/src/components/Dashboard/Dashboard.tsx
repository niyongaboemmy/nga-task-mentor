import React, { useEffect, useState, useCallback } from "react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import StudentDashboard from "./StudentDashboard";
import InstructorDashboard from "./InstructorDashboard";
import AdminDashboard from "./AdminDashboard";

interface DashboardStats {
  totalCourses: number;
  totalAssignments: number;
  pendingSubmissions: number;
  completedAssignments: number;
}

interface RecentActivity {
  id: string;
  type: "assignment" | "submission" | "course";
  title: string;
  description: string;
  timestamp: string;
}

interface AdminDashboardData {
  user: { user_id: string; first_name: string; last_name: string };
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gradingSummary: any[];
  gradeDistribution?: { excellent: number; good: number; average: number; poor: number };
  gradingSummaryError?: boolean;
}

const EMPTY_STATS: DashboardStats = {
  totalCourses: 0,
  totalAssignments: 0,
  pendingSubmissions: 0,
  completedAssignments: 0,
};

/**
 * Picks the dashboard for the most-privileged view the user holds, so a custom
 * role can be granted any of the three without code changes. The instructor
 * and student dashboards load their own overview; only the admin one is fed
 * from here.
 */
const Dashboard: React.FC = () => {
  const { can } = usePermissions();
  if (can("DASHBOARD_VIEW_ADMIN")) return <AdminDashboardContainer />;
  if (can("DASHBOARD_VIEW_INSTRUCTOR")) return <InstructorDashboard />;
  return <StudentDashboard />;
};

const AdminDashboardContainer: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // "current" scopes stats/grading-summary to the active academic term, "all"
  // removes the term filter (?scope= on the admin endpoints).
  const [scope, setScope] = useState<"current" | "all">("current");

  const load = useCallback(async () => {
    const q = scope === "all" ? "?scope=all" : "";
    const urls = [`/dashboard/admin/stats${q}`, "/dashboard/activity", `/dashboard/admin/grading-summary${q}`];
    // One failing endpoint mustn't blank the others (or shift their data).
    const results = await Promise.all(
      urls.map((url) =>
        axios.get(url).then(
          (r) => ({ ok: true as const, data: r.data?.data }),
          (error) => {
            console.error(`Failed to fetch ${url}:`, error instanceof Error ? error.message : error);
            return { ok: false as const, data: undefined };
          },
        ),
      ),
    );
    setData({
      user: { user_id: user?.id || "", first_name: user?.first_name || "", last_name: user?.last_name || "" },
      stats: results[0].data || EMPTY_STATS,
      recentActivity: results[1].data || [],
      gradingSummary: results[2].data?.gradingSummary || [],
      gradeDistribution: results[2].data?.gradeDistribution || undefined,
      gradingSummaryError: !results[2].ok,
    });
    setLoading(false);
  }, [scope, user?.id, user?.first_name, user?.last_name]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 animate-pulse">Loading dashboard...</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-text-secondary-light dark:text-text-secondary-dark/70">
        Unable to load dashboard data
      </div>
    );
  }
  return <AdminDashboard data={data} scope={scope} onScopeChange={setScope} />;
};

export default React.memo(Dashboard);
