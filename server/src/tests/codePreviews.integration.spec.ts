import crypto from "crypto";
import http from "http";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";
import { refreshJudgeInfo, resetJudgeInfo } from "../services/coderunner/judgeInfo";
import { resetPreviews } from "../services/coderunner/previews";
import { resetSessions } from "../services/coderunner/sessions";

/**
 * Server previews and real terminals (CODE_RUNNER_PLAN.md phase 5) through
 * Task Mentor, against a fake tm-judge with containers.
 */

let app: ReturnType<typeof buildTestApp>;
let token: string;
let otherToken: string;
let userId: number;
let judge: http.Server;
let features = ["run", "projects", "catalog", "sessions", "containers", "pty", "previews"];
const sent: { method: string; url: string; body: any }[] = [];
const ENV = { ...process.env };
const SECRET = "preview-secret-for-tests-0123456789abcdef";

function fakeJudge() {
  let n = 0;
  return http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (status: number, data?: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(data === undefined ? undefined : JSON.stringify(data));
      sent.push({ method: req.method!, url: req.url!, body: body ? JSON.parse(body) : null });
      if (req.url === "/v1/health") return send(200, { ok: true, features });
      if (req.url === "/v1/catalog") return send(200, { kinds: [{ id: "js/express", language: "javascript", label: "Express", actions: ["build", "run"] }] });
      if (req.url === "/v1/previews" && req.method === "POST") return send(201, { id: `pv${++n}` });
      if (req.url === "/v1/sessions" && req.method === "POST") {
        const b = body ? JSON.parse(body) : {};
        if (b.pty && b.language === "c") return send(409, { error: "No terminal for this kind", code: "PTY_UNAVAILABLE" });
        return send(201, { id: `s${++n}` });
      }
      const ev = req.url!.match(/^\/v1\/previews\/([^/]+)\/events$/);
      if (ev) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`event: stage\ndata: {"name":"build"}\n\n`);
        res.write(`event: log\ndata: {"stream":"stdout","data":"listening on 3000\\n"}\n\n`);
        res.end(`event: ready\ndata: {"path":"/"}\n\n`);
        return;
      }
      if (req.method === "DELETE") return send(204);
      send(404);
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
  judge = fakeJudge();
  await new Promise<void>((r) => judge.listen(0, "127.0.0.1", () => r()));
  process.env.CODERUNNER_ENGINE = "tmjudge";
  process.env.TMJUDGE_URL = `http://127.0.0.1:${(judge.address() as any).port}`;
  process.env.TMJUDGE_TOKEN = "runner-secret-token-for-tests-0001";
  process.env.JUDGE_PREVIEW_BASE = "https://preview.example.test/";
  process.env.JUDGE_PREVIEW_SECRET = SECRET;
});
beforeEach(async () => {
  features = ["run", "projects", "catalog", "sessions", "containers", "pty", "previews"];
  sent.length = 0;
  resetPreviews();
  resetSessions();
  resetJudgeInfo();
  await refreshJudgeInfo();
  codeRunLimiter.resetKey(`code-run:${userId}`);
});
afterAll(async () => {
  process.env = ENV;
  resetJudgeInfo();
  judge.close();
  await sequelize.close();
});

const as = (t: string) => (r: request.Test) => r.set("Authorization", `Bearer ${t}`);
const files = [{ path: "server.js", content: "require('http').createServer((q, s) => s.end('hi')).listen(process.env.PORT)" }];

describe("server previews", () => {
  it("are offered with containers, a preview origin and its secret", async () => {
    const caps = await as(token)(request(app).get("/api/code/capabilities"));
    expect(caps.body.data).toMatchObject({ previews: true, pty: true });

    process.env.JUDGE_PREVIEW_SECRET = "short";
    const weak = await as(token)(request(app).get("/api/code/capabilities"));
    expect(weak.body.data.previews).toBe(false);
    process.env.JUDGE_PREVIEW_SECRET = SECRET;
  });

  it("start one and hand out a signed address on the preview origin", async () => {
    const res = await as(token)(request(app).post("/api/code/previews")).send({ language: "javascript", files });
    expect(res.status).toBe(201);
    expect(sent.find((s) => s.url === "/v1/previews")?.body).toMatchObject({ language: "javascript", files });
    const m = String(res.body.data.url).match(/^https:\/\/preview\.example\.test\/p\/pv\d+\/(\d+)\.([\w-]+)\/$/);
    expect(m).not.toBeNull();
    const [, exp, sig] = m!;
    const runnerId = String(res.body.data.url).split("/")[4];
    expect(sig).toBe(crypto.createHmac("sha256", SECRET).update(`${runnerId}.${exp}`).digest("base64url"));
    expect(Number(exp) * 1000).toBeGreaterThan(Date.now() + 14 * 60_000);
  });

  it("relays its logs and readiness, and is private to its owner", async () => {
    const start = await as(token)(request(app).post("/api/code/previews")).send({ files });
    const id = start.body.data.id;
    const events = await as(token)(request(app).get(`/api/code/previews/${id}/events`)).buffer(true).parse((r, cb) => {
      let t = "";
      r.on("data", (c: Buffer) => (t += c.toString()));
      r.on("end", () => cb(null, t));
    });
    expect(events.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(events.body).toContain("listening on 3000");
    expect(events.body).toContain("event: ready");
    // Still running after its output stream ended: a fresh address, then Stop reaches the runner.
    const fresh = await as(token)(request(app).get(`/api/code/previews/${id}/url`));
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.url).toMatch(/^https:\/\/preview\.example\.test\/p\//);
    expect((await as(otherToken)(request(app).get(`/api/code/previews/${id}/url`))).status).toBe(404);
    expect((await as(otherToken)(request(app).delete(`/api/code/previews/${id}`))).status).toBe(404);
    expect((await as(token)(request(app).delete(`/api/code/previews/${id}`))).status).toBe(204);
    expect(sent.some((s) => s.method === "DELETE" && s.url.startsWith("/v1/previews/"))).toBe(true);
  });

  it("a new preview stops the previous one", async () => {
    await as(token)(request(app).post("/api/code/previews")).send({ files });
    await as(token)(request(app).post("/api/code/previews")).send({ files });
    await new Promise((r) => setTimeout(r, 50));
    expect(sent.filter((s) => s.method === "DELETE" && s.url.startsWith("/v1/previews/"))).toHaveLength(1);
  });

  it("explains when previews aren't available (no containers on the runner)", async () => {
    features = ["run", "projects", "catalog", "sessions"];
    resetJudgeInfo();
    await refreshJudgeInfo();
    const res = await as(token)(request(app).post("/api/code/previews")).send({ files });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PREVIEWS_UNAVAILABLE");
  });

  it("refuses paths that leave the project", async () => {
    const res = await as(token)(request(app).post("/api/code/previews")).send({ files: [{ path: "../etc/passwd", content: "" }] });
    expect(res.status).toBe(400);
  });
});

describe("real terminals", () => {
  it("ask the runner for a PTY only when it has one", async () => {
    await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files: [{ path: "main.py", content: "input()" }], pty: true });
    expect(sent.find((s) => s.url === "/v1/sessions")?.body.pty).toBe(true);

    features = ["run", "projects", "catalog", "sessions"];
    resetJudgeInfo();
    await refreshJudgeInfo();
    sent.length = 0;
    codeRunLimiter.resetKey(`code-run:${userId}`);
    await as(token)(request(app).post("/api/code/sessions")).send({ language: "python", files: [{ path: "main.py", content: "input()" }], pty: true });
    expect(sent.find((s) => s.url === "/v1/sessions")?.body.pty).toBeUndefined();
  });

  it("fall back to plain pipes when the language has no terminal (e.g. C)", async () => {
    const res = await as(token)(request(app).post("/api/code/sessions")).send({ language: "c", files: [{ path: "main.c", content: "int main(){}" }], pty: true });
    expect(res.status).toBe(201);
    const starts = sent.filter((s) => s.url === "/v1/sessions");
    expect(starts.map((s) => s.body.pty)).toEqual([true, undefined]);
  });
});
