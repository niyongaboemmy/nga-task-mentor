/**
 * Production fallback counter, 2026-11-25: 443 `no_context:keys.tk` in a minute.
 * misBearerAuth (MIS Home -> TM) and the TMCode exchange applied MIS version
 * hints BEFORE entering the person's school, so tk() built school 1's cache key:
 * a school-2 person's access change marked NGA's same-id snapshot stale and left
 * their own stale. The hints must run inside the person's school, with no
 * fallback counted.
 */
import axios from "axios";
import { currentTenantOrNull } from "../vendor/nga-tenancy";

const seen: Array<{ fn: string; tid: number | null }> = [];
jest.mock("../access/snapshot", () => ({
  noteAccessVersion: () => seen.push({ fn: "access", tid: require("../vendor/nga-tenancy").currentTenantOrNull()?.tid ?? null }),
}));
jest.mock("../services/aiPolicy", () => ({
  noteAiPolicyVersion: () => seen.push({ fn: "aiPolicy", tid: require("../vendor/nga-tenancy").currentTenantOrNull()?.tid ?? null }),
}));
jest.mock("../services/myAiGateway", () => ({
  noteMyAiVersions: () => seen.push({ fn: "myAi", tid: require("../vendor/nga-tenancy").currentTenantOrNull()?.tid ?? null }),
}));
jest.mock("axios");

const SCHOOL2 = { tid: 2, slug: "s2", name: "School 2", status: "ACTIVE", isPrimary: false, timezone: "Africa/Kigali", pkg: "max" };
jest.mock("../tenancy/request", () => {
  const actual = jest.requireActual("../tenancy/request");
  return { ...actual, resolveTenant: async () => ({ ok: true, tenant: SCHOOL2 }) };
});

import { misBearerAuth, clearMisBearerCache } from "../middleware/misBearerAuth";
import { fallbackReport, resetFallbacksForTests } from "../tenancy/fallbacks";

const res = () => {
  const r: any = { statusCode: 200 };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  return r;
};

describe("MIS version hints run inside the person's school", () => {
  beforeEach(() => {
    seen.length = 0;
    clearMisBearerCache();
    resetFallbacksForTests();
    (axios.get as jest.Mock).mockResolvedValue({
      data: { data: { userId: 77, access_version: 5, ai_policy_v: 3, ai_routes_v: 1, tenant: { tid: 2 } } },
    });
  });

  it("misBearerAuth applies access / AI policy / My AI hints in school 2, counting no fallback", async () => {
    const req: any = { headers: { authorization: "Bearer aaa.bbb.ccc" }, query: {}, get: () => undefined };
    await misBearerAuth(req, res(), () => undefined).catch(() => undefined);
    expect(seen.map((s) => s.fn).sort()).toEqual(["access", "aiPolicy", "myAi"]);
    expect(seen.every((s) => s.tid === 2)).toBe(true);
    expect(currentTenantOrNull()).toBeNull();
    const counts = (fallbackReport() as any).counts ?? {};
    expect(counts.no_context ?? 0).toBe(0);
  });
});
