import http from "http";
import axios from "axios";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered } from "./testApp";
import { sequelize } from "../config/database";
import { resetSessions } from "../services/coderunner/sessions";
import { clearMisBearerCache } from "../middleware/misBearerAuth";
import { lessonCodeRunLimiter } from "../middleware/rateLimiter.middleware";

/**
 * Live runs for the MIS Code Playground (/api/integration/code/sessions), signed in with
 * the MIS token, against a fake runner speaking the session protocol: a program that asks
 * for a name and greets you. The MIS users have no Task Mentor account.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const ALICE = 7_800_001;
const BOB = 7_800_002;
let app: ReturnType<typeof buildTestApp>;
let runner: http.Server;
const ENV = { ...process.env };
const runnerCalls: string[] = [];
let runnerFeatures = ["sessions"];

function fakeRunner() {
  const sessions = new Map<string, { res?: http.ServerResponse; input: string[]; waiting?: () => void; deleted?: boolean }>();
  let n = 0;
  return http.createServer((req, res) => {
    runnerCalls.push(`${req.method} ${req.url} ${req.headers.authorization ?? ""}`);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/v1/health") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, features: runnerFeatures }));
      const m = req.url!.match(/^\/v1\/sessions(?:\/([^/]+)(?:\/(\w+))?)?$/);
      if (!m) return res.writeHead(404).end();
      const [, id, action] = m;
      if (!id && req.method === "POST") {
        const sid = `r${++n}`;
        sessions.set(sid, { input: [] });
        res.writeHead(201, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ id: sid }));
      }
      const s = sessions.get(id!);
      if (!s) return res.writeHead(404).end();
      if (action === "events") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        send("stage", { name: "run" });
        send("stdout", { data: "What is your name? " });
        s.waiting = () => {
          send("stdout", { data: `Hello, ${s.input.join("").trim()}!\n` });
          send("exit", { code: 0, signal: null, verdict: "ok", time_ms: 12, memory_kb: 900 });
          res.end();
        };
        return;
      }
      if (action === "stdin") {
        s.input.push(JSON.parse(body).data);
        res.writeHead(204).end();
        return s.waiting?.();
      }
      if (req.method === "DELETE") {
        s.deleted = true;
        return res.writeHead(204).end();
      }
      return res.writeHead(204).end();
    });
  });
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  runner = fakeRunner();
  await new Promise<void>((r) => runner.listen(0, "127.0.0.1", () => r()));
  process.env.CODERUNNER_ENGINE = "tmjudge";
  process.env.TMJUDGE_URL = `http://127.0.0.1:${(runner.address() as any).port}`;
  process.env.TMJUDGE_TOKEN = "runner-secret-token-for-tests-0001";
});
beforeEach(() => {
  runnerFeatures = ["sessions"];
  resetSessions();
  clearMisBearerCache();
  for (const u of [ALICE, BOB]) lessonCodeRunLimiter.resetKey(`lesson-code-run:${u}`);
  mockedGet.mockReset();
  mockedGet.mockImplementation(async (url: string, opts: any) => {
    const auth = opts?.headers?.Authorization;
    if (String(url).endsWith("/auth/verify") && auth === "Bearer alice") return { data: { data: { userId: ALICE } } };
    if (String(url).endsWith("/auth/verify") && auth === "Bearer bob") return { data: { data: { userId: BOB } } };
    throw Object.assign(new Error("unauthorized"), { response: { status: 401 } });
  });
});
afterAll(async () => {
  process.env = ENV;
  runner.close();
  await sequelize.close();
});

const as = (t: string) => (r: request.Test) => r.set("Authorization", `Bearer ${t}`);
const files = [{ path: "main.py", content: 'print(f"Hello, {input(\'What is your name? \')}!")' }];

describe("MIS live runs", () => {
  it("says the runner can run programs live", async () => {
    const res = await as("alice")(request(app).get("/api/integration/code/languages"));
    expect(res.body.data).toMatchObject({ interactive: true });
    runnerFeatures = [];
    resetSessions();
    expect((await as("alice")(request(app).get("/api/integration/code/languages"))).body.data.interactive).toBe(false);
  });

  it("streams the program's output and passes the student's input to it", async () => {
    const start = await as("alice")(request(app).post("/api/integration/code/sessions")).send({ language: "python", entry: "main.py", files });
    expect(start.status).toBe(201);
    const id = start.body.data.id;
    const streamed = as("alice")(request(app).get(`/api/integration/code/sessions/${id}/events`))
      .buffer(true)
      .parse((res, cb) => {
        let text = "";
        res.on("data", (c: Buffer) => (text += c.toString()));
        res.on("end", () => cb(null, text));
      })
      .then((r) => r);
    await new Promise((r) => setTimeout(r, 150));
    expect((await as("alice")(request(app).post(`/api/integration/code/sessions/${id}/input`)).send({ data: "Ada\n" })).status).toBe(204);
    const res = await streamed;
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.headers["x-accel-buffering"]).toBe("no");
    expect(res.body).toContain("What is your name? ");
    expect(res.body).toContain("Hello, Ada!");
    expect(res.body).toContain("event: exit");
  });

  it("keeps a run private to the MIS user who started it, and needs a valid token", async () => {
    const start = await as("alice")(request(app).post("/api/integration/code/sessions")).send({ language: "python", files });
    const id = start.body.data.id;
    expect((await as("bob")(request(app).post(`/api/integration/code/sessions/${id}/input`)).send({ data: "x" })).status).toBe(404);
    expect((await as("bob")(request(app).delete(`/api/integration/code/sessions/${id}`))).status).toBe(404);
    expect((await as("nobody")(request(app).post("/api/integration/code/sessions")).send({ language: "python", files })).status).toBe(401);
    expect((await as("alice")(request(app).delete(`/api/integration/code/sessions/${id}`))).status).toBe(204);
  });

  it("one live run per person: a new one stops the old", async () => {
    await as("alice")(request(app).post("/api/integration/code/sessions")).send({ language: "python", files });
    await as("alice")(request(app).post("/api/integration/code/sessions")).send({ language: "python", files });
    await new Promise((r) => setTimeout(r, 50));
    expect(runnerCalls.filter((c) => c.startsWith("DELETE /v1/sessions/")).length).toBeGreaterThanOrEqual(1);
  });

  it("refuses bad requests and explains when live runs aren't available", async () => {
    expect((await as("alice")(request(app).post("/api/integration/code/sessions")).send({ files: [] })).status).toBe(400);
    expect((await as("alice")(request(app).post("/api/integration/code/sessions")).send({ files: [{ path: "../x.py", content: "" }] })).status).toBe(400);
    runnerFeatures = [];
    resetSessions();
    const res = await as("alice")(request(app).post("/api/integration/code/sessions")).send({ language: "python", files });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INTERACTIVE_UNAVAILABLE");
  });
});
