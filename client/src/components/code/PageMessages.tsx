import React from "react";
import type { PageMessage } from "./usePagePreview";

/** What went wrong in a PHP page (PHP's errors) or in the page's own scripts. */
const PageMessages: React.FC<{ messages: PageMessage[]; dark?: boolean }> = ({ messages, dark }) =>
  messages.length ? (
    <ul
      className={`max-h-32 shrink-0 space-y-1 overflow-y-auto border-b px-3 py-2 font-mono text-[11px] ${dark ? "border-white/10 bg-slate-900" : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900"}`}
      aria-label="Page messages"
      data-testid="preview-messages"
    >
      {messages.map((m, i) => (
        <li key={i} className={`whitespace-pre-wrap break-words ${m.level === "error" ? "text-rose-600 dark:text-rose-300" : m.level === "warn" ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>
          {m.text}
        </li>
      ))}
    </ul>
  ) : null;

export default PageMessages;
