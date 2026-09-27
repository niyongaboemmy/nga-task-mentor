import React, { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  type Plugin,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useChartTheme, type ChartTheme } from "../chartTheme";
import { PASS_MARK } from "../../../services/studentOverviewApi";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip);

const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark/80",
  muted: "text-text-secondary-light/80 dark:text-text-secondary-dark/60",
};

// ─── Task status donut ────────────────────────────────────────────────────────

export type StatusKey = "todo" | "missed" | "marked" | "awaiting";
const STATUS_ORDER: StatusKey[] = ["todo", "missed", "marked", "awaiting"]; // validated adjacency order
const STATUS_LABEL: Record<StatusKey, string> = {
  todo: "To do",
  missed: "Missed",
  marked: "Marked",
  awaiting: "Awaiting mark",
};

/**
 * Where all my work stands, at a glance. Segments and legend rows are
 * clickable (they open that group in My tasks); the legend always shows the
 * count, so colour never carries the meaning alone.
 */
export const StatusDonut: React.FC<{
  counts: Record<StatusKey, number>;
  onSelect?: (k: StatusKey) => void;
}> = ({ counts, onSelect }) => {
  const t = useChartTheme();
  const total = STATUS_ORDER.reduce((n, k) => n + counts[k], 0);
  const keys = STATUS_ORDER.filter((k) => counts[k] > 0);
  const data = {
    labels: keys.map((k) => STATUS_LABEL[k]),
    datasets: [
      {
        data: total ? keys.map((k) => counts[k]) : [1],
        backgroundColor: total ? keys.map((k) => t.status[k]) : [t.track],
        hoverOffset: total ? 6 : 0,
        borderColor: t.surface,
        borderWidth: 2,
        spacing: 1,
      },
    ],
  };
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-28 h-28 shrink-0" role="img" aria-label={`${total} tasks: ${keys.map((k) => `${counts[k]} ${STATUS_LABEL[k]}`).join(", ")}`}>
        <Doughnut
          data={data}
          options={{
            cutout: "72%",
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateRotate: true, duration: 700 },
            onClick: (_e, els) => {
              if (total && els[0] && onSelect) onSelect(keys[els[0].index]);
            },
            onHover: (e, els) => {
              const el = e.native?.target as HTMLElement | undefined;
              if (el) el.style.cursor = els.length && onSelect && total ? "pointer" : "default";
            },
            plugins: {
              legend: { display: false },
              tooltip: total ? { ...t.tooltip, displayColors: false } : { enabled: false },
            },
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-2xl font-bold ${ink.primary}`}>{total}</span>
          <span className={`text-[10px] uppercase tracking-wide ${ink.muted}`}>tasks</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1 min-w-0">
        {STATUS_ORDER.map((k) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => onSelect?.(k)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left hover:bg-surface-light dark:hover:bg-surface-dark/60 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.status[k] }} aria-hidden />
              <span className={`flex-1 text-xs ${ink.secondary}`}>{STATUS_LABEL[k]}</span>
              <span className={`text-sm font-semibold tabular-nums ${ink.primary}`}>{counts[k]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Ring gauge ───────────────────────────────────────────────────────────────

/**
 * A 0-100 ring with the value in the middle and an optional reference tick
 * (e.g. the class average). SVG, so it animates and scales cleanly.
 */
export const RingGauge: React.FC<{
  value: number | null;
  label: string;
  caption?: React.ReactNode;
  reference?: { value: number; label: string } | null;
  tone?: "auto" | "blue";
  title?: string;
}> = ({ value, label, caption, reference, tone = "auto", title }) => {
  const t = useChartTheme();
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const color =
    tone === "blue" || value == null
      ? t.s1
      : v < PASS_MARK
        ? "#d03b3b" // status critical
        : v < 65
          ? t.status.awaiting
          : t.s1;
  const refAngle = reference ? (Math.max(0, Math.min(100, reference.value)) / 100) * 360 - 90 : 0;
  const rx = (deg: number, rad: number) => 50 + rad * Math.cos((deg * Math.PI) / 180);
  const ry = (deg: number, rad: number) => 50 + rad * Math.sin((deg * Math.PI) / 180);
  return (
    <div className="flex flex-col items-center text-center" title={title}>
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-0" role="img" aria-label={`${label}: ${value == null ? "no data" : `${Math.round(v)}%`}${reference ? `, ${reference.label} ${Math.round(reference.value)}%` : ""}`}>
          <circle cx="50" cy="50" r={r} fill="none" stroke={t.track} strokeWidth="9" />
          {v > 0 && <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * c} ${c}`}
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dasharray 900ms ease" }}
          />}
          {reference && (
            <line
              x1={rx(refAngle, r - 8)}
              y1={ry(refAngle, r - 8)}
              x2={rx(refAngle, r + 8)}
              y2={ry(refAngle, r + 8)}
              stroke={t.ink}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${ink.primary}`}>{value == null ? "—" : `${Math.round(v)}%`}</span>
        </div>
      </div>
      <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${ink.secondary}`}>{label}</p>
      {caption && <div className={`text-xs ${ink.muted}`}>{caption}</div>}
    </div>
  );
};

// ─── Rank track ───────────────────────────────────────────────────────────────

/** "6th of 36" as a position on a line: first place on the right. */
export const RankTrack: React.FC<{ rank: number | null; of: number; band: string | null }> = ({ rank, of, band }) => {
  const t = useChartTheme();
  const pos = rank && of > 1 ? ((of - rank) / (of - 1)) * 100 : rank ? 100 : null;
  return (
    <div className="flex flex-col items-center justify-center text-center h-full">
      <div className={`text-3xl font-bold ${ink.primary}`}>
        {rank ?? "—"}
        {rank ? <span className={`text-sm font-medium ${ink.muted}`}> / {of}</span> : null}
      </div>
      <div className="w-full max-w-[11rem] mt-3" aria-hidden>
        <div className="relative h-2 rounded-full" style={{ background: t.track }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pos ?? 0}%`, background: t.s1, transition: "width 900ms ease" }} />
          {pos != null && (
            <span
              className="absolute top-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full border-2 shadow"
              style={{ left: `${pos}%`, background: t.surface, borderColor: t.s1, transition: "left 900ms ease" }}
            />
          )}
        </div>
        <div className={`flex justify-between text-[10px] mt-1 ${ink.muted}`}>
          <span>{of || "—"}</span>
          <span>1st</span>
        </div>
      </div>
      <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${ink.secondary}`}>Class rank</p>
      <p className={`text-xs ${ink.muted}`}>{rank ? band ?? "" : "after your first marks"}</p>
    </div>
  );
};

// ─── Subject bars ─────────────────────────────────────────────────────────────

export interface SubjectBar {
  id: number;
  label: string;
  name: string;
  me: number | null;
  classAvg: number | null;
  todo: number;
}

/** Draws each subject's class average as a short vertical tick across its bar. */
const classTicks = (ref: { current: { rows: SubjectBar[]; t: ChartTheme } }): Plugin<"bar"> => ({
  id: "classTicks",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const x = chart.scales.x;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ref.current.rows.forEach((row, i) => {
      const bar = meta.data[i] as unknown as { y: number; height: number } | undefined;
      if (!bar || row.classAvg == null) return;
      const px = x.getPixelForValue(row.classAvg);
      ctx.strokeStyle = ref.current.t.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, bar.y - bar.height / 2 - 4);
      ctx.lineTo(px, bar.y + bar.height / 2 + 4);
      ctx.stroke();
    });
    // pass mark
    const pass = x.getPixelForValue(PASS_MARK);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = ref.current.t.tick;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pass, chart.chartArea.top);
    ctx.lineTo(pass, chart.chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
});

/**
 * My score per subject (bar) against the class average (tick) and the pass
 * mark (thin rule). Click a bar to open the subject.
 */
export const SubjectBars: React.FC<{ rows: SubjectBar[]; onSelect?: (id: number) => void }> = ({ rows, onSelect }) => {
  const t = useChartTheme();
  const ref = useRef({ rows, t });
  ref.current = { rows, t };
  const plugin = useMemo(() => classTicks(ref), []);
  const data = {
    labels: rows.map((r) => r.label),
    datasets: [
      {
        label: "You",
        data: rows.map((r) => r.me ?? 0),
        backgroundColor: rows.map((r) => (r.me == null ? t.track : t.s1)),
        hoverBackgroundColor: rows.map((r) => (r.me == null ? t.track : t.s1)),
        borderRadius: { topRight: 4, bottomRight: 4 },
        borderSkipped: "left" as const,
        barThickness: 14,
      },
    ],
  };
  return (
    <div style={{ height: Math.max(150, rows.length * 44 + 36) }} role="img" aria-label="Your score per subject compared with the class average">
      <Bar
        data={data}
        plugins={[plugin]}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 700 },
          onClick: (_e, els) => {
            if (els[0] && onSelect) onSelect(rows[els[0].index].id);
          },
          onHover: (e, els) => {
            const el = e.native?.target as HTMLElement | undefined;
            if (el) el.style.cursor = els.length && onSelect ? "pointer" : "default";
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...t.tooltip,
              displayColors: false,
              callbacks: {
                title: (items) => rows[items[0]?.dataIndex ?? 0]?.name ?? "",
                label: (item) => {
                  const r = rows[item.dataIndex];
                  const lines = [r.me == null ? "You: no marks yet" : `You: ${Math.round(r.me)}%`];
                  if (r.classAvg != null) lines.push(`Class average: ${Math.round(r.classAvg)}%`);
                  if (r.todo) lines.push(`${r.todo} task${r.todo === 1 ? "" : "s"} to do`);
                  return lines;
                },
                footer: () => (onSelect ? "Click to open the subject" : ""),
              },
            },
          },
          scales: {
            x: { min: 0, max: 100, ticks: { color: t.tick, stepSize: 25, callback: (v) => `${v}%` }, grid: { color: t.grid }, border: { display: false } },
            y: { grid: { display: false }, ticks: { color: t.tick, font: { size: 12, weight: 600 } }, border: { color: t.grid } },
          },
        }}
      />
    </div>
  );
};

// ─── Marks trend ──────────────────────────────────────────────────────────────

export interface TrendPoint {
  at: string;
  pct: number;
  title: string;
  subject: string;
  url: string | null;
}

/** Each mark in time order, against the pass mark. Click a point to open it. */
export const MarksTrend: React.FC<{ points: TrendPoint[]; onOpen?: (url: string) => void }> = ({ points, onOpen }) => {
  const t = useChartTheme();
  const data = {
    labels: points.map((p) => new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
    datasets: [
      {
        label: "Mark",
        data: points.map((p) => p.pct),
        borderColor: t.s1,
        backgroundColor: t.isDark ? "rgba(57,135,229,0.15)" : "rgba(42,120,214,0.12)",
        fill: true,
        tension: 0.3,
        cubicInterpolationMode: "monotone" as const,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: points.map((p) => (p.pct < PASS_MARK ? "#d03b3b" : t.s1)),
        pointBorderColor: t.surface,
        pointBorderWidth: 2,
      },
      {
        label: "Pass mark",
        data: points.map(() => PASS_MARK),
        borderColor: t.tick,
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      },
    ],
  };
  return (
    <div className="h-44" role="img" aria-label="Your marks over time compared with the 50% pass mark">
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "nearest", intersect: false },
          onClick: (_e, els) => {
            const p = els[0] ? points[els[0].index] : null;
            if (p?.url && onOpen) onOpen(p.url);
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...t.tooltip,
              displayColors: false,
              filter: (item) => item.datasetIndex === 0,
              callbacks: {
                title: (items) => points[items[0]?.dataIndex ?? 0]?.title ?? "",
                label: (item) => {
                  const p = points[item.dataIndex];
                  return [`${Math.round(p.pct)}% · ${p.subject}`, p.pct < PASS_MARK ? "Below the pass mark" : "Passed"];
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: t.tick, font: { size: 10 }, maxRotation: 0, autoSkip: true }, border: { color: t.grid } },
            y: { min: 0, max: 100, ticks: { color: t.tick, stepSize: 50, callback: (v) => `${v}%` }, grid: { color: t.grid }, border: { display: false } },
          },
        }}
      />
    </div>
  );
};
