import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { Role } from "../models";

/**
 * Integration tests for the Roles & Permissions management module, run
 * against the real (dev) database. Covers the full admin round trip:
 * list catalog -> create custom role -> assign permissions -> assign to a
 * user -> verify effect -> clean up (delete role after reassigning the user
 * back), plus the guardrails (system-role delete block, non-admin access).
 */

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let studentToken: string;
let studentUserId: number;
let studentOriginalRoleId: number | null;
let createdRoleId: number | undefined;

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();

  const admin = await findSeededUserByRole("admin");
  const student = await findSeededUserByRole("student");

  adminToken = signTokenFor(admin.id);
  studentToken = signTokenFor(student.id);
  studentUserId = student.id;
  studentOriginalRoleId = student.role_id ?? null;
});

afterAll(async () => {
  // Clean up: restore the test student's original role, then remove the
  // custom role this suite created so re-runs stay idempotent.
  if (studentOriginalRoleId) {
    await request(app)
      .put(`/api/roles-permissions/users/${studentUserId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ roleId: studentOriginalRoleId });
  }
  if (createdRoleId) {
    await request(app)
      .delete(`/api/roles-permissions/roles/${createdRoleId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  }
  await sequelize.close();
});

describe("access control on the roles-permissions module itself", () => {
  it("rejects a student from viewing the permission catalog", async () => {
    const res = await request(app)
      .get("/api/roles-permissions/permissions")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects a student from listing roles", async () => {
    const res = await request(app)
      .get("/api/roles-permissions/roles")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("allows an admin to view the permission catalog grouped by category", async () => {
    const res = await request(app)
      .get("/api/roles-permissions/permissions")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("PROCTORING");
    expect(Array.isArray(res.body.data.PROCTORING)).toBe(true);
  });
});

describe("system role guardrails", () => {
  it("blocks deleting a system role (admin/instructor/student)", async () => {
    const adminRole = await Role.findOne({ where: { name: "admin" } });
    const res = await request(app)
      .delete(`/api/roles-permissions/roles/${adminRole!.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe("full round trip: create role -> assign permission -> assign to user -> verify", () => {
  it("creates a custom role with one permission", async () => {
    const res = await request(app)
      .post("/api/roles-permissions/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Test Auditor ${Date.now()}`,
        description: "Read-only auditor role created by integration test",
        permissionKeys: ["ROLES_PERMISSIONS_VIEW"],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdRoleId = res.body.data.id;
  });

  it("assigns the new role to the test student", async () => {
    const res = await request(app)
      .put(`/api/roles-permissions/users/${studentUserId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ roleId: createdRoleId });

    expect(res.status).toBe(200);
  });

  it("reflects the new role's permission on the user's next auth check", async () => {
    // Re-sign a token for the same user id — protect() resolves permissions
    // fresh from the DB on every request via the user's current role_id, so
    // a newly-issued token immediately reflects the reassignment.
    const freshToken = signTokenFor(studentUserId);

    // The auditor role only grants ROLES_PERMISSIONS_VIEW, not MANAGE — so
    // it can list roles (view) but cannot create another one (manage).
    const viewRes = await request(app)
      .get("/api/roles-permissions/roles")
      .set("Authorization", `Bearer ${freshToken}`);
    expect(viewRes.status).toBe(200);

    const manageRes = await request(app)
      .post("/api/roles-permissions/roles")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({ name: "Should Not Be Created", permissionKeys: [] });
    expect(manageRes.status).toBe(403);

    // And the permissions this user used to have as a student (e.g.
    // attempting quizzes) are gone now that they hold a different role.
    const proctoringRes = await request(app)
      .post("/api/proctoring/quizzes/1/proctoring/start")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({});
    expect(proctoringRes.status).toBe(403);
  });

  it("blocks deleting the role while still assigned to a user", async () => {
    const res = await request(app)
      .delete(`/api/roles-permissions/roles/${createdRoleId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
