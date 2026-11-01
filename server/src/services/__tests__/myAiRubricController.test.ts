/**
 * My AI through a real controller (POST /api/assignments/ai/rubric's handler), with the
 * school provider chain faked and the MIS gateway behind a mocked fetch: the answer
 * carries `ai`, the school path is unchanged while My AI is off, and the personal
 * branch sends exactly the prompt/schema the school branch would.
 */
const fakeProvider = {
  name: "fakeschool",
  isConfigured: () => true,
  supportsStrictSchema: true,
  generateJSON: jest.fn(),
  generateText: jest.fn(),
};
jest.mock("../aiProviders/registry", () => {
  const actual = jest.requireActual("../aiProviders/registry");
  return { ...actual, orderedProviders: () => [fakeProvider], isCoolingDown: () => false };
});

import { generateAssignmentRubric } from "../../controllers/assignmentAi.controller";
import { resetAiPolicyCache, setAiPolicyForTests } from "../aiPolicy";
import { resetMyAiCache } from "../myAiGateway";

const ENV = { ...process.env };
const fetchMock = jest.fn();
const realFetch = global.fetch;

const rubric = {
  found_in_description: false,
  criteria: [
    { name: "Accuracy", description: "Correct answers", points: 6 },
    { name: "Clarity", description: "Clear writing", points: 4 },
  ],
  note: "",
};

function call(body: Record<string, unknown> = {}) {
  const req: any = {
    user: { id: 5, mis_user_id: 4242, permissions: new Set(["AI_USE"]) },
    body: { title: "Essay", description: "<p>Write an essay about rivers.</p>", max_score: 10, criteria_count: null, provider: null, ...body },
  };
  const res: any = { statusCode: 200, body: null };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  return generateAssignmentRubric(req, res).then(() => res);
}

beforeEach(() => {
  resetAiPolicyCache();
  resetMyAiCache();
  fetchMock.mockReset();
  fakeProvider.generateJSON.mockReset();
  (global as any).fetch = fetchMock;
  process.env = { ...ENV, NGA_MIS_BASE_URL: "https://mis.test", SSO_CLIENT_ID: "taskmentor_app", SSO_CLIENT_SECRET: "s3cret" };
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  process.env = ENV;
  (global as any).fetch = realFetch;
  resetAiPolicyCache();
});

describe("AI rubric + My AI", () => {
  it("My AI off: the school chain answers as before, `ai` says school, the gateway is never called", async () => {
    setAiPolicyForTests({ v: 1, enabled: true, apps: { tm: true } } as any);
    fakeProvider.generateJSON.mockResolvedValue(rubric);
    const res = await call({ aiRoute: "12" });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.criteria.map((c: any) => c.max_score)).toEqual([6, 4]);
    expect(res.body.data.provider_used).toBe("fakeschool");
    expect(res.body.ai).toEqual({ route: "school", reason: "PERSONAL_OFF" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("My AI on: the person's key answers with the very prompt/schema the school would get", async () => {
    setAiPolicyForTests({ v: 1, enabled: true, apps: { tm: true } } as any);
    fakeProvider.generateJSON.mockResolvedValue(rubric);
    await call();
    const schoolParams = fakeProvider.generateJSON.mock.calls[0][0];
    fakeProvider.generateJSON.mockReset();

    setAiPolicyForTests({ v: 2, enabled: true, apps: { tm: true }, personal: { enabled: true } } as any);
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, data: rubric, ai: { route: "personal", reason: "PERSONAL", credentialId: 12, label: "My Claude", provider: "anthropic", model: "claude-x" } }),
    });
    const res = await call({ aiRoute: "12" });
    expect(res.statusCode).toBe(200);
    expect(res.body.ai).toMatchObject({ route: "personal", label: "My Claude", model: "claude-x" });
    expect(res.body.data.provider_used).toBe("anthropic");
    expect(fakeProvider.generateJSON).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mis.test/integrations/ai/gateway/json");
    expect(init.headers["X-Nga-On-Behalf-Of"]).toBe("4242");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ task: "author", feature: "tm.rubric", aiRoute: "12", inAssessment: false });
    expect(sent.prompt).toBe(schoolParams.prompt);
    expect(sent.schema).toEqual(schoolParams.schema);
    expect(sent.schemaName).toBe(schoolParams.schemaName);
    expect(sent.maxOutputTokens).toBe(schoolParams.maxOutputTokens);
  });

  it("key out of credit with fallback: school answers and `ai` explains it", async () => {
    setAiPolicyForTests({ v: 2, enabled: true, apps: { tm: true }, personal: { enabled: true } } as any);
    fakeProvider.generateJSON.mockResolvedValue(rubric);
    fetchMock.mockResolvedValue({
      status: 503,
      json: async () => ({ success: false, code: "AI_KEY_NO_CREDIT", message: "No credit", fallbackAllowed: true, label: "My Claude" }),
    });
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body.ai).toEqual({ route: "school", reason: "KEY_NOT_ACTIVE", fallbackFrom: "AI_KEY_NO_CREDIT", label: "My Claude" });
    expect(fakeProvider.generateJSON).toHaveBeenCalledTimes(1);
  });

  it("key failed without fallback: 503 with the gateway's message", async () => {
    setAiPolicyForTests({ v: 2, enabled: true, apps: { tm: true }, personal: { enabled: true } } as any);
    fetchMock.mockResolvedValue({
      status: 503,
      json: async () => ({ success: false, code: "AI_KEY_INVALID", message: "Your key 'My Claude' was rejected.", fallbackAllowed: false }),
    });
    const res = await call();
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ success: false, message: "Your key 'My Claude' was rejected." });
    expect(fakeProvider.generateJSON).not.toHaveBeenCalled();
  });
});
