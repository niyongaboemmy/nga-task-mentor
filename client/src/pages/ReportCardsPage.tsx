import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { CalendarDays, ChevronRight, ClipboardCheck, RefreshCw, Search, Settings2, Users } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import TermYearSelect from "../components/ReportCard/TermYearSelect";
import { useTermYearSelector } from "../hooks/useTermYearSelector";
import { STATUS_META, type ReportCardStatus } from "../services/reportCardApi";
import { ReportCardWorkflowApi, apiMessage, type CallerCan, type CycleRow } from "../services/reportCardWorkflowApi";

/**
 * Report cards, class by class: every class group with this term's progress
 * (draft → reviewed → approved → published), how many subjects have signed
 * off, and its deadlines. Opening a class goes to its workbench, where the
 * cards are reviewed, approved and published in bulk.
 */

const ORDER: Array<ReportCardStatus | "not_started"> = ["not_started", "draft", "reviewed", "approved", "published"];
const BAR: Record<string, string> = {
  not_started: "bg-gray-300 dark:bg-white/15",
  draft: "bg-amber-400",
  reviewed: "bg-blue-400",
  approved: "bg-blue-700",
  published: "bg-emerald-500",
};
const LABEL: Record<string, string> = { not_started: "Not started", ...Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.label])) };

type Filter = "all" | "mine" | "attention" | "done";

export default function ReportCardsPage() {
  const sel = useTermYearSelector();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<CycleRow[] | null>(null);
  const [can, setCan] = useState<CallerCan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const filter = (params.get("filter") as Filter) || "all";
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!sel.term || !sel.academicYear) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ReportCardWorkflowApi.cycles({ term: sel.term, academic_year: sel.academicYear });
      setRows(res.data.classes);
      setCan(res.data.can);
    } catch (e) {
      const msg = apiMessage(e, "Couldn't load the classes.");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [sel.term, sel.academicYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const list = (rows ?? []).filter((r) => !q.trim() || `${r.name} ${r.program_name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
    if (filter === "mine") return list.filter((r) => r.i_teach);
    if (filter === "attention") return list.filter((r) => r.counts.reviewed > 0 || r.subjects_submitted < r.subjects_total);
    if (filter === "done") return list.filter((r) => r.counts.published === r.students && r.students > 0);
    return list;
  }, [rows, q, filter]);

  const totals = useMemo(() => {
    const t = { students: 0, not_started: 0, draft: 0, reviewed: 0, approved: 0, published: 0 };
    for (const r of rows ?? []) {
      t.students += r.students;
      for (const k of ORDER) t[k] += r.counts[k];
    }
    return t;
  }, [rows]);

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === "all") next.delete("filter");
    else next.set("filter", f);
    setParams(next, { replace: true });
  };
  const toggle = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const query = `term=${encodeURIComponent(sel.term)}&year=${encodeURIComponent(sel.academicYear)}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Report cards"
        icon={<ClipboardCheck className="h-6 w-6 text-blue-600" />}
        description="Prepare, review, approve and publish each class's report cards. Only draft cards can be changed."
        actions={
          <>
            <TermYearSelect
              years={sel.years}
              terms={sel.terms}
              academicYear={sel.academicYear}
              term={sel.term}
              onAcademicYearChange={sel.setAcademicYear}
              onTermChange={sel.setTerm}
              disabled={loading}
            />
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {can?.approve && (
              <Link
                to="/report-cards/settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-text-primary-light hover:bg-gray-50 dark:border-white/10 dark:text-text-primary-dark dark:hover:bg-white/5"
              >
                <Settings2 className="h-4 w-4" /> Card settings
              </Link>
            )}
          </>
        }
      />

      {/* School progress */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-gray-900">
        {rows == null ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                {totals.published} of {totals.students} cards published
              </p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {totals.reviewed} waiting for approval · {totals.approved} approved, not published
              </p>
            </div>
            <ProgressBar counts={totals} total={totals.students} className="mt-3 h-2.5" />
            <Legend counts={totals} />
          </>
        )}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter classes">
          {(
            [
              ["all", "All classes"],
              ["mine", "Classes I teach"],
              ["attention", "Needs attention"],
              ["done", "Fully published"],
            ] as Array<[Filter, string]>
          ).map(([f, label]) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 text-text-secondary-light hover:bg-gray-50 dark:border-white/10 dark:text-text-secondary-dark dark:hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {can?.edit_settings && picked.size > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}>
              <CalendarDays className="h-4 w-4" /> Dates for {picked.size} class{picked.size === 1 ? "" : "es"}
            </Button>
          )}
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary-light" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a class"
              aria-label="Find a class"
              className="w-48 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm dark:border-white/10 dark:bg-slate-800"
            />
          </label>
        </div>
      </div>

      {/* Classes */}
      {error && rows == null ? (
        <EmptyState
          title="Couldn't load the classes"
          description={error}
          action={
            <Button onClick={() => void load()} size="sm">
              Try again
            </Button>
          }
        />
      ) : rows == null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          title="No classes here"
          description={filter === "all" ? "No class has students for this term yet." : "No class matches this filter."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <div
              key={r.class_group_id}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-gray-900 dark:hover:border-blue-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{r.name}</p>
                  <p className="truncate text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {[r.grade_name, r.program_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {can?.edit_settings && (
                  <input
                    type="checkbox"
                    checked={picked.has(r.class_group_id)}
                    onChange={() => toggle(r.class_group_id)}
                    aria-label={`Select ${r.name}`}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                )}
              </div>
              <ProgressBar counts={r.counts} total={r.students} className="mt-3 h-2" />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {r.students}
                </span>
                <span>
                  Subjects submitted {r.subjects_submitted}/{r.subjects_total}
                </span>
                {r.counts.reviewed > 0 && <span className="font-semibold text-blue-700 dark:text-blue-300">{r.counts.reviewed} to approve</span>}
                {r.cycle?.marks_due_at && <span>Marks due {new Date(r.cycle.marks_due_at).toLocaleDateString()}</span>}
              </div>
              <Link
                to={`/report-cards/${r.class_group_id}?${query}`}
                className="mt-3 inline-flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-white/10 dark:text-blue-300 dark:hover:bg-blue-900/20"
              >
                Open workbench <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      <CycleDatesModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        classIds={[...picked]}
        term={sel.term}
        academicYear={sel.academicYear}
        onSaved={() => {
          setPicked(new Set());
          void load();
        }}
      />
    </div>
  );
}

export function ProgressBar({
  counts,
  total,
  className = "",
}: {
  counts: Partial<Record<string, number>>;
  total: number;
  className?: string;
}) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5 ${className}`} role="img" aria-label="Card progress">
      {ORDER.map((k) => {
        const n = counts[k] ?? 0;
        if (!n || !total) return null;
        return <span key={k} className={BAR[k]} style={{ width: `${(n / total) * 100}%` }} title={`${LABEL[k]}: ${n}`} />;
      })}
    </div>
  );
}

function Legend({ counts }: { counts: Partial<Record<string, number>> }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {ORDER.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <span className={`h-2 w-2 rounded-full ${BAR[k]}`} /> {LABEL[k]} {counts[k] ?? 0}
        </span>
      ))}
    </div>
  );
}

/** Deadlines, scheduled release and next-term date for one or more classes. */
export function CycleDatesModal({
  open,
  onClose,
  classIds,
  term,
  academicYear,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  classIds: number[];
  term: string;
  academicYear: string;
  initial?: { marks_due_at?: string | null; review_due_at?: string | null; publish_at?: string | null; next_term_begins_on?: string | null };
  onSaved?: () => void;
}) {
  const toLocal = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
  const [marks, setMarks] = useState("");
  const [review, setReview] = useState("");
  const [nextTerm, setNextTerm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMarks(toLocal(initial?.marks_due_at));
    setReview(toLocal(initial?.review_due_at));
    setNextTerm(initial?.next_term_begins_on ?? "");
  }, [open, initial]);
  const save = async () => {
    setBusy(true);
    try {
      const res = await ReportCardWorkflowApi.saveSettings({
        class_group_ids: classIds,
        term,
        academic_year: academicYear,
        marks_due_at: marks ? new Date(marks).toISOString() : null,
        review_due_at: review ? new Date(review).toISOString() : null,
        next_term_begins_on: nextTerm || null,
      });
      toast.success(res.message || "Dates saved.");
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't save the dates."));
    } finally {
      setBusy(false);
    }
  };
  const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-800";
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Report card dates"
      subtitle={`${classIds.length} class${classIds.length === 1 ? "" : "es"} · ${term} ${academicYear}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save dates
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary-light dark:text-text-primary-dark">Marks due</span>
          <input type="datetime-local" value={marks} onChange={(e) => setMarks(e.target.value)} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary-light dark:text-text-primary-dark">Review due</span>
          <input type="datetime-local" value={review} onChange={(e) => setReview(e.target.value)} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary-light dark:text-text-primary-dark">Next term begins (printed on the card)</span>
          <input type="date" value={nextTerm} onChange={(e) => setNextTerm(e.target.value)} className={input} />
        </label>
      </div>
    </Modal>
  );
}
