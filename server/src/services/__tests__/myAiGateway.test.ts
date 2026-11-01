import { resetAiPolicyCache, setAiPolicyForTests, AiDisabledError } from "../aiPolicy";
import {
  getRoutes,
  myRoutesForUi,
  noteAiRoutesVersion,
  noteMyAiVersions,
  personalAiFrom,
  PersonalAiUnavailableError,
  resetMyAiCache,
  withPersonalAi,
  type PersonalAiCall,
} from "../myAiGateway";

/**
 * My AI gateway client (MY_AI_GATEWAY.md): the contract's answer table, the
 * policy gate (no network call while personal is off) and the per-person
 * route cache dropped by a new ai_routes_v.
 */

const ENV = { ...process.env };
const fetchMock = jest.fn();
const realFetch = global.fetch;

const json = (status: number, body: unknown) =>
  ({ status, json: async () => body }) as unknown as Response;

const policyOn = (personal: Record<string, unknown> = {}) =>
  setAiPolicyForTests({ v: 7, enabled: true, apps: { tm: true }, personal: { enabled: true, ...personal } } as any);

const ctx: PersonalAiCall = { misUserId: 42, task: "author", feature: "tm.rubric", aiRoute: null };
const params = { prompt: "Write a rubric", schema: { type: "object" as const, properties: { a: { type: "string" as const } } }, schemaName: "rubric" };

const run = (school = jest.fn(async () => "school answer")) => ({
  school,
  personal: async (gw: any) => gw.json(params),
});

beforeEach(() => {
  resetMyAiCache();
  resetAiPolicyCache();
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
  process.env = { ...ENV, NGA_MIS_BASE_URL: "https://mis.test/", SSO_CLIENT_ID: "taskmentor_app", SSO_CLIENT_SECRET: "s3cret" };
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  process.env = ENV;
  (global as any).fetch = realFetch;
  resetAiPolicyCache();
});

describe("withPersonalAi", () => {
  it("200: the person's key answers, sent with Basic auth + X-Nga-On-Behalf-Of (the MIS id) and the same prompt/schema", async () => {
    policyOn();
    fetchMock.mockResolvedValue(
      json(200, { success: true, data: { a: "personal" }, ai: { route: "personal", reason: "PERSONAL", credentialId: 12, label: "My Claude", provider: "anthropic", model: "claude-x" } }),
    );
    const school = jest.fn();
    const out = await withPersonalAi({ ...ctx, aiRoute: "12:claude-x" }, run(school));

    expect(out.result).toEqual({ a: "personal" });
    expect(out.ai).toMatchObject({ route: "personal", label: "My Claude", model: "claude-x" });
    expect(school).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mis.test/integrations/ai/gateway/json");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("taskmentor_app:s3cret").toString("base64")}`);
    expect(init.headers["X-Nga-On-Behalf-Of"]).toBe("42");
    expect(JSON.parse(init.body)).toEqual({
      task: "author",
      feature: "tm.rubric",
      inAssessment: false,
      aiRoute: "12:claude-x",
      prompt: params.prompt,
      schema: params.schema,
      schemaName: "rubric",
    });
  });

  it("409 AI_USE_SCHOOL: the school AI answers, labelled with the MIS reason", async () => {
    policyOn();
    fetchMock.mockResolvedValue(json(409, { success: false, code: "AI_USE_SCHOOL", reason: "NO_ROUTE", skipped: null }));
    const out = await withPersonalAi(ctx, run());
    expect(out).toEqual({ result: "school answer", ai: { route: "school", reason: "NO_ROUTE" } });
  });

  it("503 with fallbackAllowed: the school AI answers, labelled KEY_NOT_ACTIVE + fallbackFrom", async () => {
    policyOn();
    fetchMock.mockResolvedValue(
      json(503, { success: false, code: "AI_KEY_NO_CREDIT", message: "Out of credit", fallbackAllowed: true, label: "My Claude" }),
    );
    const out = await withPersonalAi(ctx, run());
    expect(out).toEqual({
      result: "school answer",
      ai: { route: "school", reason: "KEY_NOT_ACTIVE", fallbackFrom: "AI_KEY_NO_CREDIT", label: "My Claude" },
    });
  });

  it("503 without fallback: a 503 error carrying the message, the school AI is not run", async () => {
    policyOn();
    fetchMock.mockResolvedValue(
      json(503, { success: false, code: "AI_KEY_INVALID", message: "Your key was rejected.", fallbackAllowed: false, label: "My Claude" }),
    );
    const school = jest.fn();
    const err = await withPersonalAi(ctx, run(school)).catch((e) => e);
    expect(err).toBeInstanceOf(PersonalAiUnavailableError);
    expect(err).toMatchObject({ statusCode: 503, code: "AI_KEY_INVALID", message: "Your key was rejected." });
    expect(school).not.toHaveBeenCalled();
  });

  it("403 AI_DISABLED: refused as today", async () => {
    policyOn();
    fetchMock.mockResolvedValue(json(403, { success: false, code: "AI_DISABLED", reason: "APP_OFF" }));
    await expect(withPersonalAi(ctx, run())).rejects.toBeInstanceOf(AiDisabledError);
  });

  it("network failure / other status: the school AI answers with GATEWAY_UNAVAILABLE", async () => {
    policyOn();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await withPersonalAi(ctx, run())).ai).toEqual({ route: "school", reason: "GATEWAY_UNAVAILABLE" });
    fetchMock.mockResolvedValueOnce(json(500, { success: false }));
    expect((await withPersonalAi(ctx, run())).ai).toEqual({ route: "school", reason: "GATEWAY_UNAVAILABLE" });
  });

  it("personal off in the policy (or tm opted out, or no policy, or no MIS id): never calls the gateway", async () => {
    setAiPolicyForTests({ v: 1, enabled: true, apps: { tm: true } } as any); // personal defaults to off
    expect((await withPersonalAi(ctx, run())).ai).toEqual({ route: "school", reason: "PERSONAL_OFF" });
    policyOn({ apps: { tm: false } });
    expect((await withPersonalAi(ctx, run())).ai).toEqual({ route: "school", reason: "APP_OFF" });
    setAiPolicyForTests(null);
    expect((await withPersonalAi(ctx, run())).result).toBe("school answer");
    policyOn();
    expect((await withPersonalAi({ ...ctx, misUserId: null }, run())).result).toBe("school answer");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aiRoute 'school', or cached routes saying school for the task: no gateway call", async () => {
    policyOn();
    expect((await withPersonalAi({ ...ctx, aiRoute: "school" }, run())).ai.route).toBe("school");
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, data: { v: 1, enabled: true, byTask: { author: { route: "school", reason: "NO_ROUTE" } }, choices: [] } }),
    );
    await getRoutes(42);
    expect((await withPersonalAi(ctx, run())).ai).toEqual({ route: "school", reason: "NO_ROUTE" });
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the /routes fetch
  });

  it("sends inAssessment for a hint inside a quiz", async () => {
    policyOn();
    fetchMock.mockResolvedValue(json(409, { code: "AI_USE_SCHOOL", reason: "IN_ASSESSMENT" }));
    const out = await withPersonalAi({ ...ctx, task: "hint", inAssessment: true }, run());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ task: "hint", inAssessment: true });
    expect(out.ai.reason).toBe("IN_ASSESSMENT");
  });

  it("text calls go to /gateway/text", async () => {
    policyOn();
    fetchMock.mockResolvedValue(json(200, { success: true, data: '[{"x":1}]', ai: { route: "personal", reason: "PERSONAL" } }));
    const out = await withPersonalAi(ctx, { school: async () => "", personal: (gw) => gw.text({ prompt: "p" }) });
    expect(fetchMock.mock.calls[0][0]).toBe("https://mis.test/integrations/ai/gateway/text");
    expect(out.result).toBe('[{"x":1}]');
  });
});

describe("routes cache", () => {
  const routes = (v: number) =>
    json(200, { success: true, data: { v, policyV: 7, enabled: true, byTask: {}, choices: [{ credentialId: 12, provider: "anthropic", model: "m", label: "My Claude" }] } });

  it("GET /routes with a 3 s timeout, cached 60 s per person", async () => {
    policyOn();
    fetchMock.mockResolvedValue(routes(1));
    const a = await getRoutes(42);
    const b = await getRoutes(42);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mis.test/integrations/ai/routes");
    expect(init.method).toBe("GET");
    expect(init.headers["X-Nga-On-Behalf-Of"]).toBe("42");
    await getRoutes(43);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a different ai_routes_v from /auth/verify drops that person's copy; the same one keeps it", async () => {
    policyOn();
    fetchMock.mockResolvedValue(routes(1));
    await getRoutes(42);
    noteAiRoutesVersion(42, 1);
    await getRoutes(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    noteAiRoutesVersion(42, 2);
    await getRoutes(42);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a new ai_policy_v drops every cached copy", async () => {
    policyOn();
    fetchMock.mockResolvedValue(routes(1));
    noteMyAiVersions(42, { ai_policy_v: 7 });
    await getRoutes(42);
    noteMyAiVersions(42, { ai_policy_v: 8 });
    await getRoutes(42);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("myRoutesForUi: { enabled:false } when off or when the MIS can't answer", async () => {
    setAiPolicyForTests({ v: 1, enabled: true, apps: { tm: true } } as any);
    expect(await myRoutesForUi(42)).toEqual({ enabled: false });
    expect(fetchMock).not.toHaveBeenCalled();
    policyOn();
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await myRoutesForUi(42)).toEqual({ enabled: false });
    fetchMock.mockResolvedValueOnce(routes(3));
    expect(await myRoutesForUi(42)).toMatchObject({ enabled: true, choices: [{ credentialId: 12 }] });
  });
});

describe("personalAiFrom", () => {
  it("uses the MIS user id (never the local id) and the body's aiRoute", () => {
    const c = personalAiFrom({ user: { id: 5, mis_user_id: 4242 }, body: { aiRoute: " 12 " } }, "author", "tm.sql");
    expect(c).toEqual({ misUserId: 4242, task: "author", feature: "tm.sql", inAssessment: false, aiRoute: "12" });
    expect(personalAiFrom({ user: { id: 5 } }, "hint", "x", { inAssessment: true })).toMatchObject({ misUserId: null, inAssessment: true, aiRoute: null });
  });
});
