import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { Op } from "sequelize";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Permission, Quiz, Role, RolePermission, User } from "../models";
import { fetchEnrolledStudents } from "../utils/misUtils";
import { filterActiveMisRows, inactiveLocalIds } from "../utils/activeUsers";
import { ReminderRequest, setReminderTransport } from "../services/reminderSync";
import { clearJobRun, getLastSuccess } from "../services/earlyWarningPush";
import { JOB_NAME, recheckMisStatus, runMisStatusSweep } from "../services/misStatusSweep";
import { upsertMisUser } from "../services/misUserSync";

/**
 * Active users only (ACTIVE_USERS_CONTRACTS.md, "Task Mentor") against the
 * real dev DB with MIS mocked: the roster chokepoint, the quiz student list
 * (no local account made for an inactive student), admin AI search, the
 * Manage-Roles lockout guard, and the MIS status sweep (incl. REMOVED and
 * its refusal guard). Fixture users use MIS ids no real user has and are
 * removed afterwards; the sweep's writes to existing users are put back.
 * Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990801;
const MIS_ACTIVE = 990811;
const MIS_LOCAL_INACTIVE = 990812; // MIS row looks active; local mis_status says INACTIVE
const MIS_ROW_INACTIVE = 990813; // MIS row carries status INACTIVE, no local account
const MIS_NEW = 990814; // active, no local account yet
const MIS_GONE = 990815; // local account MIS no longer returns
const MIS_HEADER = { "x-mis-token": "test-mis-token" };
const ENV = { ...process.env };
jest.setTimeout(60_000);

let app: ReturnType<typeof buildTestApp>;
let admin: User;
let instructor: User;
let active: User;
let localInactive: User;
let gone: User;
let quizId: number;
const createdUserIds: number[] = [];

const ok = (data: unknown) => ({ data: { success: true, data } });
const rosterRows = () => [
  { user_id: MIS_ACTIVE, first_name: "Active", last_name: RUN, email: `au.active.${RUN}@local.test` },
  { user_id: MIS_LOCAL_INACTIVE, first_name: "LocalInactive", last_name: RUN, email: `au.li.${RUN}@local.test` },
  { user_id: MIS_ROW_INACTIVE, first_name: "RowInactive", last_name: RUN, email: `au.ri.${RUN}@local.test`, status: "INACTIVE" },
  { user_id: MIS_NEW, first_name: "New", last_name: RUN, email: `au.new.${RUN}@local.test` },
];
let rosterDown = false;

function mockMis() {
  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes(`/academics/subjects/${SUBJ}/terms/`)) {
      if (rosterDown) throw Object.assign(new Error("MIS down"), { response: { status: 502 } });
      return ok(rosterRows());
    }
    return ok([]);
  });
}

const mkUser = async (label: string, misId: number, extra: Record<string, unknown> = {}) => {
  const u = await User.create({
    email: `au.${label}.${RUN}@local.test`,
    password: "MIS_AUTH",
    first_name: `AU${label}`,
    last_name: RUN,
    role: "student",
    mis_user_id: misId,
    ...extra,
  } as any);
  createdUserIds.push(u.id);
  return u;
};

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  admin = await findSeededUserByRole("admin");
  instructor = await findSeededUserByRole("instructor");
  // Leftovers of an aborted run.
  await User.destroy({ where: { mis_user_id: { [Op.between]: [990811, 990829] } } as any });
  const studentRole = await Role.findOne({ where: { name: "student" } });
  active = await mkUser("active", MIS_ACTIVE, { role_id: studentRole?.id ?? null, mis_status: "ACTIVE" });
  localInactive = await mkUser("li", MIS_LOCAL_INACTIVE, { role_id: studentRole?.id ?? null, mis_status: "INACTIVE" });
  gone = await mkUser("gone", MIS_GONE, { role_id: studentRole?.id ?? null });
  const quiz = await Quiz.create({
    title: `Active users ${RUN}`,
    description: "activeUsers.integration.spec.ts",
    course_id: SUBJ,
    created_by: instructor.id,
    status: "published",
    type: "Quiz",
    enable_automatic_grading: true,
    require_manual_grading: false,
    passing_score: 50,
  } as any);
  quizId = quiz.id;
});

beforeEach(() => {
  rosterDown = false;
  mockMis();
});

afterAll(async () => {
  process.env = ENV;
  setReminderTransport(null);
  if (quizId) await Quiz.destroy({ where: { id: quizId } });
  await User.destroy({ where: { mis_user_id: { [Op.between]: [990811, 990829] } } as any });
  await User.destroy({ where: { id: { [Op.in]: createdUserIds } } });
  await clearJobRun(JOB_NAME).catch(() => undefined);
  await sequelize.close();
});

describe("SSO sign-in (upsertMisUser)", () => {
  it("stores the MIS status from the payload, and ACTIVE when MIS sends none", async () => {
    const info = { user_id: 990821, email: `au.sso.${RUN}@local.test`, username: "sso" };
    const { user, created } = await upsertMisUser({ ...info, status: "suspended" }, { first_name: "Sso", last_name: RUN }, []);
    createdUserIds.push(user.id);
    expect(created).toBe(true);
    expect(user.mis_status).toBe("SUSPENDED");
    const again = await upsertMisUser(info, null, []);
    expect(again.user.id).toBe(user.id);
    expect((await User.findByPk(user.id))!.mis_status).toBe("ACTIVE");
  });
});

describe("roster chokepoint", () => {
  it("filterActiveMisRows drops rows inactive in MIS or locally, keeps the rest in order", async () => {
    const rows = await filterActiveMisRows(rosterRows());
    expect(rows.map((r) => r.user_id)).toEqual([MIS_ACTIVE, MIS_NEW]);
  });

  it("fetchEnrolledStudents returns active students only", async () => {
    const rows = await fetchEnrolledStudents("tok", SUBJ, 1);
    expect(rows.map((r: any) => r.user_id)).toEqual([MIS_ACTIVE, MIS_NEW]);
  });

  it("inactiveLocalIds knows the local inactive account", async () => {
    const off = await inactiveLocalIds([active.id, localInactive.id, gone.id]);
    expect([...off]).toEqual([localInactive.id]);
  });
});

describe("GET /api/quizzes/:quizId/students", () => {
  const get = () =>
    request(app)
      .get(`/api/quizzes/${quizId}/students`)
      .set("Authorization", `Bearer ${signTokenFor(admin.id)}`)
      .set(MIS_HEADER);

  it("lists active students and never creates an account for an inactive one", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: any) => r.name);
    // The local account's name wins over the roster's (existing behaviour).
    expect(names).toEqual(expect.arrayContaining([`AUactive ${RUN}`, `New ${RUN}`]));
    expect(names.some((n: string) => /^(AUli|LocalInactive|RowInactive)/.test(n))).toBe(false);
    expect(await User.count({ where: { mis_user_id: MIS_ROW_INACTIVE } })).toBe(0);
    // The active newcomer did get a local account (existing behaviour).
    const created = await User.findOne({ where: { mis_user_id: MIS_NEW } });
    expect(created).not.toBeNull();
    createdUserIds.push(created!.id);
  });

  it("falls back to active local accounts only when MIS is down", async () => {
    rosterDown = true;
    const res = await request(app)
      .get(`/api/quizzes/${quizId}/students?search=${RUN}`)
      .set("Authorization", `Bearer ${signTokenFor(admin.id)}`)
      .set(MIS_HEADER);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r: any) => r.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(localInactive.id);
  });
});

describe("GET /api/admin/ai/users", () => {
  it("does not offer an inactive account", async () => {
    const res = await request(app)
      .get(`/api/admin/ai/users?q=${RUN}`)
      .set("Authorization", `Bearer ${signTokenFor(admin.id)}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.users.map((u: any) => u.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(localInactive.id);
  });

  it("refuses premium for an inactive account", async () => {
    const res = await request(app)
      .put(`/api/admin/ai/entitlements/${localInactive.id}`)
      .set("Authorization", `Bearer ${signTokenFor(admin.id)}`)
      .send({ premium: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("USER_INACTIVE");
  });
});

describe("Manage Roles & Permissions lockout guard", () => {
  const put = (id: number, body: Record<string, unknown>) =>
    request(app)
      .put(`/api/roles-permissions/roles/${id}`)
      .set("Authorization", `Bearer ${signTokenFor(admin.id)}`)
      .send(body);

  it("counts active accounts only, both in role user counts and the guard", async () => {
    const manage = await Permission.findOne({ where: { key: "ROLES_PERMISSIONS_MANAGE" } });
    const adminRole = await Role.findOne({ where: { name: "admin" }, include: [Permission] });
    expect(manage && adminRole).toBeTruthy();
    const temp = await Role.create({ name: `AU manager ${RUN}`, description: "activeUsers spec", is_system: false } as any);
    await RolePermission.create({ role_id: temp.id, permission_id: manage!.id } as any);
    const manager = await mkUser("mgr", 990820, { role_id: temp.id, role: "admin", mis_status: "INACTIVE" });
    const adminGrants = (await RolePermission.findAll({ where: { role_id: adminRole!.id } })).map((r) => r.permission_id);

    // Everyone else who could manage roles, outside the admin role, is made
    // inactive for this test (and put back): only `manager` would be left.
    const otherManagers = (await User.findAll({
      where: { id: { [Op.ne]: manager.id } } as any,
      include: [{ model: Role, required: true, where: { id: { [Op.ne]: adminRole!.id } }, include: [{ model: Permission, where: { key: "ROLES_PERMISSIONS_MANAGE" }, required: true }] }],
      attributes: ["id", "mis_status"],
    })) as User[];
    const restoreStatus = otherManagers.map((u) => [u.id, u.mis_status ?? null] as const);
    try {
      if (otherManagers.length) {
        await User.update({ mis_status: "INACTIVE" } as any, { where: { id: otherManagers.map((u) => u.id) } as any, hooks: false } as any);
      }
      const roles = await request(app).get("/api/roles-permissions/roles").set("Authorization", `Bearer ${signTokenFor(admin.id)}`);
      expect(roles.body.data.find((r: any) => r.id === temp.id).userCount).toBe(0);

      const keys = (adminRole!.permissions ?? []).map((p) => p.key).filter((k) => k !== "ROLES_PERMISSIONS_MANAGE");
      const refused = await put(adminRole!.id, { permissionKeys: keys });
      expect(refused.status).toBe(400);

      // Re-activated, the same manager does keep someone able to manage roles.
      await manager.update({ mis_status: "ACTIVE" } as any);
      const roles2 = await request(app).get("/api/roles-permissions/roles").set("Authorization", `Bearer ${signTokenFor(admin.id)}`);
      expect(roles2.body.data.find((r: any) => r.id === temp.id).userCount).toBe(1);
      const allowed = await put(adminRole!.id, { permissionKeys: keys });
      expect(allowed.status).toBe(200);
    } finally {
      await RolePermission.destroy({ where: { role_id: adminRole!.id } });
      await RolePermission.bulkCreate(adminGrants.map((permission_id) => ({ role_id: adminRole!.id, permission_id })) as any);
      for (const [id, status] of restoreStatus) {
        await User.update({ mis_status: status } as any, { where: { id } as any, hooks: false } as any);
      }
      await User.destroy({ where: { id: manager.id } });
      await RolePermission.destroy({ where: { role_id: temp.id } });
      await Role.destroy({ where: { id: temp.id } });
    }
  });
});

describe("MIS status sweep", () => {
  let calls: ReminderRequest[];
  let people: any[];
  let snapshot: Array<{ id: number; mis_status: string | null }>;

  const install = () => {
    calls = [];
    setReminderTransport(async (req) => {
      calls.push(req);
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/integrations/sync/people") {
        const cursor = Number(url.searchParams.get("cursor") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 2000);
        const page = people.filter((p) => p.id > cursor).sort((a, b) => a.id - b.id).slice(0, limit);
        const more = people.some((p) => p.id > (page[page.length - 1]?.id ?? Infinity));
        return {
          status: 200,
          body: { success: true, data: { users: page, pagination: { nextCursor: more ? page[page.length - 1].id : null } } },
        };
      }
      return { status: 404, body: {} };
    });
  };

  beforeAll(async () => {
    process.env.NGA_MIS_BASE_URL = "http://mis.test";
    process.env.SSO_CLIENT_ID = "taskmentor_app";
    process.env.SSO_CLIENT_SECRET = "secret";
    delete process.env.MIS_STATUS_SWEEP;
    snapshot = (await User.findAll({
      where: { mis_user_id: { [Op.ne]: null } } as any,
      attributes: ["id", "mis_status"],
      raw: true,
    })) as any;
  });

  afterAll(async () => {
    // Put every pre-existing user's status back as it was.
    const byStatus = new Map<string | null, number[]>();
    for (const r of snapshot) {
      const list = byStatus.get(r.mis_status ?? null) ?? [];
      list.push(r.id);
      byStatus.set(r.mis_status ?? null, list);
    }
    for (const [status, ids] of byStatus) {
      for (let i = 0; i < ids.length; i += 500) {
        await User.update({ mis_status: status } as any, { where: { id: ids.slice(i, i + 500) } as any, hooks: false, silent: true } as any);
      }
    }
  });

  beforeEach(async () => {
    install();
    await clearJobRun(JOB_NAME);
  });

  it("copies MIS statuses, marks ids MIS no longer returns REMOVED, and records the run", async () => {
    // Everyone MIS knows: all linked users already in the DB (as ACTIVE) plus fixtures.
    const fixtureIds = new Set([MIS_ACTIVE, MIS_LOCAL_INACTIVE, MIS_GONE, MIS_NEW]);
    const linked = (await User.findAll({ where: { mis_user_id: { [Op.ne]: null } } as any, attributes: ["mis_user_id"], raw: true })) as any[];
    people = [...new Set(linked.map((u) => Number(u.mis_user_id)))]
      .filter((id) => !fixtureIds.has(id))
      .map((id) => ({ id, status: "ACTIVE" }));
    people.push({ id: MIS_ACTIVE, status: "SUSPENDED" }, { id: MIS_LOCAL_INACTIVE, status: "ACTIVE" }, { id: MIS_NEW, status: "active" });

    const summary = await runMisStatusSweep();
    expect(summary.ok).toBe(true);
    expect(summary.removed).toBe(1);
    const statusOf = async (id: number) => (await User.findByPk(id, { attributes: ["mis_status"] }))!.mis_status;
    expect(await statusOf(active.id)).toBe("SUSPENDED");
    expect(await statusOf(localInactive.id)).toBe("ACTIVE");
    expect(await statusOf(gone.id)).toBe("REMOVED");
    expect(await getLastSuccess(JOB_NAME)).not.toBeNull();
    expect(calls.every((c) => c.headers.Authorization?.startsWith("Basic "))).toBe(true);
  });

  it("refuses to mark most users REMOVED when MIS answers with almost nobody", async () => {
    await User.update({ mis_status: "ACTIVE" } as any, { where: { id: gone.id } as any, hooks: false } as any);
    people = [{ id: MIS_ACTIVE, status: "ACTIVE" }];
    const summary = await runMisStatusSweep();
    expect(summary.ok).toBe(false);
    expect(summary.skipped).toBe("too many removed");
    expect((await User.findByPk(gone.id))!.mis_status).toBe("ACTIVE");
    expect(await getLastSuccess(JOB_NAME)).toBeNull();
  });

  it("does nothing when MIS returns nobody or a page fails", async () => {
    people = [];
    expect((await runMisStatusSweep()).skipped).toBe("empty");
    setReminderTransport(async () => ({ status: 503, body: {} }));
    expect((await runMisStatusSweep()).skipped).toBe("error");
  });

  it("re-checks one user after a back-channel logout", async () => {
    people = [{ id: MIS_ACTIVE, status: "INACTIVE" }, { id: MIS_ACTIVE + 100, status: "ACTIVE" }];
    expect(await recheckMisStatus(MIS_ACTIVE)).toBe("INACTIVE");
    expect((await User.findByPk(active.id))!.mis_status).toBe("INACTIVE");
    expect(calls[0].url).toContain(`cursor=${MIS_ACTIVE - 1}`);
    // Not returned at all -> REMOVED.
    expect(await recheckMisStatus(MIS_GONE)).toBe("REMOVED");
    expect((await User.findByPk(gone.id))!.mis_status).toBe("REMOVED");
    // MIS down -> unchanged, null.
    setReminderTransport(async () => ({ status: 500, body: {} }));
    expect(await recheckMisStatus(MIS_ACTIVE)).toBeNull();
    expect((await User.findByPk(active.id))!.mis_status).toBe("INACTIVE");
  });
});
