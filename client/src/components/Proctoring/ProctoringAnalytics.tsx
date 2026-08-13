import React, { useState, useEffect } from "react";
import axios from "../../utils/axiosConfig";

interface ProctoringAnalyticsProps {
  quizId: string;
}

interface AnalyticsData {
  totalSessions: number;
  averageRiskScore: number;
  totalViolations: number;
  flaggedSessions: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  commonViolations: Array<{ type: string; count: number; percentage: number }>;
  sessionDetails: Array<{
    student_name: string;
    risk_score: number;
    violations: number;
    status: string;
    start_time: string;
  }>;
}

const riskColor = (score: number) => {
  if (score >= 75) return { pill: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", bar: "bg-red-500" };
  if (score >= 50) return { pill: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", bar: "bg-orange-500" };
  if (score >= 25) return { pill: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", bar: "bg-yellow-500" };
  return { pill: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", bar: "bg-green-500" };
};

const violationIcon: Record<string, string> = {
  face_not_visible: "👤",
  microphone_level_low: "🎙️",
  fullscreen_exited: "⛶",
  multiple_faces: "👥",
  tab_switched: "🔀",
  copy_paste: "📋",
  unknown: "⚠️",
};

const ProctoringAnalytics: React.FC<ProctoringAnalyticsProps> = ({ quizId }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"all" | "week" | "month">("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/proctoring/quizzes/${quizId}/analytics`, { params: { timeRange } });
        if (data.success) setAnalytics(data.data);
      } catch (e) {
        console.error("Error loading proctoring analytics:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [quizId, timeRange]);

  const exportReport = async () => {
    try {
      const response = await axios.get(`/proctoring/quizzes/${quizId}/analytics/export`, {
        params: { timeRange },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `proctoring-report-${quizId}-${timeRange}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Error exporting report:", e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">Loading analytics…</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <span className="text-4xl">📊</span>
        <p className="text-base font-semibold text-text-secondary-light dark:text-text-secondary-dark">No analytics data available</p>
        <p className="text-sm text-gray-400">Data will appear once sessions have been recorded.</p>
      </div>
    );
  }

  const riskLevels = [
    { key: "low", label: "Low", color: "bg-green-500" },
    { key: "medium", label: "Medium", color: "bg-yellow-500" },
    { key: "high", label: "High", color: "bg-orange-500" },
    { key: "critical", label: "Critical", color: "bg-red-500" },
  ] as const;

  const avgRisk = analytics.averageRiskScore ?? 0;
  const avgRiskColors = riskColor(avgRisk);

  return (
    <div className="space-y-6 p-1">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">Proctoring Analytics</h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 mt-0.5">Monitor and analyze proctoring session data</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text-secondary-light dark:text-text-secondary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          >
            <option value="all">All Time</option>
            <option value="month">Last Month</option>
            <option value="week">Last Week</option>
          </select>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Sessions",
            value: analytics.totalSessions,
            icon: "🎥",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            text: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Avg Risk Score",
            value: avgRisk.toFixed(1),
            icon: "⚡",
            bg: avgRisk >= 50 ? "bg-red-50 dark:bg-red-900/20" : "bg-yellow-50 dark:bg-yellow-900/20",
            iconBg: avgRisk >= 50 ? "bg-red-100 dark:bg-red-900/40" : "bg-yellow-100 dark:bg-yellow-900/40",
            text: avgRisk >= 50 ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400",
          },
          {
            label: "Total Violations",
            value: analytics.totalViolations.toLocaleString(),
            icon: "🚨",
            bg: "bg-rose-50 dark:bg-rose-900/20",
            iconBg: "bg-rose-100 dark:bg-rose-900/40",
            text: "text-rose-600 dark:text-rose-400",
          },
          {
            label: "Flagged Sessions",
            value: analytics.flaggedSessions,
            icon: "🚩",
            bg: "bg-orange-50 dark:bg-orange-900/20",
            iconBg: "bg-orange-100 dark:bg-orange-900/40",
            text: "text-orange-600 dark:text-orange-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`${card.bg} rounded-2xl p-4 border border-white/60 dark:border-gray-800/60`}
          >
            <div className={`w-9 h-9 ${card.iconBg} rounded-xl flex items-center justify-center text-lg mb-3`}>
              {card.icon}
            </div>
            <p className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark/70 mb-0.5">{card.label}</p>
            <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Risk Distribution + Common Violations side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Risk Distribution */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Risk Score Distribution</h3>
          <div className="space-y-4">
            {riskLevels.map(({ key, label, color }) => {
              const count = analytics.riskDistribution[key];
              const pct = analytics.totalSessions > 0 ? (count / analytics.totalSessions) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">{label}</span>
                    <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
                      {count} <span className="font-normal text-gray-400">({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Common Violations */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Common Violations</h3>
          <div className="space-y-2">
            {analytics.commonViolations.map((v, i) => {
              const icon = violationIcon[v.type] ?? violationIcon.unknown;
              const pct = v.percentage;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark capitalize truncate">
                        {v.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 ml-2 flex-shrink-0">
                        {v.count.toLocaleString()} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-400 dark:bg-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Session Details */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">Session Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">#</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">Student</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">Risk Score</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">Violations</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">Start Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {analytics.sessionDetails.map((s, i) => {
                const colors = riskColor(s.risk_score);
                const initials = s.student_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-gray-400 dark:text-gray-600 font-mono">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{s.student_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${colors.pill}`}>
                          {s.risk_score.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-sm font-semibold ${s.violations > 200 ? "text-rose-600 dark:text-rose-400" : s.violations > 100 ? "text-orange-600 dark:text-orange-400" : "text-text-secondary-light dark:text-text-secondary-dark"}`}>
                        {s.violations.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                        s.status === "flagged"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : s.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-blue-500 animate-pulse" : s.status === "flagged" ? "bg-red-500" : "bg-green-500"}`} />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 whitespace-nowrap">
                      {new Date(s.start_time).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProctoringAnalytics;
