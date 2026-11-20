import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Flame,
  Rows3,
  Search,
  SlidersHorizontal,
  Table2,
  Trophy,
  X,
} from "lucide-react";
import type { SchoolReports } from "../../services/reportCardWorkflowApi";
import EmptyState from "../ui/EmptyState";
import Select from "../ui/Select";
import { ExportActions, Section } from "./shared";
import { markTone, num, pct, position, round1, tableCls, td, tdNum, th } from "./format";
import StudentDrawer from "./StudentDrawer";
import {
  EMPTY_FILTERS,
  GENDER_LABEL,
  RESULT_LABEL,
  STATUS_LABEL,
  activeFilterCount,
  defaultDir,
  filterStudents,
  filtersFromParams,
  sortStudents,
  subjectStatsFor,
  summarise,
  writeFilters,
  type BroadsheetFilters,
  type BroadsheetStudent,
  type GenderFilter,
  type ResultFilter,
  type SortDir,
  type SortKey,
} from "./broadsheetFilters";

// Students × subjects for the term, as heads of school print it, made
// explorable: live summary for the rows shown, filters (kept in the URL so a
// view can be shared), sortable columns, a heatmap, hideable subjects, and a
// student drawer. Export and print follow what is on screen.

export type BroadsheetExport = {
  students: BroadsheetStudent[];
  subjects: Array<{ subject_id: number; name: string }>;
  subject_stats: SchoolReports["broadsheet"]["subject_stats"];
};

const sticky = "sticky left-0 z-10 bg-card-light dark:bg-[#161e2b] print:static print:bg-transparent";
const PAGE_SIZES = [25, 50, 100, 0] as const; // 0 = all
const HIDDEN_KEY = "school-reports:broadsheet:hidden-subjects";
const VIEW_KEY = "school-reports:broadsheet:view";

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
    on
      ? "border-blue-600 bg-blue-600 text-white"
      : "border-border-light text-text-secondary-light hover:border-blue-400 hover:text-blue-700 dark:border-border-dark/50 dark:text-text-secondary-dark dark:hover:text-blue-300"
  }`;
const toolBtn = (on = false) =>
  `inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
    on
      ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-300"
      : "border-border-light text-text-primary-light hover:border-blue-400 dark:border-border-dark/50 dark:text-text-primary-dark"
  }`;
const inputCls =
  "h-9 w-full rounded-xl border border-border-light bg-card-light px-3 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-border-dark/50 dark:bg-card-dark/30 dark:text-text-primary-dark";

/** Blue depth for strong marks, red tint below the pass mark (heatmap view). */
const heat = (v: number | null | undefined, passMark: number) => {
  if (v == null) return "";
  if (v < passMark) return "bg-red-500/15 dark:bg-red-500/20";
  if (v >= 90) return "bg-blue-600/25 dark:bg-blue-500/30";
  if (v >= 75) return "bg-blue-600/15 dark:bg-blue-500/20";
  if (v >= 60) return "bg-blue-600/[0.07] dark:bg-blue-500/10";
  return "bg-amber-400/10 dark:bg-amber-400/10";
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the view just isn't remembered */
  }
}

export default function BroadsheetTab({ data, onExport }: { data: SchoolReports; onExport: (view?: BroadsheetExport) => void }) {
  const { subjects, students } = data.broadsheet;
  const passMark = data.pass_mark;
  const showClass = data.class_group_id == null && data.classes.length > 1;

  // ── Filters (URL) ──
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const setFilters = useCallback(
    (patch: Partial<BroadsheetFilters>) => setParams((p) => writeFilters(p, { ...filtersFromParams(p), ...patch }), { replace: true }),
    [setParams],
  );
  const clearFilters = () => setParams((p) => writeFilters(p, EMPTY_FILTERS), { replace: true });
  // Search types fast: keep a local draft and push it to the URL a moment later.
  const [qDraft, setQDraft] = useState(filters.q);
  useEffect(() => setQDraft(filters.q), [filters.q]);
  useEffect(() => {
    if (qDraft === filters.q) return;
    const t = setTimeout(() => setFilters({ q: qDraft }), 200);
    return () => clearTimeout(t);
  }, [qDraft, filters.q, setFilters]);

  // ── View (remembered per browser) ──
  const [view, setView] = useState(() => readJson(VIEW_KEY, { heatmap: true, compact: false }));
  useEffect(() => writeJson(VIEW_KEY, view), [view]);
  const [hidden, setHidden] = useState<number[]>(() => readJson<number[]>(HIDDEN_KEY, []));
  useEffect(() => writeJson(HIDDEN_KEY, hidden), [hidden]);
  const visibleSubjects = useMemo(() => subjects.filter((s) => !hidden.includes(s.subject_id)), [subjects, hidden]);

  const [panel, setPanel] = useState<"filters" | "columns" | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "position", dir: "asc" });
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  // ── Rows ──
  const filtered = useMemo(() => filterStudents(students, filters, passMark), [students, filters, passMark]);
  const rows = useMemo(() => sortStudents(filtered, sort.key, sort.dir), [filtered, sort]);
  const summary = useMemo(() => summarise(filtered, passMark), [filtered, passMark]);
  const footStats = useMemo(
    () => subjectStatsFor(filtered, subjects.map((s) => s.subject_id), passMark),
    [filtered, subjects, passMark],
  );
  const statOf = (id: number) => footStats.find((s) => s.subject_id === id);
  const classMeans = useMemo(() => new Map(footStats.map((s) => [s.subject_id, s.mean])), [footStats]);

  useEffect(() => setPage(1), [filters, sort, pageSize]);
  const pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const shown = pageSize ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;

  const nFilters = activeFilterCount(filters);
  const filteredView = nFilters > 0;

  // Options found in the data.
  const gradeOptions = useMemo(() => {
    const present = new Set(students.map((s) => s.grade ?? "—"));
    const ordered = data.bands.map((b) => b.letter).filter((l) => present.has(l));
    return [...ordered, ...[...present].filter((l) => !ordered.includes(l))];
  }, [students, data.bands]);
  const statusOptions = useMemo(() => [...new Set(students.map((s) => s.status))], [students]);
  const classOptions = useMemo(() => [...new Set(students.map((s) => s.class_name ?? "—"))].sort(), [students]);
  const hasGenderUnknown = students.some((s) => s.gender === "unknown");
  const hasAttendance = students.some((s) => s.attendance_rate != null);

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) }));

  // Columns popover closes on an outside click.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (panel !== "columns") return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panel]);

  const exportView = () =>
    onExport(
      filteredView || hidden.length
        ? { students: rows, subjects: visibleSubjects, subject_stats: footStats.filter((s) => !hidden.includes(s.subject_id)) }
        : undefined,
    );

  const openIndex = openId == null ? -1 : rows.findIndex((r) => r.student_id === openId);
  const openStudent = openIndex >= 0 ? rows[openIndex] : null;

  // Active filters as removable chips.
  const subjectName = (id: number) => subjects.find((s) => s.subject_id === id)?.name ?? `Subject ${id}`;
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.q.trim()) chips.push({ key: "q", label: `“${filters.q.trim()}”`, clear: () => setFilters({ q: "" }) });
  if (filters.gender !== "all") chips.push({ key: "g", label: GENDER_LABEL[filters.gender], clear: () => setFilters({ gender: "all" }) });
  if (filters.result !== "all") chips.push({ key: "r", label: RESULT_LABEL[filters.result], clear: () => setFilters({ result: "all" }) });
  if (filters.grades.length) chips.push({ key: "gr", label: `Grade ${filters.grades.join(", ")}`, clear: () => setFilters({ grades: [] }) });
  if (filters.statuses.length)
    chips.push({ key: "st", label: filters.statuses.map((s) => STATUS_LABEL[s] ?? s).join(", "), clear: () => setFilters({ statuses: [] }) });
  if (filters.classes.length) chips.push({ key: "cl", label: filters.classes.join(", "), clear: () => setFilters({ classes: [] }) });
  if (filters.minAvg != null || filters.maxAvg != null)
    chips.push({
      key: "avg",
      label: `Average ${filters.minAvg ?? 0}–${filters.maxAvg ?? 100}`,
      clear: () => setFilters({ minAvg: null, maxAvg: null }),
    });
  if (filters.attendanceBelow != null)
    chips.push({ key: "att", label: `Attendance < ${filters.attendanceBelow}%`, clear: () => setFilters({ attendanceBelow: null }) });
  if (filters.failingSubject != null)
    chips.push({ key: "fs", label: `Failing ${subjectName(filters.failingSubject)}`, clear: () => setFilters({ failingSubject: null }) });

  const SortHead = ({ k, label, align = "right", className = "", title, corner = false }: { k: SortKey; label: string; align?: "left" | "right"; className?: string; title?: string; corner?: boolean }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={`${th} ${align === "right" ? "text-right" : "text-left"} sticky top-0 ${corner ? "left-0 z-30" : "z-20"} bg-card-light dark:bg-[#161e2b] print:static ${className}`}
        title={title ?? label}
     >
        <button
          type="button"
          onClick={() => onSort(k)}
          className={`group inline-flex max-w-full items-center gap-1 uppercase hover:text-blue-700 focus:outline-none focus-visible:text-blue-700 dark:hover:text-blue-300 ${
            align === "right" ? "flex-row-reverse" : ""
          } ${active ? "text-blue-700 dark:text-blue-300" : ""}`}
       >
          <span className="truncate">{label}</span>
          <Icon className={`h-3 w-3 shrink-0 print:hidden ${active ? "" : "opacity-0 group-hover:opacity-60"}`} aria-hidden />
        </button>
      </th>
    );
  };

  if (students.length === 0) {
    return (
      <Section title="Broadsheet" actions={<ExportActions what="the broadsheet" onCsv={() => onExport()} disabled />}>
        <EmptyState icon={<Table2 className="h-6 w-6" />} title="No report cards for this period" description="The broadsheet fills in once report cards exist for the term." />
      </Section>
    );
  }

  const cellPad = view.compact ? "!py-1" : "!py-2.5";
  const colCount = 1 + (showClass ? 1 : 0) + visibleSubjects.length + 7;

  return (
    <div className="space-y-4">
      {/* Live summary for the rows shown */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 print:hidden" data-testid="broadsheet-summary">
        {(
          [
            ["Students", String(summary.students), filteredView ? `of ${students.length}` : `${subjects.length} subjects`, "default"],
            ["Mean average", summary.average == null ? "—" : String(round1(summary.average)), `pass mark ${passMark}%`, summary.average != null && summary.average < passMark ? "bad" : "default"],
            ["Pass rate", summary.passRate == null ? "—" : `${round1(summary.passRate)}`, "average at or above the pass mark", summary.passRate != null && summary.passRate < 50 ? "bad" : "good"],
            ["Failing a subject", String(summary.failingAny), summary.failingAny ? "at least one subject below the pass mark" : "nobody below the pass mark", summary.failingAny ? "warn" : "good"],
            ["Top of the list", summary.top ? summary.top.name : "—", summary.top ? `average ${num(summary.top.average)}` : "no marks yet", "default"],
          ] as const
        ).map(([label, value, hint, tone], i) => (
          <div key={label} className={`rounded-2xl border border-border-light bg-card-light p-4 dark:border-border-dark/40 dark:bg-card-dark/30 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
              {i === 4 && <Trophy className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden />}
              {label}
            </p>
            <p
              className={`mt-1 truncate text-2xl font-bold tabular-nums ${
                tone === "bad" ? "text-red-600 dark:text-red-400" : tone === "warn" ? "text-amber-700 dark:text-amber-400" : tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-text-primary-light dark:text-text-primary-dark"
              } ${i === 4 ? "!text-base !leading-8" : ""}`}
              title={i === 4 ? value : undefined}
           >
              {value}
              {(i === 2 && summary.passRate != null) && <span className="text-sm font-semibold"> %</span>}
            </p>
            <p className="mt-0.5 truncate text-xs text-text-secondary-light dark:text-text-secondary-dark">{hint}</p>
          </div>
        ))}
      </div>

      <Section
        title="Broadsheet"
        description={`${students.length} student${students.length !== 1 ? "s" : ""} × ${subjects.length} subject${subjects.length !== 1 ? "s" : ""} · pass mark ${passMark}% · position is within the class`}
        actions={<ExportActions what="the broadsheet" onCsv={exportView} disabled={rows.length === 0} />}
     >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <span className="sr-only">Search students</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark" />
            <input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Search name or registration no." className={`${inputCls} pl-9`} />
          </label>
          <button type="button" className={toolBtn(panel === "filters" || nFilters > 0)} onClick={() => setPanel((p) => (p === "filters" ? null : "filters"))} aria-expanded={panel === "filters"} aria-controls="broadsheet-filters">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Filters
            {nFilters > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">{nFilters}</span>}
          </button>
          <div className="relative" ref={panelRef}>
            <button type="button" className={toolBtn(panel === "columns" || hidden.length > 0)} onClick={() => setPanel((p) => (p === "columns" ? null : "columns"))} aria-expanded={panel === "columns"}>
              <Columns3 className="h-3.5 w-3.5" aria-hidden /> Subjects
              <span className="tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                {visibleSubjects.length}/{subjects.length}
              </span>
            </button>
            {panel === "columns" && (
              <div role="dialog" aria-label="Choose subject columns" className="absolute left-0 z-30 mt-2 w-72 rounded-2xl border border-border-light bg-card-light p-3 dark:border-border-dark/50 dark:bg-[#161e2b]">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">Subject columns</span>
                  <span className="flex gap-2">
                    <button type="button" className="font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => setHidden([])}>
                      All
                    </button>
                    <button type="button" className="font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => setHidden(subjects.map((s) => s.subject_id))}>
                      None
                    </button>
                  </span>
                </div>
                <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                  {subjects.map((s) => (
                    <li key={s.subject_id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary-light hover:bg-surface-light dark:text-text-primary-dark dark:hover:bg-white/5">
                        <input
                          type="checkbox"
                          checked={!hidden.includes(s.subject_id)}
                          onChange={() => setHidden((h) => (h.includes(s.subject_id) ? h.filter((x) => x !== s.subject_id) : [...h, s.subject_id]))}
                          className="h-4 w-4 rounded border-border-light text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">{num(classMeans.get(s.subject_id))}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className={toolBtn(view.heatmap)} aria-pressed={view.heatmap} onClick={() => setView((v) => ({ ...v, heatmap: !v.heatmap }))} title="Colour marks by level">
              <Flame className="h-3.5 w-3.5" aria-hidden /> Heatmap
            </button>
            <button type="button" className={toolBtn(view.compact)} aria-pressed={view.compact} onClick={() => setView((v) => ({ ...v, compact: !v.compact }))} title="Tighter rows">
              <Rows3 className="h-3.5 w-3.5" aria-hidden /> Compact
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {panel === "filters" && (
          <div id="broadsheet-filters" className="mt-3 grid gap-4 rounded-2xl border border-border-light bg-surface-light/60 p-4 dark:border-border-dark/40 dark:bg-white/[0.02] md:grid-cols-2 xl:grid-cols-3 print:hidden">
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Gender</legend>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "female", "male", ...(hasGenderUnknown ? (["unknown"] as const) : [])] as GenderFilter[]).map((g) => (
                  <button key={g} type="button" aria-pressed={filters.gender === g} className={chip(filters.gender === g)} onClick={() => setFilters({ gender: g })}>
                    {GENDER_LABEL[g]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Result</legend>
              <Select className="w-full" aria-label="Result" value={filters.result} onChange={(e) => setFilters({ result: e.target.value as ResultFilter })}>
                {(Object.keys(RESULT_LABEL) as ResultFilter[]).map((r) => (
                  <option key={r} value={r}>
                    {RESULT_LABEL[r]}
                  </option>
                ))}
              </Select>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Failing in subject</legend>
              <Select
                aria-label="Failing in subject"
                value={filters.failingSubject ?? ""}
                onChange={(e) => setFilters({ failingSubject: e.target.value ? Number(e.target.value) : null })}
                className={inputCls}
             >
                <option value="">Any subject</option>
                {subjects.map((s) => (
                  <option key={s.subject_id} value={s.subject_id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Grade</legend>
              <div className="flex flex-wrap gap-1.5">
                {gradeOptions.map((g) => (
                  <button key={g} type="button" aria-pressed={filters.grades.includes(g)} className={chip(filters.grades.includes(g))} onClick={() => setFilters({ grades: toggleIn(filters.grades, g) })}>
                    {g}
                    <span className="ml-1 opacity-70">{students.filter((s) => (s.grade ?? "—") === g).length}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Average range</legend>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  aria-label="Lowest average"
                  placeholder="0"
                  value={filters.minAvg ?? ""}
                  onChange={(e) => setFilters({ minAvg: e.target.value === "" ? null : Number(e.target.value) })}
                  className={inputCls}
                />
                <span className="text-text-secondary-light dark:text-text-secondary-dark">–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  aria-label="Highest average"
                  placeholder="100"
                  value={filters.maxAvg ?? ""}
                  onChange={(e) => setFilters({ maxAvg: e.target.value === "" ? null : Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </fieldset>
            {hasAttendance && (
              <fieldset>
                <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Attendance</legend>
                <div className="flex flex-wrap gap-1.5">
                  {[null, 85, 75, 50].map((a) => (
                    <button key={a ?? "any"} type="button" aria-pressed={filters.attendanceBelow === a} className={chip(filters.attendanceBelow === a)} onClick={() => setFilters({ attendanceBelow: a })}>
                      {a == null ? "Any" : `Under ${a}%`}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {statusOptions.length > 1 && (
              <fieldset>
                <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Card status</legend>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map((s) => (
                    <button key={s} type="button" aria-pressed={filters.statuses.includes(s)} className={chip(filters.statuses.includes(s))} onClick={() => setFilters({ statuses: toggleIn(filters.statuses, s) })}>
                      {STATUS_LABEL[s] ?? s}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {showClass && classOptions.length > 1 && (
              <fieldset className="md:col-span-2 xl:col-span-3">
                <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Classes</legend>
                <div className="flex flex-wrap gap-1.5">
                  {classOptions.map((c) => (
                    <button key={c} type="button" aria-pressed={filters.classes.includes(c)} className={chip(filters.classes.includes(c))} onClick={() => setFilters({ classes: toggleIn(filters.classes, c) })}>
                      {c}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {view.heatmap && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark print:hidden" aria-label="Heatmap legend">
            {(
              [
                ["90+", heat(95, passMark)],
                ["75–89", heat(80, passMark)],
                ["60–74", heat(65, passMark)],
                [`${passMark}–59`, heat(Math.max(passMark, 55), passMark)],
                [`Below ${passMark}`, heat(passMark - 1, passMark)],
              ] as const
            ).map(([label, cls]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-3 w-5 rounded border border-border-light dark:border-border-dark/50 ${cls}`} aria-hidden /> {label}
              </span>
            ))}
          </div>
        )}

        {/* Active filters */}
        {(chips.length > 0 || hidden.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 print:hidden" data-testid="active-filters">
            <span className="mr-1 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
              Showing {rows.length} of {students.length}
            </span>
            {chips.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                {c.label}
                <button type="button" onClick={c.clear} aria-label={`Remove filter ${c.label}`} className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-500/20">
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
            {hidden.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border-light py-0.5 pl-2.5 pr-1 text-xs text-text-secondary-light dark:border-border-dark/50 dark:text-text-secondary-dark">
                {hidden.length} subject{hidden.length !== 1 ? "s" : ""} hidden
                <button type="button" onClick={() => setHidden([])} aria-label="Show every subject" className="rounded-full p-0.5 hover:bg-surface-light dark:hover:bg-white/10">
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            )}
            {chips.length > 0 && (
              <button type="button" onClick={clearFilters} className="ml-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="mt-3 max-h-[70vh] overflow-auto rounded-2xl border border-border-light dark:border-border-dark/40 print:max-h-none print:overflow-visible print:rounded-none print:border-0">
          <table className={tableCls}>
            <thead>
              <tr>
                <SortHead k="name" label="Student" align="left" corner className="min-w-[200px]" />
                {showClass && (
                  <th scope="col" className={`${th} sticky top-0 z-20 bg-card-light dark:bg-[#161e2b]`}>
                    Class
                  </th>
                )}
                {visibleSubjects.map((s) => (
                  <SortHead key={s.subject_id} k={`subject:${s.subject_id}`} label={s.name} title={s.name} className="max-w-[130px]" />
                ))}
                <SortHead k="total" label="Total" />
                <SortHead k="average" label="Average" />
                <th scope="col" className={`${th} sticky top-0 z-20 bg-card-light text-right dark:bg-[#161e2b]`}>
                  Grade
                </th>
                <SortHead k="position" label="Position" />
                <SortHead k="passed" label="Passed" />
                <SortHead k="failed" label="Failed" />
                <SortHead k="attendance" label="Attendance" />
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr
                  key={s.student_id}
                  tabIndex={0}
                  onClick={() => setOpenId(s.student_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(s.student_id);
                    }
                  }}
                  aria-label={`Open ${s.name}'s details`}
                  className="group cursor-pointer outline-none hover:bg-blue-50/60 focus-visible:bg-blue-50 dark:hover:bg-blue-500/[0.06] dark:focus-visible:bg-blue-500/10"
               >
                  <th scope="row" className={`${td} ${cellPad} ${sticky} text-left font-semibold group-hover:bg-blue-50 dark:group-hover:bg-[#1a2536]`}>
                    <span className="flex items-center gap-2.5">
                      {s.position != null && s.position <= 3 ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white print:hidden" aria-hidden>
                          {s.position}
                        </span>
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-light text-[11px] font-semibold text-text-secondary-light dark:bg-white/5 dark:text-text-secondary-dark print:hidden" aria-hidden>
                          {s.name.trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block max-w-[220px] truncate">{s.name}</span>
                        {s.registration_number && !view.compact && (
                          <span className="block text-[11px] font-normal tabular-nums text-text-secondary-light dark:text-text-secondary-dark">{s.registration_number}</span>
                        )}
                      </span>
                    </span>
                  </th>
                  {showClass && <td className={`${td} ${cellPad}`}>{s.class_name ?? "—"}</td>}
                  {visibleSubjects.map((sub) => {
                    const v = s.subjects[sub.subject_id];
                    return (
                      <td key={sub.subject_id} className={`${tdNum} ${cellPad} ${markTone(v, passMark)} ${view.heatmap ? heat(v, passMark) : ""}`}>
                        {num(v)}
                      </td>
                    );
                  })}
                  <td className={`${tdNum} ${cellPad}`}>{num(s.total)}</td>
                  <td className={`${tdNum} ${cellPad} font-bold ${markTone(s.average, passMark)}`}>
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10 lg:inline-block print:hidden" aria-hidden>
                        <span className={`block h-full rounded-full ${s.average != null && s.average < passMark ? "bg-red-500" : "bg-blue-600 dark:bg-blue-500"}`} style={{ width: `${Math.max(0, Math.min(100, s.average ?? 0))}%` }} />
                      </span>
                      {num(s.average)}
                    </span>
                  </td>
                  <td className={`${tdNum} ${cellPad}`}>
                    {s.grade ? (
                      <span className="inline-flex min-w-[2rem] justify-center rounded-lg border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">{s.grade}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${tdNum} ${cellPad}`}>{position(s.position, s.position_of)}</td>
                  <td className={`${tdNum} ${cellPad} text-emerald-700 dark:text-emerald-400`}>{s.passed}</td>
                  <td className={`${tdNum} ${cellPad} ${s.failed > 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>{s.failed}</td>
                  <td className={`${tdNum} ${cellPad} ${s.attendance_rate != null && s.attendance_rate < 85 ? "text-red-600 dark:text-red-400" : ""}`}>{pct(s.attendance_rate)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className={`${td} py-10 text-center text-text-secondary-light dark:text-text-secondary-dark`} colSpan={colCount}>
                    {filters.q.trim() && nFilters === 1 ? `No student matches “${filters.q.trim()}”.` : "No student matches these filters."}{" "}
                    <button type="button" onClick={clearFilters} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-surface-light dark:bg-[#121925]">
              {(
                [
                  ["Subject mean", "mean"],
                  ["Highest", "max"],
                  ["Lowest", "min"],
                  ["Pass rate", "pass_rate"],
                ] as const
              ).map(([label, key]) => (
                <tr key={key}>
                  <th scope="row" className={`${td} ${sticky} bg-surface-light text-left text-xs font-semibold dark:bg-[#121925]`}>
                    {label}
                  </th>
                  {showClass && <td className={td} />}
                  {visibleSubjects.map((sub) => {
                    const v = statOf(sub.subject_id)?.[key] ?? null;
                    return (
                      <td key={sub.subject_id} className={`${tdNum} text-xs font-semibold ${key === "pass_rate" ? "" : markTone(v, passMark)}`}>
                        {key === "pass_rate" ? pct(v) : num(v)}
                      </td>
                    );
                  })}
                  <td className={td} colSpan={7} />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark print:hidden">
          <span>
            {filteredView ? "Footer and summary are worked out over the students shown. " : ""}Click a student for their subjects; ← → step through.
          </span>
          {rows.length > PAGE_SIZES[0] && (
            <span className="flex items-center gap-2">
              <Select aria-label="Rows per page" value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))} size="sm">
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n} per page` : "All rows"}
                  </option>
                ))}
              </Select>
              {pageSize > 0 && pages > 1 && (
                <>
                  <button type="button" className={toolBtn()} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    ‹
                  </button>
                  <span className="tabular-nums">
                    {page} / {pages}
                  </span>
                  <button type="button" className={toolBtn()} disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    ›
                  </button>
                </>
              )}
            </span>
          )}
        </p>
      </Section>

      <StudentDrawer
        student={openStudent}
        subjects={subjects}
        classMeans={classMeans}
        passMark={passMark}
        index={openIndex}
        count={rows.length}
        onClose={() => setOpenId(null)}
        onPrev={openIndex > 0 ? () => setOpenId(rows[openIndex - 1].student_id) : undefined}
        onNext={openIndex >= 0 && openIndex < rows.length - 1 ? () => setOpenId(rows[openIndex + 1].student_id) : undefined}
      />
    </div>
  );
}
