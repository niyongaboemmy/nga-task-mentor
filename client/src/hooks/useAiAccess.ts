import { useEffect, useState } from "react";
import {
  fetchAiAccess,
  fetchAiPolicy,
  type AiAccess,
  type AiAccessContext,
  type AiPolicySummary,
} from "../services/aiApi";
import { useOptionalAuth } from "../contexts/AuthContext";

/**
 * AI usage control on the client (AI_USAGE_CONTROL_PLAN.md §5.7). The server
 * enforces everything; these hooks only decide what to show.
 *
 *   useAiAccess({ quiz | assignment | project })  a student's AI in an item
 *   useAiPolicy()                                  the school policy summary
 *   useAiAuthoring()                               a teacher's AI tools (AI_USE + policy)
 *
 * Answers are cached for a minute (the server's policy cache is as long).
 */

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

/** Forget cached answers (tests; after a policy change). */
export function clearAiAccessCache() {
  cache.clear();
}

const keyOf = (ctx: AiAccessContext) =>
  ctx.quiz ? `quiz:${ctx.quiz}` : ctx.assignment ? `assignment:${ctx.assignment}` : ctx.project ? `project:${ctx.project}` : "none";

export interface AiAccessState {
  loading: boolean;
  /** null while loading, or when the server couldn't be asked (treated as no AI). */
  access: AiAccess | null;
}

export function useAiAccess(ctx: AiAccessContext, enabled = true): AiAccessState {
  const key = keyOf(ctx);
  const [state, setState] = useState<AiAccessState>({ loading: enabled, access: null });
  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, access: null });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    cached(`access:${key}`, () => fetchAiAccess(ctx))
      .then((access) => live && setState({ loading: false, access }))
      .catch(() => live && setState({ loading: false, access: null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return state;
}

export function useAiPolicy(enabled = true): { loading: boolean; policy: AiPolicySummary | null } {
  const [state, setState] = useState<{ loading: boolean; policy: AiPolicySummary | null }>({ loading: enabled, policy: null });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    cached("policy", fetchAiPolicy)
      .then((policy) => live && setState({ loading: false, policy }))
      .catch(() => live && setState({ loading: false, policy: null }));
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}

/**
 * May this staff member use the AI authoring tools (generators, rubric, marking
 * drafts, test cases)? `allowed` stays true while the policy is loading or
 * unknown so buttons don't flicker; the server still refuses with a message.
 */
export function useAiAuthoring(): { allowed: boolean; reason: string | null } {
  // Optional: these buttons also render in isolated components (tests, previews)
  // without an AuthProvider; then nothing is hidden and the server decides.
  const user = useOptionalAuth()?.user;
  const hasAiUse = !!user?.localPermissions?.includes("AI_USE");
  const { policy } = useAiPolicy(hasAiUse);
  if (!user) return { allowed: true, reason: null };
  if (!hasAiUse) return { allowed: false, reason: "Your role does not include AI tools." };
  if (policy && !policy.author.allowed) return { allowed: false, reason: policy.author.message };
  return { allowed: true, reason: null };
}
