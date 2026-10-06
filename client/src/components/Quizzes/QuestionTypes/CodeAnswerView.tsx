import React from "react";

/**
 * A submitted code answer, read-only ({code, language}; in project mode
 * `code` is a JSON array of files). Used on results pages instead of the IDE.
 */
export const CodeAnswerView: React.FC<{ answer: unknown }> = ({ answer }) => {
  const a = (answer && typeof answer === "object" ? answer : {}) as {
    code?: unknown;
    language?: string;
  };
  const code: string = typeof a.code === "string" ? a.code : "";
  if (!code.trim()) {
    return <p className="text-sm italic text-gray-500">No code submitted.</p>;
  }

  let files: Array<{ name: string; content: string }> | null = null;
  if (code.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(code);
      if (Array.isArray(parsed)) files = parsed;
    } catch {
      files = null;
    }
  }
  const blocks = files ?? [{ name: a.language || "code", content: code }];

  return (
    <div className="space-y-3" data-testid="code-answer-view">
      {blocks.map((f, i) => (
        <div key={`${f.name}-${i}`}>
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{f.name}</div>
          <pre className="rounded-xl bg-[#1e1e1e] text-[#d4d4d4] text-xs font-mono p-3 overflow-x-auto whitespace-pre">
            {f.content}
          </pre>
        </div>
      ))}
    </div>
  );
};

export default CodeAnswerView;
