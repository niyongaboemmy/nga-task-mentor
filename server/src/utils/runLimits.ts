/**
 * Run limits from a coding question, in the units the runners take.
 *
 * `time_limit` is seconds. `memory_limit` is MB, but the author form stored
 * KB until 2026-10 (default 256000), so a value above 4096 is read as KB.
 * Both are clamped to what the runners accept (Judge0 CE takes at most
 * 512 MB).
 */
export const MAX_TIME_S = 20;
export const MAX_MEMORY_MB = 512;

export function memoryMbOf(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const mb = n > 4096 ? n / 1024 : n;
  return Math.min(MAX_MEMORY_MB, Math.max(16, Math.round(mb)));
}

export function timeSOf(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(MAX_TIME_S, Math.max(0.1, n));
}

export function questionRunLimits(questionData: any): { time_s: number; memory_mb: number } {
  return {
    time_s: timeSOf(questionData?.time_limit) ?? 5,
    memory_mb: memoryMbOf(questionData?.memory_limit) ?? 256,
  };
}
