import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Circle,
  Code2,
  ExternalLink,
  FileCode2,
  GitCommitHorizontal,
  History,
  Info,
  ListChecks,
  MonitorUp,
  Paperclip,
  Play,
  XCircle,
} from "lucide-react";
import RichTextDisplay from "../../Common/RichTextDisplay";
import UserAvatar from "../../ui/UserAvatar";
import type { GradingRoster, GradingRow, RunTargets } from "../../../services/practicalsApi";
import type { RevisionSummary } from "../../../services/projectsApi";
import { formatBytes, formatDateTime, timeAgo } from "../projectFormat";
import { duration, languageLabel, normLang } from "./gradingFormat";

/**
 * The grading workspace's Details tab: what the student was asked to do (the
 * brief, attachments, marking guide) beside what they handed in, with the
 * checks a grader would otherwise work out by hand (late by how long, the
 * language they used, edits after submitting, what can be run).
 */

type Activity = GradingRoster["activity"];
type Check = { tone: "ok" | "warn" | "bad" | "info"; title: string; detail?: React.ReactNode };

const looksLikeHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);
const hasText = (html: string | null | undefined) => !!String(html ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

const Card: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; aside?: React.ReactNode; testId?: string }> = ({
  title,
  icon: Icon,
  children,
  aside,
  testId,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900" data-testid={testId}>
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h2 className="flex-1 text-sm font-semibold">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

const Fact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
  </div>
);

const CHECK_ICON = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />,
  bad: <XCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />,
  info: <Info className="h-4 w-4 text-sky-500" aria-hidden="true" />,
};

const GradingDetailsPane: React.FC<{
  activity: Activity;
  row: GradingRow;
  revisions: RevisionSummary[] | null;
  /** The revision shown in Code/Preview/Run. */
  revisionId: number | null;
  targets: RunTargets | null;
  savedScores: (number | null)[];
  openedInTmcode: { at: string; revision: number | null } | null;
  onViewRevision: (revisionId: number, pane: "code" | "preview" | "run") => void;
}> = ({ activity: a, row, revisions, revisionId, targets, savedScores, openedInTmcode, onViewRevision }) => {
  const brief = a.brief ?? null;
  const name = row.student?.name ?? "Student";
  const due = a.due_date ? new Date(a.due_date) : null;
  const submittedAt = row.submitted_at ? new Date(row.submitted_at) : null;
  const submittedRevNo = row.link?.revision_number ?? null;
  const submittedRev = revisions?.find((r) => r.id === row.link?.revision_id) ?? null;
  const head = revisions?.length ? revisions.reduce((m, r) => (r.number > m.number ? r : m), revisions[0]!) : null;
  const afterSubmit = submittedRevNo && revisions ? revisions.filter((r) => r.number > submittedRevNo) : [];
  const expectedLang = normLang(brief?.language);
  const usedLang = normLang(row.project?.language);
  const description = brief?.description ?? a.question?.text ?? null;
  const instructions = brief?.instructions ?? a.question?.instructions ?? null;
  const rubricMax = a.rubric.reduce((n, c) => n + (Number(c.max_score) || 0), 0);

  // ── Checks ────────────────────────────────────────────────────────────────
  const checks: Check[] = [];
  if (!row.project) checks.push({ tone: "bad", title: `${name} hasn't started a project yet` });
  if (!submittedAt) {
    checks.push({ tone: row.project ? "warn" : "bad", title: "Not submitted", detail: row.project ? "You'd be grading work in progress." : undefined });
  } else if (due && submittedAt > due) {
    checks.push({ tone: "bad", title: `Late by ${duration(submittedAt.getTime() - due.getTime())}`, detail: `Due ${formatDateTime(a.due_date)}, submitted ${formatDateTime(row.submitted_at)}` });
  } else if (row.late) {
    checks.push({ tone: "bad", title: "Submitted late" });
  } else {
    checks.push({
      tone: "ok",
      title: "Submitted on time",
      detail: due ? `${duration(due.getTime() - submittedAt.getTime())} before the deadline` : undefined,
    });
  }
  if (row.link && !row.link.revision_id && row.project?.kind !== "github") {
    checks.push({ tone: "warn", title: "No frozen revision", detail: "The submission isn't tied to a saved revision; the code shown is the latest." });
  }
  if (afterSubmit.length) {
    checks.push({
      tone: "warn",
      title: `${afterSubmit.length} ${afterSubmit.length === 1 ? "save" : "saves"} after submitting`,
      detail: `Grade revision #${submittedRevNo} (what was handed in). The latest is #${head?.number}.`,
    });
  }
  if (expectedLang && usedLang) {
    checks.push(
      expectedLang === usedLang
        ? { tone: "ok", title: `Uses ${languageLabel(expectedLang)}, as asked` }
        : { tone: "warn", title: `Uses ${languageLabel(usedLang)}`, detail: `The task asks for ${languageLabel(expectedLang)}.` },
    );
  }
  if (submittedRev) {
    checks.push({
      tone: submittedRev.file_count ? "info" : "bad",
      title: submittedRev.file_count ? `${submittedRev.file_count} files · ${formatBytes(submittedRev.size_bytes)}` : "The submitted revision is empty",
    });
  }
  if (targets) {
    if (targets.html_entry) checks.push({ tone: "info", title: `Has a web page (${targets.html_entry})`, detail: "Open it in Preview." });
    const runnable = targets.languages.filter((l) => l.runnable);
    if (runnable.length) {
      checks.push({
        tone: "info",
        title: `Runnable ${runnable.map((l) => l.label).join(", ")} program`,
        detail: targets.entries[0] ? `Detected entry: ${targets.entries[0]}. Try it in Run.` : "Try it in Run.",
      });
    }
    if (!targets.html_entry && !targets.languages.length) checks.push({ tone: "warn", title: "Nothing to preview or run", detail: "Read the code instead." });
    if (targets.has_package_json) checks.push({ tone: "info", title: "Has a package.json", detail: "It needs a build step: open it in TMCode to run it fully." });
  }
  if (openedInTmcode) {
    checks.push({ tone: "info", title: `You opened it in TMCode ${timeAgo(openedInTmcode.at)}`, detail: openedInTmcode.revision ? `Revision #${openedInTmcode.revision}` : undefined });
  }

  // ── Timeline ──────────────────────────────────────────────────────────────
  const steps: { label: string; at: string | null; done: boolean; note?: string }[] = [
    { label: "Started", at: revisions?.length ? revisions.reduce((m, r) => (r.number < m.number ? r : m), revisions[0]!).created_at : null, done: !!row.project },
    { label: "Submitted", at: row.submitted_at, done: !!submittedAt, note: submittedRevNo ? `revision #${submittedRevNo}` : undefined },
    {
      label: "Graded",
      at: row.grade?.graded_at ?? null,
      done: row.state === "graded",
      note: row.grade?.score != null ? `${Math.round(row.grade.score * 100) / 100}/${a.max_points}` : undefined,
    },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-1 xl:grid-cols-[minmax(0,1fr)_360px]" data-testid="grading-details">
      {/* ── The task ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        <Card title="The task" icon={BookOpen} testId="details-brief">
          <h3 className="text-base font-semibold">{a.title}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Due" value={a.due_date ? formatDateTime(a.due_date) : "No deadline"} />
            <Fact label="Points" value={a.max_points} />
            <Fact label="Language" value={brief?.language ? languageLabel(brief.language) : "Any"} />
            <Fact label="Type" value={brief?.kind === "case_study" ? "Case study" : a.type === "quiz" ? "Coding question" : "Code assignment"} />
          </dl>
          {hasText(description) && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/5">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <RichTextDisplay content={description!} className="assignment-description leading-relaxed" />
              </div>
            </div>
          )}
          {instructions && instructions.trim() && instructions !== description && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Instructions in TMCode</p>
              {looksLikeHtml(instructions) ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <RichTextDisplay content={instructions} />
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{instructions}</p>
              )}
            </div>
          )}
          {!hasText(description) && !instructions?.trim() && (
            <p className="mt-4 text-sm text-slate-500">No description was written for this task.</p>
          )}
          {(brief?.attachments.length || brief?.starter) && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-white/5">
              {brief?.attachments.map((f) => (
                <a
                  key={f.url}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{f.name}</span>
                  {f.size ? <span className="text-slate-400">{formatBytes(f.size)}</span> : null}
                </a>
              ))}
              {brief?.starter && (
                <Link
                  to={`/projects/${brief.starter.project_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <FileCode2 className="h-3.5 w-3.5 text-slate-400" /> Starter files
                </Link>
              )}
            </div>
          )}
        </Card>

        <Card
          title="Marking guide"
          icon={Award}
          testId="details-rubric"
          aside={a.rubric.length ? <span className="text-xs text-slate-500">{rubricMax} marks in total</span> : null}
        >
          {a.rubric.length === 0 ? (
            <p className="text-sm text-slate-500">No criteria: give one overall mark out of {a.max_points}.</p>
          ) : (
            <ol className="divide-y divide-slate-100 dark:divide-white/5">
              {a.rubric.map((c, i) => {
                const got = savedScores[i] ?? null;
                return (
                  <li key={i} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-white/10">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{c.criteria}</p>
                      {c.description && <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-500 dark:text-slate-400">{c.description}</p>}
                    </div>
                    <span className="shrink-0 text-right text-sm font-bold tabular-nums">
                      {got != null ? got : <span className="text-slate-400">–</span>}
                      <span className="text-xs font-medium text-slate-400">/{c.max_score}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {row.grade?.feedback && (
          <Card title="Feedback sent" icon={CheckCircle2}>
            <p className="whitespace-pre-wrap text-sm">{row.grade.feedback}</p>
          </Card>
        )}
      </div>

      {/* ── The submission ───────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        <Card title="This submission" icon={ListChecks} testId="details-submission">
          <div className="mb-3 flex items-center gap-2.5">
            <UserAvatar decorative src={row.student?.avatar_url} userId={row.student?.id} name={name} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-slate-500">{row.project ? `${row.project.name} · ${languageLabel(row.project.language)}` : "No project"}</p>
            </div>
          </div>
          <ol className="mb-4 flex items-start" aria-label="Progress">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
                {i > 0 && <span className={`absolute right-1/2 top-2 h-0.5 w-full ${s.done ? "bg-blue-500" : "bg-slate-200 dark:bg-white/10"}`} aria-hidden="true" />}
                <span className="relative z-10 bg-white dark:bg-slate-900">
                  {s.done ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                </span>
                <span className="mt-1 text-[11px] font-semibold">{s.label}</span>
                <span className="text-[10px] text-slate-500">{s.done && s.at ? formatDateTime(s.at) : s.done ? "" : "—"}</span>
                {s.note && s.done && <span className="text-[10px] text-slate-500">{s.note}</span>}
              </li>
            ))}
          </ol>
          <ul className="space-y-2" data-testid="details-checks">
            {checks.map((c) => (
              <li key={c.title} className="flex gap-2">
                <span className="mt-0.5 shrink-0">{CHECK_ICON[c.tone]}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{c.title}</span>
                  {c.detail && <span className="block text-xs text-slate-500">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {row.project && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
              {targets?.html_entry && row.link?.revision_id && (
                <QuickButton icon={MonitorUp} label="Preview" onClick={() => onViewRevision(row.link!.revision_id!, "preview")} />
              )}
              {!!targets?.languages.some((l) => l.runnable) && row.link?.revision_id && (
                <QuickButton icon={Play} label="Run" onClick={() => onViewRevision(row.link!.revision_id!, "run")} />
              )}
              <Link
                to={`/projects/${row.project.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Project page
              </Link>
              {row.project.repo_url && (
                <a
                  href={row.project.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Repository
                </a>
              )}
              {row.link?.git_commit && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs dark:bg-white/5" title="Submitted git commit">
                  <GitCommitHorizontal className="h-3.5 w-3.5" /> {row.link.git_commit.slice(0, 10)}
                </span>
              )}
            </div>
          )}
        </Card>

        {row.project && (
          <Card title="Revisions" icon={History} testId="details-revisions" aside={revisions ? <span className="text-xs text-slate-500">{revisions.length}</span> : null}>
            {!revisions ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : revisions.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing saved yet.</p>
            ) : (
              <ul className="-mx-1 max-h-80 space-y-0.5 overflow-y-auto">
                {[...revisions]
                  .sort((x, y) => y.number - x.number)
                  .slice(0, 30)
                  .map((r) => {
                    const isSubmitted = r.id === row.link?.revision_id;
                    const isViewing = r.id === revisionId;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => onViewRevision(r.id, "code")}
                          title="View this revision's code"
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                            isViewing ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"
                          }`}
                        >
                          <Code2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="font-semibold tabular-nums">#{r.number}</span>
                          <span className="min-w-0 flex-1 truncate text-slate-500">{r.message || (r.source === "submit" ? "Submitted" : "Saved")}</span>
                          {isSubmitted && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Submitted</span>}
                          <span className="shrink-0 text-[10px] text-slate-400" title={formatDateTime(r.created_at)}>
                            {timeAgo(r.created_at)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Card>
        )}

        {a.due_date && (
          <p className="flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" /> Deadline {formatDateTime(a.due_date)}
            {brief?.created_at ? ` · set ${timeAgo(brief.created_at)}` : ""}
          </p>
        )}
      </div>
    </div>
  );
};

const QuickButton: React.FC<{ icon: React.ElementType; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
  >
    <Icon className="h-3.5 w-3.5" /> {label}
  </button>
);

export default GradingDetailsPane;
