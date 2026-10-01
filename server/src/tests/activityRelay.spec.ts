import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import zlib from "zlib";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createActivityRelay } from "../vendor/nga-activity-relay/relay";
import { createActivityRouter } from "../routes/activity";
import { createMisUserIdResolver } from "../activity/session";
import { activityRelay, buildActivityRelay } from "../activity/relay";
import { trackOnSuccess } from "../activity/keyEvents";
import catalog from "../activity/catalog.json";

/**
 * Platform usage analytics relay (nga_central_mis USAGE_ANALYTICS_IMPLEMENTATION_PLAN.md §5.2):
 * POST /api/activity stamps the Task Mentor session's MIS user id, drops anonymous
 * traffic from foreign origins, and is a no-op when MIS isn't configured.
 * No database: the users table and session_revocations are faked.
 */
const SECRET = "activity-test-secret";
const SPA = "https://taskmentor.amashuri.com";
const DID = "AAAAAAAAAAAAAAAAAAAAAA";

// Local user 7 is MIS user 412; local 8 has no MIS id; local 9 signed out of MIS.
const users: Record<number, number | null> = { 7: 412, 8: null, 9: 413 };
const revoked: Record<number, Date> = { 9: new Date(Date.now() + 60_000) };
const getUserId = createMisUserIdResolver({
  secret: SECRET,
  findMisUserId: async (id) => (id in users ? users[id] : undefined),
  revokedAt: async (id) => revoked[id] ?? null,
});

type Sent = { url: string; body: any };
let sent: Sent[] = [];
const fetchImpl = jest.fn(async (url: string, init: any) => {
  const raw = init?.body ? zlib.gunzipSync(init.body).toString() : "null";
  sent.push({ url, body: JSON.parse(raw) });
  return new Response(JSON.stringify({ accepted: 1, commands: [] }), { status: 202 });
}) as any;

const makeRelay = () =>
  createActivityRelay({
    app: "tm",
    misBaseUrl: "https://api.example",
    clientId: "taskmentor_app",
    clientSecret: "s3cret",
    origins: [SPA],
    getUserId,
    flushMs: 60_000,
    fetchImpl,
    logger: { warn: () => undefined, error: () => undefined },
  });

const appWith = (relay: ReturnType<typeof makeRelay>) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use("/api/activity", createActivityRouter(relay));
  return app;
};

const envelope = (extra: Record<string, unknown> = {}) => ({
  v: 1,
  app: "tm",
  did: DID,
  tab: "t1",
  sent_at: Date.now(),
  events: [{ id: "01J00000000000000000000000", n: "page_view", t: Date.now(), r: "/dashboard", f: "tm.dashboard" }],
  ...extra,
});
const tokenFor = (id: number, opts: jwt.SignOptions = { expiresIn: 3600 }) => jwt.sign({ id, role: "student" }, SECRET, opts);

beforeEach(() => {
  sent = [];
  fetchImpl.mockClear();
});

describe("POST /api/activity", () => {
  it("stamps the session's MIS user id (not the local id), ignoring any user_id in the body", async () => {
    const relay = makeRelay();
    const res = await request(appWith(relay))
      .post("/api/activity")
      .set("Authorization", `Bearer ${tokenFor(7)}`)
      .set("X-Forwarded-For", "102.22.1.9")
      .send({ ...envelope(), user_id: 999 });
    expect(res.status).toBe(204);
    await relay.flush();
    expect(sent[0].url).toBe("https://api.example/activity/ingest");
    expect(sent[0].body.app).toBe("tm");
    expect(sent[0].body.batches[0]).toMatchObject({ user_id: 412, ip: "102.22.1.9" });
    expect(sent[0].body.batches[0].envelope.user_id).toBeUndefined();
    await relay.stop();
  });

  it("reads the session from the tm_auth_token cookie too, and accepts a text/plain beacon", async () => {
    const relay = makeRelay();
    const app = express();
    app.use((req, _res, next) => {
      // cookie-parser's job in index.ts
      const m = String(req.headers.cookie || "").match(/tm_auth_token=([^;]+)/);
      (req as any).cookies = m ? { tm_auth_token: m[1] } : {};
      next();
    });
    app.use("/api/activity", createActivityRouter(relay));
    const res = await request(app)
      .post("/api/activity")
      .set("Cookie", `tm_auth_token=${tokenFor(7)}`)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify(envelope()));
    expect(res.status).toBe(204);
    await relay.flush();
    expect(sent[0].body.batches[0].user_id).toBe(412);
    await relay.stop();
  });

  it("treats an invalid, expired, revoked or MIS-less session as a visitor, never a 401", async () => {
    const relay = makeRelay();
    const app = appWith(relay);
    const tokens = [
      "garbage",
      jwt.sign({ id: 7 }, "another-secret"),
      tokenFor(7, { expiresIn: -10 }),
      tokenFor(9), // signed out of NGA after this token was issued
      tokenFor(8), // no MIS id on record
      tokenFor(404), // user no longer exists
    ];
    for (const t of tokens) {
      const res = await request(app).post("/api/activity").set("Authorization", `Bearer ${t}`).set("Origin", SPA).send(envelope());
      expect(res.status).toBe(204);
    }
    await relay.flush();
    expect(sent[0].body.batches).toHaveLength(tokens.length);
    expect(sent[0].body.batches.every((b: any) => b.user_id === null)).toBe(true);
    await relay.stop();
  });

  it("drops anonymous batches from a foreign or missing Origin, keeps the SPA's", async () => {
    const relay = makeRelay();
    const app = appWith(relay);
    await request(app).post("/api/activity").set("Origin", "https://evil.example").send(envelope()).expect(204);
    await request(app).post("/api/activity").send(envelope()).expect(204);
    expect(relay._queue().batches).toBe(0);
    await request(app).post("/api/activity").set("Origin", SPA).send(envelope()).expect(204);
    expect(relay._queue().batches).toBe(1);
    await relay.stop();
  });

  it("answers 204 to a malformed or oversized body instead of an error", async () => {
    const relay = makeRelay();
    const app = appWith(relay);
    await request(app).post("/api/activity").set("Content-Type", "application/json").send("{nope").expect(204);
    await request(app)
      .post("/api/activity")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(envelope({ pad: "x".repeat(300 * 1024) })))
      .expect(204);
    expect(relay._queue().batches).toBe(0);
    await relay.stop();
  });
});

describe("without MIS configured", () => {
  it("is a no-op: POST answers 204 and config says disabled", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const relay = buildActivityRelay({ NGA_MIS_BASE_URL: "", SSO_CLIENT_ID: "taskmentor_app" });
    const app = appWith(relay as any);
    await request(app).post("/api/activity").set("Authorization", `Bearer ${tokenFor(7)}`).send(envelope()).expect(204);
    const cfg = await request(app).get("/api/activity/config?did=x").expect(200);
    expect(cfg.body).toEqual({ enabled: false, v: 1 });
    expect(relay._queue()).toEqual({ batches: 0, serverEvents: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("server-side key events", () => {
  const app = (status: number) => {
    const a = express();
    a.use((req, _res, next) => {
      (req as any).user = { id: 7, mis_user_id: 412 };
      next();
    });
    a.post(
      "/quizzes/:id/submit",
      trackOnSuccess("tm.quiz.submit", (req) => ({ quiz_id: Number(req.params.id) })),
      (_req, res) => res.status(status).json({}),
    );
    return a;
  };

  it("records the event with the MIS user id and the shared device id, only on success", async () => {
    const track = jest.spyOn(activityRelay, "track");
    const deviceIdOf = jest.spyOn(activityRelay, "deviceIdOf").mockReturnValue(DID);
    await request(app(200)).post("/quizzes/31/submit").expect(200);
    await request(app(400)).post("/quizzes/32/submit").expect(400);
    await new Promise((r) => setImmediate(r));
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(412, DID, "tm.quiz.submit", { quiz_id: 31 }, expect.anything());
    track.mockRestore();
    deviceIdOf.mockRestore();
  });

  it("every key event recorded on the server is in the catalog as a key event", () => {
    const keyEvents = catalog.features.filter((f: any) => f.key_event).map((f) => f.key).sort();
    expect(keyEvents).toEqual(["tm.assignment.submit", "tm.grade.save", "tm.question.generate", "tm.quiz.submit"]);
    const src = ["routes/quizzes.ts", "routes/assignments.ts", "routes/submissions.ts", "routes/manualAssessments.ts", "controllers/aiQuestionGeneration.controller.ts", "controllers/questionBank.controller.ts"]
      .map((f) => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8"))
      .join("\n");
    const used = [...new Set([...src.matchAll(/"(tm\.[a-z_.]+)"/g)].map((m) => m[1]))].sort();
    expect(used).toEqual(keyEvents);
  });
});

describe("vendored relay", () => {
  it("matches its provenance hash (re-sync with nga_central_mis/packages/activity/sync.mjs --relay)", () => {
    const text = fs.readFileSync(path.resolve(__dirname, "../vendor/nga-activity-relay/relay.ts"), "utf8");
    const [, , shaLine, ...rest] = text.split("\n");
    expect(shaLine).toBe(`// sha256:${crypto.createHash("sha256").update(rest.join("\n")).digest("hex")}`);
  });
});
