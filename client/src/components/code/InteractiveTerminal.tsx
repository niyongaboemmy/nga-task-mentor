import React, { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Loader2, Square } from "lucide-react";
import { VerdictChip } from "./RunPanel";
import type { RunExit, TranscriptLine, InteractiveStatus } from "./useInteractiveRun";

/**
 * The Output tab while a program runs interactively: what it prints, what
 * you typed (highlighted), and an input line. Enter sends the line; the
 * buttons send Ctrl+C, end of input (Ctrl+D) or stop the program.
 */
const InteractiveTerminal: React.FC<{
  status: InteractiveStatus;
  lines: TranscriptLine[];
  exit: RunExit | null;
  error: string | null;
  onSend: (line: string) => void;
  onInterrupt: () => void;
  onEndInput: () => void;
  onStop: () => void;
}> = ({ status, lines, exit, error, onSend, onInterrupt, onEndInput, onStop }) => {
  const [line, setLine] = useState("");
  const screen = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const running = status === "running";

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight });
  }, [lines, exit]);
  useEffect(() => {
    if (running) input.current?.focus();
  }, [running]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!running) return;
    onSend(line);
    setLine("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="interactive-terminal">
      <div
        ref={screen}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100"
        role="log"
        aria-live="polite"
        aria-label="Program output"
        onClick={() => input.current?.focus()}
        data-testid="terminal-output"
      >
        {lines.length === 0 && status !== "starting" && <span className="text-slate-500">Press Run (Ctrl/⌘ + Enter). Your program's output appears here, and you can type what it asks for.</span>}
        {status === "starting" && (
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…
          </span>
        )}
        {lines.map((l, i) => (
          <span key={i} className={l.kind === "err" ? "text-rose-300" : l.kind === "in" ? "text-sky-300" : l.kind === "info" ? "text-slate-400" : ""}>
            {l.text}
          </span>
        ))}
        {error && <span className="block text-rose-300">{error}</span>}
        {exit && (
          <span className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2 font-sans text-[11px] text-slate-400">
            <VerdictChip verdict={exit.verdict} />
            {exit.code != null && <span>exit {exit.code}</span>}
            {exit.time_ms != null && <span>{Math.round(exit.time_ms)} ms</span>}
          </span>
        )}
      </div>
      <form onSubmit={submit} className="mt-2 flex shrink-0 items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Input to the program</span>
          <input
            ref={input}
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
                e.preventDefault();
                onInterrupt();
              } else if (e.ctrlKey && e.key.toLowerCase() === "d") {
                e.preventDefault();
                onEndInput();
              }
            }}
            disabled={!running}
            placeholder={running ? "Type the input and press Enter" : "Run your program to type input here"}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 pr-9 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-white/15 dark:bg-slate-800"
            data-testid="terminal-input"
          />
          <CornerDownLeft className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        </label>
        <button type="button" onClick={onInterrupt} disabled={!running} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-white/15" title="Interrupt (Ctrl+C)">
          Ctrl+C
        </button>
        <button type="button" onClick={onEndInput} disabled={!running} className="hidden rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-white/15 sm:block" title="End of input (Ctrl+D)">
          End input
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!running}
          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
          data-testid="terminal-stop"
        >
          <Square className="h-3 w-3" aria-hidden="true" /> Stop
        </button>
      </form>
    </div>
  );
};

export default InteractiveTerminal;
