import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowRight, CalendarDays, Check, ClipboardCheck, ClipboardList, Clock, Eye, FileCheck2, RefreshCw, Search, Send, Settings2, ShieldCheck, Users, LayoutTemplate } from "lucide-react";
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

type Filter = "all" | "mine" | "attention" | "done" | `stage-${number}`;

/** Where a class is in the flow, from the least advanced card. */
const STAGES = [
  { key: "marks", title: "Collecting marks", cta: "Collect marks", hint: "Subject teachers submit their marks." },
  { key: "review", title: "Ready to review", cta: "Review cards", hint: "Comments, attributes, then review." },
  { key: "approve", title: "Awaiting approval", cta: "Approve", hint: "Approval locks the cards and their marks." },
  { key: "publish", title: "Ready to publish", cta: "Publish", hint: "Students see cards once published." },
  { key: "done", title: "Published", cta: "View cards", hint: "Every card is out." },
] as const;

const STAGE_ICON = [ClipboardList, FileCheck2, ShieldCheck, Send, Eye];

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** What is left at this stage, in one short line under the action. */
function stageHint(st: number, r: CycleRow): string {
  if (st === 0) return `${plural(r.subjects_total - r.subjects_submitted, "subject")} to submit`;
  if (st === 1) return `${plural(r.counts.not_started + r.counts.draft, "card")} to review`;
  if (st === 2) return `${plural(r.counts.reviewed, "card")} to approve`;
  if (st === 3) return `${plural(r.counts.approved, "card")} to publish`;
  return `All ${r.students} published`;
}

function stageOf(r: CycleRow): number {
  if (r.subjects_total > 0 && r.subjects_submitted < r.subjects_total) return 0;
  if (r.counts.not_started + r.counts.draft > 0) return 1;
  if (r.counts.reviewed > 0) return 2;
  if (r.counts.approved > 0) return 3;
  return 4;
}

/** "in 3 days" / "today" / "2 days ago" — and whether it's overdue. */
function due(iso?: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  const text = days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days > 0 ? `in ${days} days` : `${-days} days ago`;
  return { text, overdue: days < 0 };
}

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
    if (filter.startsWith("stage-")) return list.filter((r) => stageOf(r) === Number(filter.slice(6)));
    // Least advanced first: what needs doing comes to the top.
    return [...list].sort((a, b) => stageOf(a) - stageOf(b) || a.name.localeCompare(b.name));
  }, [rows, q, filter]);

  const totals = useMemo(() => {
    const t = { students: 0, not_started: 0, draft: 0, reviewed: 0, approved: 0, published: 0 };
    for (const r of rows ?? []) {
      t.students += r.students;
      for (const k of ORDER) t[k] += r.counts[k];
    }
    return t;
  }, [rows]);

  const byStage = useMemo(() => {
    const n = [0, 0, 0, 0, 0];
    for (const r of rows ?? []) if (r.students > 0) n[stageOf(r)]++;
    return n;
  }, [rows]);
  const nextStage = byStage.findIndex((n, i) => i < 4 && n > 0);

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
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-text-primary-light hover:bg-gray-50 dark:border-panel-line dark:text-text-primary-dark dark:hover:bg-panel-raised"
              >
                <Settings2 className="h-4 w-4" /> Card settings
              </Link>
            )}
            {can?.approve && (
              <Link
                to="/report-cards/templates"
                data-testid="templates-link"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-text-primary-light hover:bg-gray-50 dark:border-panel-line dark:text-text-primary-dark dark:hover:bg-panel-raised"
              >
                <LayoutTemplate className="h-4 w-4" /> Templates
              </Link>
            )}
          </>
        }
      />

      {/* School pipeline: how many classes sit at each stage, and what to do next */}
      <section className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-panel-line dark:bg-panel-dark" data-testid="school-pipeline">
        {rows == null ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-64" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                {totals.published} of {totals.students} cards published
                <span className="ml-2 font-normal text-text-secondary-light dark:text-text-secondary-dark">
                  · {(rows ?? []).filter((r) => r.students > 0).length} classes
                </span>
              </p>
              {nextStage >= 0 ? (
                <button
                  type="button"
                  onClick={() => setFilter(`stage-${nextStage}`)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  data-testid="next-step"
                >
                  Next: {byStage[nextStage]} class{byStage[nextStage] === 1 ? "" : "es"} {STAGES[nextStage].title.toLowerCase()}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : totals.students > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                  <Check className="h-3.5 w-3.5" /> Every class is published
                </span>
              ) : null}
            </div>
            <ProgressBar counts={totals} total={totals.students} className="mt-3 h-1.5" />
            <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {STAGES.map((st, i) => {
                const active = filter === `stage-${i}`;
                return (
                  <li key={st.key}>
                    <button
                      type="button"
                      onClick={() => setFilter(active ? "all" : `stage-${i}`)}
                      aria-pressed={active}
                      title={st.hint}
                      className={`flex w-full flex-col items-start rounded-2xl border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-blue-500 bg-blue-50 dark:border-blue-400/60 dark:bg-blue-500/10"
                          : "border-gray-200 hover:bg-gray-50 dark:border-panel-line dark:hover:bg-panel-raised"
                      }`}
                    >
                      <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {i + 1}. {st.title}
                      </span>
                      <span className={`text-lg font-semibold tabular-nums ${byStage[i] ? "text-text-primary-light dark:text-text-primary-dark" : "text-text-secondary-light/60 dark:text-text-secondary-dark/50"}`}>
                        {byStage[i]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
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
                  : "border-gray-200 text-text-secondary-light hover:bg-gray-50 dark:border-panel-line dark:text-text-secondary-dark dark:hover:bg-panel-raised"
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
              className="w-48 rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-panel-line dark:bg-panel-dark"
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
            <Skeleton key={i} className="h-36 w-full rounded-3xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          title="No classes here"
          description={filter === "all" ? "No class has students for this term yet." : "No class matches this filter."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const st = stageOf(r);
            const stage = STAGES[st];
            const marksDue = st === 0 ? due(r.cycle?.marks_due_at) : null;
            const reviewDue = st > 0 && st < 3 ? due(r.cycle?.review_due_at) : null;
            const deadline = marksDue ? { label: "Marks due", ...marksDue } : reviewDue ? { label: "Review due", ...reviewDue } : null;
            const url = `/report-cards/${r.class_group_id}?${query}`;
            const ctaUrl = `${url}${st === 0 ? "&focus=subjects" : st === 2 ? "&view=reviewed" : st === 3 ? "&view=approved" : ""}`;
            const StageIcon = STAGE_ICON[st];
            const subjPct = r.subjects_total ? Math.round((r.subjects_submitted / r.subjects_total) * 100) : 0;
            return (
              <div
                key={r.class_group_id}
                data-testid={`class-${r.class_group_id}`}
                className="group relative flex flex-col rounded-3xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-panel-line dark:bg-panel-dark dark:hover:border-blue-500/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={url} className="block truncate text-sm font-semibold text-text-primary-light after:absolute after:inset-0 after:rounded-3xl focus:outline-none dark:text-text-primary-dark">
                      {r.name}
                    </Link>
                    <p className="truncate text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {[r.grade_name, r.program_name].filter(Boolean).join(" · ") || "—"}
                      {r.i_teach ? " · you teach" : ""}
                    </p>
                  </div>
                  {can?.edit_settings && (
                    <input
                      type="checkbox"
                      checked={picked.has(r.class_group_id)}
                      onChange={() => toggle(r.class_group_id)}
                      aria-label={`Select ${r.name} to set dates`}
                      className="relative z-10 mt-0.5"
                    />
                  )}
                </div>

                {/* Stage: four steps, the current one named */}
                <div className="mt-3 flex items-center gap-1" aria-label={`Stage: ${stage.title}`}>
                  {STAGES.slice(0, 4).map((x, i) => (
                    <span
                      key={x.key}
                      title={x.title}
                      className={`h-1.5 flex-1 rounded-full ${i < st ? "bg-blue-600" : i === st ? "bg-blue-400" : "bg-gray-200 dark:bg-white/10"}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {st === 4 ? <Check className="h-3.5 w-3.5 text-blue-600" /> : <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                    {stage.title}
                  </span>
                  {deadline && (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] ${deadline.overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-text-secondary-light dark:text-text-secondary-dark"}`}
                    >
                      <Clock className="h-3 w-3" /> {deadline.label} {deadline.text}
                    </span>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                  <div>
                    <dt>Students</dt>
                    <dd className="inline-flex items-center gap-1 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                      <Users className="h-3.5 w-3.5 opacity-60" /> {r.students}
                    </dd>
                  </div>
                  <div>
                    <dt>Subjects in</dt>
                    <dd className="text-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                      {r.subjects_submitted}/{r.subjects_total}
                    </dd>
                    <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${subjPct}%` }} />
                    </span>
                  </div>
                  <div>
                    <dt>Published</dt>
                    <dd className="text-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                      {r.counts.published}/{r.students}
                    </dd>
                  </div>
                </dl>

                <Link
                  to={ctaUrl}
                  data-testid={`cta-${r.class_group_id}`}
                  className={`relative z-10 mt-4 flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                    st < 4
                      ? "bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                      : "border border-gray-200 text-text-primary-light hover:bg-gray-50 dark:border-panel-line dark:text-text-primary-dark dark:hover:bg-panel-raised"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                      st < 4 ? "bg-blue-600 text-white" : "bg-gray-100 text-blue-700 dark:bg-white/10 dark:text-blue-300"
                    }`}
                  >
                    <StageIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm font-semibold">{stage.cta}</span>
                    <span className="block truncate text-[11px] opacity-75">{stageHint(st, r)}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            );
          })}
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
    <div className={`flex w-full overflow-hidden rounded-full bg-gray-100 dark:bg-panel-raised ${className}`} role="img" aria-label="Card progress">
      {ORDER.map((k) => {
        const n = counts[k] ?? 0;
        if (!n || !total) return null;
        return <span key={k} className={BAR[k]} style={{ width: `${(n / total) * 100}%` }} title={`${LABEL[k]}: ${n}`} />;
      })}
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
  const input = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-panel-line dark:bg-panel-dark";
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
