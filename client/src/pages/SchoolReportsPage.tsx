import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, FileWarning, Info, LineChart, RefreshCw, School, ShieldAlert, Table2, Users } from "lucide-react";
import { toast } from "react-toastify";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Select from "../components/ui/Select";
import { UrlTabs, type TabDef } from "../components/ui/Tabs";
import TermYearSelect from "../components/ReportCard/TermYearSelect";
import { useTermYearSelector } from "../hooks/useTermYearSelector";
import { ReportCardWorkflowApi, apiMessage, type SchoolReports } from "../services/reportCardWorkflowApi";
import { downloadCsv, csvSlug } from "../utils/csvExport";
import BroadsheetTab, { type BroadsheetExport } from "../components/SchoolReports/BroadsheetTab";
import { filtersFromParams, writeFilters } from "../components/SchoolReports/broadsheetFilters";
import { useSearchParams } from "react-router-dom";
import PerformanceTab from "../components/SchoolReports/PerformanceTab";
import GenderTab from "../components/SchoolReports/GenderTab";
import TrendsTab from "../components/SchoolReports/TrendsTab";
import AtRiskTab from "../components/SchoolReports/AtRiskTab";
import { atRiskRows, broadsheetRows, genderRows, performanceRows, trendsRows } from "../components/SchoolReports/csvRows";
import { ReportsSkeleton } from "../components/SchoolReports/shared";
import { secondaryBtn } from "../components/SchoolReports/format";
import PrintLetterhead from "../components/ui/PrintLetterhead";

// ─── /reports/school ──────────────────────────────────────────────────────────
// The school's term reports from report-card data (GET /api/reports/school):
// Broadsheet · Performance · Gender · Trends · At risk. By default only issued
// (approved / published) cards count, so the numbers match what parents got;
// "Include drafts" turns it into a provisional, live view. Every tab exports
// to CSV (Excel-safe) and prints / saves as PDF with the app chrome hidden.

type TabId = "broadsheet" | "performance" | "gender" | "trends" | "at-risk";

const labelCls = "mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark";

// Paper: only the report area prints, landscape, with background colours kept
// so the bars survive.
const PRINT_CSS = `
@media print {
  @page { size: landscape; margin: 10mm; }
  body * { visibility: hidden !important; }
  [data-print-area], [data-print-area] * { visibility: visible !important; }
  [data-print-area] [role=tablist] { display: none !important; }
  [data-print-area] { position: absolute; left: 0; top: 0; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export default function SchoolReportsPage() {
  const period = useTermYearSelector();
  const { term, academicYear } = period;

  const [classId, setClassId] = useState<number | null>(null);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [data, setData] = useState<SchoolReports | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The class list from the unfiltered response, so picking one class
  // doesn't shrink the picker to that class.
  const [classOptions, setClassOptions] = useState<SchoolReports["classes"]>([]);
  const requestId = useRef(0);

  const load = useCallback(
    async (fresh = false) => {
      if (!term || !academicYear) return;
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await ReportCardWorkflowApi.schoolReports({
          term,
          academic_year: academicYear,
          class_group_id: classId,
          include_drafts: includeDrafts,
          fresh,
        });
        if (id !== requestId.current) return;
        setData(res.data);
        if (res.data.classes?.length) setClassOptions((prev) => (classId == null || prev.length === 0 ? res.data.classes : prev));
        if (fresh) toast.success("Reports refreshed");
      } catch (e) {
        if (id !== requestId.current) return;
        const msg = apiMessage(e, "Couldn't load the school reports");
        setError(msg);
        toast.error(msg);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [term, academicYear, classId, includeDrafts],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // A new period has its own classes.
  useEffect(() => {
    setClassOptions([]);
    setProgramme(null);
  }, [term, academicYear]);

  // Programme: narrows the class picker and, for the whole programme, the
  // broadsheet and at-risk lists (their class filter, kept in the URL).
  const [, setParams] = useSearchParams();
  const [programme, setProgramme] = useState<string | null>(null);
  const programmes = useMemo(
    () => [...new Set(classOptions.map((c) => c.program_name).filter((p): p is string => !!p))].sort(),
    [classOptions],
  );
  const visibleClasses = programme ? classOptions.filter((c) => c.program_name === programme) : classOptions;
  const pickProgramme = (p: string | null) => {
    setProgramme(p);
    const names = p ? classOptions.filter((c) => c.program_name === p).map((c) => c.name) : [];
    if (classId != null && p && !names.includes(classOptions.find((c) => c.id === classId)?.name ?? "")) setClassId(null);
    setParams((prev) => writeFilters(prev, { ...filtersFromParams(prev), classes: names }), { replace: true });
  };

  const className =
    classId != null ? (classOptions.find((c) => c.id === classId)?.name ?? "Class") : programme ? `${programme} (all classes)` : "All classes";

  const exportTab = useCallback(
    (tab: TabId, view?: BroadsheetExport) => {
      if (!data) return;
      const builders: Record<TabId, (d: SchoolReports) => (string | number | null | undefined)[][]> = {
        broadsheet: broadsheetRows,
        performance: performanceRows,
        gender: genderRows,
        trends: trendsRows,
        "at-risk": atRiskRows,
      };
      try {
        // The broadsheet exports what is on screen (filters, hidden subjects, order).
        const source = view ? { ...data, broadsheet: { ...data.broadsheet, ...view } } : data;
        downloadCsv(`${csvSlug(`${tab} ${className} ${data.term} ${data.academic_year}${view ? " filtered" : ""}`)}.csv`, builders[tab](source));
        toast.success("CSV exported");
      } catch {
        toast.error("Couldn't export the CSV");
      }
    },
    [data, className],
  );

  const tabs: TabDef[] = useMemo(
    () => [
      { id: "broadsheet", label: "Broadsheet", icon: <Table2 className="h-4 w-4" /> },
      { id: "performance", label: "Performance", icon: <BarChart3 className="h-4 w-4" /> },
      { id: "gender", label: "Gender", icon: <Users className="h-4 w-4" /> },
      { id: "trends", label: "Trends", icon: <LineChart className="h-4 w-4" /> },
      { id: "at-risk", label: "At risk", icon: <ShieldAlert className="h-4 w-4" />, count: data ? data.at_risk.length : undefined },
    ],
    [data],
  );

  const renderTab = (active: string) => {
    if (loading || (period.loading && !data)) return <ReportsSkeleton />;
    if (!term || !academicYear) {
      return <EmptyState icon={<School className="h-6 w-6" />} title="Pick a term" description="Choose an academic year and term to see the school's reports." />;
    }
    if (error && !data) {
      return (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Couldn't load the school reports"
          description={error}
          action={
            <button type="button" className={secondaryBtn} onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          }
        />
      );
    }
    if (!data) return <ReportsSkeleton />;
    const onExport = (view?: BroadsheetExport) => exportTab(active as TabId, view);
    switch (active as TabId) {
      case "performance":
        return <PerformanceTab data={data} onExport={() => onExport()} />;
      case "gender":
        return <GenderTab data={data} onExport={() => onExport()} />;
      case "trends":
        return <TrendsTab data={data} onExport={() => onExport()} />;
      case "at-risk":
        return <AtRiskTab data={data} onExport={() => onExport()} />;
      default:
        return <BroadsheetTab data={data} onExport={onExport} />;
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 pb-16 sm:p-6">
      <style>{PRINT_CSS}</style>
      {/* After the page's own @page rule: the letterhead only changes the top and bottom margins. */}
      <PrintLetterhead note="School reports" pageWidthMm={297} sideMm={10} />

      <div className="print:hidden">
        <PageHeader
          breadcrumb={[{ label: "Reports", to: "/report-cards" }, { label: "School reports" }]}
          title="School reports"
          icon={<School className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          description="Broadsheet, performance, gender, trends and at-risk students from the term's report cards"
          actions={
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => void load(true)}
              disabled={loading || !term || !academicYear}
              aria-label="Refresh reports"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden /> Refresh
            </button>
          }
        />

        <div className="mt-4 rounded-2xl border border-border-light bg-card-light p-3 dark:border-border-dark/40 dark:bg-card-dark/30 sm:p-4" data-testid="school-report-filters">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0">
              <p className={labelCls}>Period</p>
              <TermYearSelect
                years={period.years}
                terms={period.terms}
                academicYear={academicYear}
                term={term}
                onAcademicYearChange={period.setAcademicYear}
                onTermChange={period.setTerm}
                disabled={period.loading}
              />
            </div>
            {programmes.length > 1 && (
              <div>
                <p className={labelCls}>Programme</p>
                <Select value={programme ?? "all"} onChange={(e) => pickProgramme(e.target.value === "all" ? null : e.target.value)} aria-label="Programme" className="min-w-[180px]">
                  <option value="all">All programmes</option>
                  {programmes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <p className={labelCls}>Class</p>
              <Select
                value={classId == null ? "all" : String(classId)}
                onChange={(e) => setClassId(e.target.value === "all" ? null : Number(e.target.value))}
                aria-label="Class"
                className="min-w-[220px]"
                disabled={classOptions.length === 0}
              >
                <option value="all">{programme ? `All ${programme} classes` : "All classes"}</option>
                {visibleClasses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.program_name && !programme ? `${c.name} · ${c.program_name}` : c.name}
                  </option>
                ))}
              </Select>
            </div>
            <label className="inline-flex w-full cursor-pointer sm:ml-auto sm:w-auto select-none items-center gap-2.5 rounded-xl border border-border-light px-3 py-2 text-sm text-text-primary-light hover:border-blue-400 dark:border-border-dark/50 dark:text-text-primary-dark">
              <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} className="peer sr-only" />
              <span
                aria-hidden
                className="relative h-5 w-9 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 dark:bg-white/20"
              />
              <span>
                Include drafts (provisional)
                <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark">Live numbers before cards are approved</span>
              </span>
            </label>
          </div>
          {(programme || classId != null) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-light pt-3 text-xs dark:border-border-dark/40">
              <span className="text-text-secondary-light dark:text-text-secondary-dark">Looking at</span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">{className}</span>
              <button
                type="button"
                className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                onClick={() => {
                  setClassId(null);
                  pickProgramme(null);
                }}
              >
                Whole school
              </button>
            </div>
          )}
        </div>
      </div>

      {data && !loading && (
        <div className="space-y-2 print:hidden">
          {data.provisional ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
            >
              <FileWarning className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>
                <strong>Provisional — includes draft cards.</strong>{" "}
                {data.drafts_included > 0
                  ? `${data.drafts_included} draft card${data.drafts_included !== 1 ? "s" : ""} not yet approved are counted; numbers can still change.`
                  : "Numbers can still change before the cards are approved."}
              </span>
            </div>
          ) : (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300"
            >
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>Showing issued (approved/published) cards only — the numbers parents see.</span>
            </div>
          )}
          {data.truncated && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>Too many report cards to analyse at once, so only part of the school is shown. Pick one class for complete numbers.</span>
            </div>
          )}
          {error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden />
              <span className="flex-1">{error} — showing the last loaded numbers.</span>
              <button type="button" className={secondaryBtn} onClick={() => void load()}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}
        </div>
      )}

      <div data-print-area>
        {data && (
          <div className="mb-3 hidden print:block">
            <h1 className="text-lg font-bold">School reports — {className}</h1>
            <p className="text-xs">
              {data.term} {data.academic_year} ·{" "}
              {data.provisional ? "Provisional — includes draft cards" : "Issued (approved/published) cards only"} · printed{" "}
              {new Date().toLocaleDateString()}
            </p>
          </div>
        )}
        <UrlTabs tabs={tabs} label="School report sections" defaultTab="broadsheet">
          {renderTab}
        </UrlTabs>
      </div>
    </div>
  );
}
