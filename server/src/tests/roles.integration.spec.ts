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

  it("allows an instructor to list students, returning a hint (not 403/500) when no course is selected", async () => {
    const res = await request(app)
      .get("/api/users?role=student")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it("does not 403 an instructor listing students scoped to a course (permission gate + controller path pass)", async () => {
    const res = await request(app)
      .get("/api/users?role=student&subjectId=1&termId=1")
      .set("Authorization", `Bearer ${instructorToken}`);
    // No MIS token is attached in this harness, so the controller stops at the
    // MIS-auth guard (401) — the point is the RBAC layer let it through.
    expect(res.status).not.toBe(403);
  });

  it("rejects a student from the instructor 'my students' roster", async () => {
    const res = await request(app)
      .get("/api/users/my-students")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("lets an instructor reach the 'my students' roster (RBAC gate passes)", async () => {
    const res = await request(app)
      .get("/api/users/my-students")
      .set("Authorization", `Bearer ${instructorToken}`);
    // No MIS token in this harness → controller stops at the MIS-auth guard;
    // the point is the RBAC layer allowed it through and the route resolved
    // to the roster handler (not the /:id handler).
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(404);
  });

  it("rejects a student from viewing another user's assignments", async () => {
    const res = await request(app)
      .get("/api/users/999999/assignments")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});

describe("assignments — grouped, role-scoped listing", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/assignments/grouped");
    expect(res.status).toBe(401);
  });

  it("scopes a student to 'enrolled'", async () => {
    const res = await request(app)
      .get("/api/assignments/grouped")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("enrolled");
    expect(res.body.data.can_manage).toBe(false);
    expect(Array.isArray(res.body.data.subjects)).toBe(true);
  });

  it("scopes an instructor to 'assigned' and marks them a manager", async () => {
    const res = await request(app)
      .get("/api/assignments/grouped")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("assigned");
    expect(res.body.data.can_manage).toBe(true);
  });

  it("scopes an admin to 'all'", async () => {
    const res = await request(app)
      .get("/api/assignments/grouped")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("all");
  });

  it("returns a bounded page shape", async () => {
    const res = await request(app)
      .get("/api/assignments/grouped?pageSize=5&page=1")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.data.pagination).toMatchObject({ page: 1, page_size: 5 });
    expect(res.body.data.subjects.length).toBeLessThanOrEqual(5);
  });
});

describe("submissions — grouped by subject + type, role-scoped", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/submissions/grouped");
    expect(res.status).toBe(401);
  });

  it("scopes a student to 'enrolled', not a viewer of all", async () => {
    const res = await request(app)
      .get("/api/submissions/grouped")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("enrolled");
    expect(res.body.data.can_view_all).toBe(false);
  });

  it("scopes an instructor to 'assigned' and exposes grading", async () => {
    const res = await request(app)
      .get("/api/submissions/grouped")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("assigned");
    expect(res.body.data.can_view_all).toBe(true);
    expect(res.body.data.can_grade).toBe(true);
  });

  it("scopes an admin to 'all' with a bounded page", async () => {
    const res = await request(app)
      .get("/api/submissions/grouped?pageSize=4")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("all");
    expect(res.body.data.subjects.length).toBeLessThanOrEqual(4);
    expect(res.body.data.pagination.page_size).toBe(4);
  });

  it("each subject section splits assignments and quizzes", async () => {
    const res = await request(app)
      .get("/api/submissions/grouped")
      .set("Authorization", `Bearer ${adminToken}`);
    for (const s of res.body.data.subjects) {
      expect(s).toHaveProperty("assignments.items");
      expect(s).toHaveProperty("quizzes.items");
    }
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
