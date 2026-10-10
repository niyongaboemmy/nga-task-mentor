import React from "react";
import { MessageSquareCode } from "lucide-react";

export interface LineComment {
  path: string;
  line: number;
  text: string;
}

/**
 * The teacher's line comments on a student's files (a released practical
 * grade's `annotations`), grouped by file. Renders nothing without any.
 */
const LineComments: React.FC<{ items: LineComment[] | null | undefined; className?: string }> = ({ items, className = "" }) => {
  const list = (items ?? []).filter((a) => a && a.path && a.text);
  if (!list.length) return null;
  const byFile = new Map<string, LineComment[]>();
  for (const a of list) byFile.set(a.path, [...(byFile.get(a.path) ?? []), a]);
  return (
    <div className={`rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-gray-900/40 ${className}`} data-testid="line-comments">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        <MessageSquareCode className="h-3.5 w-3.5" aria-hidden="true" /> Comments on your code ({list.length})
      </p>
      <ul className="space-y-2">
        {[...byFile.entries()].map(([path, notes]) => (
          <li key={path}>
            <p className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{path}</p>
            <ul className="mt-1 space-y-1">
              {[...notes].sort((x, y) => x.line - y.line).map((n, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 font-mono text-xs text-slate-500">line {n.line}</span>
                  <span className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{n.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LineComments;
