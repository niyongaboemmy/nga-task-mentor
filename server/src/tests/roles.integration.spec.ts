import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";

/**
 * Integration tests run against the real (dev) database configured via
 * .env — they exercise the actual route/middleware/controller code paths
 * for the security gaps identified in the RBAC audit, using real JWTs for
 * the 3 seeded system roles. Requires migrations to have been run first
 * (`npm run migrate`) so the roles/permissions/role_permissions tables and
 * at least one user per role exist.
 */

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let instructorToken: string;
let studentToken: string;
let studentUserId: number;

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();

  const admin = await findSeededUserByRole("admin");
  const instructor = await findSeededUserByRole("instructor");
  const student = await findSeededUserByRole("student");

  adminToken = signTokenFor(admin.id);
  instructorToken = signTokenFor(instructor.id);
  studentToken = signTokenFor(student.id);
  studentUserId = student.id;
});

afterAll(async () => {
  await sequelize.close();
});

describe("proctoring routes (previously had zero role checks)", () => {
  it("rejects a student from viewing all proctoring sessions for a quiz", async () => {
    const res = await request(app)
      .get("/api/proctoring/quizzes/1/proctoring/sessions")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("allows an instructor to view proctoring sessions for a quiz (route-level gate passes)", async () => {
    const res = await request(app)
      .get("/api/proctoring/quizzes/1/proctoring/sessions")
      .set("Authorization", `Bearer ${instructorToken}`);
    // 200 (possibly empty) or a downstream 404/500 from the controller are
    // both acceptable here — what we're proving is the route-level
    // permission gate does NOT reject with 403 for a privileged role.
    expect(res.status).not.toBe(403);
  });

  it("rejects a student from viewing active live proctoring streams", async () => {
    const res = await request(app)
      .get("/api/proctoring/live-streams")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("allows a student to start their own proctoring session", async () => {
    const res = await request(app)
      .post("/api/proctoring/quizzes/1/proctoring/start")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.status).not.toBe(403);
  });

  it("rejects an instructor from starting a proctoring session via the student-only route", async () => {
    const res = await request(app)
      .post("/api/proctoring/quizzes/1/proctoring/start")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe("users routes (previously had IDOR gaps)", () => {
  it("rejects a student from viewing another user's profile", async () => {
    const res = await request(app)
      .get("/api/users/999999")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("allows a student to view their own profile", async () => {
    const res = await request(app)
      .get(`/api/users/${studentUserId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).not.toBe(403);
  });

  it("allows an admin to view any user's profile", async () => {
    const res = await request(app)
      .get(`/api/users/${studentUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).not.toBe(403);
  });

  it("rejects a student from listing all users", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("allows an admin to list all users (route-level gate passes)", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).not.toBe(403);
  });

  it("rejects a student from viewing another user's assignments", async () => {
    const res = await request(app)
      .get("/api/users/999999/assignments")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});

describe("database admin routes (defense in depth: permission + step-up token)", () => {
  it("rejects a student outright (fails the permission check before step-up is even considered)", async () => {
    const res = await request(app)
      .get("/api/database/tables")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects an instructor outright", async () => {
    const res = await request(app)
      .get("/api/database/tables")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects an admin without the step-up token (permission passes, step-up blocks)", async () => {
    const res = await request(app)
      .get("/api/database/tables")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
  });
});

describe("unauthenticated access", () => {
  it("rejects requests with no token at all", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });
});
