import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { Permission, Role, RolePermission } from "../models";

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

describe("editing a role (PUT /roles/:id)", () => {
  const put = (id: number, body: object) =>
    request(app)
      .put(`/api/roles-permissions/roles/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);
  const keysOf = async (id: number) => {
    const res = await request(app)
      .get(`/api/roles-permissions/roles/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    return [...res.body.data.permissionKeys].sort();
  };
  /** Snapshot a role's grants straight from the DB, and put them back. */
  const snapshot = async (roleId: number) => {
    const rows = await RolePermission.findAll({ where: { role_id: roleId } });
    const ids = rows.map((r) => r.permission_id);
    return async () => {
      await RolePermission.destroy({ where: { role_id: roleId } });
      await RolePermission.bulkCreate(ids.map((permission_id) => ({ role_id: roleId, permission_id })) as any);
    };
  };

  let tempRoleId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/roles-permissions/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Test Editor ${Date.now()}`, permissionKeys: ["COURSES_VIEW"] });
    tempRoleId = res.body.data.id;
  });

  afterAll(async () => {
    await RolePermission.destroy({ where: { role_id: tempRoleId } });
    await Role.destroy({ where: { id: tempRoleId } });
  });

  it("replaces a role's permission set", async () => {
    const res = await put(tempRoleId, { permissionKeys: ["COURSES_VIEW", "RANKINGS_VIEW_OWN", "RANKINGS_VIEW_OWN"] });
    expect(res.status).toBe(200);
    expect(await keysOf(tempRoleId)).toEqual(["COURSES_VIEW", "RANKINGS_VIEW_OWN"]);
  });

  it("saves the student role with the ranking switched off (the production payload)", async () => {
    const student = await Role.findOne({ where: { name: "student" } });
    const restore = await snapshot(student!.id);
    const permissionKeys = [
      "USERS_VIEW_SELF", "COURSES_VIEW", "COURSES_VIEW_OWN_GRADES", "ASSIGNMENTS_VIEW",
      "SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_CREATE", "QUIZZES_VIEW", "QUIZZES_ATTEMPT",
      "QUIZZES_VIEW_RESULTS_OWN", "QUIZ_QUESTIONS_USE_AI_HINT", "QUIZ_QUESTIONS_RUN_CODE",
      "PROCTORING_START_SESSION", "PROCTORING_VIEW_OWN_SESSIONS", "PROCTORING_LOG_EVENTS",
      "REPORT_CARDS_VIEW_OWN", "REPORT_CARDS_EXPORT_PDF", "DASHBOARD_VIEW_STUDENT", "ACADEMICS_VIEW",
    ];
    try {
      const res = await put(student!.id, {
        name: "student",
        description: "Attempts quizzes/assignments and views own results",
        permissionKeys,
      });
      expect(res.status).toBe(200);
      expect(await keysOf(student!.id)).toEqual([...permissionKeys].sort());
    } finally {
      await restore();
    }
  });

  it("refuses unknown permission keys and leaves the role untouched", async () => {
    const before = await keysOf(tempRoleId);
    const res = await put(tempRoleId, { permissionKeys: ["COURSES_VIEW", "NOT_A_REAL_KEY"] });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("NOT_A_REAL_KEY");
    expect(await keysOf(tempRoleId)).toEqual(before);
  });

  it("refuses to rename a system role", async () => {
    const student = await Role.findOne({ where: { name: "student" } });
    const res = await put(student!.id, { name: "pupil" });
    expect(res.status).toBe(400);
    expect((await Role.findByPk(student!.id))!.name).toBe("student");
  });

  it("lets a role give up Manage Roles & Permissions while someone else keeps it", async () => {
    expect((await put(tempRoleId, { permissionKeys: ["ROLES_PERMISSIONS_MANAGE"] })).status).toBe(200);
    const res = await put(tempRoleId, { permissionKeys: ["COURSES_VIEW"] });
    expect(res.status).toBe(200);
    expect(await keysOf(tempRoleId)).toEqual(["COURSES_VIEW"]);
  });

  it("won't strip Manage Roles & Permissions when only users-less roles would keep it", async () => {
    // The temp role holds MANAGE but nobody is on it: that doesn't count.
    await put(tempRoleId, { permissionKeys: ["ROLES_PERMISSIONS_MANAGE"] });
    const admin = await Role.findOne({ where: { name: "admin" }, include: [Permission] });
    const restore = await snapshot(admin!.id);
    try {
      const others = await Role.findAll({ include: [{ model: Permission, where: { key: "ROLES_PERMISSIONS_MANAGE" } }] });
      const anotherManager = await (await import("../models")).User.count({
        where: { role_id: others.map((r) => r.id).filter((id) => id !== admin!.id) },
      });
      if (anotherManager > 0) return; // the dev DB has another manager; the guard rightly allows it
      const keys = (admin!.permissions ?? []).map((p) => p.key).filter((k) => k !== "ROLES_PERMISSIONS_MANAGE");
      const res = await put(admin!.id, { permissionKeys: keys });
      expect(res.status).toBe(400);
      expect(await keysOf(admin!.id)).toContain("ROLES_PERMISSIONS_MANAGE");
    } finally {
      await restore();
    }
  });
});
