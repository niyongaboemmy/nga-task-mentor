import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileBadge,
  RefreshCw,
  Search,
  Target,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { HealthPill, KpiTile, ProgressBar, pct, relativeDue } from "../components/Dashboard/instructor/InstructorPanels";
import {
  getAdminSubjects,
  type AdminSubjectRow,
  type AdminSubjectsResponse,
  type SubjectFlag,
  type SubjectSort,
} from "../services/adminReportsApi";
import type { SubjectHealth } from "../services/instructorOverviewApi";
import Select from "../components/ui/Select";

// ─── /courses for school-wide viewers ─────────────────────────────────────────
// Every subject in the school with the same per-subject numbers the teacher
// dashboard shows (health, class average, participation, grading backlog,
// students needing support), plus who teaches it, to which classes, and
// whether its report-card mapping is done. Paged, filtered and sorted on the
// server (GET /dashboard/admin/subjects); every filter lives in the URL.
// A row opens the subject's details page, exactly as a teacher sees it.

const PAGE_SIZE = 15;

const HEALTH_CHIPS: Array<{ key: SubjectHealth; label: string }> = [
  { key: "at_risk", label: "At risk" },
  { key: "watch", label: "Watch" },
  { key: "on_track", label: "On track" },
  { key: "no_data", label: "No data" },
];

const FLAGS: Array<{ key: SubjectFlag; label: string }> = [
  { key: "grading_overdue", label: "Grading overdue" },
  { key: "no_work", label: "No published work" },
  { key: "unmapped", label: "Report card not mapped" },
  { key: "no_teacher", label: "No teacher assigned" },
];

const SORTS: Array<{ key: SubjectSort; label: string; dir: "asc" | "desc" }> = [
  { key: "health", label: "Status (worst first)", dir: "asc" },
  { key: "name", label: "Name", dir: "asc" },
  { key: "avg_score", label: "Class average", dir: "asc" },
  { key: "participation", label: "Participation", dir: "asc" },
  { key: "pending", label: "To grade", dir: "desc" },
  { key: "at_risk", label: "Students needing support", dir: "desc" },
  { key: "students", label: "Students", dir: "desc" },
  { key: "assessments", label: "Assessments", dir: "desc" },
  { key: "last_activity", label: "Last submission", dir: "desc" },
];

const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark/80",
  muted: "text-text-secondary-light/80 dark:text-text-secondary-dark/60",
};
const card = "bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm";
const selectCls =
  "rounded-full border border-border-light dark:border-border-dark/50 bg-card-light dark:bg-card-dark/40 px-3 py-2 text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/30 max-w-full";

const periodName = (p: unknown): string | undefined =>
  p && typeof p === "object" && "name" in p ? String((p as { name: unknown }).name) : undefined;

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

const AdminSubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = num(params.get("page")) ?? 1;
  const search = params.get("q") ?? "";
  const health = (params.get("health") as SubjectHealth | null) ?? undefined;
  const flag = (params.get("flag") as SubjectFlag | null) ?? undefined;
  const programme = params.get("programme") ?? undefined;
  const classGroupId = num(params.get("classGroupId"));
  const teacherId = num(params.get("teacherId"));
  const sort = (params.get("sort") as SubjectSort | null) ?? "health";
  const dir = (params.get("dir") as "asc" | "desc" | null) ?? SORTS.find((s) => s.key === sort)?.dir ?? "asc";

  const [data, setData] = useState<AdminSubjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const seq = useRef(0);

  const update = useCallback(
    (patch: Record<string, string | number | undefined | null>, resetPage = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === null || v === "") next.delete(k);
            else next.set(k, String(v));
          }
          if (resetPage && !("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Debounced search into the URL.
  useEffect(() => {
    if (searchInput === search) return;
    const t = window.setTimeout(() => update({ q: searchInput.trim() || undefined }), 300);
    return () => window.clearTimeout(t);
  }, [searchInput, search, update]);

  const term = periodName(user?.currentAcademicTerm);
  const year = periodName(user?.currentAcademicYear);

  const load = useCallback(
    async (fresh = false) => {
      const id = ++seq.current;
      if (fresh) setRefreshing(true);
      try {
        const res = await getAdminSubjects(
          { page, pageSize: PAGE_SIZE, search: search || undefined, health, flag, programme, classGroupId, teacherId, sort, dir },
          { term, academic_year: year },
          fresh,
        );
        if (id !== seq.current) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (id !== seq.current) return;
        const e = err as { response?: { data?: { message?: string } } };
        setError(e?.response?.data?.message || "Couldn't load the subjects report.");
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search, health, flag, programme, classGroupId, teacherId, sort, dir, term, year],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtersActive = Boolean(search || health || flag || programme || classGroupId || teacherId);
  const t = data?.totals;
  const mapped = useMemo(() => data?.rows.filter((r) => r.report_card.mapped).length ?? 0, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className={`${card} h-24 animate-pulse`} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${card} h-24 animate-pulse`} />
          ))}
        </div>
        <div className={`${card} h-96 animate-pulse`} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`${card} p-8 text-center`}>
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
        <p className={`font-medium ${ink.primary}`}>{error}</p>
        <button type="button" onClick={() => load()} className="mt-4 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" aria-busy={refreshing || loading}>
      {/* Header */}
      <div className={`${card} px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${ink.primary}`}>Subjects</h1>
            <p className={`text-sm ${ink.secondary}`}>
              Every subject in the school{[year, term].filter(Boolean).length ? ` · ${[year, term].filter(Boolean).join(" · ")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow text-text-primary-light dark:text-text-primary-dark"
          >
            <BarChart3 className="w-4 h-4" />
            School dashboard
          </Link>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow text-text-primary-light dark:text-text-primary-dark disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* School-wide KPIs */}
      {t && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiTile icon={<BookOpen className="w-4 h-4" />} color="blue" label="Subjects" value={String(t.subjects)} hint={`${t.published} published assessments`} />
          <KpiTile icon={<Users className="w-4 h-4" />} color="indigo" label="Students" value={t.students != null ? String(t.students) : "—"} hint={`${t.class_groups} classes`} />
          <KpiTile icon={<Target className="w-4 h-4" />} color="emerald" label="Class average" value={pct(t.avg_score)} progress={t.avg_score} hint={`pass rate ${pct(t.pass_rate)}`} />
          <KpiTile icon={<CheckCircle2 className="w-4 h-4" />} color="violet" label="Participation" value={pct(t.participation)} progress={t.participation} hint={data.rosters_available ? `${t.missing_work} missing` : "roster unavailable"} />
          <KpiTile
            icon={<ClipboardList className="w-4 h-4" />}
            color="amber"
            label="To grade"
            value={String(t.pending_grading)}
            hint={t.overdue_grading > 0 ? `${t.overdue_grading} over a week old` : undefined}
            emphasis={t.overdue_grading > 0 ? "critical" : undefined}
            onClick={() => update({ flag: "grading_overdue" })}
          />
          <KpiTile
            icon={<AlertTriangle className="w-4 h-4" />}
            color="red"
            label="Subjects at risk"
            value={String(data.health_counts.at_risk)}
            hint={`${data.health_counts.watch} to watch`}
            emphasis={data.health_counts.at_risk > 0 ? "warning" : undefined}
            onClick={() => update({ health: "at_risk" })}
          />
        </div>
      )}

      {/* Filters */}
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className={`pointer-events-none absolute left-3 top-2.5 h-4 w-4 ${ink.muted}`} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search subject, code, teacher or class…"
              aria-label="Search subjects"
              className="w-full rounded-full border border-border-light dark:border-border-dark/50 bg-surface-light dark:bg-surface-dark/50 py-2 pl-9 pr-4 text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Programme" className={selectCls} value={programme ?? ""} onChange={(e) => update({ programme: e.target.value || undefined })}>
              <option value="">All programmes</option>
              {data.facets.programmes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select aria-label="Class" className={selectCls} value={classGroupId ?? ""} onChange={(e) => update({ classGroupId: e.target.value || undefined })}>
              <option value="">All classes</option>
              {data.facets.class_groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Teacher" className={selectCls} value={teacherId ?? ""} onChange={(e) => update({ teacherId: e.target.value || undefined })}>
              <option value="">All teachers</option>
              {data.facets.teachers.map((tc) => (
                <option key={tc.mis_user_id} value={tc.mis_user_id}>
                  {tc.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Needs" className={selectCls} value={flag ?? ""} onChange={(e) => update({ flag: e.target.value || undefined })}>
              <option value="">Any issue</option>
              {FLAGS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            <StatusChip active={!health} onClick={() => update({ health: undefined })}>
              All ({Object.values(data.health_counts).reduce((a, b) => a + b, 0)})
            </StatusChip>
            {HEALTH_CHIPS.map((h) => (
              <StatusChip key={h.key} active={health === h.key} onClick={() => update({ health: health === h.key ? undefined : h.key })}>
                {h.label} ({data.health_counts[h.key]})
              </StatusChip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Sort by"
              className={selectCls}
              value={sort}
              onChange={(e) => {
                const s = SORTS.find((x) => x.key === e.target.value)!;
                update({ sort: s.key, dir: s.dir });
              }}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => update({ dir: dir === "asc" ? "desc" : "asc" })}
              className="p-2 rounded-full border border-border-light dark:border-border-dark/50 hover:bg-surface-light dark:hover:bg-surface-dark/50"
              aria-label={dir === "asc" ? "Ascending, switch to descending" : "Descending, switch to ascending"}
              title={dir === "asc" ? "Ascending" : "Descending"}
            >
              {dir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setParams(new URLSearchParams(), { replace: true });
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className={`${card} overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark/40 text-sm ${ink.secondary}`}>
          <span>
            {data.total} subject{data.total === 1 ? "" : "s"}
            {filtersActive ? " match" : ""}
          </span>
          <span className="text-xs">
            {mapped}/{data.rows.length} on this page mapped to the report card
          </span>
        </div>

        {data.rows.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className={`w-10 h-10 mx-auto ${ink.muted}`} />
            <p className={`mt-2 text-sm font-medium ${ink.primary}`}>No subjects match these filters</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className={`text-xs text-left ${ink.secondary} border-b border-border-light dark:border-border-dark/40`}>
                  <tr>
                    <th scope="col" className="pl-5 pr-3 py-2 font-medium">Subject</th>
                    <th scope="col" className="px-3 py-2 font-medium">Teachers</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium text-right">Students</th>
                    <th scope="col" className="px-3 py-2 font-medium text-right" title="Published · assignments (A), quizzes (Q), drafts (D)">Work</th>
                    <th scope="col" className="px-3 py-2 font-medium w-32">Class average</th>
                    <th scope="col" className="px-3 py-2 font-medium w-32">Participation</th>
                    <th scope="col" className="px-3 py-2 font-medium text-right">To grade</th>
                    <th scope="col" className="px-3 py-2 font-medium text-right">Support</th>
                    <th scope="col" className="px-3 py-2 font-medium">Report card</th>
                    <th scope="col" className="pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <SubjectRow key={r.subject_id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-border-light dark:divide-border-dark/40">
              {data.rows.map((r) => (
                <SubjectCard key={r.subject_id} row={r} />
              ))}
            </ul>
          </>
        )}

        {data.total_pages > 1 && (
          <div className={`flex items-center justify-between gap-3 px-5 py-3 border-t border-border-light dark:border-border-dark/40 text-xs ${ink.secondary}`}>
            <span>
              {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => update({ page: data.page - 1 }, false)}
                className="px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark/50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="tabular-nums">
                Page {data.page} of {data.total_pages}
              </span>
              <button
                type="button"
                disabled={data.page >= data.total_pages}
                onClick={() => update({ page: data.page + 1 }, false)}
                className="px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark/50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? "bg-blue-600 border-blue-600 text-white"
        : "border-border-light dark:border-border-dark/50 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50"
    }`}
  >
    {children}
  </button>
);

const ReportCardChip: React.FC<{ row: AdminSubjectRow }> = ({ row }) =>
  row.report_card.mapped ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" title={`${row.report_card.mapped_items} assessments mapped`}>
      <FileBadge className="w-3 h-3" /> Mapped
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Not mapped
    </span>
  );

const SubjectRow: React.FC<{ row: AdminSubjectRow }> = ({ row: r }) => (
  <tr className="border-b last:border-0 border-border-light/70 dark:border-border-dark/30 hover:bg-surface-light/60 dark:hover:bg-surface-dark/30 align-top">
    <td className="pl-5 pr-3 py-3 max-w-[240px]">
      <Link to={`/courses/${r.subject_id}`} className={`font-semibold ${ink.primary} hover:text-blue-600 dark:hover:text-blue-400`}>
        {r.subject_name}
      </Link>
      <div className={`text-xs ${ink.muted} line-clamp-1`} title={r.class_groups.join(", ")}>
        {[r.subject_code, r.class_groups.join(", ")].filter(Boolean).join(" · ") || "No class assigned"}
      </div>
    </td>
    <td className={`px-3 py-3 text-xs ${ink.secondary} max-w-[160px]`}>
      {r.teacher_list.length ? r.teacher_list.map((t) => t.name).join(", ") : <span className="text-amber-700 dark:text-amber-300">Unassigned</span>}
    </td>
    <td className="px-3 py-3">
      <HealthPill health={r.health} title={r.health_reasons.join("\n")} />
    </td>
    <td className={`px-3 py-3 text-right tabular-nums ${ink.primary}`}>{r.students ?? "—"}</td>
    <td className={`px-3 py-3 text-right tabular-nums ${ink.primary}`}>
      {r.published}
      <div className={`text-[11px] whitespace-nowrap ${ink.muted}`}>
        {r.assignments}A · {r.quizzes}Q{r.drafts ? ` · ${r.drafts}D` : ""}
      </div>
    </td>
    <td className="px-3 py-3">
      <div className={ink.primary}>{pct(r.avg_score)}</div>
      <ProgressBar value={r.avg_score} label={`Pass rate ${pct(r.pass_rate)}`} />
    </td>
    <td className="px-3 py-3">
      <div className={ink.primary}>
        {pct(r.participation)}
        {r.missing > 0 && <span className={`ml-1 text-xs ${ink.muted}`}>{r.missing} missing</span>}
      </div>
      <ProgressBar value={r.participation} tone="blue" />
    </td>
    <td className="px-3 py-3 text-right tabular-nums">
      <span className={r.overdue_pending > 0 ? "text-red-600 dark:text-red-400 font-medium" : r.pending > 0 ? "text-amber-700 dark:text-amber-300" : ink.muted}>
        {r.pending}
      </span>
      {r.overdue_pending > 0 && <div className="text-[11px] whitespace-nowrap text-red-600/80 dark:text-red-400/80">{r.overdue_pending} over 7d</div>}
    </td>
    <td className={`px-3 py-3 text-right tabular-nums ${r.at_risk > 0 ? "text-red-600 dark:text-red-400 font-medium" : ink.muted}`}>{r.at_risk}</td>
    <td className="px-3 py-3">
      <ReportCardChip row={r} />
      {r.next_due && <div className={`text-[11px] whitespace-nowrap ${ink.muted} mt-1`}>due {relativeDue(r.next_due.due_at)}</div>}
    </td>
    <td className="pr-5 py-3 text-right whitespace-nowrap">
      <Link
        to={`/dashboard?subject=${r.subject_id}`}
        className="inline-flex p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark"
        aria-label={`Dashboard for ${r.subject_name}`}
        title="Subject dashboard"
      >
        <BarChart3 className="w-4 h-4" />
      </Link>
      <Link
        to={`/courses/${r.subject_id}`}
        className="inline-flex p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark"
        aria-label={`Open ${r.subject_name}`}
        title="Subject details"
      >
        <ArrowRight className="w-4 h-4" />
      </Link>
    </td>
  </tr>
);

const SubjectCard: React.FC<{ row: AdminSubjectRow }> = ({ row: r }) => (
  <li className="px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Link to={`/courses/${r.subject_id}`} className={`font-semibold ${ink.primary}`}>
          {r.subject_name}
        </Link>
        <div className={`text-xs ${ink.muted} line-clamp-1`}>
          {[r.subject_code, r.teacher_list.map((t) => t.name).join(", ") || "Unassigned"].filter(Boolean).join(" · ")}
        </div>
      </div>
      <HealthPill health={r.health} title={r.health_reasons.join("\n")} />
    </div>
    <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
      <div>
        <div className={ink.muted}>Average</div>
        <div className={`font-semibold ${ink.primary}`}>{pct(r.avg_score)}</div>
        <ProgressBar value={r.avg_score} />
      </div>
      <div>
        <div className={ink.muted}>Participation</div>
        <div className={`font-semibold ${ink.primary}`}>{pct(r.participation)}</div>
        <ProgressBar value={r.participation} tone="blue" />
      </div>
      <div>
        <div className={ink.muted}>To grade</div>
        <div className={`font-semibold ${r.overdue_pending > 0 ? "text-red-600 dark:text-red-400" : ink.primary}`}>{r.pending}</div>
      </div>
    </div>
    <div className="flex items-center justify-between mt-3">
      <ReportCardChip row={r} />
      <Link to={`/dashboard?subject=${r.subject_id}`} className="text-xs font-medium text-blue-600 dark:text-blue-400">
        Subject dashboard
      </Link>
    </div>
  </li>
);

export default AdminSubjectsPage;
