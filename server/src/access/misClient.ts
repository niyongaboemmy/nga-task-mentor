import axios from "axios";
import type { AccessSnapshot, Manifest } from "../vendor/nga-access";

/**
 * The MIS access-control v2 endpoints Task Mentor talks to
 * (nga_central_mis/backend/src/routes/access.ts). Every call has a short
 * timeout: an access decision must never hang a request on a slow MIS.
 */

export const ACCESS_APP = "tm";

const misBase = () => (process.env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");
export const misTimeoutMs = () => {
  const n = Number(process.env.ACCESS_MIS_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 3000;
};

/** HTTP Basic header from this app's SSO client credentials (same as /sso/token). */
export function clientBasicAuth(env: NodeJS.ProcessEnv = process.env): string | null {
  const id = env.SSO_CLIENT_ID;
  const secret = env.SSO_CLIENT_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export class SnapshotFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "SnapshotFetchError";
  }
}

const looksLikeSnapshot = (d: any): d is AccessSnapshot =>
  d && typeof d === "object" && typeof d.v === "number" && d.caps && typeof d.caps === "object";

/** GET {MIS}/access/me?app=tm with the user's MIS bearer token. */
export async function fetchSnapshotFromMis(misToken: string): Promise<AccessSnapshot> {
  if (!misBase()) throw new SnapshotFetchError("NGA_MIS_BASE_URL is not set", null);
  try {
    const res = await axios.get(`${misBase()}/access/me`, {
      params: { app: ACCESS_APP },
      headers: { Authorization: `Bearer ${misToken}` },
      timeout: misTimeoutMs(),
    });
    const data = res.data?.data;
    if (!looksLikeSnapshot(data)) {
      throw new SnapshotFetchError("MIS returned a malformed access snapshot", res.status);
    }
    return data;
  } catch (err: any) {
    if (err instanceof SnapshotFetchError) throw err;
    // 503 = access v2 not installed on that MIS; anything else = unreachable/refused
    throw new SnapshotFetchError(
      `access snapshot fetch failed: ${err?.message ?? err}`,
      err?.response?.status ?? null,
    );
  }
}

/** The body + headers `npm run access:publish` sends (pure, for tests). */
export function buildManifestPublishRequest(manifest: Manifest, env: NodeJS.ProcessEnv = process.env) {
  const base = (env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");
  const auth = clientBasicAuth(env);
  return {
    method: "PUT" as const,
    url: `${base}/access/manifests/${manifest.app}`,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.parse(JSON.stringify(manifest)) as Manifest,
    ready: Boolean(base && auth),
  };
}

/** PUT the manifest to MIS. Throws on HTTP failure; the CLI decides fatality. */
export async function publishManifest(manifest: Manifest, env: NodeJS.ProcessEnv = process.env) {
  const req = buildManifestPublishRequest(manifest, env);
  if (!req.ready) {
    throw new Error("NGA_MIS_BASE_URL, SSO_CLIENT_ID and SSO_CLIENT_SECRET are required to publish");
  }
  const res = await axios.put(req.url, req.body, { headers: req.headers, timeout: 15000 });
  return res.data;
}

/** GET {MIS}/access/holders (client credentials) -> [{user_id, depth, via}]. */
export async function fetchHolders(
  cap: string,
  target: { classGroupId?: number | null; subjectId?: number | null; studentId?: number | null } = {},
  minDepth?: string,
): Promise<Array<{ user_id: number; depth: string | null; via: number[] }>> {
  const auth = clientBasicAuth();
  if (!auth || !misBase()) return [];
  const res = await axios.get(`${misBase()}/access/holders`, {
    params: { app: ACCESS_APP, cap, ...target, ...(minDepth ? { minDepth } : {}) },
    headers: { Authorization: auth },
    timeout: misTimeoutMs(),
  });
  return res.data?.data ?? [];
}

/** POST {MIS}/access/audit (client credentials) -- for sensitive reads. Never throws. */
export async function postAudit(entry: {
  action: string;
  actor_id?: number | null;
  subject_user_id?: number | null;
  target?: Record<string, unknown>;
  reason?: string | null;
}): Promise<boolean> {
  const auth = clientBasicAuth();
  if (!auth || !misBase()) return false;
  try {
    await axios.post(`${misBase()}/access/audit`, entry, {
      headers: { Authorization: auth },
      timeout: misTimeoutMs(),
    });
    return true;
  } catch {
    return false;
  }
}

/** GET {MIS}/academics/students/:id/class-group (user token) -> placement or null. */
export async function fetchStudentPlacement(
  misToken: string,
  misStudentId: number,
): Promise<{ classGroupId: number | null; gradeId: number | null; programId: number | null } | null> {
  const res = await axios.get(`${misBase()}/academics/students/${misStudentId}/class-group`, {
    headers: { Authorization: `Bearer ${misToken}` },
    timeout: misTimeoutMs(),
  });
  const d = res.data?.data;
  if (!d) return null;
  const num = (v: any) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return { classGroupId: num(d.class_group_id), gradeId: num(d.grade_id), programId: num(d.program_id) };
}

/** GET {MIS}/academics/class-groups/:id/students (user token) -> MIS student ids. */
export async function fetchClassGroupRoster(misToken: string, classGroupId: number): Promise<number[]> {
  const res = await axios.get(`${misBase()}/academics/class-groups/${classGroupId}/students`, {
    headers: { Authorization: `Bearer ${misToken}` },
    timeout: misTimeoutMs(),
  });
  const rows: any[] = res.data?.data ?? [];
  return rows.map((r) => Number(r?.user_id ?? r?.id)).filter((n) => Number.isInteger(n) && n > 0);
}
