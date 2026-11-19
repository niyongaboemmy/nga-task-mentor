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
import BroadsheetTab from "../components/SchoolReports/BroadsheetTab";
import PerformanceTab from "../components/SchoolReports/PerformanceTab";
import GenderTab from "../components/SchoolReports/GenderTab";
import TrendsTab from "../components/SchoolReports/TrendsTab";
import AtRiskTab from "../components/SchoolReports/AtRiskTab";
import { atRiskRows, broadsheetRows, genderRows, performanceRows, trendsRows } from "../components/SchoolReports/csvRows";
import { ReportsSkeleton } from "../components/SchoolReports/shared";
import { secondaryBtn } from "../components/SchoolReports/format";

// ─── /reports/school ──────────────────────────────────────────────────────────
// The school's term reports from report-card data (GET /api/reports/school):
// Broadsheet · Performance · Gender · Trends · At risk. By default only issued
// (approved / published) cards count, so the numbers match what parents got;
// "Include drafts" turns it into a provisional, live view. Every tab exports
// to CSV (Excel-safe) and prints / saves as PDF with the app chrome hidden.

type TabId = "broadsheet" | "performance" | "gender" | "trends" | "at-risk";

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
  }, [term, academicYear]);

  const className = classId == null ? "All classes" : (classOptions.find((c) => c.id === classId)?.name ?? "Class");

  const exportTab = useCallback(
    (tab: TabId) => {
      if (!data) return;
      const builders: Record<TabId, (d: SchoolReports) => (string | number | null | undefined)[][]> = {
        broadsheet: broadsheetRows,
        performance: performanceRows,
        gender: genderRows,
        trends: trendsRows,
        "at-risk": atRiskRows,
      };
      try {
        downloadCsv(`${csvSlug(`${tab} ${className} ${data.term} ${data.academic_year}`)}.csv`, builders[tab](data));
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
    const onExport = () => exportTab(active as TabId);
    switch (active as TabId) {
      case "performance":
        return <PerformanceTab data={data} onExport={onExport} />;
      case "gender":
        return <GenderTab data={data} onExport={onExport} />;
      case "trends":
        return <TrendsTab data={data} onExport={onExport} />;
      case "at-risk":
        return <AtRiskTab data={data} onExport={onExport} />;
      default:
        return <BroadsheetTab data={data} onExport={onExport} />;
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 pb-16 sm:p-6">
      <style>{PRINT_CSS}</style>

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

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border-light bg-card-light p-3 dark:border-border-dark/40 dark:bg-card-dark/30">
          <TermYearSelect
            years={period.years}
            terms={period.terms}
            academicYear={academicYear}
            term={term}
            onAcademicYearChange={period.setAcademicYear}
            onTermChange={period.setTerm}
            disabled={period.loading}
          />
          <Select
            value={classId == null ? "all" : String(classId)}
            onChange={(e) => setClassId(e.target.value === "all" ? null : Number(e.target.value))}
            aria-label="Class"
            className="min-w-[180px]"
            size="sm"
            disabled={classOptions.length === 0}
          >
            <option value="all">All classes</option>
            {classOptions.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.program_name ? `${c.name} · ${c.program_name}` : c.name}
              </option>
            ))}
          </Select>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-primary-light dark:text-text-primary-dark">
            <input
              type="checkbox"
              checked={includeDrafts}
              onChange={(e) => setIncludeDrafts(e.target.checked)}
              className="h-4 w-4 rounded border-border-light text-blue-600 focus:ring-blue-500 dark:border-border-dark"
            />
            Include drafts (provisional)
          </label>
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
