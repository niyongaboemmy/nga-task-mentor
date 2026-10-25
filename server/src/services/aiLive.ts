import { EventEmitter } from "node:events";
import { refreshAiPolicyNow } from "./aiPolicy";
import type { AiPolicy } from "../vendor/nga-access";

/**
 * "AI settings changed" for apps that keep a line open (TMCode: GET /api/tmcode/ai/events), so a
 * change lands in seconds instead of at the next status poll:
 *   policy  the super admin changed the school's AI policy in MIS (seen by watching MIS while
 *           anyone listens, every AI_POLICY_WATCH_MS, default 5 s), or MIS stopped answering
 *           long enough for the policy to fall back to "off";
 *   item    a teacher (or a super admin) changed a quiz's or an assignment's AI mode;
 *   access  roles or role permissions changed (AI_USE).
 * Listeners just ask for their AI status again; the event carries no decision.
 *
 * In-process: Task Mentor runs as one process (ecosystem.config.js, fork, 1 instance). Behind a
 * cluster this would need a shared channel (Redis pub/sub).
 */

export type AiChangeCause = "policy" | "item" | "access";

export interface AiChange {
  cause: AiChangeCause;
  /** policy: the new policy version (null: no policy, AI off). */
  v?: number | null;
  /** item: which quiz or assignment. */
  kind?: "quiz" | "assignment";
  id?: number;
  at: string;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

const watchMs = () => {
  const n = Number(process.env.AI_POLICY_WATCH_MS);
  return Number.isFinite(n) && n >= 1000 ? n : 5000;
};

/** The policy as compared between two looks (null and an unreadable policy compare equal). */
const signature = (p: AiPolicy | null) => (p ? JSON.stringify({ ...p, updated_at: null, updated_by: null }) : "null");

let timer: NodeJS.Timeout | null = null;
let last: string | undefined;
/** The look under way: a second caller waits for it rather than racing it. */
let looking: Promise<void> | null = null;
/** Bumped when watching stops: a look begun before then says nothing about the next watch. */
let generation = 0;

function look(): Promise<void> {
  if (!looking) {
    const gen = generation;
    looking = (async () => {
      const policy = await refreshAiPolicyNow();
      if (gen !== generation) return;
      const sig = signature(policy);
      if (last !== undefined && sig !== last) publishAiChange({ cause: "policy", v: policy?.v ?? null });
      last = sig;
    })().finally(() => (looking = null));
  }
  return looking;
}

function startWatching() {
  if (timer) return;
  void look();
  timer = setInterval(() => void look(), watchMs());
  timer.unref?.();
}

function stopWatching() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  last = undefined;
  looking = null;
  generation++;
}

export function publishAiChange(change: Omit<AiChange, "at">) {
  bus.emit("change", { ...change, at: new Date().toISOString() } satisfies AiChange);
}

/** Calls `fn` on every change until the returned function is called. */
export function subscribeAiChanges(fn: (change: AiChange) => void): () => void {
  bus.on("change", fn);
  startWatching();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    bus.off("change", fn);
    if (bus.listenerCount("change") === 0) stopWatching();
  };
}

/** For tests: one look at MIS now (what the timer does). */
export const lookAtPolicyForTests = look;

export const aiLiveListenerCount = () => bus.listenerCount("change");
