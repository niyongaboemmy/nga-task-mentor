/**
 * End-to-end tests of the live proctoring server's socket authentication,
 * using a real Socket.IO server (src/index.ts on an ephemeral port) and real
 * socket.io-client connections.
 */
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { LIVE_TICKET_TYPE, liveTicketSecret } from "../src/socketAuth";

const SECRET = "integration-test-secret";
process.env.JWT_SECRET = SECRET;
process.env.LIVE_SERVER_NO_LISTEN = "1";
process.env.CORS_ORIGIN = "http://localhost:5174";

// eslint-disable-next-line @typescript-eslint/no-var-requires
let live: typeof import("../src/index");
let url: string;
const openSockets: ClientSocket[] = [];

const sessionJwt = (id: number, role = "student") =>
  jwt.sign({ id, role }, SECRET, { expiresIn: "1h" });
const liveTicket = (id: number, proctor: boolean) =>
  jwt.sign({ typ: LIVE_TICKET_TYPE, id, proctor }, liveTicketSecret(SECRET), {
    expiresIn: 120,
  });

const connect = (auth?: Record<string, unknown>): ClientSocket => {
  const s = ioClient(url, {
    auth,
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
  openSockets.push(s);
  return s;
};

const waitFor = <T = any>(s: ClientSocket, event: string, ms = 2000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    s.once(event as any, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });

const connected = async (s: ClientSocket) => {
  if (!s.connected) await waitFor(s, "connect");
  return s;
};

/** Resolves true if `event` arrives within `ms`, false otherwise. */
const receives = (s: ClientSocket, event: string, ms = 300) =>
  new Promise<boolean>((resolve) => {
    const handler = () => {
      clearTimeout(t);
      resolve(true);
    };
    const t = setTimeout(() => {
      s.off(event as any, handler);
      resolve(false);
    }, ms);
    s.once(event as any, handler);
  });

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  live = require("../src/index");
  await new Promise<void>((resolve) => live.httpServer.listen(0, resolve));
  const { port } = live.httpServer.address() as AddressInfo;
  url = `http://127.0.0.1:${port}`;
});

afterEach(() => {
  while (openSockets.length) openSockets.pop()!.disconnect();
  live.activeProctoringStreams.clear();
});

afterAll(async () => {
  live.io.close();
  await new Promise<void>((resolve) => live.httpServer.close(() => resolve()));
  jest.restoreAllMocks();
});

describe("socket handshake authentication", () => {
  it("rejects a connection without a token", async () => {
    const err = await waitFor<Error>(connect(), "connect_error");
    expect(err.message).toBe("Authentication required");
  });

  it("rejects a connection with a forged/invalid token", async () => {
    const forged = jwt.sign({ id: 1 }, "not-the-secret");
    const err = await waitFor<Error>(connect({ token: forged }), "connect_error");
    expect(err.message).toBe("Invalid token");
  });

  it("accepts a valid session JWT", async () => {
    const s = await connected(connect({ token: sessionJwt(42) }));
    expect(s.connected).toBe(true);
  });

  it("accepts the tm_auth_token cookie when no auth.token is sent", async () => {
    const s = ioClient(url, {
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      extraHeaders: { cookie: `tm_auth_token=${sessionJwt(43)}` },
    });
    openSockets.push(s);
    await connected(s);
    expect(s.connected).toBe(true);
  });

  it("takes the user id from the token, not the client payload", async () => {
    const host = await connected(connect({ token: sessionJwt(10) }));
    const created: any = await host.emitWithAck("create-room", {
      roomName: "r",
      username: "host",
    });
    const guest = await connected(connect({ token: sessionJwt(42) }));
    const joined: any = await guest.emitWithAck("join-room", {
      roomId: created.roomId,
      userId: "999", // spoofed — must be ignored
      username: "guest",
      role: "participant",
    });
    expect(joined.success).toBe(true);
    const me = joined.room.clients.find((c: any) => c.id === joined.clientId);
    expect(me.userId).toBe("42");
  });

  it("records the verified user id on the student's stream", async () => {
    const proctor = await connected(connect({ token: liveTicket(1, true) }));
    const student = await connected(connect({ token: sessionJwt(55) }));
    const started = waitFor(proctor, "stream-started");
    student.emit("student-stream-started", {
      sessionToken: "sess-id",
      studentInfo: { id: 999, first_name: "Spoof" },
      quizInfo: { id: 1, title: "Q" },
    });
    await started;
    expect(live.activeProctoringStreams.get("sess-id").studentUserId).toBe(55);
  });
});

describe("proctor vs student decided from the verified identity", () => {
  it("denies a session-JWT socket joining as dashboard, even if its JWT claims admin", async () => {
    const s = await connected(connect({ token: sessionJwt(42, "admin") }));
    const denied = waitFor<any>(s, "proctoring-auth-error");
    s.emit("join-proctoring-session", { sessionToken: "abc", role: "dashboard" });
    expect((await denied).event).toBe("join-proctoring-session");
  });

  it("lets a proctor ticket join as dashboard and notifies the student", async () => {
    const student = await connected(connect({ token: sessionJwt(55) }));
    student.emit("join-proctoring-session", { sessionToken: "s1", role: "student" });
    const proctor = await connected(connect({ token: liveTicket(1, true) }));
    const notified = waitFor(student, "dashboard-reconnected");
    proctor.emit("join-proctoring-session", { sessionToken: "s1", role: "dashboard" });
    await expect(notified).resolves.toMatchObject({ sessionToken: "s1" });
  });

  it("drops proctor-only commands from a student but relays them from a proctor", async () => {
    const victim = await connected(connect({ token: sessionJwt(55) }));
    victim.emit("join-proctoring-session", { sessionToken: "s2", role: "student" });
    const attacker = await connected(connect({ token: sessionJwt(56) }));
    attacker.emit("join-proctoring-session", { sessionToken: "s2", role: "student" });
    await new Promise((r) => setTimeout(r, 50));

    const blocked = waitFor<any>(attacker, "proctoring-auth-error");
    const victimPaused = receives(victim, "pause-student-exam");
    attacker.emit("pause-student-exam", { sessionToken: "s2", reason: "x" });
    expect((await blocked).event).toBe("pause-student-exam");
    expect(await victimPaused).toBe(false);

    const proctor = await connected(connect({ token: liveTicket(1, true) }));
    proctor.emit("join-proctoring-session", { sessionToken: "s2", role: "dashboard" });
    await new Promise((r) => setTimeout(r, 50));
    const paused = waitFor<any>(victim, "pause-student-exam");
    proctor.emit("pause-student-exam", { sessionToken: "s2", reason: "by proctor" });
    await expect(paused).resolves.toMatchObject({ reason: "by proctor" });
  });

  it("sends global stream broadcasts to proctors only", async () => {
    const proctor = await connected(connect({ token: liveTicket(1, true) }));
    const bystander = await connected(connect({ token: sessionJwt(77) }));
    const student = await connected(connect({ token: sessionJwt(55) }));

    const proctorGot = waitFor(proctor, "stream-started");
    const bystanderGot = receives(bystander, "stream-started");
    student.emit("student-stream-started", {
      sessionToken: "s3",
      studentInfo: { first_name: "A" },
      quizInfo: { title: "Q" },
    });
    await expect(proctorGot).resolves.toMatchObject({ sessionToken: "s3" });
    expect(await bystanderGot).toBe(false);
  });

  it("only answers get-active-streams for proctors", async () => {
    const student = await connected(connect({ token: sessionJwt(55) }));
    const studentGot = receives(student, "active-streams");
    student.emit("get-active-streams");
    expect(await studentGot).toBe(false);

    const proctor = await connected(connect({ token: liveTicket(1, true) }));
    const list = waitFor<any[]>(proctor, "active-streams");
    proctor.emit("get-active-streams");
    expect(Array.isArray(await list)).toBe(true);
  });
});

describe("HTTP endpoints", () => {
  it("requires a proctor ticket for /proctoring/streams", async () => {
    expect((await fetch(`${url}/proctoring/streams`)).status).toBe(401);
    expect(
      (
        await fetch(`${url}/proctoring/streams`, {
          headers: { Authorization: `Bearer ${sessionJwt(55)}` },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(`${url}/proctoring/streams`, {
          headers: { Authorization: `Bearer ${liveTicket(1, true)}` },
        })
      ).status,
    ).toBe(200);
  });

  it("requires any valid token for /turn-credentials and keeps /health public", async () => {
    expect((await fetch(`${url}/turn-credentials`)).status).toBe(401);
    expect((await fetch(`${url}/health`)).status).toBe(200);
  });

  it("only reflects configured CORS origins", async () => {
    const ok = await fetch(`${url}/health`, { headers: { Origin: "http://localhost:5174" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5174");
    const bad = await fetch(`${url}/health`, { headers: { Origin: "https://evil.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });
});
