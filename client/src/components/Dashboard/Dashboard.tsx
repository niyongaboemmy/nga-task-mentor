import React from "react";
import { usePermissions } from "../../hooks/usePermissions";
import StudentDashboard from "./StudentDashboard";
import InstructorDashboard from "./InstructorDashboard";

/**
 * Picks the dashboard for the most-privileged view the user holds, so a custom
 * role can be granted any of the three without code changes. Admins get the
 * teacher board over every subject in the school, plus the school-wide layer
 * (teachers, classes, report-card readiness); each dashboard loads its own data.
 */
const Dashboard: React.FC = () => {
  const { can } = usePermissions();
  if (can("DASHBOARD_VIEW_ADMIN")) return <InstructorDashboard variant="admin" />;
  if (can("DASHBOARD_VIEW_INSTRUCTOR")) return <InstructorDashboard />;
  return <StudentDashboard />;
};

export default React.memo(Dashboard);
