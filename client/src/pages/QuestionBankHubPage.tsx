import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  Library,
  ListChecks,
  Loader2,
  RefreshCw,
} from "lucide-react";
import QuestionBankHubDashboard from "../components/QuestionBank/hub/QuestionBankHubDashboard";
import QuestionBankList from "../components/QuestionBank/QuestionBankList";
import {
  QuestionBankHubApiService,
  type QuestionBankOverview,
} from "../services/questionBankHubApi";

/**
 * /question-bank -- one place for a teacher's question banks across every
 * subject they teach (instead of Courses -> subject -> Question Bank).
 *
 *   Dashboard  cross-subject health, alerts and reports; the subject filter
 *              narrows it to one subject.
 *   Questions  the existing per-subject QuestionBankList for the selected
 *              subject (a subject is required: questions belong to one).
 *
 * Tab and subject live in the URL (?tab=&subject=) so alerts, report rows
 * and bookmarks can deep-link straight into a subject's questions.
 */

type Tab = "dashboard" | "questions";

const QuestionBankHubPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "questions" ? "questions" : "dashboard";
  const subjectParam = Number(params.get("subject"));
  const subjectId = Number.isFinite(subjectParam) && subjectParam > 0 ? subjectParam : null;

  const [data, setData] = useState<QuestionBankOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    (next: { tab?: Tab; subject?: number | null }) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next.tab) p.set("tab", next.tab);
          if (next.subject !== undefined) {
            if (next.subject) p.set("subject", String(next.subject));
            else p.delete("subject");
          }
          return p;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const load = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await QuestionBankHubApiService.getOverview(subjectId));
      } catch (e) {
        const err = e as { response?: { status?: number; data?: { message?: string } } };
        if (err?.response?.status === 404 && subjectId) {
          // A stale/foreign subject in the URL: fall back to all subjects.
          update({ subject: null });
          return;
        }
        setError(err?.response?.data?.message || "Couldn't load your question bank overview.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [subjectId, update],
  );

  useEffect(() => {
    load(data !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const subjects = useMemo(() => data?.available_subjects ?? [], [data]);

  // A single-subject teacher never needs to pick.
  useEffect(() => {
    if (tab === "questions" && !subjectId && subjects.length === 1) update({ subject: subjects[0].id });
  }, [tab, subjectId, subjects, update]);

  const selected = subjects.find((s) => s.id === subjectId) ?? null;
  const urgentAlerts = (data?.alerts ?? []).filter((a) => a.severity === "critical" || a.severity === "warning").length;
  const countFor = (id: number) => data?.subjects.find((s) => s.subject_id === id)?.total;

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, badge: urgentAlerts || undefined },
    { id: "questions", label: "Questions", icon: ListChecks },
  ];

  return (
    <div className="max-w-8xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/60 bg-white/80 p-4 backdrop-blur-xl dark:border-gray-800/30 dark:bg-gray-900/50 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Library className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark md:text-2xl">Question Bank</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {selected
                ? `${selected.code ? `${selected.code} · ` : ""}${selected.name}`
                : subjects.length > 0
                  ? `All ${subjects.length} subjects you teach`
                  : "The subjects you teach"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Subject</span>
            <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <select
              value={subjectId ?? ""}
              onChange={(e) => update({ subject: e.target.value ? Number(e.target.value) : null })}
              disabled={!data}
              className="min-w-[16rem] appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-9 text-sm font-medium text-text-primary-light focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
            >
              <option value="">{tab === "questions" ? "Choose a subject…" : "All my subjects"}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} — ${s.name}` : s.name}
                  {countFor(s.id) != null && !subjectId ? ` (${countFor(s.id)})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </label>
          {selected && (
            <Link
              to={`/courses/${selected.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
            >
              <ExternalLink className="h-4 w-4" /> Subject page
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Question bank views" className="flex gap-1 border-b border-gray-200 dark:border-gray-800/60 print:hidden">
        {tabs.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => update({ tab: t.id })}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-600 hover:text-text-primary-light dark:text-slate-300 dark:hover:text-text-primary-dark"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.badge ? (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white" aria-label={`${t.badge} alerts need attention`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading your question banks…</p>
        </div>
      ) : error && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-10 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
          <AlertCircle className="h-8 w-8 text-rose-500" />
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : !data ? null : tab === "dashboard" ? (
        <QuestionBankHubDashboard
          data={data}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          onOpenSubject={(id) => update({ tab: "questions", subject: id })}
        />
      ) : selected ? (
        <QuestionBankList key={selected.id} courseId={selected.id} hideCourseCard onChanged={() => load(true)} />
      ) : (
        <SubjectChooser data={data} onPick={(id) => update({ subject: id })} />
      )}
    </div>
  );
};

/** Shown on the Questions tab until a subject is picked. */
const SubjectChooser: React.FC<{ data: QuestionBankOverview; onPick: (id: number) => void }> = ({ data, onPick }) => {
  if (data.available_subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-sm text-slate-600 dark:border-gray-700 dark:text-slate-300">
        You have no subjects assigned for the selected academic period.
      </div>
    );
  }
  return (
    <div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Pick a subject to see and manage its questions.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.available_subjects.map((s) => {
          const st = data.subjects.find((x) => x.subject_id === s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className="group flex items-center gap-3 rounded-2xl border border-gray-200/70 bg-card-light p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-border-dark/30 dark:bg-card-dark/30 dark:hover:border-blue-800"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                {(s.code || s.name).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{s.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {s.code && <span className="font-mono">{s.code} · </span>}
                  {st?.total ?? 0} questions
                  {st && st.added_7d > 0 && <span className="text-emerald-600 dark:text-emerald-400"> · +{st.added_7d} this week</span>}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionBankHubPage;
