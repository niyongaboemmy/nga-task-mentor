import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type Plugin,
  type TooltipItem,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useTheme } from "../../../contexts/ThemeContext";
import { PASS_MARK, subjectLabel, type InstructorOverview, type SubjectSummary } from "../../../services/instructorOverviewApi";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip, Legend);

// Palette validated (dataviz validate_palette.js) against the card surface in
// both modes: slot 1 blue = "submitted", slot 2 orange = "graded". A chart with
// one series uses slot 1 only.
const SERIES = {
  light: { s1: "#2a78d6", s2: "#eb6834" },
  dark: { s1: "#3987e5", s2: "#d95926" },
};

function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return useMemo(
    () => ({
      isDark,
      ...(isDark ? SERIES.dark : SERIES.light),
      tick: isDark ? "#94a3b8" : "#64748b",
      grid: isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.2)",
      surface: isDark ? "#1c2635" : "#ffffff",
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.94)",
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
        padding: 10,
        cornerRadius: 10,
        boxPadding: 4,
      },
    }),
    [isDark],
  );
}

const fmtWeek = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

/** A thin reference rule at the pass mark on a percentage axis. */
const passRule = (themeRef: { current: { tick: string } }, axis: "x" | "y"): Plugin => ({
  id: `passRule-${axis}`,
  beforeDatasetsDraw(chart) {
    const scale = chart.scales[axis];
    const { ctx, chartArea } = chart;
    if (!scale || !chartArea) return;
    const at = scale.getPixelForValue(PASS_MARK);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = themeRef.current.tick;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(at, chartArea.top);
      ctx.lineTo(at, chartArea.bottom);
    } else {
      ctx.moveTo(chartArea.left, at);
      ctx.lineTo(chartArea.right, at);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = themeRef.current.tick;
    ctx.font = "500 10px system-ui, -apple-system, sans-serif";
    if (axis === "x") ctx.fillText(`Pass ${PASS_MARK}%`, at + 4, chartArea.top + 10);
    else ctx.fillText(`Pass ${PASS_MARK}%`, chartArea.left + 4, at - 4);
    ctx.restore();
  },
});

export function ActivityTrendChart({ trend }: { trend: InstructorOverview["trend"] }) {
  const t = useChartTheme();
  const data = {
    labels: trend.map((w) => fmtWeek(w.week_start)),
    datasets: [
      {
        label: "Submitted",
        data: trend.map((w) => w.submissions),
        borderColor: t.s1,
        backgroundColor: t.s1,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBorderColor: t.surface,
        pointBorderWidth: 2,
        tension: 0.3,
        cubicInterpolationMode: "monotone" as const,
      },
      {
        label: "Graded",
        data: trend.map((w) => w.graded),
        borderColor: t.s2,
        backgroundColor: t.s2,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBorderColor: t.surface,
        pointBorderWidth: 2,
        tension: 0.3,
        cubicInterpolationMode: "monotone" as const,
      },
    ],
  };
  return (
    <div className="h-64" role="img" aria-label="Weekly submissions received and graded over the last 10 weeks">
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: { color: t.tick, usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8 },
            },
            tooltip: {
              ...t.tooltip,
              callbacks: {
                title: (items) => `Week of ${items[0]?.label ?? ""}`,
                afterBody: (items) => {
                  const w = trend[items[0]?.dataIndex ?? 0];
                  return w?.avg_score != null ? [`Avg score graded: ${w.avg_score}%`] : [];
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: t.tick, font: { size: 11 } }, border: { color: t.grid } },
            y: {
              beginAtZero: true,
              ticks: { color: t.tick, precision: 0, font: { size: 11 } },
              grid: { color: t.grid },
              border: { display: false },
            },
          },
        }}
      />
    </div>
  );
}

export function ScoreDistributionChart({ distribution }: { distribution: InstructorOverview["distribution"] }) {
  const t = useChartTheme();
  const total = distribution.reduce((n, b) => n + b.count, 0);
  const data = {
    labels: distribution.map((b) => b.band),
    datasets: [
      {
        label: "Scores",
        data: distribution.map((b) => b.count),
        backgroundColor: t.s1,
        hoverBackgroundColor: t.s1,
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: "bottom" as const,
        // 2px surface gap between neighbouring bars
        borderColor: t.surface,
        borderWidth: { left: 1, right: 1 },
        maxBarThickness: 36,
      },
    ],
  };
  return (
    <div className="h-64" role="img" aria-label="How graded scores are spread across score bands">
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...t.tooltip,
              displayColors: false,
              callbacks: {
                title: (items) => `Score ${items[0]?.label ?? ""}%`,
                label: (item: TooltipItem<"bar">) => {
                  const n = Number(item.raw);
                  return `${n} result${n === 1 ? "" : "s"} (${total ? Math.round((n / total) * 100) : 0}%)`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: t.tick, font: { size: 10 }, maxRotation: 0, autoSkip: false },
              border: { color: t.grid },
              title: { display: true, text: "Score band (%)", color: t.tick, font: { size: 11 } },
            },
            y: { beginAtZero: true, ticks: { color: t.tick, precision: 0 }, grid: { color: t.grid }, border: { display: false } },
          },
        }}
      />
    </div>
  );
}

export function SubjectComparisonChart({
  subjects,
  onSelect,
}: {
  subjects: SubjectSummary[];
  onSelect?: (subjectId: number) => void;
}) {
  const t = useChartTheme();
  const themeRef = useRef(t);
  themeRef.current = t;
  const rule = useMemo(() => passRule(themeRef, "x"), []);
  const rows = subjects.filter((s) => s.avg_score != null);
  const data = {
    labels: rows.map(subjectLabel),
    datasets: [
      {
        label: "Class average",
        data: rows.map((s) => s.avg_score ?? 0),
        backgroundColor: t.s1,
        hoverBackgroundColor: t.s1,
        borderRadius: { topRight: 4, bottomRight: 4 },
        borderSkipped: "left" as const,
        barThickness: 14,
      },
    ],
  };
  return (
    <div
      style={{ height: Math.max(140, rows.length * 38 + 40) }}
      role="img"
      aria-label="Class average score per subject compared with the pass mark"
    >
      <Bar
        data={data}
        plugins={[rule]}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_e, els) => {
            const el = els[0];
            if (el && onSelect) onSelect(rows[el.index].subject_id);
          },
          onHover: (e, els) => {
            const target = e.native?.target as HTMLElement | undefined;
            if (target) target.style.cursor = els.length && onSelect ? "pointer" : "default";
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...t.tooltip,
              displayColors: false,
              callbacks: {
                title: (items) => rows[items[0]?.dataIndex ?? 0]?.subject_name ?? "",
                label: (item) => {
                  const s = rows[item.dataIndex];
                  const lines = [`Class average: ${s.avg_score}%`];
                  if (s.pass_rate != null) lines.push(`Passing: ${s.pass_rate}% of students`);
                  if (s.participation != null) lines.push(`Participation: ${s.participation}%`);
                  return lines;
                },
                footer: () => (onSelect ? "Click to focus this subject" : ""),
              },
            },
          },
          scales: {
            x: {
              min: 0,
              max: 100,
              ticks: { color: t.tick, callback: (v) => `${v}%`, stepSize: 25 },
              grid: { color: t.grid },
              border: { display: false },
            },
            y: { grid: { display: false }, ticks: { color: t.tick, font: { size: 12, weight: 600 } }, border: { color: t.grid } },
          },
        }}
      />
    </div>
  );
}
