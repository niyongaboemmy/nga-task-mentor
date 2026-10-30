import React, { useState } from "react";
import { ChevronDown, Code2, ExternalLink, Eye, FlaskConical, GitCompare, Info, Lightbulb, Play } from "lucide-react";
import type { CheckAction, ProjectProfile } from "./projectProfile";

/**
 * "How to check this project": what kind of project it is and the way to
 * assess it, with one button per step (grading). Collapses to one line; the
 * choice is remembered.
 */

const ACTION: Record<CheckAction, { label: string; Icon: React.ElementType }> = {
  preview: { label: "Preview", Icon: Eye },
  run: { label: "Run it", Icon: Play },
  "unit-tests": { label: "Unit tests", Icon: FlaskConical },
  changes: { label: "Changes since starter", Icon: GitCompare },
  code: { label: "Code", Icon: Code2 },
  tmcode: { label: "Open in TMCode", Icon: ExternalLink },
};

const KEY = "tm.grading.guide.open";
const readOpen = () => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
};

const AssessGuide: React.FC<{
  profile: ProjectProfile;
  /** Actions this page can do right now (e.g. no Changes without a starter). */
  available: CheckAction[];
  onAction: (a: CheckAction) => void;
}> = ({ profile, available, onAction }) => {
  const [open, setOpen] = useState(readOpen);
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {
        // a convenience
      }
      return !v;
    });
  const actions = profile.actions.filter((a) => available.includes(a));

  return (
    <section className="shrink-0 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900" aria-label="How to check this project" data-testid="assess-guide" data-profile={profile.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Lightbulb className="h-4 w-4 shrink-0 text-blue-600 dark:text-amber-300" aria-hidden="true" />
        <span className="font-semibold text-slate-800 dark:text-slate-100" data-testid="assess-kind">
          {profile.label}
        </span>
        {!open && <span className="hidden truncate text-slate-600 dark:text-slate-300 sm:inline">· {profile.steps[0]}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {actions.map((a) => {
            const { label, Icon } = ACTION[a];
            return (
              <button
                key={a}
                type="button"
                onClick={() => onAction(a)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 font-semibold text-blue-700 hover:bg-blue-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/10"
                data-testid={`assess-${a}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
              </button>
            );
          })}
          <button type="button" onClick={toggle} aria-expanded={open} aria-label={open ? "Hide the steps" : "Show the steps"} className="rounded-md p-1 text-slate-500 hover:bg-blue-100 dark:hover:bg-white/10">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-1.5 space-y-1 pl-6">
          <ol className="list-decimal space-y-0.5 pl-4 text-slate-700 dark:text-slate-200">
            {profile.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {profile.note && (
            <p className="flex items-start gap-1.5 text-amber-800 dark:text-amber-200" data-testid="assess-note">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {profile.note}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default AssessGuide;
