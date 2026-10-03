import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Repeat, Sparkles, Square, XCircle } from "lucide-react";
import type { BatchState } from "./runGeneration";
import { DIFFICULTIES, formatDuration, typeLabel } from "./aiGeneratorModel";

interface Props {
  phase: "preparing" | "generating";
  sourceLabel: string;
  batches: BatchState[];
  latest: { text: string; difficulty: string; type: string }[];
  startedAt: number;
  estimateSec: number;
  onCancel: () => void;
  cancelling: boolean;
}

const labelOf = (name?: string) =>
  ({ gemini: "Gemini", groq: "Groq", glm: "GLM", openai: "OpenAI", deepseek: "DeepSeek", openrouter: "OpenRouter" })[name ?? ""] ?? name;

function useElapsed(since: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return Math.max(0, (now - since) / 1000);
}

const GenerationProgress: React.FC<Props> = ({ phase, sourceLabel, batches, latest, startedAt, estimateSec, onCancel, cancelling }) => {
  const elapsed = useElapsed(startedAt);
  const requested = batches.reduce((n, b) => n + b.requested, 0);
  const produced = batches.reduce((n, b) => n + (b.returned ?? 0), 0);
  const finished = batches.filter((b) => b.status !== "queued" && b.status !== "running").length;
  // Blend finished batches with time spent on the running one so the bar keeps moving.
  const runningShare = Math.min(0.9, elapsed / Math.max(estimateSec, 1)) / Math.max(batches.length, 1);
  const pct = phase === "preparing" ? 4 : Math.min(99, Math.round(((finished / Math.max(batches.length, 1)) + (finished < batches.length ? runningShare : 0)) * 100));
  const remaining = Math.max(0, estimateSec - elapsed);

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10 space-y-6" aria-live="polite">
      <div className="text-center">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-500 opacity-20 animate-ping" />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
            <Sparkles className="w-9 h-9 text-white" />
          </div>
        </div>
        <h3 className="mt-5 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          {phase === "preparing" ? "Reading your source material…" : `Writing ${requested} question${requested === 1 ? "" : "s"}…`}
        </h3>
        <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark truncate">{sourceLabel}</p>
      </div>

      <div>
        <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-500"
            animate={{ width: `${pct}%` }}
            transition={{ ease: "easeOut", duration: 0.6 }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500 tabular-nums">
          <span>
            {produced} ready{phase === "generating" ? ` · batch ${Math.min(finished + 1, batches.length)} of ${batches.length}` : ""}
          </span>
          <span>
            {formatDuration(elapsed)} elapsed{remaining > 3 && phase === "generating" ? ` · ~${formatDuration(remaining)} left` : ""}
          </span>
        </div>
      </div>

      {phase === "generating" && (
        <ol className="space-y-1.5">
          {batches.map((b) => (
            <li
              key={b.index}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                b.status === "running"
                  ? "border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40"
              }`}
            >
              <BatchIcon status={b.status} />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-text-primary-light dark:text-text-primary-dark">
                  {b.plan.map((p) => typeLabel(p.question_type)).join(", ")}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {b.status === "done"
                    ? `${b.returned}/${b.requested} ready${b.skipped ? ` · ${b.skipped} rejected by checks` : ""} · ${labelOf(b.provider)}${b.durationMs ? ` · ${formatDuration(b.durationMs / 1000)}` : ""}`
                    : b.status === "failed" || b.status === "cancelled"
                      ? b.error || (b.status === "cancelled" ? "Cancelled" : "Failed")
                      : b.retrying
                        ? "AI busy — trying the next available engine…"
                        : `${b.requested} question${b.requested === 1 ? "" : "s"}`}
                </span>
              </span>
              {b.fellBack && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="Your chosen engine was busy; another one answered">
                  <Repeat className="w-3 h-3" /> fallback
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {latest.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3 space-y-1.5 overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Just written</p>
          <AnimatePresence initial={false}>
            {latest.slice(0, 4).map((q) => {
              const d = DIFFICULTIES.find((x) => x.value === q.difficulty);
              return (
                <motion.p
                  key={q.text}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >
                  <span className={`w-2 h-2 shrink-0 rounded-full ${d?.dot ?? "bg-gray-400"}`} title={d?.label} />
                  <span className="truncate">{q.text}</span>
                </motion.p>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
        >
          {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
          {produced > 0 ? `Stop and review ${produced}` : "Cancel"}
        </button>
      </div>
    </div>
  );
};

const BatchIcon: React.FC<{ status: BatchState["status"] }> = ({ status }) => {
  if (status === "running") return <Loader2 className="w-4 h-4 shrink-0 text-blue-600 animate-spin" />;
  if (status === "done") return <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />;
  if (status === "failed") return <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />;
  if (status === "cancelled") return <XCircle className="w-4 h-4 shrink-0 text-gray-400" />;
  return <Circle className="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600" />;
};

export default GenerationProgress;
