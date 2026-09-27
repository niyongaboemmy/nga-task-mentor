import React, { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  Brain,
  CheckCircle2,
  Download,
  FileQuestion,
  Info,
  Layers,
  Lightbulb,
  Printer,
  RefreshCw,
  Repeat,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type {
  AlertSeverity,
  BankAlert,
  QuestionBankOverview,
  SubjectBankStats,
} from "../../../services/questionBankHubApi";
import type { QuestionType } from "../../../types/quiz.types";
import { getQuestionTypeIcon } from "../questionTypeIcons";
import { formatDateTimeLocal } from "../../../utils/dateUtils";

/**
 * Question Bank hub -- the "Dashboard" tab. Pure presentation over the
 * /question-bank/overview payload; the page owns fetching and the subject
 * filter. Bars are plain HTML (not canvas) so they follow the app theme,
 * stay keyboard/screen-reader readable and print cleanly.
 */

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const typeLabel = (t: string) => t.replace(/_/g, " ");
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const CARD =
  "bg-card-light dark:bg-card-dark/30 rounded-2xl border border-gray-200/70 dark:border-border-dark/30 shadow-sm";
const SECONDARY = "text-slate-600 dark:text-slate-300";

const SEVERITY: Record<AlertSeverity, { icon: React.ElementType; label: string; cls: string; dot: string }> = {
  critical: {
    icon: AlertOctagon,
    label: "Action needed",
    cls: "border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    label: "Needs attention",
    cls: "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  info: {
    icon: Lightbulb,
    label: "Suggestion",
    cls: "border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  success: {
    icon: CheckCircle2,
    label: "Good news",
    cls: "border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

const DIFFICULTY_SEGMENTS = [
  { key: "easy", label: "Easy", cls: "bg-emerald-500" },
  { key: "medium", label: "Medium", cls: "bg-amber-500" },
  { key: "difficult", label: "Difficult", cls: "bg-rose-500" },
  { key: "no_difficulty", label: "Not set", cls: "bg-slate-300 dark:bg-slate-600" },
] as const;

function healthTone(score: number) {
  if (score >= 75) return { label: "Healthy", ring: "text-emerald-500", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" };
  if (score >= 50) return { label: "Fair", ring: "text-amber-500", chip: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" };
  return { label: "Weak", ring: "text-rose-500", chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" };
}

/* ── small building blocks ──────────────────────────────────────────────── */

const HealthRing: React.FC<{ score: number; size?: number }> = ({ score, size = 76 }) => {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const tone = healthTone(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Bank health ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={6} className="fill-none stroke-gray-200 dark:stroke-gray-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={`fill-none stroke-current transition-[stroke-dashoffset] duration-700 ${tone.ring}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
        {score}
      </span>
    </div>
  );
};

const Kpi: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint: string;
  accent: string;
}> = ({ icon: Icon, label, value, hint, accent }) => (
  <div className={`${CARD} p-4 flex items-start gap-3`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <p className={`text-xs font-medium ${SECONDARY}`}>{label}</p>
      <p className="text-2xl font-bold leading-tight text-text-primary-light dark:text-text-primary-dark">{value}</p>
      <p className={`text-[11px] mt-0.5 ${SECONDARY}`}>{hint}</p>
    </div>
  </div>
);

/** Labelled horizontal bar; value text sits in ink, never in the bar colour. */
const BarRow: React.FC<{ label: React.ReactNode; value: number; max: number; barCls?: string; suffix?: string }> = ({
  label,
  value,
  max,
  barCls = "bg-blue-500",
  suffix,
}) => (
  <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs" title={`${value}${suffix ?? ""}`}>
    <span className={`truncate ${SECONDARY}`}>{label}</span>
    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <div className={`h-full rounded-full ${barCls} transition-[width] duration-500`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
    <span className="tabular-nums font-semibold text-text-primary-light dark:text-text-primary-dark w-8 text-right">{value}</span>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ElementType; aside?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  icon: Icon,
  aside,
  children,
  className = "",
}) => (
  <section className={`${CARD} p-5 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 mb-4">
      <h3 className="flex shrink-0 items-center gap-2 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {title}
      </h3>
      {aside}
    </div>
    {children}
  </section>
);

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className={`text-xs py-6 text-center ${SECONDARY}`}>{children}</p>
);

/* ── report export ──────────────────────────────────────────────────────── */

function downloadCsv(subjects: SubjectBankStats[]) {
  const header = [
    "Subject code", "Subject", "Questions", "Mine", "Easy", "Medium", "Difficult", "Difficulty not set",
    "With explanation %", "Bloom's classified %", "Higher-order %", "Linked to scheme %",
    "Topics covered", "Used in quizzes", "Added last 7 days", "Added last 30 days", "Last added", "Health score",
  ];
  const rows = subjects.map((s) => [
    s.subject_code ?? "", s.subject_name, s.total, s.mine, s.easy, s.medium, s.difficult, s.no_difficulty,
    pct(s.with_explanation, s.total), pct(s.blooms_classified, s.total), pct(s.higher_order, s.blooms_classified),
    pct(s.sow_linked, s.total), s.topics_covered, s.used_in_quizzes, s.added_7d, s.added_30d,
    s.last_added_at ?? "", s.health_score,
  ]);
  const escape = (v: unknown) => {
    const str = String(v);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `question-bank-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── main ───────────────────────────────────────────────────────────────── */

interface Props {
  data: QuestionBankOverview;
  refreshing: boolean;
  onRefresh: () => void;
  /** Jump to the Questions tab for a subject (from an alert or report row). */
  onOpenSubject: (subjectId: number) => void;
}

const QuestionBankHubDashboard: React.FC<Props> = ({ data, refreshing, onRefresh, onOpenSubject }) => {
  const { totals, subjects, alerts } = data;
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const alertCounts = useMemo(() => {
    const c: Record<AlertSeverity, number> = { critical: 0, warning: 0, info: 0, success: 0 };
    alerts.forEach((a) => (c[a.severity] += 1));
    return c;
  }, [alerts]);
  const visibleAlerts = alerts.filter((a) => severityFilter === "all" || a.severity === severityFilter);
  const shownAlerts = showAllAlerts ? visibleAlerts : visibleAlerts.slice(0, 5);

  const tone = healthTone(totals.health_score);
  const singleSubject = data.subject_id != null;
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.count));
  const maxType = Math.max(1, ...data.by_type.map((t) => t.count));
  const maxBlooms = Math.max(1, ...data.by_blooms.map((b) => b.count));
  const maxTopic = Math.max(1, ...data.top_topics.map((t) => t.count));
  const subjectName = (id: number) => {
    const s = data.available_subjects.find((x) => x.id === id);
    return s ? s.code || s.name : `#${id}`;
  };

  const coverage = [
    { label: "Have an explanation", value: pct(totals.with_explanation, totals.total), tip: "Shown to students after they answer" },
    { label: "Bloom's classified", value: pct(totals.blooms_classified, totals.total), tip: "Needed for the thinking-skills mix" },
    { label: "Difficulty set", value: pct(totals.total - totals.no_difficulty, totals.total), tip: "Lets quizzes balance easy and hard" },
    { label: "Linked to scheme of work", value: pct(totals.sow_linked, totals.total), tip: "Maps questions to what was taught" },
    { label: "Used in a quiz", value: pct(totals.used_in_quizzes, totals.total), tip: "Questions that have reached students" },
  ];

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Toolbar: freshness + report actions (both views) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-xs ${SECONDARY}`}>
          {singleSubject ? "This subject's question bank" : `Across your ${subjects.length} subject${subjects.length === 1 ? "" : "s"}`}
          {" · "}updated {formatDateTimeLocal(data.generated_at)}
        </p>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(subjects)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>
      {/* Health summary + KPIs */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,22rem)_1fr] gap-5">
        <div className={`${CARD} p-5 flex items-center gap-4`}>
          <HealthRing score={totals.health_score} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Bank health</h3>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone.chip}`}>{tone.label}</span>
            </div>
            <p className={`text-xs mt-1 leading-relaxed ${SECONDARY}`}>
              {totals.total === 0
                ? "No questions yet. Your score grows as you add, explain and classify questions."
                : "Combines explanations, Bloom's classification, difficulty spread and scheme-of-work links."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            icon={FileQuestion}
            label="Questions"
            value={totals.total}
            hint={`${totals.mine} written by you`}
            accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
          />
          <Kpi
            icon={Sparkles}
            label="Added this week"
            value={totals.added_7d}
            hint={`${totals.added_30d} in the last 30 days`}
            accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
          />
          <Kpi
            icon={Brain}
            label="Higher-order"
            value={`${pct(totals.higher_order, totals.blooms_classified)}%`}
            hint="Analyse, evaluate or create"
            accent="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
          />
          <Kpi
            icon={Repeat}
            label="Used in quizzes"
            value={totals.used_in_quizzes}
            hint={`${Math.max(0, totals.total - totals.used_in_quizzes)} never used`}
            accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          />
        </div>
      </div>

      {/* Alerts (the "notify" layer) */}
      <Section
        title="Alerts & suggestions"
        icon={Bell}
        aside={
          <div className="flex flex-wrap items-center gap-1.5 print:hidden" role="group" aria-label="Filter alerts">
            {(["all", "critical", "warning", "info", "success"] as const).map((sev) => {
              const count = sev === "all" ? alerts.length : alertCounts[sev];
              if (sev !== "all" && count === 0) return null;
              const active = severityFilter === sev;
              return (
                <button
                  key={sev}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSeverityFilter(sev)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 text-slate-600 hover:border-gray-300 dark:border-gray-700 dark:text-slate-300"
                  }`}
                >
                  {sev !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY[sev].dot}`} />}
                  {sev === "all" ? "All" : SEVERITY[sev].label}
                  <span className="tabular-nums opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        }
      >
        {visibleAlerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Everything looks good. No gaps found in {singleSubject ? "this subject's" : "your"} question bank.
          </div>
        ) : (
          <ul className="space-y-2">
            {shownAlerts.map((a: BankAlert) => {
              const meta = SEVERITY[a.severity];
              const Icon = meta.icon;
              return (
                <li key={a.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 ${meta.cls}`}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-label={meta.label} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-xs mt-0.5 text-slate-600 dark:text-slate-300">{a.message}</p>
                    </div>
                  </div>
                  {a.subject_id != null && a.severity !== "success" && (
                    <button
                      type="button"
                      onClick={() => onOpenSubject(a.subject_id!)}
                      className="self-start sm:self-center inline-flex items-center gap-1 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-text-primary-light shadow-sm hover:bg-white dark:bg-gray-900/60 dark:text-text-primary-dark dark:hover:bg-gray-900 print:hidden"
                    >
                      Open questions <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {visibleAlerts.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllAlerts((v) => !v)}
            className="mt-3 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 print:hidden"
          >
            {showAllAlerts ? "Show fewer" : `Show all ${visibleAlerts.length}`}
          </button>
        )}
      </Section>

      {/* Report: per-subject table */}
      {!singleSubject && (
        <Section
          title="Subject report"
          icon={Layers}
        >
          {subjects.length === 0 ? (
            <EmptyNote>You have no subjects assigned for the selected academic period.</EmptyNote>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className={`text-left text-[11px] uppercase tracking-wide ${SECONDARY}`}>
                  <tr className="border-b border-gray-200/70 dark:border-gray-800">
                    <th className="px-5 py-2 font-semibold">Subject</th>
                    <th className="px-3 py-2 font-semibold text-right">Questions</th>
                    <th className="px-3 py-2 font-semibold min-w-[10rem]">Difficulty mix</th>
                    <th className="px-3 py-2 font-semibold text-right">Explained</th>
                    <th className="px-3 py-2 font-semibold text-right">Bloom's</th>
                    <th className="px-3 py-2 font-semibold text-right">Used</th>
                    <th className="px-3 py-2 font-semibold text-right">This week</th>
                    <th className="px-5 py-2 font-semibold text-right">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
                  {subjects.map((s) => {
                    const t = healthTone(s.health_score);
                    return (
                      <tr
                        key={s.subject_id}
                        className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40 focus-within:bg-gray-50/70"
                        onClick={() => onOpenSubject(s.subject_id)}
                      >
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSubject(s.subject_id);
                            }}
                            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                          >
                            <span className="block font-semibold text-text-primary-light dark:text-text-primary-dark">{s.subject_name}</span>
                            {s.subject_code && <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">{s.subject_code}</span>}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold text-text-primary-light dark:text-text-primary-dark">{s.total}</td>
                        <td className="px-3 py-3">
                          {s.total > 0 ? (
                            <div
                              className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full"
                              role="img"
                              aria-label={DIFFICULTY_SEGMENTS.map((d) => `${d.label} ${s[d.key]}`).join(", ")}
                              title={DIFFICULTY_SEGMENTS.map((d) => `${d.label}: ${s[d.key]}`).join(" · ")}
                            >
                              {DIFFICULTY_SEGMENTS.map((d) =>
                                s[d.key] > 0 ? <div key={d.key} className={d.cls} style={{ width: `${(s[d.key] / s.total) * 100}%` }} /> : null,
                              )}
                            </div>
                          ) : (
                            <span className={`text-xs ${SECONDARY}`}>—</span>
                          )}
                        </td>
                        <td className={`px-3 py-3 text-right tabular-nums ${SECONDARY}`}>{pct(s.with_explanation, s.total)}%</td>
                        <td className={`px-3 py-3 text-right tabular-nums ${SECONDARY}`}>{pct(s.blooms_classified, s.total)}%</td>
                        <td className={`px-3 py-3 text-right tabular-nums ${SECONDARY}`}>{s.used_in_quizzes}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {s.added_7d > 0 ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{s.added_7d}</span>
                          ) : (
                            <span className={SECONDARY}>0</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${t.chip}`}>
                            {s.health_score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className={`flex flex-wrap gap-3 px-5 pt-3 text-[11px] ${SECONDARY}`}>
                {DIFFICULTY_SEGMENTS.map((d) => (
                  <span key={d.key} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${d.cls}`} /> {d.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Growth trend */}
        <Section title="Questions added per week" icon={TrendingUp} aside={<span className={`text-[11px] ${SECONDARY}`}>Last 12 weeks</span>}>
          <div className="flex h-40 items-end gap-1.5" role="list" aria-label="Questions added per week">
            {data.trend.map((w) => {
              const label = new Date(`${w.week_start}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
              return (
                <div key={w.week_start} role="listitem" className="group relative flex h-full flex-1 flex-col items-center justify-end" aria-label={`Week of ${label}: ${w.count}`}>
                  <span className="pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow transition-opacity group-hover:opacity-100 dark:bg-white dark:text-gray-900">
                    Week of {label}: <b>{w.count}</b>
                  </span>
                  <div
                    className={`w-full max-w-[28px] rounded-t ${w.count > 0 ? "bg-blue-500 group-hover:bg-blue-600" : "bg-gray-200 dark:bg-gray-800"}`}
                    style={{ height: `${w.count > 0 ? Math.max(6, (w.count / maxTrend) * 100) : 3}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className={`mt-2 flex justify-between text-[10px] ${SECONDARY}`}>
            <span>{data.trend[0] && new Date(`${data.trend[0].week_start}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })}</span>
            <span>This week</span>
          </div>
        </Section>

        {/* Coverage */}
        <Section title="Quality coverage" icon={CheckCircle2}>
          {totals.total === 0 ? (
            <EmptyNote>Coverage appears once the bank has questions.</EmptyNote>
          ) : (
            <div className="space-y-3">
              {coverage.map((c) => (
                <div key={c.label} title={c.tip}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={SECONDARY}>{c.label}</span>
                    <span className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">{c.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.value >= 75 ? "bg-emerald-500" : c.value >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${c.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Bloom's */}
        <Section title="Thinking skills (Bloom's)" icon={Brain}>
          {data.by_blooms.every((b) => b.count === 0) ? (
            <EmptyNote>No questions are classified by Bloom's level yet.</EmptyNote>
          ) : (
            <div className="space-y-2.5">
              {data.by_blooms.map((b) => (
                <BarRow
                  key={b.level_id ?? "none"}
                  label={b.level_order != null ? `L${b.level_order} · ${b.name}` : b.name}
                  value={b.count}
                  max={maxBlooms}
                  barCls={b.level_order == null ? "bg-slate-300 dark:bg-slate-600" : b.level_order >= 4 ? "bg-violet-500" : "bg-blue-500"}
                />
              ))}
              <p className={`pt-1 text-[11px] ${SECONDARY}`}>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-1" />Recall &amp; apply
                <span className="inline-block h-2 w-2 rounded-full bg-violet-500 ml-3 mr-1" />Higher-order (L4+)
              </p>
            </div>
          )}
        </Section>

        {/* Types */}
        <Section title="Question types" icon={Layers}>
          {data.by_type.length === 0 ? (
            <EmptyNote>No questions yet.</EmptyNote>
          ) : (
            <div className="space-y-2.5">
              {data.by_type.map((t) => {
                const Icon = getQuestionTypeIcon(t.type as QuestionType);
                return (
                  <BarRow
                    key={t.type}
                    label={
                      <span className="inline-flex items-center gap-1.5 capitalize">
                        <Icon className="h-3.5 w-3.5 shrink-0" /> {typeLabel(t.type)}
                      </span>
                    }
                    value={t.count}
                    max={maxType}
                  />
                );
              })}
            </div>
          )}
        </Section>

        {/* Topics */}
        <Section title="Most covered scheme-of-work topics" icon={Info}>
          {data.top_topics.length === 0 ? (
            <EmptyNote>No questions are linked to a scheme-of-work topic yet.</EmptyNote>
          ) : (
            <div className="space-y-2.5">
              {data.top_topics.map((t) => (
                <BarRow key={t.title} label={t.title} value={t.count} max={maxTopic} />
              ))}
            </div>
          )}
        </Section>

        {/* Most used */}
        <Section title="Most reused questions" icon={Repeat}>
          {data.most_used.length === 0 ? (
            <EmptyNote>None of these questions has been used in a quiz yet.</EmptyNote>
          ) : (
            <ol className="space-y-2">
              {data.most_used.map((q, i) => {
                const Icon = getQuestionTypeIcon(q.question_type as QuestionType);
                return (
                  <li key={q.id} className="flex items-start gap-3 rounded-xl bg-surface-light dark:bg-surface-dark/40 p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-text-primary-light dark:text-text-primary-dark">{stripHtml(q.question_text) || "(no text)"}</p>
                      <p className={`mt-1 flex items-center gap-2 text-[11px] ${SECONDARY}`}>
                        <Icon className="h-3 w-3" /> <span className="capitalize">{typeLabel(q.question_type)}</span>
                        {!singleSubject && <span>· {subjectName(q.subject_id)}</span>}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      {q.uses} quiz{q.uses === 1 ? "" : "zes"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>
    </div>
  );
};

export default QuestionBankHubDashboard;
