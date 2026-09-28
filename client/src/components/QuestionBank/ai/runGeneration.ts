import type {
  AIBatchResult,
  AIGeneratedQuestion,
  AIPlanItem,
} from "../../../services/aiQuestionGenerationApi";
import { aiErrorMessage, httpStatus, isContextExpired } from "../../../services/aiQuestionGenerationApi";
import { planTotal } from "./aiGeneratorModel";

export type BatchStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface BatchState {
  index: number;
  plan: AIPlanItem[];
  requested: number;
  status: BatchStatus;
  returned?: number;
  skipped?: number;
  provider?: string;
  fellBack?: boolean;
  error?: string;
  durationMs?: number;
  /** A transient failure is being retried once. */
  retrying?: boolean;
}

export interface RunCallbacks {
  onBatch: (b: BatchState) => void;
  onQuestions: (qs: AIGeneratedQuestion[], batch: BatchState) => void;
  onContextRefreshed?: (contextId: string) => void;
}

export interface RunOptions {
  batches: AIPlanItem[][];
  contextId: string;
  signal: AbortSignal;
  generate: (body: { context_id: string; plan: AIPlanItem[]; avoid_questions: string[] }, signal: AbortSignal) => Promise<AIBatchResult>;
  /** Prepares the same source again when the server forgot it (restart / expiry). */
  reprepare: () => Promise<string>;
  /** Wait before the single retry of a transient failure (default 4 s). */
  retryDelayMs?: number;
}

/** Worth one retry: rate limits, gateway/proxy hiccups, dropped connections. */
const isTransient = (err: unknown) => {
  const s = httpStatus(err);
  if (s === undefined) return (err as { name?: string })?.name !== "CanceledError";
  return s === 429 || s === 502 || s === 504;
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

/** Errors after which the next batch would fail the same way. */
const isFatal = (err: unknown) => {
  const s = httpStatus(err);
  return s === 401 || s === 403 || s === 503;
};

/**
 * Runs the batches one after another. A failed batch doesn't lose earlier
 * results and doesn't stop later batches unless the failure is one every
 * batch would hit (auth, AI not configured). Questions from earlier batches
 * are passed on so the AI doesn't repeat itself.
 */
export async function runGeneration(opts: RunOptions, cb: RunCallbacks) {
  let contextId = opts.contextId;
  let refreshed = false;
  const produced: string[] = [];
  const states: BatchState[] = opts.batches.map((plan, index) => ({
    index,
    plan,
    requested: planTotal(plan),
    status: "queued",
  }));
  states.forEach(cb.onBatch);

  let fatal: string | null = null;
  for (const state of states) {
    if (opts.signal.aborted || fatal) {
      Object.assign(state, { status: "cancelled", error: fatal ?? undefined });
      cb.onBatch({ ...state });
      continue;
    }
    Object.assign(state, { status: "running" });
    cb.onBatch({ ...state });
    const started = Date.now();

    // Short excerpts are enough to steer the AI away from repeats.
    const attempt = () =>
      opts.generate(
        { context_id: contextId, plan: state.plan, avoid_questions: produced.slice(-40).map((q) => q.slice(0, 200)) },
        opts.signal,
      );

    try {
      let res: AIBatchResult;
      try {
        res = await attempt();
      } catch (err) {
        if (isContextExpired(err) && !refreshed) {
          refreshed = true;
          contextId = await opts.reprepare();
          cb.onContextRefreshed?.(contextId);
          res = await attempt();
        } else if (isTransient(err) && !opts.signal.aborted) {
          // Every AI was busy / a connection dropped: give it a moment, try once more.
          Object.assign(state, { retrying: true });
          cb.onBatch({ ...state });
          await sleep(opts.retryDelayMs ?? 4000, opts.signal);
          res = await attempt();
        } else {
          throw err;
        }
      }
      produced.push(...res.data.map((q) => q.question_text));
      Object.assign(state, {
        status: "done",
        returned: res.data.length,
        skipped: res.meta.skipped.length,
        provider: res.meta.provider_used,
        fellBack: res.meta.fell_back,
        durationMs: Date.now() - started,
      });
      cb.onQuestions(res.data, { ...state });
      cb.onBatch({ ...state });
    } catch (err) {
      const cancelled = opts.signal.aborted;
      Object.assign(state, {
        status: cancelled ? "cancelled" : "failed",
        error: aiErrorMessage(err),
        durationMs: Date.now() - started,
      });
      cb.onBatch({ ...state });
      if (!cancelled && isFatal(err)) fatal = state.error!;
    }
  }

  return {
    contextId,
    states,
    produced: produced.length,
    failed: states.filter((s) => s.status === "failed").length,
    cancelled: states.filter((s) => s.status === "cancelled").length,
  };
}
