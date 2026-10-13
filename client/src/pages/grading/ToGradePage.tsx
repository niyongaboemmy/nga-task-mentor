import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, Code2, FileText, HelpCircle, RefreshCw, Search } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { fetchGradingInbox, type GradingInbox, type GradingInboxItem } from "../../services/gradingInboxApi";

/**
 * To grade (CODE_RUNNER_PLAN.md §7.6): every assignment and quiz with work
 * waiting in the teacher's subjects, most urgent first, and one button that
 * opens the place to grade it. Filters live in the URL (?type=&subject=&q=),
 * so a link or a refresh keeps them; the list refreshes every 2 minutes.
 */

type Kind = "all" | "assignment" | "quiz";

const fmtDue = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

const waited = (days: number) => (days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`);

const ToGradePage: React.FC = () => {
  const [data, setData] = useState<GradingInbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useSearchParams();
  const kind = (["assignment", "quiz"].includes(search.get("type") ?? "") ? search.get("type") : "all") as Kind;
  const subject = search.get("subject") ?? "all";
  const q = search.get("q") ?? "";
  const setParam = (key: string, value: string, fallback: string) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const setKind = (v: Kind) => setParam("type", v, "all");
  const setSubject = (v: string) => setParam("subject", v, "all");
  const setQ = (v: string) => setParam("q", v, "");

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      setData(await fetchGradingInbox(fresh));
      setError(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Couldn't load what needs grading.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 120_000);
    return () => window.clearInterval(t);
  }, [load]);

  const subjects = useMemo(() => {
    const m = new Map<number, string>();
    for (const i of data?.items ?? []) m.set(i.subject.id, i.subject.code ? `${i.subject.code} · ${i.subject.name}` : i.subject.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const items = (data?.items ?? []).filter(
    (i) =>
      (kind === "all" || (kind === "assignment" ? i.kind === "assignment" : i.kind !== "assignment")) &&
      (subject === "all" || String(i.subject.id) === subject) &&
      (!q.trim() || i.title.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <div className="space-y-5" data-testid="to-grade-page">
      <PageHeader
        title="To grade"
        icon={<ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />}
        description={
          data
            ? data.total_to_grade
              ? `${data.total_to_grade} submission${data.total_to_grade === 1 ? "" : "s"} waiting in ${data.items.length} activit${data.items.length === 1 ? "y" : "ies"}, oldest first.`
              : "Everything is graded."
            : "Work waiting to be graded in your subjects."
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load(true)}
            disabled={loading}
            icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2" role="search">
        <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="group" aria-label="Type">
          {(
            [
              ["all", "All"],
              ["assignment", "Assignments"],
              ["quiz", "Quizzes"],
            ] as [Kind, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                kind === k ? "bg-white text-text-primary-light shadow-sm dark:bg-slate-700 dark:text-white" : "text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {subjects.length > 1 && (
          <div className="w-56">
            <Select size="sm" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="all">All subjects</option>
              {subjects.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <label className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary-light" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find an activity"
            aria-label="Find an activity"
            className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-800"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          {error}
        </p>
      )}

      {!data && !error ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          title="Nothing to grade"
          description="New submissions will appear here as soon as students hand in their work."
        />
      ) : data && items.length === 0 ? (
        <EmptyState title="No activity matches" description="Change the type, subject or search." />
      ) : (
        <ul className="space-y-2" aria-label="Activities to grade">
          {items.map((i) => (
            <InboxRow key={`${i.kind}-${i.id}`} item={i} />
          ))}
        </ul>
      )}
    </div>
  );
};

const InboxRow: React.FC<{ item: GradingInboxItem }> = ({ item: i }) => {
  const Icon = i.code ? Code2 : i.kind === "assignment" ? FileText : HelpCircle;
  const due = fmtDue(i.due_at);
  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 dark:border-white/10 dark:bg-card-dark/40"
      data-testid="to-grade-item"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary dark:bg-blue-500/10 dark:text-blue-300" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary-light dark:text-text-primary-dark">{i.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <span>{i.kind === "assignment" ? (i.code ? "Code assignment" : "Assignment") : i.code ? "Quiz · coding" : "Quiz"}</span>
          <span aria-hidden="true">·</span>
          <span>{i.subject.code ?? i.subject.name}</span>
          {due && (
            <>
              <span aria-hidden="true">·</span>
              <span>Due {due}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="attention" testId="to-grade-count">
          {i.to_grade} to grade
        </Badge>
        {i.late > 0 && <Badge tone="danger">{i.late} late</Badge>}
        <Badge tone={i.waiting_days >= 7 ? "danger" : "neutral"}>waiting {waited(i.waiting_days)}</Badge>
      </div>
      <Link
        to={i.grade_url}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        data-testid="to-grade-open"
      >
        Grade
      </Link>
    </li>
  );
};

export default ToGradePage;
