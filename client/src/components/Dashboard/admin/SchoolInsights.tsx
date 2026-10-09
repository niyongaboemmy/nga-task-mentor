import UserAvatar from "../../ui/UserAvatar";
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileBadge,
  Info,
  Layers,
  School,
  UserCog,
} from "lucide-react";
import { Panel, ProgressBar, pct } from "../instructor/InstructorPanels";
import { useChartTheme } from "../chartTheme";
import type { AdminInsights, TeacherRow, TeacherStatus } from "../../../services/adminReportsApi";
import type { DashboardAlert } from "../../../services/instructorOverviewApi";

/**
 * The admin-only layer on top of the (shared) teacher dashboard: what a school
 * leader decides on — which teachers are behind, which classes are
 * struggling, whether report cards can be produced, and which subjects have
 * no work or no teacher. Data: GET /dashboard/admin/insights.
 */

const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark/80",
  muted: "text-text-secondary-light/80 dark:text-text-secondary-dark/60",
};

const since = (iso: string | null) => {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
};

// ─── Decisions ────────────────────────────────────────────────────────────────

const SEVERITY: Record<DashboardAlert["severity"], { icon: React.ReactNode; cls: string; label: string }> = {
  critical: {
    icon: <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />,
    cls: "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-900/10",
    label: "Urgent",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    cls: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10",
    label: "Attention",
  },
  info: {
    icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    cls: "border-blue-100 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-900/10",
    label: "Info",
  },
  success: {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    cls: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10",
    label: "Good",
  },
};

export const DecisionList: React.FC<{ decisions: DashboardAlert[] }> = ({ decisions }) => {
  const navigate = useNavigate();
  if (decisions.length === 0) {
    return <p className={`text-sm ${ink.secondary}`}>Nothing needs a decision right now.</p>;
  }
  const go = (url: string) => {
    if (url.startsWith("#")) document.getElementById(url.slice(1))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    else navigate(url);
  };
  return (
    <ul className="space-y-2">
      {decisions.map((d) => (
        <li key={d.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${SEVERITY[d.severity].cls}`}>
          <span className="mt-0.5 shrink-0" aria-label={SEVERITY[d.severity].label}>
            {SEVERITY[d.severity].icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${ink.primary}`}>{d.title}</p>
            <p className={`text-xs ${ink.secondary} mt-0.5`}>{d.message}</p>
          </div>
          {d.action && (
            <button
              type="button"
              onClick={() => go(d.action!.url)}
              className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              {d.action.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

// ─── Teachers ─────────────────────────────────────────────────────────────────

const TEACHER_STATUS: Record<TeacherStatus, { label: string; cls: string }> = {
  inactive: { label: "No work yet", cls: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" },
  behind: { label: "Behind", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" },
  active: { label: "Active", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
};

const TEACHERS_PER_PAGE = 8;

export const TeacherTable: React.FC<{ teachers: TeacherRow[] }> = ({ teachers }) => {
  const [filter, setFilter] = useState<TeacherStatus | "all">("all");
  const [page, setPage] = useState(1);
  const counts = useMemo(() => {
    const c: Record<TeacherStatus, number> = { inactive: 0, behind: 0, active: 0 };
    for (const t of teachers) c[t.status]++;
    return c;
  }, [teachers]);
  const rows = filter === "all" ? teachers : teachers.filter((t) => t.status === filter);
  const pages = Math.max(1, Math.ceil(rows.length / TEACHERS_PER_PAGE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * TEACHERS_PER_PAGE, current * TEACHERS_PER_PAGE);

  if (teachers.length === 0) {
    return <p className={`text-sm ${ink.secondary}`}>No teacher assignments found in the MIS for this year.</p>;
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Filter teachers">
        {(["all", "inactive", "behind", "active"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => {
              setFilter(k);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === k
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-border-light dark:border-border-dark/50 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50"
            }`}
          >
            {k === "all" ? `All (${teachers.length})` : `${TEACHER_STATUS[k].label} (${counts[k]})`}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm min-w-[720px]">
          <thead className={`text-xs text-left ${ink.secondary} border-b border-border-light dark:border-border-dark/40`}>
            <tr>
              <th scope="col" className="pl-5 pr-3 py-2 font-medium">Teacher</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Published</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">To grade</th>
              <th scope="col" className="px-3 py-2 font-medium w-32">Class average</th>
              <th scope="col" className="px-3 py-2 font-medium w-32">Participation</th>
              <th scope="col" className="pl-3 pr-5 py-2 font-medium">Last submission</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.mis_user_id} className="border-b last:border-0 border-border-light/70 dark:border-border-dark/30 align-top">
                <td className="pl-5 pr-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar decorative misUserId={t.mis_user_id} name={t.name} size={32} />
                    <div className="min-w-0">
                    <div className={`font-medium ${ink.primary}`}>{t.name}</div>
                  <div className={`text-xs ${ink.muted} line-clamp-1`} title={t.subjects.map((s) => s.name).join(", ")}>
                    {t.subjects.length} subject{t.subjects.length === 1 ? "" : "s"} · {t.subjects.map((s) => s.code || s.name).join(", ")}
                  </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TEACHER_STATUS[t.status].cls}`} title={t.flags.join("\n")}>
                    {TEACHER_STATUS[t.status].label}
                  </span>
                  {t.flags.length > 0 && <div className={`text-[11px] ${ink.muted} mt-1 max-w-[220px]`}>{t.flags[0]}</div>}
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${ink.primary}`}>
                  {t.published}
                  {t.drafts > 0 && <span className={`text-xs ${ink.muted}`}> +{t.drafts} draft</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={t.overdue_pending > 0 ? "text-red-600 dark:text-red-400 font-medium" : ink.primary}>{t.pending}</span>
                  {t.overdue_pending > 0 && <div className="text-[11px] text-red-600/80 dark:text-red-400/80">{t.overdue_pending} over 7d</div>}
                </td>
                <td className="px-3 py-2.5">
                  <div className={`text-sm ${ink.primary}`}>{pct(t.avg_score)}</div>
                  <ProgressBar value={t.avg_score} />
                </td>
                <td className="px-3 py-2.5">
                  <div className={`text-sm ${ink.primary}`}>{pct(t.participation)}</div>
                  <ProgressBar value={t.participation} tone="blue" />
                </td>
                <td className={`pl-3 pr-5 py-2.5 text-xs ${ink.secondary}`}>{since(t.last_activity_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && <Pager page={current} pages={pages} onPage={setPage} total={rows.length} size={TEACHERS_PER_PAGE} noun="teachers" />}
    </div>
  );
};

const Pager: React.FC<{ page: number; pages: number; total: number; size: number; noun: string; onPage: (p: number) => void }> = ({
  page,
  pages,
  total,
  size,
  noun,
  onPage,
}) => (
  <div className={`flex items-center justify-between gap-3 pt-3 text-xs ${ink.secondary}`}>
    <span>
      {(page - 1) * size + 1}–{Math.min(page * size, total)} of {total} {noun}
    </span>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark/50 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="tabular-nums">
        {page} / {pages}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        className="px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark/50 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  </div>
);

// ─── Classes & programmes ─────────────────────────────────────────────────────

const CLASSES_PER_PAGE = 8;

export const ClassGroupTable: React.FC<{ insights: AdminInsights }> = ({ insights }) => {
  const [page, setPage] = useState(1);
  const rows = insights.class_groups;
  const pages = Math.max(1, Math.ceil(rows.length / CLASSES_PER_PAGE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * CLASSES_PER_PAGE, current * CLASSES_PER_PAGE);
  if (rows.length === 0) return <p className={`text-sm ${ink.secondary}`}>No class groups found for this year.</p>;
  return (
    <div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm min-w-[560px]">
          <caption className="sr-only">Class groups, weakest average first</caption>
          <thead className={`text-xs text-left ${ink.secondary} border-b border-border-light dark:border-border-dark/40`}>
            <tr>
              <th scope="col" className="pl-5 pr-3 py-2 font-medium">Class</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Students</th>
              <th scope="col" className="px-3 py-2 font-medium w-40">Average</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Passing</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Need support</th>
              <th scope="col" className="pr-5" />
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <tr key={g.id} className="border-b last:border-0 border-border-light/70 dark:border-border-dark/30">
                <td className="pl-5 pr-3 py-2.5">
                  <div className={`font-medium ${ink.primary}`}>{g.name}</div>
                  <div className={`text-xs ${ink.muted}`}>{[g.grade_name, g.program_name].filter(Boolean).join(" · ")}</div>
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${ink.primary}`}>
                  {g.students}
                  {g.with_marks < g.students && <div className={`text-[11px] ${ink.muted}`}>{g.with_marks} marked</div>}
                </td>
                <td className="px-3 py-2.5">
                  <div className={`text-sm ${ink.primary}`}>{pct(g.average)}</div>
                  <ProgressBar value={g.average} />
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${ink.primary}`}>{pct(g.pass_rate)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${g.at_risk > 0 ? "text-red-600 dark:text-red-400 font-medium" : ink.muted}`}>
                  {g.at_risk}
                </td>
                <td className="pr-5 py-2.5 text-right">
                  <Link
                    to={`/students?classGroupId=${g.id}`}
                    className="inline-flex p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark"
                    aria-label={`Students in ${g.name}`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && <Pager page={current} pages={pages} onPage={setPage} total={rows.length} size={CLASSES_PER_PAGE} noun="classes" />}
    </div>
  );
};

export const ProgrammeCards: React.FC<{ insights: AdminInsights }> = ({ insights }) => (
  <div className="grid gap-2">
    {insights.programmes.map((p) => (
      <div key={p.name} className="rounded-xl border border-border-light dark:border-border-dark/40 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-medium ${ink.primary} truncate`}>{p.name}</span>
          <span className={`text-sm font-semibold tabular-nums ${ink.primary}`}>{pct(p.average)}</span>
        </div>
        <ProgressBar value={p.average} />
        <div className={`text-xs ${ink.muted} mt-1.5`}>
          {p.class_groups} class{p.class_groups === 1 ? "" : "es"} · {p.students} students
          {p.at_risk > 0 && <span className="text-red-600 dark:text-red-400"> · {p.at_risk} need support</span>}
        </div>
      </div>
    ))}
  </div>
);

// ─── Report-card readiness ────────────────────────────────────────────────────

export const ReportCardReadiness: React.FC<{ insights: AdminInsights }> = ({ insights }) => {
  const t = useChartTheme();
  const rc = insights.report_cards;
  const mappedPct = rc.subjects_total ? Math.round((rc.subjects_mapped / rc.subjects_total) * 100) : 0;
  // Status of the cards that exist: approved (published) -> saved -> draft.
  const segments = [
    { key: "approved", label: "Approved", n: rc.cards.approved, color: t.s1 },
    { key: "saved", label: "Saved", n: rc.cards.saved, color: t.s2 },
    { key: "draft", label: "Draft", n: rc.cards.draft, color: t.track },
  ];
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <span className={`text-sm ${ink.secondary}`}>Subjects mapped to CW/HW/MD/EOT</span>
          <span className={`text-sm font-semibold tabular-nums ${ink.primary}`}>
            {rc.subjects_mapped} / {rc.subjects_total}
          </span>
        </div>
        <ProgressBar value={mappedPct} tone="blue" label={`${mappedPct}% of subjects mapped`} />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className={`text-sm ${ink.secondary}`}>Report cards{rc.term ? ` · ${rc.term}` : ""}</span>
          <span className={`text-sm font-semibold tabular-nums ${ink.primary}`}>{rc.cards.total}</span>
        </div>
        {rc.cards.total > 0 ? (
          <>
            <div className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden" role="img" aria-label={segments.map((s) => `${s.label} ${s.n}`).join(", ")}>
              {segments
                .filter((s) => s.n > 0)
                .map((s) => (
                  <div key={s.key} style={{ width: `${(s.n / rc.cards.total) * 100}%`, background: s.color }} title={`${s.label}: ${s.n}`} />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {segments.map((s) => (
                <li key={s.key} className={`inline-flex items-center gap-1.5 text-xs ${ink.secondary}`}>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
                  {s.label} <span className={`font-semibold tabular-nums ${ink.primary}`}>{s.n}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={`text-xs ${ink.muted}`}>No report cards started for this period yet.</p>
        )}
      </div>

      {insights.coverage.unmapped.length > 0 && (
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wide ${ink.muted} mb-1.5`}>Not mapped yet</div>
          <ul className="space-y-1">
            {insights.coverage.unmapped.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <Link to={`/courses/${s.id}`} className={`truncate hover:underline ${ink.primary}`}>
                  {s.code ? `${s.code} · ${s.name}` : s.name}
                </Link>
                <span className={`text-xs ${ink.muted} truncate max-w-[45%]`}>{s.teachers.join(", ")}</span>
              </li>
            ))}
          </ul>
          {insights.coverage.unmapped.length > 5 && (
            <Link to="/courses?flag=unmapped" className="inline-block mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              All {insights.coverage.unmapped.length} subjects
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Coverage ─────────────────────────────────────────────────────────────────

export const CoverageList: React.FC<{ insights: AdminInsights }> = ({ insights }) => {
  const c = insights.coverage;
  const items: Array<{ label: string; n: number; to: string; detail?: string }> = [
    {
      label: "Subjects with no published work",
      n: c.no_published_work.length,
      to: "/courses?flag=no_work",
      detail: c.no_published_work.slice(0, 3).map((s) => s.code || s.name).join(", "),
    },
    {
      label: "Subjects with no teacher assigned",
      n: c.no_teacher.length,
      to: "/courses?flag=no_teacher",
      detail: c.no_teacher.slice(0, 3).map((s) => s.code || s.name).join(", "),
    },
    { label: "Students with no marks yet", n: c.students_without_marks, to: "/students?status=no_marks" },
    { label: "Students needing support", n: insights.school.needing_support, to: "/students?attention=1" },
  ];
  return (
    <ul className="divide-y divide-border-light/70 dark:divide-border-dark/30">
      {items.map((i) => (
        <li key={i.label}>
          <Link to={i.to} className="flex items-center gap-3 py-2.5 group">
            <span className={`w-10 text-right text-lg font-semibold tabular-nums ${i.n > 0 ? ink.primary : ink.muted}`}>{i.n}</span>
            <span className="flex-1 min-w-0">
              <span className={`block text-sm ${ink.primary} group-hover:underline`}>{i.label}</span>
              {i.detail && i.n > 0 && <span className={`block text-xs ${ink.muted} truncate`}>{i.detail}{i.n > 3 ? "…" : ""}</span>}
            </span>
            <ArrowRight className={`w-4 h-4 ${ink.muted}`} />
          </Link>
        </li>
      ))}
    </ul>
  );
};

// ─── The whole admin layer ────────────────────────────────────────────────────

const SchoolInsights: React.FC<{ insights: AdminInsights }> = ({ insights }) => (
  <>
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel
        title="Decisions"
        subtitle="School-wide issues to act on, most urgent first"
        icon={<AlertTriangle className="w-4 h-4" />}
        iconColor="amber"
        className="lg:col-span-2"
      >
        <DecisionList decisions={insights.decisions} />
      </Panel>
      <Panel title="Coverage" subtitle="Gaps across the school this term" icon={<Layers className="w-4 h-4" />} iconColor="violet">
        <CoverageList insights={insights} />
      </Panel>
    </div>

    <Panel
      id="teachers"
      title="Teachers"
      subtitle="Work published, grading backlog and results across each teacher's subjects"
      icon={<UserCog className="w-4 h-4" />}
      iconColor="indigo"
    >
      <TeacherTable teachers={insights.teachers} />
    </Panel>

    <div className="grid gap-5 lg:grid-cols-3">
      <Panel
        id="classes"
        title="Classes"
        subtitle="Mean of students' averages (online work and recorded marks), weakest first"
        icon={<School className="w-4 h-4" />}
        iconColor="emerald"
        className="lg:col-span-2"
      >
        <ClassGroupTable insights={insights} />
      </Panel>
      <div className="space-y-5">
        <Panel title="Report cards" subtitle="Readiness for this period" icon={<FileBadge className="w-4 h-4" />}>
          <ReportCardReadiness insights={insights} />
        </Panel>
        {insights.programmes.length > 0 && (
          <Panel title="Programmes" icon={<BookOpenCheck className="w-4 h-4" />} iconColor="purple">
            <ProgrammeCards insights={insights} />
          </Panel>
        )}
      </div>
    </div>
  </>
);

export default SchoolInsights;
