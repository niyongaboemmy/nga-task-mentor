import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardCheck,
  FileText,
  Info,
  Minus,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { STAT_COLORS, dashboardItemVariants, type StatColor } from "../dashboardUi";
import { LiveCountdown } from "../../Common/LiveCountdown";
import {
  PASS_MARK,
  subjectLabel,
  type AssessmentSummary,
  type DashboardAlert,
  type GradingQueueItem,
  type StudentSummary,
  type SubjectHealth,
  type SubjectSummary,
} from "../../../services/instructorOverviewApi";

// ─── Formatting ───────────────────────────────────────────────────────────────

const DAY = 86400000;

// eslint-disable-next-line react-refresh/only-export-components
export function relativeDue(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const hours = Math.round(diff / 3600000);
  if (Math.abs(hours) < 24) return hours >= 0 ? `in ${Math.max(1, hours)}h` : `${Math.abs(hours)}h ago`;
  const days = Math.round(diff / DAY);
  return days >= 0 ? `in ${days}d` : `${Math.abs(days)}d ago`;
}

// eslint-disable-next-line react-refresh/only-export-components
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}%`);

const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark/80",
  muted: "text-text-secondary-light/80 dark:text-text-secondary-dark/60",
};

const card = "bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm";

// ─── Building blocks ──────────────────────────────────────────────────────────

export const Panel: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: StatColor;
  action?: React.ReactNode;
  className?: string;
  id?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, iconColor = "blue", action, className = "", id, children }) => (
  <motion.section variants={dashboardItemVariants} id={id} className={`${card} p-5 flex flex-col scroll-mt-24 ${className}`}>
    <header className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${STAT_COLORS[iconColor]}`}>{icon}</div>
        )}
        <div className="min-w-0">
          <h3 className={`text-base font-semibold ${ink.primary}`}>{title}</h3>
          {subtitle && <p className={`text-xs ${ink.secondary}`}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
    <div className="flex-1 min-h-0">{children}</div>
  </motion.section>
);

export const ProgressBar: React.FC<{ value: number | null; tone?: "auto" | "blue"; label?: string }> = ({
  value,
  tone = "auto",
  label,
}) => {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const color =
    tone === "blue"
      ? "bg-blue-500"
      : value == null
        ? "bg-gray-300 dark:bg-gray-600"
        : v < PASS_MARK
          ? "bg-red-500"
          : v < 75
            ? "bg-amber-500"
            : "bg-emerald-500";
  return (
    <div className="w-full" title={label}>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-[width] duration-700`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
};

const HEALTH: Record<SubjectHealth, { label: string; cls: string; icon: React.ReactNode }> = {
  on_track: {
    label: "On track",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  watch: {
    label: "Watch",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  at_risk: {
    label: "At risk",
    cls: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
    icon: <AlertOctagon className="w-3.5 h-3.5" />,
  },
  no_data: {
    label: "No data",
    cls: "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300",
    icon: <Circle className="w-3.5 h-3.5" />,
  },
};

export const HealthPill: React.FC<{ health: SubjectHealth; title?: string }> = ({ health, title }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${HEALTH[health].cls}`}
  >
    {HEALTH[health].icon}
    {HEALTH[health].label}
  </span>
);

// ─── KPI tile ─────────────────────────────────────────────────────────────────

export const KpiTile: React.FC<{
  icon: React.ReactNode;
  color: StatColor;
  label: string;
  value: string;
  hint?: string;
  /** Change vs last week; `goodWhenUp` decides the arrow's colour. */
  delta?: { current: number; previous: number; goodWhenUp: boolean; unit?: string };
  progress?: number | null;
  to?: string;
  onClick?: () => void;
  emphasis?: "critical" | "warning";
}> = ({ icon, color, label, value, hint, delta, progress, to, onClick, emphasis }) => {
  let deltaEl: React.ReactNode = null;
  if (delta) {
    const diff = delta.current - delta.previous;
    const up = diff > 0;
    const good = diff === 0 ? null : up === delta.goodWhenUp;
    const Icon = diff === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
    deltaEl = (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium ${
          good == null ? ink.muted : good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
        title={`This week ${delta.current} vs last week ${delta.previous}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {diff === 0 ? "same as last week" : `${Math.abs(diff)}${delta.unit ?? ""} vs last week`}
      </span>
    );
  }
  const ring =
    emphasis === "critical"
      ? "ring-1 ring-red-200 dark:ring-red-900/50"
      : emphasis === "warning"
        ? "ring-1 ring-amber-200 dark:ring-amber-900/50"
        : "";
  const body = (
    <motion.div
      variants={dashboardItemVariants}
      whileHover={to || onClick ? { y: -2 } : undefined}
      className={`${card} ${ring} p-4 h-full flex flex-col gap-2 transition-shadow ${to || onClick ? "hover:shadow-md cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wide ${ink.secondary}`}>{label}</span>
        <span className={`p-1.5 rounded-lg ${STAT_COLORS[color]}`}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${ink.primary}`}>{value}</div>
      {progress !== undefined && <ProgressBar value={progress} />}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-h-[1rem]">
        {deltaEl}
        {hint && <span className={`text-xs ${ink.muted}`}>{hint}</span>}
      </div>
    </motion.div>
  );
  if (to) return <Link to={to} className="block h-full">{body}</Link>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="block h-full w-full text-left">
        {body}
      </button>
    );
  return body;
};

// ─── Notifications ────────────────────────────────────────────────────────────

const SEVERITY: Record<DashboardAlert["severity"], { cls: string; icon: React.ReactNode; label: string }> = {
  critical: {
    cls: "border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-900/10",
    icon: <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />,
    label: "Urgent",
  },
  warning: {
    cls: "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-900/10",
    icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    label: "Attention",
  },
  info: {
    cls: "border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/10",
    icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    label: "FYI",
  },
  success: {
    cls: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    label: "Good",
  },
};

/** A teacher alert or a student reminder (which may carry a countdown). */
type ListAlert = Omit<DashboardAlert, "subject_id"> & { subject_id?: number | null; countdown_to?: string | null };

export const AlertsList: React.FC<{
  alerts: ListAlert[];
  onDismiss: (alert: ListAlert) => void;
  onAction: (alert: ListAlert) => void;
  /** Important alerts the user hasn't seen before get a "New" chip. */
  isNew?: (alert: ListAlert) => boolean;
  limit?: number;
}> = ({ alerts, onDismiss, onAction, isNew, limit = 4 }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? alerts : alerts.slice(0, limit);
  if (alerts.length === 0) {
    return <p className={`text-sm ${ink.secondary}`}>No notifications right now.</p>;
  }
  return (
    <div className="space-y-2">
      {shown.map((a) => (
        <div key={a.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${SEVERITY[a.severity].cls}`}>
          <span className="mt-0.5 shrink-0" aria-label={SEVERITY[a.severity].label}>
            {SEVERITY[a.severity].icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${ink.primary}`}>
              {a.title}
              {isNew?.(a) && (
                <span className="ml-2 align-middle px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-600 text-white">New</span>
              )}
            </p>
            <p className={`text-xs ${ink.secondary}`}>{a.message}</p>
            {a.countdown_to && (
              <div className="mt-1">
                <LiveCountdown
                  to={a.countdown_to}
                  kind={a.id.startsWith("running-") ? "time_left" : a.id.startsWith("opens-") ? "opens" : "due"}
                  compact
                />
              </div>
            )}
          </div>
          {a.action && (
            <button
              type="button"
              onClick={() => onAction(a)}
              className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-text-primary-light dark:text-text-primary-dark transition-colors"
            >
              {a.action.label}
            </button>
          )}
          {a.severity !== "success" && (
            <button
              type="button"
              onClick={() => onDismiss(a)}
              aria-label={`Dismiss: ${a.title}`}
              className={`shrink-0 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 ${ink.muted}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {alerts.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? "Show fewer" : `Show ${alerts.length - limit} more`}
        </button>
      )}
    </div>
  );
};

// ─── Subject scorecards ───────────────────────────────────────────────────────

type SortKey = "subject" | "health" | "avg_score" | "participation" | "pending" | "at_risk";
const HEALTH_RANK: Record<SubjectHealth, number> = { at_risk: 0, watch: 1, on_track: 2, no_data: 3 };

export const SubjectScorecards: React.FC<{
  subjects: SubjectSummary[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}> = ({ subjects, selected, onSelect }) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "health", dir: 1 });
  const rows = useMemo(() => {
    const val = (s: SubjectSummary): number | string => {
      switch (sort.key) {
        case "subject":
          return subjectLabel(s).toLowerCase();
        case "health":
          return HEALTH_RANK[s.health];
        case "avg_score":
          return s.avg_score ?? -1;
        case "participation":
          return s.participation ?? -1;
        case "pending":
          return s.pending;
        case "at_risk":
          return s.at_risk;
      }
    };
    return [...subjects].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [subjects, sort]);

  const Th: React.FC<{ k: SortKey; children: React.ReactNode; className?: string }> = ({ k, children, className = "" }) => (
    <th scope="col" className={`px-3 py-2 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : k === "subject" || k === "health" ? 1 : -1 }))}
        className="inline-flex items-center gap-1 hover:text-text-primary-light dark:hover:text-text-primary-dark"
      >
        {children}
        {sort.key === k && (sort.dir === 1 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm min-w-[760px]">
        <thead className={`text-xs text-left ${ink.secondary} border-b border-border-light dark:border-border-dark/40`}>
          <tr>
            <Th k="subject" className="pl-5">Subject</Th>
            <Th k="health">Status</Th>
            <Th k="avg_score">Class average</Th>
            <Th k="participation">Participation</Th>
            <Th k="pending">To grade</Th>
            <Th k="at_risk">Need support</Th>
            <th scope="col" className="px-3 py-2 font-medium">Next due</th>
            <th scope="col" className="pr-5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const active = selected === s.subject_id;
            return (
              <tr
                key={s.subject_id}
                onClick={() => onSelect(active ? null : s.subject_id)}
                className={`border-b last:border-0 border-border-light/70 dark:border-border-dark/30 cursor-pointer transition-colors ${
                  active ? "bg-blue-50/70 dark:bg-blue-900/15" : "hover:bg-surface-light dark:hover:bg-surface-dark/40"
                }`}
              >
                <td className="pl-5 pr-3 py-3">
                  <div className={`font-semibold ${ink.primary}`}>{s.subject_code || s.subject_name}</div>
                  <div className={`text-xs ${ink.secondary} line-clamp-1`}>
                    {s.subject_code ? s.subject_name : ""}
                    {s.class_groups.length > 0 && ` · ${s.class_groups.join(", ")}`}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <HealthPill health={s.health} title={s.health_reasons.join("\n")} />
                </td>
                <td className="px-3 py-3 w-36">
                  <div className={`text-sm font-medium ${ink.primary}`}>{pct(s.avg_score)}</div>
                  <ProgressBar value={s.avg_score} label={`Pass rate ${pct(s.pass_rate)}`} />
                </td>
                <td className="px-3 py-3 w-36">
                  <div className={`text-sm font-medium ${ink.primary}`}>
                    {pct(s.participation)}
                    {s.missing > 0 && <span className={`ml-1 text-xs font-normal ${ink.muted}`}>{s.missing} missing</span>}
                  </div>
                  <ProgressBar value={s.participation} />
                </td>
                <td className="px-3 py-3">
                  {s.pending > 0 ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.overdue_pending > 0
                          ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                      }`}
                      title={s.overdue_pending > 0 ? `${s.overdue_pending} waiting over a week` : undefined}
                    >
                      {s.pending}
                    </span>
                  ) : (
                    <span className={ink.muted}>0</span>
                  )}
                </td>
                <td className={`px-3 py-3 ${s.at_risk > 0 ? "text-red-600 dark:text-red-400 font-medium" : ink.muted}`}>
                  {s.at_risk}
                  {s.students != null && <span className={`text-xs font-normal ${ink.muted}`}> / {s.students}</span>}
                </td>
                <td className="px-3 py-3 max-w-[180px]">
                  {s.next_due ? (
                    <div>
                      <div className={`text-xs font-medium ${ink.primary} truncate`}>{s.next_due.title}</div>
                      <div className={`text-xs ${ink.muted}`}>{relativeDue(s.next_due.due_at)}</div>
                    </div>
                  ) : (
                    <span className={`text-xs ${ink.muted}`}>—</span>
                  )}
                </td>
                <td className="pr-5 py-3 text-right">
                  <Link
                    to={`/courses/${s.subject_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark"
                    aria-label={`Open ${subjectLabel(s)}`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Lists ────────────────────────────────────────────────────────────────────

const KindIcon: React.FC<{ kind: "assignment" | "quiz" }> = ({ kind }) => (
  <span
    className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${kind === "quiz" ? STAT_COLORS.violet : STAT_COLORS.blue}`}
    aria-label={kind}
  >
    {kind === "quiz" ? <ClipboardCheck className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
  </span>
);

export const GradingQueue: React.FC<{ items: GradingQueueItem[] }> = ({ items }) => {
  const [kind, setKind] = useState<"all" | "assignment" | "quiz">("all");
  const shown = items.filter((i) => kind === "all" || i.kind === kind);
  return (
    <div>
      <div className="flex gap-1 mb-3" role="tablist">
        {(["all", "assignment", "quiz"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              kind === k
                ? "bg-blue-600 text-white"
                : "bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {k === "all" ? `All (${items.length})` : k === "assignment" ? "Assignments" : "Quizzes"}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyLine icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} text="Nothing waiting to be graded." />
      ) : (
        <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {shown.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <Link to={i.url} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
                <KindIcon kind={i.kind} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${ink.primary}`}>{i.title}</p>
                  <p className={`text-xs ${ink.secondary}`}>
                    {subjectLabel(i)} · oldest {i.waiting_days === 0 ? "today" : `${i.waiting_days}d ago`}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    i.waiting_days > 7
                      ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                  }`}
                >
                  {i.pending}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const UpcomingList: React.FC<{ items: AssessmentSummary[] }> = ({ items }) =>
  items.length === 0 ? (
    <EmptyLine icon={<Circle className="w-5 h-5 text-gray-400" />} text="No deadlines in the next two weeks." />
  ) : (
    <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
      {items.map((a) => {
        const hours = (new Date(a.due_at!).getTime() - Date.now()) / 3600000;
        const urgent = hours <= 48;
        return (
          <li key={`${a.kind}-${a.id}`}>
            <Link to={a.url} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
              <div
                className={`w-12 shrink-0 text-center rounded-lg py-1 ${
                  urgent ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" : "bg-surface-light dark:bg-surface-dark " + ink.secondary
                }`}
              >
                <div className="text-[10px] uppercase leading-tight">
                  {new Date(a.due_at!).toLocaleDateString(undefined, { month: "short" })}
                </div>
                <div className="text-base font-bold leading-tight">{new Date(a.due_at!).getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${ink.primary}`}>{a.title}</p>
                <p className={`text-xs ${ink.secondary}`}>
                  {subjectLabel(a)} · {a.kind === "quiz" ? a.quiz_type || "Quiz" : "Assignment"} · {relativeDue(a.due_at!)}
                </p>
                {a.expected != null && (
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar value={a.participation} tone="blue" />
                    <span className={`text-[11px] whitespace-nowrap ${ink.muted}`}>
                      {a.submitted}/{a.expected}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

export const StudentWatchlist: React.FC<{ atRisk: StudentSummary[]; top: StudentSummary[] }> = ({ atRisk, top }) => {
  const [tab, setTab] = useState<"risk" | "top">("risk");
  const list = tab === "risk" ? atRisk : top;
  return (
    <div>
      <div className="flex gap-1 mb-3" role="tablist">
        <TabButton active={tab === "risk"} onClick={() => setTab("risk")}>
          Need support ({atRisk.length})
        </TabButton>
        <TabButton active={tab === "top"} onClick={() => setTab("top")}>
          Top performers ({top.length})
        </TabButton>
      </div>
      {list.length === 0 ? (
        <EmptyLine
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          text={tab === "risk" ? "No student is flagged right now." : "Not enough graded work to rank students yet."}
        />
      ) : (
        <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {list.map((s, i) => {
            const inner = (
              <>
                <span
                  className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                    tab === "risk" ? STAT_COLORS.red : STAT_COLORS.emerald
                  }`}
                >
                  {tab === "top" ? i + 1 : initials(s.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${ink.primary}`}>{s.name}</p>
                  <p className={`text-xs truncate ${ink.secondary}`}>
                    {tab === "risk" ? s.reasons.join(" · ") : `${s.graded_count} graded · ${s.subjects.join(", ")}`}
                    {s.class_group_name ? ` · ${s.class_group_name}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    s.avg_score == null
                      ? ink.muted
                      : s.avg_score < PASS_MARK
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {pct(s.avg_score)}
                </span>
              </>
            );
            const key = `${s.mis_user_id ?? "l"}-${s.local_id ?? i}`;
            return (
              <li key={key}>
                {s.url ? (
                  <Link to={s.url} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 p-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
      active
        ? "bg-blue-600 text-white"
        : "bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-700"
    }`}
  >
    {children}
  </button>
);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const EmptyLine: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className={`flex items-center gap-2 py-6 justify-center text-sm ${ink.secondary}`}>
    {icon}
    {text}
  </div>
);
