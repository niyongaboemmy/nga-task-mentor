import React from "react";
import { Bot, Lock, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import Badge, { type BadgeTone } from "../ui/Badge";
import { AI_MODE_OPTIONS, INTERPRETER_STAGE_OPTIONS, type AiHelp, type AiMode, type PromptExample, type PromptProblem } from "../../services/aiApi";
import { useAiPolicy } from "../../hooks/useAiAccess";

/**
 * AI usage control UI (AI_USAGE_CONTROL_PLAN.md §5.6-5.8):
 *   AiModeControl  the teacher's "AI assistance for students" setting
 *   AiModeBadge    "AI: Off / Hints / Full" on quiz and assignment lists/details
 *   AiReasonChip   why AI isn't available here (student views)
 */

export const AI_DISABLED_BY_ADMIN = "Disabled by the school administrator";

export const AiModeControl: React.FC<{
  value: AiMode;
  onChange: (mode: AiMode) => void;
  /** Prefix for element ids (e.g. "quiz" → quiz-ai_mode). */
  idPrefix: string;
  /** "an assignment" / "this quiz" in the help text. */
  itemLabel?: string;
}> = ({ value, onChange, idPrefix, itemLabel = "it" }) => {
  const { policy } = useAiPolicy();
  // Shown but disabled when the school has AI off or locks every assessment:
  // the teacher's choice is kept for when it is switched back on.
  const locked = !!policy && !policy.itemModes;
  const current = AI_MODE_OPTIONS.find((o) => o.value === value) ?? AI_MODE_OPTIONS[0];
  return (
    <div className="space-y-1.5" data-testid={`${idPrefix}-ai-mode`}>
      <span id={`${idPrefix}-ai_mode-label`} className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        AI assistance for students
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-ai_mode-label`}
        aria-describedby={`${idPrefix}-ai_mode-help`}
        aria-disabled={locked || undefined}
        className={`inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 ${locked ? "opacity-60" : ""}`}
      >
        {AI_MODE_OPTIONS.map((o) => (
          <button
            key={o.value}
            id={`${idPrefix}-ai_mode-${o.value}`}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={locked}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
              value === o.value
                ? "bg-white dark:bg-gray-900 shadow text-text-primary-light dark:text-text-primary-dark"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {o.value === "off" ? <Lock className="w-3.5 h-3.5" aria-hidden /> : o.value === "hints" ? <Sparkles className="w-3.5 h-3.5" aria-hidden /> : <Bot className="w-3.5 h-3.5" aria-hidden />}
            {o.label}
          </button>
        ))}
      </div>
      <p id={`${idPrefix}-ai_mode-help`} className="text-xs text-text-secondary-light dark:text-text-secondary-dark/80">
        {locked ? (
          <>
            <span className="font-medium text-amber-700 dark:text-amber-300">{AI_DISABLED_BY_ADMIN}.</span>{" "}
            Your choice is kept for when AI is turned back on.
          </>
        ) : (
          <>
            {current.help} Applies while students work on {itemLabel}; your own AI tools aren't affected.
          </>
        )}
      </p>
    </div>
  );
};

/**
 * What each layer lets the teacher tune (proposal §8.3, A4, A11): Learning's help strength,
 * pseudo-code, tiny syntax examples and question allowance; Industrial's "students' own AI tools".
 * For a quiz with AI the session is a timed task, not an exam (D9).
 */
export const AiLayerOptions: React.FC<{
  mode: AiMode;
  help: AiHelp;
  onHelp: (h: AiHelp) => void;
  ownTools: boolean;
  onOwnTools: (v: boolean) => void;
  idPrefix: string;
  /** A quiz: say that AI makes it a timed task. */
  quiz?: boolean;
}> = ({ mode, help, onHelp, ownTools, onOwnTools, idPrefix, quiz }) => {
  if (mode === "off") return null;
  const box = "rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3 text-sm";
  const label = "text-text-primary-light dark:text-text-primary-dark";
  const hint = "text-xs text-text-secondary-light dark:text-text-secondary-dark/80";
  return (
    <div className={box} data-testid={`${idPrefix}-ai-layer-options`}>
      {quiz && <p className={hint}>With AI on, TMCode shows this quiz as a <strong>timed task</strong>, not an exam: exams are always No AI.</p>}
      {mode === "hints" ? (
        <>
          <fieldset className="space-y-1.5">
            <legend className={`font-medium ${label}`}>Help strength</legend>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["hints", "Hints", "Questions and nudges only"],
                  ["tutor", "Tutor", "Also explains concepts, errors and reviews code, in words"],
                ] as const
              ).map(([v, l, d]) => (
                <label key={v} className="inline-flex items-start gap-2 cursor-pointer" title={d}>
                  <input type="radio" name={`${idPrefix}-ai-strength`} checked={help.strength === v} onChange={() => onHelp({ ...help, strength: v })} data-testid={`${idPrefix}-ai-strength-${v}`} />
                  <span>
                    <span className={label}>{l}</span> <span className={hint}>{d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={help.pseudo} onChange={(e) => onHelp({ ...help, pseudo: e.target.checked })} data-testid={`${idPrefix}-ai-pseudo`} />
            <span className={label}>Pseudo-code in words</span>
            <span className={hint}>("loop over the list; keep the largest so far")</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={help.syntax} onChange={(e) => onHelp({ ...help, syntax: e.target.checked })} data-testid={`${idPrefix}-ai-syntax`} />
            <span className={label}>Tiny generic syntax examples</span>
            <span className={hint}>(at most 2 lines, never the students' own names)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className={label}>Questions:</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1"
              value={help.allowance.max}
              onChange={(e) => onHelp({ ...help, allowance: { ...help.allowance, max: Math.max(1, Math.min(100, Number(e.target.value) || 1)) } })}
              aria-label="Questions a student can ask in a row"
              data-testid={`${idPrefix}-ai-allowance-max`}
            />
            <span className={hint}>in a row, one more every</span>
            <input
              type="number"
              min={0.5}
              max={120}
              step={0.5}
              className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1"
              value={help.allowance.regain_minutes}
              onChange={(e) => onHelp({ ...help, allowance: { ...help.allowance, regain_minutes: Math.max(0.5, Math.min(120, Number(e.target.value) || 3)) } })}
              aria-label="Minutes until one more question"
              data-testid={`${idPrefix}-ai-allowance-minutes`}
            />
            <span className={hint}>minutes (a pause to think is part of learning)</span>
          </div>
        </>
      ) : (
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={ownTools} onChange={(e) => onOwnTools(e.target.checked)} data-testid={`${idPrefix}-ai-own-tools`} className="mt-1" />
          <span>
            <span className={label}>Allow students' own AI tools</span>{" "}
            <span className={hint}>(Industrial · Open: Claude Code, Copilot, AI command-line tools and own keys. They bypass the school's logging and limits; best for S5–S6 and TVET.)</span>
          </span>
        </label>
      )}
      <RequestCheckOptions help={help} onHelp={onHelp} idPrefix={idPrefix} learning={mode === "hints"} />
      {mode === "full" && !quiz && <PromptProblemEditor value={help.prompt_problem} onChange={(p) => onHelp({ ...help, prompt_problem: p })} idPrefix={idPrefix} />}
    </div>
  );
};

/**
 * TMCode's request check (prompt interpreter report, Q7/Q10): in Industrial an intent card students
 * confirm before the AI acts; in Learning a prompt coach that points out what is missing (it never
 * rewrites the request). "Auto" fades it as a student's requests get complete.
 */
const RequestCheckOptions: React.FC<{ help: AiHelp; onHelp: (h: AiHelp) => void; idPrefix: string; learning: boolean }> = ({ help, onHelp, idPrefix, learning }) => {
  const label = "text-text-primary-light dark:text-text-primary-dark";
  const hint = "text-xs text-text-secondary-light dark:text-text-secondary-dark/80";
  const current = INTERPRETER_STAGE_OPTIONS.find((o) => o.value === help.interpreter) ?? INTERPRETER_STAGE_OPTIONS[0];
  return (
    <fieldset className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700" data-testid={`${idPrefix}-ai-request-check`}>
      <legend className={`flex items-center gap-1.5 font-medium ${label}`}>
        <Wand2 className="h-4 w-4 text-violet-500" aria-hidden="true" /> Request check
      </legend>
      <p className={hint}>
        {learning
          ? "Before a question reaches the tutor, TMCode's coach shows students what their request leaves out (inputs, an example, an unusual case). It never writes the request for them."
          : "Before the AI acts, students see what TMCode understood: the goal, examples to tick, unusual cases and files. Kinyarwanda requests are restated in Kinyarwanda and sent to the AI in clear English."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${idPrefix}-ai-interpreter`} className={label}>
          Stage
        </label>
        <select
          id={`${idPrefix}-ai-interpreter`}
          className="rounded-lg border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-600"
          value={help.interpreter}
          onChange={(e) => onHelp({ ...help, interpreter: e.target.value as AiHelp["interpreter"] })}
          data-testid={`${idPrefix}-ai-interpreter`}
        >
          {INTERPRETER_STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={hint}>{current.help}</span>
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" className="mt-1" checked={help.show_prompts} onChange={(e) => onHelp({ ...help, show_prompts: e.target.checked })} data-testid={`${idPrefix}-ai-show-prompts`} />
        <span>
          <span className={label}>Show me the text of students' requests</span> <span className={hint}>(off: the activity log shows only what was checked, how complete each request was and what students did with the card; students see this choice)</span>
        </span>
      </label>
    </fieldset>
  );
};

const EMPTY_PROBLEM: PromptProblem = { language: "python", entry: "solution.py", examples: [{ input: "", output: "" }], hidden: [], instructions: "", hints: true };

/** A list of input → output rows (shown or hidden examples). */
const ExampleRows: React.FC<{ rows: PromptExample[]; onChange: (r: PromptExample[]) => void; idPrefix: string; kind: "shown" | "hidden" }> = ({ rows, onChange, idPrefix, kind }) => (
  <div className="space-y-1.5">
    {rows.map((r, i) => (
      <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5">
        <input
          className="min-w-0 rounded-lg border border-gray-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-gray-600"
          placeholder={kind === "shown" ? "is_even(4)" : "is_even(-2)"}
          value={r.input}
          aria-label={`${kind} example ${i + 1} input`}
          onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, input: e.target.value } : x)))}
          data-testid={`${idPrefix}-pp-${kind}-input-${i}`}
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          className="min-w-0 rounded-lg border border-gray-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-gray-600"
          placeholder={kind === "shown" ? "True" : "True"}
          value={r.output}
          aria-label={`${kind} example ${i + 1} output`}
          onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, output: e.target.value } : x)))}
          data-testid={`${idPrefix}-pp-${kind}-output-${i}`}
        />
        <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${kind} example ${i + 1}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    ))}
    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-300" onClick={() => onChange([...rows, { input: "", output: "" }])} data-testid={`${idPrefix}-pp-add-${kind}`}>
      <Plus className="h-3.5 w-3.5" /> Add {kind === "shown" ? "an example" : "a hidden example"}
    </button>
  </div>
);

/**
 * Prompt Problems (Q11): students see input → output examples and write a request (in any
 * language); they pass when the code the AI writes from it passes the examples, including hidden
 * ones that never leave Task Mentor. Practises saying precisely what a program should do.
 */
const PromptProblemEditor: React.FC<{ value: PromptProblem | null; onChange: (p: PromptProblem | null) => void; idPrefix: string }> = ({ value, onChange, idPrefix }) => {
  const label = "text-text-primary-light dark:text-text-primary-dark";
  const hint = "text-xs text-text-secondary-light dark:text-text-secondary-dark/80";
  const p = value;
  return (
    <fieldset className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700" data-testid={`${idPrefix}-ai-prompt-problem`}>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" className="mt-1" checked={!!p} onChange={(e) => onChange(e.target.checked ? EMPTY_PROBLEM : null)} data-testid={`${idPrefix}-pp-toggle`} />
        <span>
          <span className={`font-medium ${label}`}>Prompt Problem</span> <span className={hint}>(students write a request; it passes when the AI's code from it passes your examples)</span>
        </span>
      </label>
      {p && (
        <div className="space-y-3 pl-6">
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-lg border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-600" value={p.language} onChange={(e) => onChange({ ...p, language: e.target.value as PromptProblem["language"], entry: e.target.value === "python" ? "solution.py" : "solution.js" })} aria-label="Language" data-testid={`${idPrefix}-pp-language`}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
            <input className="w-36 rounded-lg border border-gray-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-gray-600" value={p.entry} onChange={(e) => onChange({ ...p, entry: e.target.value })} aria-label="File the AI writes" data-testid={`${idPrefix}-pp-entry`} />
            <span className={hint}>the file the AI writes</span>
          </div>
          <div>
            <div className={`mb-1 text-sm ${label}`}>Examples students see</div>
            <ExampleRows rows={p.examples} onChange={(examples) => onChange({ ...p, examples })} idPrefix={idPrefix} kind="shown" />
          </div>
          <div>
            <div className={`mb-1 text-sm ${label}`}>
              Hidden examples <span className={hint}>(checked too; students only see how many passed)</span>
            </div>
            <ExampleRows rows={p.hidden} onChange={(hidden) => onChange({ ...p, hidden })} idPrefix={idPrefix} kind="hidden" />
          </div>
          <p className={hint}>A call (is_even(4) → True) checks a function; any other input is typed into the program and its output compared.</p>
          <textarea className="w-full rounded-lg border border-gray-300 bg-transparent px-2 py-1 text-sm dark:border-gray-600" rows={2} placeholder="Extra instructions for students (optional)" value={p.instructions} onChange={(e) => onChange({ ...p, instructions: e.target.value })} data-testid={`${idPrefix}-pp-instructions`} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={p.hints} onChange={(e) => onChange({ ...p, hints: e.target.checked })} data-testid={`${idPrefix}-pp-hints`} />
            <span className={label}>Request-check hints while solving</span>
            <span className={hint}>(off: students are on their own)</span>
          </label>
        </div>
      )}
    </fieldset>
  );
};

const BADGE_TONE: Record<AiMode, BadgeTone> = { off: "neutral", hints: "info", full: "success" };

export const AiModeBadge: React.FC<{ mode?: AiMode | null; className?: string }> = ({ mode, className }) => {
  const m: AiMode = mode === "hints" || mode === "full" ? mode : "off";
  const label = AI_MODE_OPTIONS.find((o) => o.value === m)!.short;
  return (
    <Badge tone={BADGE_TONE[m]} className={className} testId="ai-mode-badge" icon={<Bot className="w-3 h-3" aria-hidden />}>
      AI: {label}
    </Badge>
  );
};

export const AiReasonChip: React.FC<{ message: string; className?: string }> = ({ message, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300 ${className}`}
    data-testid="ai-reason-chip"
    title={message}
  >
    <Lock className="w-3 h-3" aria-hidden />
    {message}
  </span>
);
