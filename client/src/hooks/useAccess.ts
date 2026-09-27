import { useCallback, useEffect, useState } from "react";
import api from "../utils/axiosConfig";
import { useAuth } from "../contexts/AuthContext";
import {
  decide,
  scopeFor as coreScopeFor,
  type AccessSnapshot,
  type Depth,
  type ScopeEntry,
  type Target,
} from "../vendor/nga-access";

/**
 * Access control v2 snapshot for UI gating (GET /api/access/me). Not wired
 * into any screen yet -- the existing permission-based UI (usePermissions /
 * user.localPermissions) is unchanged. Uses the same vendored decision core
 * as the server, so `can(...)` here answers exactly what the API will.
 * No snapshot (MIS without v2, or unreachable) -> every check is false.
 */
export interface AccessState {
  ready: boolean;
  available: boolean;
  mode: "off" | "shadow" | "enforce" | null;
  snapshot: AccessSnapshot | null;
}

const EMPTY: AccessState = { ready: false, available: false, mode: null, snapshot: null };
let cached: { userId: unknown; state: AccessState } | null = null;

export function __resetAccessCache() {
  cached = null;
}

export function useAccess() {
  const { user } = useAuth();
  const userId = (user as { id?: unknown } | null)?.id ?? null;
  const [state, setState] = useState<AccessState>(
    cached && cached.userId === userId ? cached.state : EMPTY,
  );

  useEffect(() => {
    if (!userId) return;
    if (cached && cached.userId === userId) {
      setState(cached.state);
      return;
    }
    let live = true;
    api
      .get("/access/me")
      .then((res) => {
        const d = res.data?.data ?? {};
        const next: AccessState = {
          ready: true,
          available: Boolean(d.snapshot),
          mode: d.mode ?? null,
          snapshot: d.snapshot ?? null,
        };
        cached = { userId, state: next };
        if (live) setState(next);
      })
      .catch(() => {
        if (live) setState({ ...EMPTY, ready: true });
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const can = useCallback(
    (cap: string, target?: Target | null, minDepth?: Depth | null) =>
      decide(state.snapshot, cap, target ?? null, minDepth ?? null).allowed,
    [state.snapshot],
  );
  const depthAt = useCallback(
    (cap: string, target?: Target | null): Depth | null => decide(state.snapshot, cap, target ?? null).depth,
    [state.snapshot],
  );
  const scopeFor = useCallback(
    (cap: string, minDepth?: Depth | null): ScopeEntry | null => coreScopeFor(state.snapshot, cap, minDepth ?? null),
    [state.snapshot],
  );

  return { ...state, can, depthAt, scopeFor };
}
