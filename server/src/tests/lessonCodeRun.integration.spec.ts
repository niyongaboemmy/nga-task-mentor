import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { buildTestApp, ensureModelsRegistered } from "./testApp";
import { sequelize } from "../config/database";
import { Judge0Service } from "../services/Judge0Service";
import { clearMisBearerCache } from "../middleware/misBearerAuth";
import { lessonCodeRunLimiter } from "../middleware/rateLimiter.middleware";

/**
 * /api/integration/code/*: the MIS lesson Code Playground, relayed by the MIS
 * backend with the user's own MIS token. The MIS verify call and the judge are
 * mocked; the caller has no Task Mentor account (students read lessons in the MIS).
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const MIS_USER = 7_000_000 + (parseInt(crypto.randomBytes(2).toString("hex"), 16) % 100000);
const TOKEN = `mis-token-${MIS_USER}`;
const ENV = { ...process.env };
let app: ReturnType<typeof buildTestApp>;

const ok = (stdout: string) => ({
  stdout, stderr: null, compile_output: null, message: null, time: "0.01", memory: 100, token: "t",
  status: { id: 3, description: "Accepted" },
});

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  delete process.env.CODERUNNER_ENGINE; // Judge0, stubbed
});
beforeEach(() => {
  clearMisBearerCache();
  lessonCodeRunLimiter.resetKey(`lesson-code-run:${MIS_USER}`);
  mockedGet.mockReset();
  mockedGet.mockImplementation(async (url: string, opts: any) => {
    if (String(url).endsWith("/auth/verify") && opts?.headers?.Authorization === `Bearer ${TOKEN}`) {
      return { data: { data: { userId: MIS_USER } } };
    }
    throw Object.assign(new Error("unauthorized"), { response: { status: 401 } });
  });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  process.env = ENV;
  await sequelize.close();
});

const run = (body: object, token = TOKEN) =>
  request(app).post("/api/integration/code/run").set("Authorization", `Bearer ${token}`).send(body);

describe("lesson code playground", () => {
  it("refuses a missing or unknown MIS token", async () => {
    expect((await request(app).post("/api/integration/code/run").send({})).status).toBe(401);
    expect((await run({ files: [{ path: "main.py", content: "print(1)" }], tests: [{ id: "run", input: "" }] }, "bad")).body.code).toBe("MIS_TOKEN_INVALID");
  });

  it("runs code for an MIS user who never opened Task Mentor", async () => {
    const single = jest.spyOn(Judge0Service, "runSingle").mockResolvedValueOnce(ok("Hello, 5\n") as any);
    const res = await run({
      language: "python",
      files: [{ path: "main.py", content: "n = int(input())\nprint(f'Hello, {n}')\n" }],
      tests: [{ id: "run", input: "5" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ language: "python", entry: "main.py" });
    expect(res.body.data.tests[0]).toMatchObject({ verdict: "ok", stdout: "Hello, 5\n" });
    expect(single.mock.calls[0][0]).toContain("int(input())");
  });

  it("answers bad requests like /api/code/run", async () => {
    expect((await run({ files: [], tests: [{ id: "run", input: "" }] })).status).toBe(400);
    expect((await run({ language: "html", files: [{ path: "index.html", content: "<p>x</p>" }], tests: [{ id: "run", input: "" }] })).body.code).toBe("USE_PREVIEW");
    expect((await run({ files: [{ path: "../x.py", content: "x" }], tests: [{ id: "run", input: "" }] })).status).toBe(400);
  });

  it("lists the languages the runner runs, with labels", async () => {
    const res = await request(app).get("/api/integration/code/languages").set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.languages.map((l: any) => l.key);
    expect(keys).toEqual(expect.arrayContaining(["python", "javascript", "java", "cpp"]));
    expect(res.body.data.languages.find((l: any) => l.key === "cpp")).toMatchObject({ label: "C++" });
  });

  it("limits runs per MIS user", async () => {
    jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(ok("1\n") as any);
    const body = { language: "python", files: [{ path: "main.py", content: "print(1)" }], tests: [{ id: "run", input: "" }] };
    let last = 0;
    for (let i = 0; i < 13; i++) last = (await run(body)).status;
    expect(last).toBe(429);
  });
});
