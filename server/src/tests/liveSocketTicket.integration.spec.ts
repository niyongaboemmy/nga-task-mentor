import request from "supertest";
import jwt from "jsonwebtoken";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import {
  LIVE_TICKET_TYPE,
  liveTicketSecret,
  signLiveSocketTicket,
} from "../utils/liveSocketTicket";

/**
 * GET /api/proctoring/live-ticket issues the short-lived ticket the browser
 * presents to the live proctoring socket server (live-server/). The proctor
 * bit must come from the user's resolved permissions, and a ticket must never
 * be accepted as a normal session token by this API.
 */

let app: ReturnType<typeof buildTestApp>;
let admin: { id: number };
let student: { id: number };

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  admin = await findSeededUserByRole("admin");
  student = await findSeededUserByRole("student");
});

afterAll(async () => {
  await sequelize.close();
});

const decodeTicket = (ticket: string) =>
  jwt.verify(ticket, liveTicketSecret(process.env.JWT_SECRET!)) as jwt.JwtPayload;

describe("GET /api/proctoring/live-ticket", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/proctoring/live-ticket");
    expect(res.status).toBe(401);
  });

  it("issues a proctor ticket to a user holding the live-stream permissions", async () => {
    const res = await request(app)
      .get("/api/proctoring/live-ticket")
      .set("Authorization", `Bearer ${signTokenFor(admin.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.proctor).toBe(true);
    const payload = decodeTicket(res.body.ticket);
    expect(payload).toMatchObject({ typ: LIVE_TICKET_TYPE, id: admin.id, proctor: true });
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(120);
  });

  it("issues a non-proctor ticket to a student", async () => {
    const res = await request(app)
      .get("/api/proctoring/live-ticket")
      .set("Authorization", `Bearer ${signTokenFor(student.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.proctor).toBe(false);
    expect(decodeTicket(res.body.ticket)).toMatchObject({ id: student.id, proctor: false });
  });

  it("cannot be replayed as a session token against the API", async () => {
    const { ticket } = signLiveSocketTicket({
      id: admin.id,
      permissions: new Set(["PROCTORING_JOIN_LIVE_STREAM"]),
    });
    const res = await request(app)
      .get("/api/proctoring/live-ticket")
      .set("Authorization", `Bearer ${ticket}`);
    expect(res.status).toBe(401);
  });
});
