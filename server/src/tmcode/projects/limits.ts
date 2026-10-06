/**
 * TMCode Projects limits (PROJECTS_PLAN.md §2 "Quotas"), read from env on
 * every call so tests and ops can change them without a restart of the logic.
 */

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export interface ProjectLimits {
  /** Total uncompressed size of one revision. */
  maxProjectBytes: number;
  maxFiles: number;
  maxFileBytes: number;
  maxProjectsPerUser: number;
  /** Blobs smaller than this stay in MySQL; larger ones go to the file-server. */
  blobDbMaxBytes: number;
}

export function projectLimits(): ProjectLimits {
  return {
    maxProjectBytes: num("PROJECTS_MAX_PROJECT_MB", 100) * 1024 * 1024,
    maxFiles: num("PROJECTS_MAX_FILES", 5000),
    maxFileBytes: num("PROJECTS_MAX_FILE_MB", 10) * 1024 * 1024,
    maxProjectsPerUser: num("PROJECTS_MAX_PER_USER", 50),
    blobDbMaxBytes: num("PROJECTS_BLOB_DB_MAX_KB", 256) * 1024,
  };
}

/** A presence row older than this is shown offline. */
export const presenceStaleMs = () => num("PROJECTS_PRESENCE_STALE_S", 60) * 1000;

/** SSE comment heartbeat (keeps proxies from closing idle streams). */
export const sseHeartbeatMs = () => num("PROJECTS_SSE_HEARTBEAT_MS", 25_000);
