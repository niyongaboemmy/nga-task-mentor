import { refreshAiPolicyNow } from "./aiPolicy";
import type { AiPolicy } from "../vendor/nga-access";
import { currentTenantOrNull, primaryTenantCtx, runWithTenant, type TenantCtx } from "../vendor/nga-tenancy";
import { ctid } from "../tenancy/keys";

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
 * Per tenant: each school has its own listeners, its own MIS policy watcher (run in that
 * school's tenant context, so it reads that school's policy) and its own change stream; a
 * change carries its `tid` and a listener only ever hears its own school's.
 *
 * In-process: Task Mentor runs as one process (ecosystem.config.js, fork, 1 instance). Behind a
 * cluster this would need a shared channel (Redis pub/sub).
 */

export type AiChangeCause = "policy" | "item" | "access";

export interface AiChange {
  cause: AiChangeCause;
  /** The school the change belongs to. */
  tid: number;
  /** policy: the new policy version (null: no policy, AI off). */
  v?: number | null;
  /** item: which quiz or assignment. */
  kind?: "quiz" | "assignment";
  id?: number;
  at: string;
}

type Listener = (change: AiChange) => void;

const watchMs = () => {
  const n = Number(process.env.AI_POLICY_WATCH_MS);
  return Number.isFinite(n) && n >= 1000 ? n : 5000;
};

/** The policy as compared between two looks (null and an unreadable policy compare equal). */
const signature = (p: AiPolicy | null) => (p ? JSON.stringify({ ...p, updated_at: null, updated_by: null }) : "null");

interface TenantLine {
  tenant: TenantCtx;
  listeners: Set<Listener>;
  timer: NodeJS.Timeout | null;
  last: string | undefined;
  /** The look under way: a second caller waits for it rather than racing it. */
  looking: Promise<void> | null;
  /** Bumped when watching stops: a look begun before then says nothing about the next watch. */
  generation: number;
}

const lines = new Map<number, TenantLine>();

function lineFor(tid: number, tenant?: TenantCtx | null): TenantLine {
  let line = lines.get(tid);
  if (!line) {
    const ctx = tenant && tenant.tid === tid ? tenant : primaryTenantCtx({ tid });
    line = { tenant: ctx, listeners: new Set(), timer: null, last: undefined, looking: null, generation: 0 };
    lines.set(tid, line);
  }
  return line;
}

function look(line: TenantLine): Promise<void> {
  if (!line.looking) {
    const gen = line.generation;
    // The watcher timer runs outside any request: read the policy in the line's own tenant.
    line.looking = runWithTenant(line.tenant, async () => {
      const policy = await refreshAiPolicyNow();
      if (gen !== line.generation) return;
      const sig = signature(policy);
      if (line.last !== undefined && sig !== line.last) publishAiChange({ cause: "policy", v: policy?.v ?? null }, line.tenant.tid);
      line.last = sig;
    }).finally(() => (line.looking = null));
  }
  return line.looking;
}

function startWatching(line: TenantLine) {
  if (line.timer) return;
  void look(line);
  line.timer = setInterval(() => void look(line), watchMs());
  line.timer.unref?.();
}

function stopWatching(line: TenantLine) {
  if (line.timer) clearInterval(line.timer);
  line.timer = null;
  line.last = undefined;
  line.looking = null;
  line.generation++;
}

/** Tell the current school's listeners (or school `tid`'s, from code running outside its context). */
export function publishAiChange(change: Omit<AiChange, "at" | "tid">, tid: number = ctid()) {
  const line = lines.get(tid);
  if (!line) return;
  const event: AiChange = { ...change, tid, at: new Date().toISOString() };
  for (const fn of [...line.listeners]) {
    try {
      fn(event);
    } catch (e) {
      console.warn("[ai-live] listener failed:", (e as Error)?.message);
    }
  }
}

/** Calls `fn` on every change of the current school until the returned function is called. */
export function subscribeAiChanges(fn: Listener): () => void {
  const tenant = currentTenantOrNull();
  const tid = tenant?.tid ?? ctid();
  const line = lineFor(tid, tenant);
  // A listener never hears another school's change, whatever reaches it.
  const guarded: Listener = (c) => {
    if (c.tid === tid) fn(c);
  };
  line.listeners.add(guarded);
  startWatching(line);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    line.listeners.delete(guarded);
    if (line.listeners.size === 0) {
      stopWatching(line);
      if (lines.get(tid) === line) lines.delete(tid);
    }
  };
}

/** For tests: one look at MIS now (what the timer does) for the current school. */
export const lookAtPolicyForTests = () => {
  const line = lines.get(ctid());
  return line ? look(line) : Promise.resolve();
};

/** Listeners of the current school (or of every school with `all`). */
export const aiLiveListenerCount = (all = false) => {
  if (!all) return lines.get(ctid())?.listeners.size ?? 0;
  let n = 0;
  for (const l of lines.values()) n += l.listeners.size;
  return n;
};

/** For tests: is school `tid`'s MIS policy watcher running? */
export const aiLiveWatching = (tid: number) => !!lines.get(tid)?.timer;
