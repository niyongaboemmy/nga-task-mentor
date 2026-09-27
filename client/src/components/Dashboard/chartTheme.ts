import { useMemo } from "react";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * Colours for the dashboard charts. Chart.js paints with plain colours, so the
 * Tailwind `dark:` variant can't reach it; everything is rebuilt when the theme
 * flips. Every palette here was checked with the dataviz validate_palette.js
 * script against the card surface in both modes.
 *
 * - s1/s2: two-series charts (blue = primary series, orange = second).
 * - status: the 4-part task donut, in its validated adjacency order
 *   (blue to do, orange missed, aqua marked, yellow awaiting). In light mode
 *   aqua/yellow sit under 3:1 contrast, so the donut always ships a labelled
 *   legend.
 */
const PALETTE = {
  light: {
    s1: "#2a78d6",
    s2: "#eb6834",
    status: { todo: "#2a78d6", missed: "#eb6834", marked: "#1baf7a", awaiting: "#eda100" },
    track: "#e5e7eb",
    tick: "#64748b",
    grid: "rgba(148,163,184,0.2)",
    surface: "#ffffff",
    ink: "#1e293b",
  },
  dark: {
    s1: "#3987e5",
    s2: "#d95926",
    status: { todo: "#3987e5", missed: "#d95926", marked: "#199e70", awaiting: "#c98500" },
    track: "#334155",
    tick: "#94a3b8",
    grid: "rgba(148,163,184,0.12)",
    surface: "#1c2635",
    ink: "#f1f5f9",
  },
};

export function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return useMemo(
    () => ({
      isDark,
      ...(isDark ? PALETTE.dark : PALETTE.light),
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

export type ChartTheme = ReturnType<typeof useChartTheme>;
