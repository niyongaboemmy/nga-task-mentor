/**
 * Automatic strict mode (TENANT_SWITCHING_PLAN.md Appendix A.6).
 *
 * MIS's registry response (`GET /platform/tenants/active`) may carry
 * `tenancy: { strict: { taskmentor: bool, ... } }`. MIS turns it on after 7
 * clean days of fallback reports (fallbacks.ts). While it is on, Task Mentor
 * behaves as TENANCY_LEGACY_DEFAULT_TID=none + TENANCY_MODE=enforce, unless
 * the env sets TENANCY_STRICT=off (kill switch).
 *
 * The flag is sticky between registry reads: it only changes when MIS
 * answers. An MIS that predates the contract (no `tenancy` key) means off.
 */

export const STRICT_APP = "taskmentor";

let strictFromMis = false;

/** Read the strict flag out of a registry response body (any shape: never throws). */
export function strictFlagFromBody(body: unknown): boolean {
  try {
    const b = body as { tenancy?: unknown; data?: { tenancy?: unknown } } | null;
    const tenancy = (b?.tenancy ?? b?.data?.tenancy) as { strict?: Record<string, unknown> } | undefined;
    return tenancy?.strict?.[STRICT_APP] === true;
  } catch {
    return false;
  }
}

/** Record what the latest registry response said. */
export function applyRegistryStrict(body: unknown): void {
  const next = strictFlagFromBody(body);
  if (next !== strictFromMis) {
    console.log(`[tenancy] MIS strict mode for ${STRICT_APP}: ${next ? "on" : "off"}`);
  }
  strictFromMis = next;
}

export function strictKillSwitch(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.TENANCY_STRICT ?? "").trim().toLowerCase() === "off";
}

/** True when MIS asked for strict mode and the env does not veto it. */
export function strictActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return strictFromMis && !strictKillSwitch(env);
}

/** Tests only. */
export function setStrictForTests(on: boolean): void {
  strictFromMis = on;
}
