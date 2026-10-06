import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  GraduationCap,
  LayoutList,
  RefreshCw,
  Rows3,
  Search,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { KpiTile, ProgressBar, pct } from "../Dashboard/instructor/InstructorPanels";
import {
  getAdminStudents,
  STATUS_META,
  type AdminStudentRow,
  type AdminStudentsResponse,
  type PerformanceStatus,
  type StudentSort,
} from "../../services/adminReportsApi";

// ─── /students for school-wide viewers ────────────────────────────────────────
// Every student in the school (MIS class-group rosters for the year), with the
// detail a teacher gets for their own students: class group, programme,
// subjects, plus performance from the same scoring as the Overall Ranking
// (online work and recorded marks, mean of subject averages) and missing
// work from the dashboard. Paged, filtered and sorted on the server
// (GET /dashboard/admin/students); filters live in the URL so the dashboard
// can deep-link (?attention=1, ?classGroupId=…, ?status=no_marks).

const PAGE_SIZE = 25;
const STATUSES: PerformanceStatus[] = ["at_risk", "needs_attention", "on_track", "excelling", "no_marks"];
const SORTS: Array<{ key: StudentSort; label: string; dir: "asc" | "desc" }> = [
  { key: "name", label: "Name", dir: "asc" },
  { key: "average", label: "Average", dir: "desc" },
  { key: "rank", label: "Rank", dir: "asc" },
  { key: "missing", label: "Missing work", dir: "desc" },
  { key: "class_group", label: "Class", dir: "asc" },
  { key: "marked_items", label: "Marked items", dir: "desc" },
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
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

const StatusPill: React.FC<{ status: PerformanceStatus }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_META[status].cls}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden />
    {STATUS_META[status].label}
  </span>
);

const AdminStudentsDirectory: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  // Rank is the ranking switch in Roles & Permissions; the server also drops it.
  const sorts = can("RANKINGS_VIEW_ALL") ? SORTS : SORTS.filter((s) => s.key !== "rank");
  const [params, setParams] = useSearchParams();
  const page = num(params.get("page")) ?? 1;
  const search = params.get("q") ?? "";
  const classGroupId = num(params.get("classGroupId"));
  const subjectId = num(params.get("subjectId"));
  const programme = params.get("programme") ?? undefined;
  const status = (params.get("status") as PerformanceStatus | null) ?? undefined;
  const attention = params.get("attention") === "1";
  const gender = params.get("gender") ?? undefined;
  const requestedSort = params.get("sort") as StudentSort | null;
  const sort: StudentSort = sorts.some((s) => s.key === requestedSort) ? requestedSort! : "name";
  const dir = (params.get("dir") as "asc" | "desc" | null) ?? sorts.find((s) => s.key === sort)?.dir ?? "asc";
  const grouped = params.get("view") === "class";

  const [data, setData] = useState<AdminStudentsResponse | null>(null);
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
        const res = await getAdminStudents(
          {
            page,
            pageSize: PAGE_SIZE,
            search: search || undefined,
            classGroupId,
            subjectId,
            programme,
            status,
            attention,
            gender,
            // Grouping reads best in class order.
            sort: grouped ? "class_group" : sort,
            dir: grouped ? "asc" : dir,
          },
          { term, academic_year: year },
          fresh,
        );
        if (id !== seq.current) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (id !== seq.current) return;
        const e = err as { response?: { data?: { message?: string } } };
        setError(e?.response?.data?.message || "Couldn't load the students.");
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search, classGroupId, subjectId, programme, status, attention, gender, sort, dir, grouped, term, year],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtersActive = Boolean(search || classGroupId || subjectId || programme || status || attention || gender);

  const groups = useMemo(() => {
    if (!data || !grouped) return null;
    const out: Array<{ key: string; title: string; subtitle: string; rows: AdminStudentRow[] }> = [];
    for (const r of data.rows) {
      const key = r.class_group ? String(r.class_group.id) : "none";
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = {
          key,
          title: r.class_group?.name ?? "No class this year",
          subtitle: r.class_group ? [r.class_group.grade_name, r.class_group.program_name].filter(Boolean).join(" · ") : "",
          rows: [],
        };
        out.push(g);
      }
      g.rows.push(r);
    }
    return out;
  }, [data, grouped]);

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

  const s = data.summary;
  const totalStatus = Object.values(data.status_counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5" aria-busy={refreshing || loading}>
      <div className={`${card} px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3`}>
        <div>
          <h1 className={`text-2xl font-bold ${ink.primary}`}>Students</h1>
          <p className={`text-sm ${ink.secondary}`}>
            Every student in the school{[year, term].filter(Boolean).length ? ` · ${[year, term].filter(Boolean).join(" · ")}` : ""}
            {!data.rosters_available && " · some class rosters couldn't be loaded"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow text-text-primary-light dark:text-text-primary-dark disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={<Users className="w-4 h-4" />} color="blue" label={filtersActive ? "Matching" : "Students"} value={String(s.students)} hint={`${data.facets.class_groups.length} classes`} />
        <KpiTile icon={<Target className="w-4 h-4" />} color="emerald" label="Average" value={pct(s.average)} progress={s.average} hint={`${s.with_marks} with marks`} />
        <KpiTile
          icon={<AlertTriangle className="w-4 h-4" />}
          color="red"
          label="Need support"
          value={String(s.needing_support)}
          hint="below 50% or 2+ missing"
          emphasis={s.needing_support > 0 ? "warning" : undefined}
          onClick={() => update({ attention: attention ? undefined : 1 })}
        />
        <KpiTile icon={<GraduationCap className="w-4 h-4" />} color="amber" label="Missing work" value={String(s.missing_work)} hint="closed work not turned in" />
      </div>

      {/* Status distribution: counted segments, so identity is never colour alone. */}
      {totalStatus > 0 && (
        <div className={`${card} px-5 py-4`}>
          <div className="flex h-2.5 w-full gap-[2px] rounded-full overflow-hidden" role="img" aria-label={STATUSES.map((k) => `${STATUS_META[k].label} ${data.status_counts[k]}`).join(", ")}>
            {STATUSES.filter((k) => data.status_counts[k] > 0).map((k) => (
              <div key={k} className={STATUS_META[k].dot} style={{ width: `${(data.status_counts[k] / totalStatus) * 100}%` }} title={`${STATUS_META[k].label}: ${data.status_counts[k]}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="Filter by performance">
            <Chip active={!status} onClick={() => update({ status: undefined })}>
              All ({totalStatus})
            </Chip>
            {STATUSES.map((k) => (
              <Chip key={k} active={status === k} onClick={() => update({ status: status === k ? undefined : k })}>
                <span className={`w-2 h-2 rounded-full ${STATUS_META[k].dot}`} aria-hidden />
                {STATUS_META[k].label} ({data.status_counts[k]})
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className={`pointer-events-none absolute left-3 top-2.5 h-4 w-4 ${ink.muted}`} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, username, reg. number…"
              aria-label="Search students"
              className="w-full rounded-full border border-border-light dark:border-border-dark/50 bg-surface-light dark:bg-surface-dark/50 py-2 pl-9 pr-4 text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Programme" className={selectCls} value={programme ?? ""} onChange={(e) => update({ programme: e.target.value || undefined })}>
              <option value="">All programmes</option>
              {data.facets.programmes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select aria-label="Class" className={selectCls} value={classGroupId ?? ""} onChange={(e) => update({ classGroupId: e.target.value || undefined })}>
              <option value="">All classes</option>
              {data.facets.class_groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.students})
                </option>
              ))}
            </select>
            <select aria-label="Subject" className={selectCls} value={subjectId ?? ""} onChange={(e) => update({ subjectId: e.target.value || undefined })}>
              <option value="">All subjects</option>
              {data.facets.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code ? `${sub.code} · ${sub.name}` : sub.name}
                </option>
              ))}
            </select>
            <select aria-label="Gender" className={selectCls} value={gender ?? ""} onChange={(e) => update({ gender: e.target.value || undefined })}>
              <option value="">Any gender</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className={`inline-flex items-center gap-2 text-sm ${ink.secondary}`}>
            <input type="checkbox" checked={attention} onChange={(e) => update({ attention: e.target.checked ? 1 : undefined })} className="rounded" />
            Only students needing support
          </label>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border-light dark:border-border-dark/50 p-0.5" role="group" aria-label="Layout">
              <button
                type="button"
                aria-pressed={!grouped}
                onClick={() => update({ view: undefined })}
                className={`p-1.5 rounded-full ${!grouped ? "bg-blue-600 text-white" : ink.secondary}`}
                title="List"
                aria-label="List"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-pressed={grouped}
                onClick={() => update({ view: "class" })}
                className={`p-1.5 rounded-full ${grouped ? "bg-blue-600 text-white" : ink.secondary}`}
                title="Group by class"
                aria-label="Group by class"
              >
                <Rows3 className="w-4 h-4" />
              </button>
            </div>
            {!grouped && (
              <>
                <select
                  aria-label="Sort by"
                  className={selectCls}
                  value={sort}
                  onChange={(e) => {
                    const so = sorts.find((x) => x.key === e.target.value)!;
                    update({ sort: so.key, dir: so.dir });
                  }}
                >
                  {sorts.map((so) => (
                    <option key={so.key} value={so.key}>
                      Sort: {so.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => update({ dir: dir === "asc" ? "desc" : "asc" })}
                  className="p-2 rounded-full border border-border-light dark:border-border-dark/50"
                  aria-label={dir === "asc" ? "Ascending, switch to descending" : "Descending, switch to ascending"}
                >
                  {dir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                </button>
              </>
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setParams(grouped ? new URLSearchParams({ view: "class" }) : new URLSearchParams(), { replace: true });
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        {data.rows.length === 0 ? (
          <div className="py-16 text-center">
            <UserRound className={`w-10 h-10 mx-auto ${ink.muted}`} />
            <p className={`mt-2 text-sm font-medium ${ink.primary}`}>{filtersActive ? "No students match these filters" : "No students found for this year"}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className={`text-xs text-left ${ink.secondary} border-b border-border-light dark:border-border-dark/40`}>
                  <tr>
                    <th scope="col" className="pl-5 pr-3 py-2 font-medium">Student</th>
                    <th scope="col" className="px-3 py-2 font-medium">Class</th>
                    <th scope="col" className="px-3 py-2 font-medium">Subjects</th>
                    <th scope="col" className="px-3 py-2 font-medium w-36">Average</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium text-right">Missing</th>
                    <th scope="col" className="pl-3 pr-5 py-2 font-medium">Weakest subject</th>
                  </tr>
                </thead>
                {groups ? (
                  groups.map((g) => (
                    <tbody key={g.key}>
                      <tr className="bg-surface-light/70 dark:bg-surface-dark/40">
                        <th scope="rowgroup" colSpan={7} className={`pl-5 py-2 text-left text-xs font-semibold uppercase tracking-wide ${ink.secondary}`}>
                          {g.title}
                          {g.subtitle && <span className={`ml-2 normal-case font-normal ${ink.muted}`}>{g.subtitle}</span>}
                          <span className={`ml-2 normal-case font-normal ${ink.muted}`}>· {g.rows.length} on this page</span>
                        </th>
                      </tr>
                      {g.rows.map((r) => (
                        <StudentRow key={r.key} row={r} />
                      ))}
                    </tbody>
                  ))
                ) : (
                  <tbody>
                    {data.rows.map((r) => (
                      <StudentRow key={r.key} row={r} />
                    ))}
                  </tbody>
                )}
              </table>
            </div>
            <ul className="md:hidden divide-y divide-border-light dark:divide-border-dark/40">
              {data.rows.map((r) => (
                <StudentCard key={r.key} row={r} />
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

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? "bg-blue-600 border-blue-600 text-white"
        : "border-border-light dark:border-border-dark/50 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50"
    }`}
  >
    {children}
  </button>
);

const StudentName: React.FC<{ row: AdminStudentRow }> = ({ row: r }) => {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
        {initials(r.name)}
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-medium ${ink.primary} group-hover:text-blue-600 dark:group-hover:text-blue-400`}>{r.name}</span>
        <span className={`block truncate text-xs ${ink.muted}`}>
          {[r.email || r.username, r.registration_number].filter(Boolean).join(" · ") || (r.mis_user_id ? `ID ${r.mis_user_id}` : "Local account")}
        </span>
      </span>
    </>
  );
  return r.mis_user_id ? (
    <Link to={`/students/${r.mis_user_id}`} className="group flex items-center gap-3 min-w-0">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3 min-w-0" title="No MIS account, so there is no profile page">
      {inner}
    </div>
  );
};

const SubjectBadges: React.FC<{ row: AdminStudentRow; max?: number }> = ({ row, max = 3 }) => {
  if (row.subjects.length === 0) return <span className={`text-xs ${ink.muted}`}>—</span>;
  const scores = new Map(row.subject_scores.map((s) => [s.id, s.score]));
  return (
    <div className="flex flex-wrap gap-1" title={row.subjects.map((s) => s.name).join(", ")}>
      {row.subjects.slice(0, max).map((sub) => {
        const score = scores.get(sub.id);
        return (
          <span
            key={sub.id}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
              score != null && score < 50
                ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                : "bg-surface-light text-text-secondary-light dark:bg-surface-dark/60 dark:text-text-secondary-dark"
            }`}
          >
            {sub.code || sub.name}
            {score != null && <span className="tabular-nums opacity-80">{Math.round(score)}</span>}
          </span>
        );
      })}
      {row.subjects.length > max && <span className={`text-[11px] ${ink.muted}`}>+{row.subjects.length - max}</span>}
    </div>
  );
};

const StudentRow: React.FC<{ row: AdminStudentRow }> = ({ row: r }) => (
  <tr className="border-b last:border-0 border-border-light/70 dark:border-border-dark/30 hover:bg-surface-light/60 dark:hover:bg-surface-dark/30">
    <td className="pl-5 pr-3 py-2.5 max-w-[260px]">
      <StudentName row={r} />
    </td>
    <td className="px-3 py-2.5">
      {r.class_group ? (
        <>
          <div className={ink.primary}>{r.class_group.name}</div>
          <div className={`text-xs ${ink.muted}`}>{[r.class_group.grade_name, r.class_group.program_name].filter(Boolean).join(" · ")}</div>
        </>
      ) : (
        <span className={`text-xs ${ink.muted}`}>No class this year</span>
      )}
    </td>
    <td className="px-3 py-2.5 max-w-[220px]">
      <SubjectBadges row={r} />
    </td>
    <td className="px-3 py-2.5">
      <div className={`flex items-baseline gap-1.5 ${ink.primary}`}>
        <span className="font-medium">{pct(r.average)}</span>
        {r.rank != null && <span className={`text-xs ${ink.muted}`}>#{r.rank} of {r.ranked_of}</span>}
      </div>
      <ProgressBar value={r.average} label={`${r.marked_items} marked items across ${r.subjects_marked} subjects`} />
    </td>
    <td className="px-3 py-2.5">
      <StatusPill status={r.status} />
      {r.reasons.length > 0 && <div className="text-[11px] text-red-600/90 dark:text-red-400/90 mt-1 max-w-[200px] line-clamp-1" title={r.reasons.join("\n")}>{r.reasons[0]}</div>}
    </td>
    <td className={`px-3 py-2.5 text-right tabular-nums ${r.missing >= 2 ? "text-red-600 dark:text-red-400 font-medium" : r.missing > 0 ? ink.primary : ink.muted}`}>{r.missing}</td>
    <td className={`pl-3 pr-5 py-2.5 text-xs ${ink.secondary}`}>
      {r.weakest ? (
        <>
          {r.weakest.code || r.weakest.name} <span className="tabular-nums">{Math.round(r.weakest.score)}%</span>
        </>
      ) : (
        "—"
      )}
    </td>
  </tr>
);

const StudentCard: React.FC<{ row: AdminStudentRow }> = ({ row: r }) => (
  <li className="px-4 py-3 space-y-2">
    <div className="flex items-start justify-between gap-3">
      <StudentName row={r} />
      <StatusPill status={r.status} />
    </div>
    <div className={`flex items-center justify-between text-xs ${ink.secondary}`}>
      <span>{r.class_group?.name ?? "No class this year"}</span>
      <span>
        <span className={`font-semibold ${ink.primary}`}>{pct(r.average)}</span>
        {r.rank != null && ` · #${r.rank}`}
        {r.missing > 0 && ` · ${r.missing} missing`}
      </span>
    </div>
    <ProgressBar value={r.average} />
    <SubjectBadges row={r} max={4} />
  </li>
);

export default AdminStudentsDirectory;
