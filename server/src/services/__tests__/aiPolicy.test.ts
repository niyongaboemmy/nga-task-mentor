jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));

import axios from "axios";
import {
  AiDisabledError,
  aiGradingAllowed,
  assertAiApp,
  getAiPolicy,
  noteAiPolicyVersion,
  resetAiPolicyCache,
  setAiPolicyForTests,
} from "../aiPolicy";

/**
 * The MIS AI policy client (AI_USAGE_CONTROL_PLAN.md §5.1): 60 s cache, a new
 * ai_policy_v expires it, 15 min of grace on the last good copy, then fail
 * closed; a failure isn't retried for 10 s.
 */

const get = axios.get as jest.Mock;
const ENV = { ...process.env };
const policy = (v: number, extra: Record<string, unknown> = {}) => ({
  data: { success: true, data: { policy: { v, enabled: true, apps: { tm: true }, features: { grading: false }, ...extra } } },
});

let now = 1_000_000;
beforeEach(() => {
  resetAiPolicyCache();
  get.mockReset();
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  process.env = { ...ENV, NGA_MIS_BASE_URL: "https://mis.test/", SSO_CLIENT_ID: "tm", SSO_CLIENT_SECRET: "s3cret" };
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  process.env = ENV;
  resetAiPolicyCache();
});

describe("aiPolicy client", () => {
  it("fetches /integrations/ai-policy with the SSO client's Basic auth and a 3 s timeout", async () => {
    get.mockResolvedValue(policy(3));
    const p = await getAiPolicy();
    expect(p).toMatchObject({ v: 3, enabled: true });
    const [url, opts] = get.mock.calls[0];
    expect(url).toBe("https://mis.test/integrations/ai-policy");
    expect(opts.headers.Authorization).toBe(`Basic ${Buffer.from("tm:s3cret").toString("base64")}`);
    expect(opts.timeout).toBe(3000);
  });

  it("caches for 60 s, then refetches", async () => {
    get.mockResolvedValue(policy(3));
    await getAiPolicy();
    now += 59_000;
    await getAiPolicy();
    expect(get).toHaveBeenCalledTimes(1);
    now += 2_000;
    await getAiPolicy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("a new ai_policy_v from the verify poll expires the cache; the same one doesn't", async () => {
    get.mockResolvedValueOnce(policy(3)).mockResolvedValueOnce(policy(4, { enabled: false }));
    await getAiPolicy();
    noteAiPolicyVersion(3);
    await getAiPolicy();
    expect(get).toHaveBeenCalledTimes(1);
    noteAiPolicyVersion(4);
    expect(await getAiPolicy()).toMatchObject({ v: 4, enabled: false });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good copy for 15 min when MIS fails, then fails closed", async () => {
    get.mockResolvedValueOnce(policy(5));
    await getAiPolicy();
    get.mockRejectedValue(new Error("ECONNREFUSED"));
    now += 61_000;
    expect(await getAiPolicy()).toMatchObject({ v: 5 });
    // no new attempt within 10 s of a failure
    now += 5_000;
    await getAiPolicy();
    expect(get).toHaveBeenCalledTimes(2);
    now += 15 * 60_000;
    expect(await getAiPolicy()).toBeNull();
  });

  it("no copy at all, or no credentials, is null (AI off)", async () => {
    get.mockRejectedValue(new Error("timeout of 3000ms exceeded"));
    expect(await getAiPolicy()).toBeNull();
    resetAiPolicyCache();
    delete process.env.SSO_CLIENT_SECRET;
    expect(await getAiPolicy()).toBeNull();
  });

  it("assertAiApp throws AiDisabledError (GLOBAL_OFF / APP_OFF); grading needs features.grading", async () => {
    setAiPolicyForTests(null);
    await expect(assertAiApp("tm")).rejects.toMatchObject({ code: "AI_DISABLED", reason: "GLOBAL_OFF", statusCode: 403 });
    setAiPolicyForTests({ v: 1, enabled: true, apps: { tm: false }, features: { grading: true }, assessments: "teacher", thirdPartyExtensions: false });
    await expect(assertAiApp("tm")).rejects.toBeInstanceOf(AiDisabledError);
    await expect(assertAiApp("tmcode")).resolves.toMatchObject({ enabled: true });
    expect(await aiGradingAllowed()).toBe(false);
    setAiPolicyForTests({ v: 1, enabled: true, apps: {}, features: { grading: true }, assessments: "teacher", thirdPartyExtensions: false });
    expect(await aiGradingAllowed()).toBe(true);
    setAiPolicyForTests({ v: 1, enabled: true, apps: {}, features: { grading: false }, assessments: "teacher", thirdPartyExtensions: false });
    expect(await aiGradingAllowed()).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
