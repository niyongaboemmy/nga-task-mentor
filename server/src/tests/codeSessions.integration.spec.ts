import http from "http";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { resetSessions } from "../services/coderunner/sessions";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";

/**
 * Interactive runs through Task Mentor (CODE_RUNNER_PLAN.md §16), against a
 * fake runner speaking the session protocol: a program that asks for a name
 * and greets you.
 */

let app: ReturnType<typeof buildTestApp>;
let token: string;
let otherToken: string;
let userId: number;
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
  const student = await findSeededUserByRole("student");
  userId = student.id;
  token = signTokenFor(student.id);
  otherToken = signTokenFor((await findSeededUserByRole("instructor")).id);
  runner = fakeRunner();
  await new Promise<void>((r) => runner.listen(0, "127.0.0.1", () => r()));
  const port = (runner.address() as any).port;
  process.env.CODERUNNER_ENGINE = "tmjudge";
  process.env.TMJUDGE_URL = `http://127.0.0.1:${port}`;
  process.env.TMJUDGE_TOKEN = "runner-secret-token-for-tests-0001";
});
beforeEach(() => {
  runnerFeatures = ["sessions"];
  resetSessions();
  codeRunLimiter.resetKey(`code-run:${userId}`);
});
afterAll(async () => {
  process.env = ENV;
  runner.close();
  await sequelize.close();
});

const as = (t: string) => (r: request.Test) => r.set("Authorization", `Bearer ${t}`);
const files = [{ path: "main.py", content: 'print(f"Hello, {input(\'What is your name? \')}!")' }];

describe("interactive runs", () => {
  it("reports whether interactive runs are available", async () => {
    const res = await as(token)(request(app).get("/api/code/capabilities"));
    expect(res.body.data).toEqual({ interactive: true });
  });

  it("streams the program's output and passes the student's input to it", async () => {
    const start = await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files });
    expect(start.status).toBe(201);
    const id = start.body.data.id;
    expect(runnerCalls.some((c) => c.startsWith("POST /v1/sessions ") && c.endsWith("Bearer runner-secret-token-for-tests-0001"))).toBe(true);

    const events = as(token)(request(app).get(`/api/code/sessions/${id}/events`)).buffer(true).parse((res, cb) => {
      let text = "";
      res.on("data", (c: Buffer) => (text += c.toString()));
      res.on("end", () => cb(null, text));
    });
    const streamed = events.then((r) => r);
    await new Promise((r) => setTimeout(r, 150));
    const input = await as(token)(request(app).post(`/api/code/sessions/${id}/input`)).send({ data: "Ada\n" });
    expect(input.status).toBe(204);
    const res = await streamed;
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.body).toContain("What is your name? ");
    expect(res.body).toContain("Hello, Ada!");
    expect(res.body).toContain("event: exit");
  });

  it("a run is private to the person who started it", async () => {
    const start = await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files });
    const other = await as(otherToken)(request(app).post(`/api/code/sessions/${start.body.data.id}/input`)).send({ data: "x" });
    expect(other.status).toBe(404);
  });

  it("starting a new run stops the previous one", async () => {
    runnerCalls.length = 0;
    await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files });
    await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files });
    await new Promise((r) => setTimeout(r, 50));
    expect(runnerCalls.filter((c) => c.startsWith("DELETE /v1/sessions/"))).toHaveLength(1);
  });

  it("explains when interactive runs aren't available (Judge0)", async () => {
    process.env.CODERUNNER_ENGINE = "judge0";
    const res = await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INTERACTIVE_UNAVAILABLE");
    process.env.CODERUNNER_ENGINE = "tmjudge";
  });

  it("keeps the batch Run when the runner is older and has no sessions", async () => {
    runnerFeatures = [];
    const caps = await as(token)(request(app).get("/api/code/capabilities"));
    expect(caps.body.data).toEqual({ interactive: false });
    const res = await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INTERACTIVE_UNAVAILABLE");
  });
});
