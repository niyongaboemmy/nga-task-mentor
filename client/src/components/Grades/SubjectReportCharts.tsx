import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  type ChartEvent,
  type ActiveElement,
  type TooltipItem,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import type { Plugin } from "chart.js";
import { useTheme } from "../../contexts/ThemeContext";
import {
  BANDS,
  bandMeta,
  bandOf,
  type AssessmentStat,
  type BandKey,
} from "../../services/subjectReportApi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

// ─── Shared theme tokens ──────────────────────────────────────────────────────
// Chart.js paints with plain colors, so the Tailwind `dark:` variant can't
// reach it — every axis/grid/tooltip color is rebuilt when the theme flips.

const useChartTheme = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return useMemo(
    () => ({
      isDark,
      tick: isDark ? "#94a3b8" : "#64748b",
      grid: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.18)",
      // The chart's actual ground: card-dark (#334155) at 30% over
      // background-dark (#0f172a) in dark mode, plain card-light in light.
      surface: isDark ? "#1c2635" : "#ffffff",
      tooltip: {
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(15, 23, 42, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)",
        borderWidth: 1,
      },
    }),
    [isDark],
  );
};

// ─── Local plugins ────────────────────────────────────────────────────────────
// Two things every reader of these charts needs and a bare canvas doesn't give:
// the value without hovering, and the 50% pass mark to judge it against.

// Both plugins read their colors through a ref rather than closing over them:
// react-chartjs-2 registers plugin instances when the chart is *created*, so a
// plugin that captured the palette would keep painting last theme's colors
// after a light/dark toggle.
type ThemeRef = { current: { tick: string; surface: string } };

/** Writes each bar's value just past its end, in ink — never in the bar color. */
const barValueLabels = (theme: ThemeRef): Plugin<"bar"> => ({
  id: "barValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";
    // A surface-colored halo keeps the value legible where it crosses the
    // dashed pass line.
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.current.surface;
    ctx.fillStyle = theme.current.tick;
    meta.data.forEach((bar, i) => {
      const value = chart.data.datasets[0].data[i] as number;
      ctx.strokeText(`${value}%`, bar.x + 6, bar.y);
      ctx.fillText(`${value}%`, bar.x + 6, bar.y);
    });
    ctx.restore();
  },
});

/** A dashed 50% rule — the line between "passing" and "needs intervention". */
const passLine = (theme: ThemeRef, axis: "x" | "y"): Plugin => ({
  id: `passLine-${axis}`,
  beforeDatasetsDraw(chart) {
    const scale = chart.scales[axis];
    const { ctx, chartArea } = chart;
    if (!scale || !chartArea) return;
    const at = scale.getPixelForValue(50);
    const color = theme.current.tick;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(at, chartArea.top);
      ctx.lineTo(at, chartArea.bottom);
    } else {
      ctx.moveTo(chartArea.left, at);
      ctx.lineTo(chartArea.right, at);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 10px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = color;
    if (axis === "x") {
      ctx.textAlign = "center";
      ctx.fillText("Pass 50%", at, chartArea.top - 4);
    } else {
      ctx.textAlign = "left";
      ctx.fillText("Pass 50%", chartArea.left + 4, at - 5);
    }
    ctx.restore();
  },
});

/** A stable ref carrying the *current* theme colors into chart plugins. */
const useThemeRef = (theme: { tick: string; surface: string }): ThemeRef => {
  const ref = useRef({ tick: theme.tick, surface: theme.surface });
  ref.current = { tick: theme.tick, surface: theme.surface };
  return ref;
};

const KIND_LABEL: Record<AssessmentStat["kind"], string> = {
  quiz: "Quiz",
  assignment: "Assignment",
  manual: "Recorded",
};

// ─── Per-assessment class average ─────────────────────────────────────────────
// Horizontal bars: the label is the assessment's name, and names don't fit
// under a vertical axis without rotating them into illegibility. Ranked worst
// → best so the assessment that needs attention is the first thing read.

export function AssessmentAveragesChart({
  assessments,
  selectedKey,
  onSelect,
}: {
  assessments: AssessmentStat[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const t = useChartTheme();
  const themeRef = useThemeRef(t);
  const plugins = useMemo(
    () => [barValueLabels(themeRef), passLine(themeRef, "x")],
    [themeRef],
  );
  const marked = useMemo(
    () =>
      assessments
        .filter((a) => a.averagePct !== null)
        .sort((a, b) => (a.averagePct ?? 0) - (b.averagePct ?? 0)),
    [assessments],
  );

  const data = useMemo(
    () => ({
      labels: marked.map((a) => a.title),
      datasets: [
        {
          label: "Class average",
          data: marked.map((a) => a.averagePct ?? 0),
          backgroundColor: marked.map((a) => {
            const color = bandMeta(bandOf(a.averagePct ?? 0)).color;
            // The unselected bars recede while one is picked, so the chart
            // and the table below always agree on what's in focus.
            return selectedKey && selectedKey !== a.key ? `${color}59` : color;
          }),
          borderRadius: 4,
          borderSkipped: false as const,
          barThickness: 18,
          maxBarThickness: 22,
        },
      ],
    }),
    [marked, selectedKey],
  );

  const options = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 14 } },
      animation: { duration: 700, easing: "easeOutQuart" as const },
      onClick: (_e: ChartEvent, els: ActiveElement[]) => {
        const hit = marked[els[0]?.index ?? -1];
        if (hit) onSelect(selectedKey === hit.key ? null : hit.key);
      },
      onHover: (e: ChartEvent, els: ActiveElement[]) => {
        const target = e.native?.target as HTMLElement | null;
        if (target) target.style.cursor = els.length ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...t.tooltip,
          callbacks: {
            title: (items: TooltipItem<"bar">[]) => marked[items[0].dataIndex].title,
            label: (ctx: TooltipItem<"bar">) => {
              const a = marked[ctx.dataIndex];
              return [
                `${KIND_LABEL[a.kind]} · max ${a.maxScore}`,
                `Class average ${a.averagePct}%`,
                `Marked ${a.markedCount}/${a.rosterSize}`,
                a.failingCount > 0 ? `${a.failingCount} below 50%` : "Nobody below 50%",
              ];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          // 108 not 100: the value label sits past the end of a full bar.
          max: 108,
          grid: { color: t.grid, drawTicks: false },
          border: { display: false },
          ticks: {
            color: t.tick,
            font: { size: 11 },
            stepSize: 25,
            callback: (v: string | number) => (Number(v) > 100 ? "" : `${v}%`),
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: t.tick,
            font: { size: 11 },
            callback(this: { getLabelForValue: (v: number) => string }, value: string | number) {
              const label = this.getLabelForValue(Number(value));
              return label.length > 22 ? `${label.slice(0, 21)}…` : label;
            },
          },
        },
      },
    }),
    [marked, onSelect, selectedKey, t],
  );

  if (marked.length === 0) {
    return (
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-12 text-center">
        No assessment has been marked yet — averages appear as soon as the first
        marks are in.
      </p>
    );
  }

  return (
    <div style={{ height: Math.max(180, marked.length * 34 + 52) }}>
      <Bar
        data={data}
        options={options}
        plugins={plugins}
      />
    </div>
  );
}

// ─── Class average over time ──────────────────────────────────────────────────
// Change-over-time, one series → a line, no legend (the card title names it).

export function PerformanceTrendChart({ timeline }: { timeline: AssessmentStat[] }) {
  const t = useChartTheme();
  const themeRef = useThemeRef(t);
  const plugins = useMemo(() => [passLine(themeRef, "y")], [themeRef]);

  const data = useMemo(
    () => ({
      labels: timeline.map((a) =>
        a.date
          ? new Date(a.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
          : a.title,
      ),
      datasets: [
        {
          label: "Class average",
          data: timeline.map((a) => a.averagePct ?? 0),
          borderColor: "#3b82f6",
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          backgroundColor: (ctx: { chart: ChartJS }) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return "rgba(59,130,246,0.15)";
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, "rgba(59,130,246,0.28)");
            g.addColorStop(1, "rgba(59,130,246,0)");
            return g;
          },
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: timeline.map((a) => bandMeta(bandOf(a.averagePct ?? 0)).color),
          pointBorderColor: t.surface,
          pointBorderWidth: 2,
        },
      ],
    }),
    [timeline, t.surface],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: "easeOutQuart" as const },
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...t.tooltip,
          callbacks: {
            title: (items: TooltipItem<"line">[]) => timeline[items[0].dataIndex].title,
            label: (ctx: TooltipItem<"line">) => {
              const a = timeline[ctx.dataIndex];
              return [
                `Class average ${a.averagePct}%`,
                `Marked ${a.markedCount}/${a.rosterSize}`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: t.grid, drawTicks: false },
          border: { display: false },
          ticks: { color: t.tick, font: { size: 11 }, stepSize: 25, callback: (v: string | number) => `${v}%` },
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: t.tick, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
        },
      },
    }),
    [timeline, t],
  );

  if (timeline.length < 2) {
    return (
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-12 text-center">
        A trend needs at least two dated, marked assessments.
      </p>
    );
  }

  return (
    <div className="h-[220px]">
      <Line data={data} options={options} plugins={plugins} />
    </div>
  );
}

// ─── Band distribution ────────────────────────────────────────────────────────
// Parts of one whole (the marked cohort) → a doughnut, with the legend built
// in HTML so counts and labels wear text tokens rather than the band color.

export function BandDistributionChart({
  bandCounts,
  activeBand,
  onSelectBand,
}: {
  bandCounts: Record<BandKey, number>;
  activeBand: BandKey | null;
  onSelectBand: (band: BandKey | null) => void;
}) {
  const t = useChartTheme();
  const total = BANDS.reduce((acc, b) => acc + (bandCounts[b.key] ?? 0), 0);

  const data = useMemo(
    () => ({
      labels: BANDS.map((b) => `${b.label} (${b.short})`),
      datasets: [
        {
          data: BANDS.map((b) => bandCounts[b.key] ?? 0),
          backgroundColor: BANDS.map((b) =>
            activeBand && activeBand !== b.key ? `${b.color}59` : b.color,
          ),
          // A 2px surface-colored ring keeps adjacent arcs from bleeding
          // into one another.
          borderColor: t.surface,
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [bandCounts, activeBand, t.surface],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      animation: { duration: 700, easing: "easeOutQuart" as const },
      onClick: (_e: ChartEvent, els: ActiveElement[]) => {
        const band = BANDS[els[0]?.index ?? -1];
        if (band) onSelectBand(activeBand === band.key ? null : band.key);
      },
      onHover: (e: ChartEvent, els: ActiveElement[]) => {
        const target = e.native?.target as HTMLElement | null;
        if (target) target.style.cursor = els.length ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...t.tooltip,
          callbacks: {
            label: (ctx: TooltipItem<"doughnut">) => {
              const count = Number(ctx.raw) || 0;
              const share = total > 0 ? Math.round((count / total) * 100) : 0;
              return `${count} student${count !== 1 ? "s" : ""} · ${share}%`;
            },
          },
        },
      },
    }),
    [activeBand, onSelectBand, t, total],
  );

  if (total === 0) {
    return (
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-12 text-center">
        Nobody has a mark yet, so there's no distribution to show.
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-[180px] w-[180px] flex-shrink-0">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
            {total}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
            Marked
          </span>
        </div>
      </div>

      {/* Legend doubles as a filter for the roster table below. */}
      <ul className="flex-1 w-full space-y-1.5">
        {BANDS.map((b) => {
          const count = bandCounts[b.key] ?? 0;
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          const isActive = activeBand === b.key;
          return (
            <li key={b.key}>
              <button
                onClick={() => onSelectBand(isActive ? null : b.key)}
                aria-pressed={isActive}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                  isActive
                    ? "bg-surface-light dark:bg-surface-dark ring-1 ring-blue-500/40"
                    : "hover:bg-surface-light/70 dark:hover:bg-surface-dark/50"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: b.color }}
                  aria-hidden
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {b.label}
                  </span>
                  <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                    {b.short}
                  </span>
                </span>
                <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                  {count}
                </span>
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 tabular-nums w-9 text-right">
                  {share}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Subject comparison (student view) ────────────────────────────────────────
// Same grammar as AssessmentAveragesChart — horizontal bars, weakest first,
// value labels, the 50% pass rule — but fed plain rows, because a student's
// axis is their subjects rather than one subject's assessments. Only subjects
// that actually carry a mark should ever be passed in; plotting an unassessed
// subject as 0% is the bug this page used to have.

export interface SubjectBar {
  key: string;
  label: string;
  value: number;
  /** Extra tooltip lines, rendered under the value. */
  tooltip?: string[];
}

export function SubjectAveragesChart({
  subjects,
  onSelect,
}: {
  subjects: SubjectBar[];
  onSelect?: (key: string) => void;
}) {
  const t = useChartTheme();
  const themeRef = useThemeRef(t);
  const plugins = useMemo(
    () => [barValueLabels(themeRef), passLine(themeRef, "x")],
    [themeRef],
  );

  const ordered = useMemo(
    () => [...subjects].sort((a, b) => a.value - b.value),
    [subjects],
  );

  const data = useMemo(
    () => ({
      labels: ordered.map((s) => s.label),
      datasets: [
        {
          label: "Average",
          data: ordered.map((s) => s.value),
          backgroundColor: ordered.map((s) => bandMeta(bandOf(s.value)).color),
          borderRadius: 4,
          borderSkipped: false as const,
          barThickness: 18,
          maxBarThickness: 22,
        },
      ],
    }),
    [ordered],
  );

  const options = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 14 } },
      animation: { duration: 700, easing: "easeOutQuart" as const },
      onClick: (_e: ChartEvent, els: ActiveElement[]) => {
        const hit = ordered[els[0]?.index ?? -1];
        if (hit && onSelect) onSelect(hit.key);
      },
      onHover: (e: ChartEvent, els: ActiveElement[]) => {
        const target = e.native?.target as HTMLElement | null;
        if (target) target.style.cursor = els.length && onSelect ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...t.tooltip,
          callbacks: {
            title: (items: TooltipItem<"bar">[]) => ordered[items[0].dataIndex].label,
            label: (ctx: TooltipItem<"bar">) => [
              `${ordered[ctx.dataIndex].value}%`,
              ...(ordered[ctx.dataIndex].tooltip ?? []),
            ],
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 108,
          grid: { color: t.grid, drawTicks: false },
          border: { display: false },
          ticks: {
            color: t.tick,
            font: { size: 11 },
            stepSize: 25,
            callback: (v: string | number) => (Number(v) > 100 ? "" : `${v}%`),
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: t.tick, font: { size: 11 } },
        },
      },
    }),
    [ordered, onSelect, t],
  );

  if (ordered.length === 0) return null;

  return (
    <div style={{ height: Math.max(160, ordered.length * 32 + 52) }}>
      <Bar data={data} options={options} plugins={plugins} />
    </div>
  );
}
