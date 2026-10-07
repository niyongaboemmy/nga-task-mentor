import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ClipboardCheck, ExternalLink, FolderCode, PenLine, RefreshCw, Search, Undo2 } from "lucide-react";
import { gradingWorkspaceHref } from "../../services/practicalsApi";
import ReturnForChangesDialog from "./ReturnForChangesDialog";
import { Skeleton } from "../ui/Skeleton";
import {
  apiErrorMessage,
  projectsApi,
  type ActivityProject,
  type ActivityType,
} from "../../services/projectsApi";
import { Avatar, KindBadge, LanguageBadge, LinkStatusBadge, ProjectStatusBadge } from "./ProjectBadges";
import { formatDateTime, frozenProjectHref, shortSha } from "./projectFormat";

/**
 * Teacher "Linked projects" panel for a quiz, an assignment or a recorded
 * assessment (GET /tmcode/activities/:type/:id/projects): each student's
 * project, whether it was submitted, and a link that opens it at the frozen
 * revision (or the frozen commit on GitHub).
 *
 * `collapsible` starts closed and loads on first open — for places with many
 * activities on one screen, like the recorded assessments list.
 */
const LinkedProjectsPanel: React.FC<{
  activityType: ActivityType;
  activityId: number;
  collapsible?: boolean;
  className?: string;
}> = ({ activityType, activityId, collapsible = false, className = "" }) => {
  const [open, setOpen] = useState(!collapsible);
  const [rows, setRows] = useState<ActivityProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [returning, setReturning] = useState<{ projectId: number; name: string } | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await projectsApi.activityProjects(activityType, activityId));
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load the linked projects."));
    }
  }, [activityType, activityId]);

  useEffect(() => {
    if (open && rows === null) load();
  }, [open, rows, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...(rows ?? [])].sort(
      (a, b) => Number(b.link.status === "submitted") - Number(a.link.status === "submitted") || a.owner.name.localeCompare(b.owner.name),
    );
    return q ? list.filter((r) => r.owner.name.toLowerCase().includes(q) || r.project.name.toLowerCase().includes(q)) : list;
  }, [rows, query]);

  const submitted = rows?.filter((r) => r.link.status === "submitted").length ?? 0;

  // The grading workspace covers assignments and quiz practical questions.
  const gradeHref = (r: ActivityProject | null): string | null => {
    if (activityType === "assignment") return gradingWorkspaceHref("assignment", activityId, { studentId: r?.owner.id });
    if (activityType !== "quiz") return null;
    const questionId = r ? r.link.question_id : rows?.find((x) => x.link.question_id)?.link.question_id;
    return questionId ? gradingWorkspaceHref("quiz", activityId, { questionId, studentId: r?.owner.id }) : null;
  };

  const header = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
        <FolderCode className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Linked projects</span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
          {rows === null ? "TMCode projects students linked to this activity" : `${submitted} submitted · ${rows.length - submitted} linked, not submitted`}
        </span>
      </span>
    </span>
  );

  return (
    <section
      aria-label="Linked projects"
      data-testid="linked-projects-panel"
      className={`rounded-2xl border border-gray-200/70 bg-card-light dark:border-border-dark/30 dark:bg-card-dark/30 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 p-4">
        {collapsible ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            {header}
          </button>
        ) : (
          header
        )}
        {gradeHref(null) && rows?.some((r) => r.link.status === "submitted") && (
          <Link
            to={gradeHref(null)!}
            data-testid="linked-open-grading"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
          >
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> Grade
          </Link>
        )}
        {open && rows !== null && (
          <button type="button" onClick={load} aria-label="Refresh linked projects" className="rounded-lg p-1.5 text-slate-400 hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/5">
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-gray-100 p-4 dark:border-white/5">
              {error ? (
                <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
                  {error}{" "}
                  <button type="button" onClick={load} className="font-semibold underline">
                    Retry
                  </button>
                </p>
              ) : rows === null ? (
                <div className="space-y-2" aria-hidden="true">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No student has linked a project to this activity yet.</p>
              ) : (
                <>
                  {rows.length > 5 && (
                    <label className="relative block">
                      <span className="sr-only">Search linked projects</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search students or projects"
                        className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-text-primary-dark"
                      />
                    </label>
                  )}
                  <ul className="space-y-1.5">
                    {visible.map((r) => (
                      <li key={r.link.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-light px-3 py-2.5 dark:bg-surface-dark/50">
                        <Avatar name={r.owner.name} src={r.owner.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{r.owner.name}</p>
                          <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate">{r.project.name}</span>
                            <LanguageBadge language={r.project.language} />
                            {r.link.submitted_at && <span>· {formatDateTime(r.link.submitted_at)}</span>}
                          </p>
                        </div>
                        <KindBadge kind={r.project.kind} />
                        {r.project.status && <ProjectStatusBadge status={r.project.status} />}
                        <LinkStatusBadge
                          status={r.link.status}
                          revisionNumber={r.link.revision_number ?? r.revision?.number}
                          gitCommit={r.link.git_commit}
                        />
                        <div className="flex items-center gap-1">
                          <Link
                            to={frozenProjectHref(r)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                            aria-label={`Open ${r.owner.name}'s project ${r.project.name}`}
                          >
                            Open
                          </Link>
                          {r.link.status === "submitted" && gradeHref(r) && (
                            <Link
                              to={gradeHref(r)!}
                              data-testid="linked-grade"
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-900/20"
                            >
                              <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> {r.project.status === "graded" ? "Regrade" : "Grade"}
                            </Link>
                          )}
                          {r.project.status === "submitted" && (
                            <button
                              type="button"
                              onClick={() => setReturning({ projectId: r.project.id, name: r.owner.name })}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50 hover:text-amber-700 dark:text-slate-300 dark:hover:bg-amber-900/20"
                            >
                              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Return
                            </button>
                          )}
                          {r.project.kind === "github" && r.project.repo_url && r.link.git_commit && (
                            <a
                              href={`${r.project.repo_url.replace(/\.git$/, "")}/tree/${r.link.git_commit}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-mono text-xs text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/5"
                              title="Browse the submitted commit on GitHub"
                            >
                              {shortSha(r.link.git_commit)}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ReturnForChangesDialog
        open={!!returning}
        projectId={returning?.projectId ?? null}
        studentName={returning?.name ?? "the student"}
        onClose={() => setReturning(null)}
        onReturned={load}
      />
    </section>
  );
};

export default LinkedProjectsPanel;
