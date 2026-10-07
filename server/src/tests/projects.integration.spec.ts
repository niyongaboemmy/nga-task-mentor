import http from "http";
import zlib from "zlib";
import crypto from "crypto";
import request from "supertest";
import axios from "axios";
import { QueryTypes } from "sequelize";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  Project,
  ProjectActivityLink,
  ProjectBlob,
  ProjectEvent,
  ProjectMember,
  ProjectPresence,
  ProjectRevision,
  Role,
  User,
} from "../models";
import * as scoped from "../utils/scopedSubjects";
import fileServer from "../utils/fileServer";
import { signTmcodeToken } from "../tmcode/token";
import { signTmcodeUserToken } from "../tmcode/userToken";
import { revokeSessionsForMisUser } from "../services/sessionRevocation";
import { projectsBus, projectTopic } from "../tmcode/projects/bus";
import { resetPresenceTracking } from "../tmcode/projects/presence";
import * as projectsController from "../controllers/projects.controller";

/**
 * TMCode Projects (PROJECTS_PLAN.md §1-§3) against the dev DB: sign-in
 * exchange, projects CRUD and permissions, the blob/revision sync protocol,
 * activity links + assignment submit, presence, SSE, members. MIS is
 * stubbed (axios / getScopedSubjects); the file-server is stubbed.
 */

const COURSE_ID = 4247;
const OTHER_COURSE = 999_991;
const ENV = { ...process.env };

// One server bound to 127.0.0.1 for every request: supertest's own
// listen(0) binds the wildcard address, and on a dev machine another process
// can already hold 127.0.0.1:<that port> -- requests then land there (404).
let app: http.Server;
let student: User;
let student2: User;
let teacher: User;
let admin: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;

const projectIds: number[] = [];
const blobShas = new Set<string>();
const userIds: number[] = [];
let assignmentId: number | null = null;

/** Per-user scope the stubbed getScopedSubjects answers. */
const scopes = new Map<number, { scope: any; subjects: Array<{ id: number; name: string; code: null }> }>();

const blob = (content: string | Buffer) => {
  const raw = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const sha = crypto.createHash("sha256").update(raw).digest("hex");
  blobShas.add(sha);
  return { raw, sha, gz: zlib.gzipSync(raw), size: raw.length };
};
const unique = (label: string) => `${label} ${Date.now()} ${crypto.randomBytes(4).toString("hex")}`;

async function createProject(u: User, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/tmcode/projects")
    .set("Authorization", tok(u))
    .send({ name: unique("Proj"), language: "cpp", ...body });
  expect(res.status).toBe(201);
  projectIds.push(res.body.project.id);
  return res.body.project;
}

async function upload(u: User, projectId: number, b: ReturnType<typeof blob>) {
  return request(app)
    .put(`/api/tmcode/projects/${projectId}/blobs/${b.sha}`)
    .set("Authorization", tok(u))
    .set("Content-Type", "application/gzip")
    .set("X-Blob-Size", String(b.size))
    .send(b.gz);
}

async function commit(u: User, projectId: number, base: number | null, files: Array<{ path: string; b: ReturnType<typeof blob> }>, extra = {}) {
  return request(app)
    .post(`/api/tmcode/projects/${projectId}/revisions`)
    .set("Authorization", tok(u))
    .send({
      base_revision_id: base,
      message: "save",
      files: files.map((f) => ({ path: f.path, sha256: f.b.sha, size: f.b.size })),
      ...extra,
    });
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = http.createServer(buildTestApp());
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", () => r()));
  student = await findSeededUserByRole("student");
  teacher = await findSeededUserByRole("instructor");
  admin = await findSeededUserByRole("admin");
  const studentRole = await Role.findOne({ where: { name: "student" } });
  student2 = (await User.findAll({ where: { role_id: studentRole!.id }, order: [["id", "ASC"]], limit: 2 }))[1];
  expect(student2).toBeDefined();
  // A clean slate for the per-user quota.
  process.env.PROJECTS_MAX_PER_USER = "1000";
});

beforeEach(() => {
  jest.spyOn(scoped, "getScopedSubjects").mockImplementation(async (req: any) => {
    return scopes.get(Number(req.user?.id)) ?? { scope: "none", subjects: [] };
  });
  scopes.set(student.id, { scope: "enrolled", subjects: [{ id: COURSE_ID, name: "Programming", code: null }] });
  scopes.set(student2.id, { scope: "enrolled", subjects: [{ id: COURSE_ID, name: "Programming", code: null }] });
  scopes.set(teacher.id, { scope: "assigned", subjects: [{ id: COURSE_ID, name: "Programming", code: null }] });
  scopes.set(admin.id, { scope: "all", subjects: [] });
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...ENV, PROJECTS_MAX_PER_USER: "1000" };
});

afterAll(async () => {
  process.env = ENV;
  resetPresenceTracking();
  projectsBus.clear();
  if (projectIds.length) {
    const where = { project_id: projectIds };
    await ProjectEvent.destroy({ where });
    await ProjectActivityLink.destroy({ where });
    await ProjectPresence.destroy({ where });
    await ProjectMember.destroy({ where });
    await ProjectRevision.destroy({ where });
    await Project.destroy({ where: { id: projectIds } });
  }
  if (blobShas.size) await ProjectBlob.destroy({ where: { sha256: [...blobShas] } });
  if (assignmentId) {
    await sequelize.query("DELETE FROM submissions WHERE assignment_id = ?", { replacements: [assignmentId] });
    await Assignment.destroy({ where: { id: assignmentId } });
  }
  if (userIds.length) {
    await sequelize.query("DELETE FROM session_revocations WHERE user_id IN (?)", { replacements: [userIds] });
    await User.destroy({ where: { id: userIds } });
  }
  await new Promise((r) => app.close(r));
  await sequelize.close();
});

// ─── Sign-in ─────────────────────────────────────────────────────────────────

describe("auth exchange", () => {
  const misId = 880_000_000 + Math.floor(Math.random() * 1_000_000);
  const email = `tmcode-${misId}@test.nga`;

  function stubMis(opts: { verify?: number; me?: number } = {}) {
    return jest.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/verify")) {
        if (opts.verify) throw Object.assign(new Error("verify"), { response: { status: opts.verify } });
        return { data: { success: true, data: { userId: misId, access_version: null } } } as any;
      }
      if (url.endsWith("/users/me")) {
        if (opts.me) throw Object.assign(new Error("me"), { response: { status: opts.me } });
        return {
          data: {
            data: {
              user: { user_id: misId, email, username: "tmcoder" },
              profile: { first_name: "Tee", last_name: "Coder" },
              roles: [{ role_id: 99, name: "Student" }],
            },
          },
        } as any;
      }
      throw new Error(`unexpected GET ${url}`);
    });
  }

  it("trades a verified MIS token for a TMCode user token and provisions the user like SSO", async () => {
    stubMis();
    const res = await request(app).post("/api/tmcode/auth/exchange").set("Authorization", "Bearer mis.jwt.token");
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(new Date(res.body.expires_at).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(res.body.user).toMatchObject({ mis_user_id: misId, email, name: "Tee Coder", role: "student" });
    expect(res.body.user.permissions).toContain("PROJECTS_USE");
    userIds.push(res.body.user.id);

    const local = await User.findByPk(res.body.user.id);
    expect(local?.mis_user_id).toBe(misId);

    // The token works on the Projects API...
    const me = await request(app).get("/api/tmcode/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ token_kind: "tmcode-user", user: { id: res.body.user.id } });

    // ...a second sign-in reuses the same row.
    stubMis();
    const again = await request(app).post("/api/tmcode/auth/exchange").set("Authorization", "Bearer mis.jwt.token");
    expect(again.body.user.id).toBe(res.body.user.id);
  });

  it("is refused once the user signs out of MIS (SESSION_ENDED, by iat)", async () => {
    const user = await User.findOne({ where: { mis_user_id: misId } });
    const { token } = signTmcodeUserToken(user!.id, misId);
    await new Promise((r) => setTimeout(r, 1100)); // iat has second precision
    await revokeSessionsForMisUser(String(misId));
    const me = await request(app).get("/api/tmcode/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(401);
    expect(me.body.error_code).toBe("SESSION_ENDED");
    // A token issued after the sign-out works.
    await new Promise((r) => setTimeout(r, 1100));
    const fresh = signTmcodeUserToken(user!.id, misId).token;
    expect((await request(app).get("/api/tmcode/auth/me").set("Authorization", `Bearer ${fresh}`)).status).toBe(200);
  });

  it("answers 401 MIS_TOKEN_INVALID for a rejected MIS token and 503 when MIS is down", async () => {
    stubMis({ verify: 401 });
    const bad = await request(app).post("/api/tmcode/auth/exchange").set("Authorization", "Bearer nope");
    expect(bad.status).toBe(401);
    expect(bad.body.error_code).toBe("MIS_TOKEN_INVALID");

    jest.restoreAllMocks();
    jest.spyOn(axios, "get").mockRejectedValue(Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" }));
    const down = await request(app).post("/api/tmcode/auth/exchange").set("Authorization", "Bearer x");
    expect(down.status).toBe(503);
    expect(down.body.error_code).toBe("MIS_UNAVAILABLE");

    const none = await request(app).post("/api/tmcode/auth/exchange");
    expect(none.status).toBe(401);
  });

  it("accepts a TM web token, refuses an exam-session token and garbage", async () => {
    const web = await request(app).get("/api/tmcode/auth/me").set("Authorization", tok(student));
    expect(web.status).toBe(200);
    expect(web.body.token_kind).toBe("web");

    const exam = signTmcodeToken({ sid: "s", sub: String(student.id), submission_id: 1 }, new Date(Date.now() + 60_000));
    const r1 = await request(app).get("/api/tmcode/auth/me").set("Authorization", `Bearer ${exam}`);
    expect(r1.status).toBe(401);
    expect(r1.body.error_code).toBe("TOKEN_INVALID");
    expect((await request(app).get("/api/tmcode/auth/me")).body.error_code).toBe("TOKEN_MISSING");
  });
});

// ─── Projects CRUD and permissions ───────────────────────────────────────────

describe("projects: create, list, permissions", () => {
  it("creates a TM project and lists it under mine with head/presence/links summaries", async () => {
    const p = await createProject(student, { description: "practice" });
    expect(p).toMatchObject({ kind: "tm", visibility: "private", my_role: "owner", head: null, file_count: 0 });
    expect(p.slug).toMatch(/^proj-/);
    expect(p.events[0].type).toBe("created");

    const list = await request(app).get("/api/tmcode/projects?scope=mine").set("Authorization", tok(student));
    expect(list.status).toBe(200);
    const row = list.body.projects.find((x: any) => x.id === p.id);
    expect(row).toMatchObject({
      head: null,
      presence: { online: false, devices_online: 0 },
      links: { total: 0, submitted: 0, items: [] },
    });
    expect(list.body.stats.total).toBeGreaterThanOrEqual(1);

    const found = await request(app)
      .get(`/api/tmcode/projects?q=${encodeURIComponent(p.name)}&kind=tm`)
      .set("Authorization", tok(student));
    expect(found.body.projects.map((x: any) => x.id)).toEqual([p.id]);
  });

  it("hides other people's projects (404) and gates scope=all on PROJECTS_VIEW_ALL", async () => {
    const p = await createProject(student);
    const other = await request(app).get(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(student2));
    expect(other.status).toBe(404);
    expect(other.body.error_code).toBe("PROJECT_NOT_FOUND");

    const denied = await request(app).get("/api/tmcode/projects?scope=all").set("Authorization", tok(student));
    expect(denied.status).toBe(403);
    expect(denied.body.error_code).toBe("FORBIDDEN");

    const all = await request(app).get("/api/tmcode/projects?scope=all").set("Authorization", tok(admin));
    expect(all.status).toBe(200);
    expect(all.body.projects.some((x: any) => x.id === p.id)).toBe(true);
    // Admins read, but don't edit.
    const view = await request(app).get(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(admin));
    expect(view.body.project.my_role).toBe("admin");
    const patch = await request(app).patch(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(admin)).send({ name: "x" });
    expect(patch.status).toBe(403);
  });

  it("renames, archives, and keeps the slug", async () => {
    const p = await createProject(student);
    const res = await request(app)
      .patch(`/api/tmcode/projects/${p.id}`)
      .set("Authorization", tok(student))
      .send({ name: "Renamed", visibility: "course", archived: true });
    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({ name: "Renamed", slug: p.slug, visibility: "course" });
    expect(res.body.project.archived_at).not.toBeNull();
    const list = await request(app).get("/api/tmcode/projects").set("Authorization", tok(student));
    expect(list.body.projects.some((x: any) => x.id === p.id)).toBe(false);
    const archived = await request(app).get("/api/tmcode/projects?archived=only").set("Authorization", tok(student));
    expect(archived.body.projects.some((x: any) => x.id === p.id)).toBe(true);
  });

  it("enforces the per-user project quota", async () => {
    const count = await Project.count({ where: { owner_id: student.id } });
    process.env.PROJECTS_MAX_PER_USER = String(count);
    const res = await request(app).post("/api/tmcode/projects").set("Authorization", tok(student)).send({ name: "One more" });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error_code: "QUOTA_EXCEEDED", limit: "projects" });
  });

  it("validates the body", async () => {
    const res = await request(app).post("/api/tmcode/projects").set("Authorization", tok(student)).send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_ERROR");
    const kind = await request(app)
      .post("/api/tmcode/projects")
      .set("Authorization", tok(student))
      .send({ name: "x", kind: "tm", repo_url: "https://github.com/a/b" });
    expect(kind.body.error_code).toBe("PROJECT_KIND");
  });
});

// ─── Sync protocol ───────────────────────────────────────────────────────────

describe("blobs", () => {
  it("reports missing blobs, stores one, then reports it present (idempotent put)", async () => {
    const p = await createProject(student);
    const b = blob(unique("int main() { return 0; }"));
    const missing = await request(app)
      .post(`/api/tmcode/projects/${p.id}/blobs/missing`)
      .set("Authorization", tok(student))
      .send({ sha256: [b.sha] });
    expect(missing.body.missing).toEqual([b.sha]);

    const put = await upload(student, p.id, b);
    expect(put.status).toBe(201);
    expect(put.body).toMatchObject({ sha256: b.sha, size: b.size, stored: "db", existed: false });
    expect((await upload(student, p.id, b)).status).toBe(200);

    const again = await request(app)
      .post(`/api/tmcode/projects/${p.id}/blobs/missing`)
      .set("Authorization", tok(student))
      .send({ sha256: [b.sha] });
    expect(again.body.missing).toEqual([]);
  });

  it("refuses a hash mismatch, a size mismatch, bad gzip and oversized files", async () => {
    const p = await createProject(student);
    const b = blob(unique("content"));
    const wrong = await request(app)
      .put(`/api/tmcode/projects/${p.id}/blobs/${"0".repeat(64)}`)
      .set("Authorization", tok(student))
      .set("Content-Type", "application/gzip")
      .send(b.gz);
    expect(wrong.status).toBe(422);
    expect(wrong.body).toMatchObject({ error_code: "HASH_MISMATCH", sha256: b.sha });

    const size = await request(app)
      .put(`/api/tmcode/projects/${p.id}/blobs/${b.sha}`)
      .set("Authorization", tok(student))
      .set("Content-Type", "application/gzip")
      .set("X-Blob-Size", String(b.size + 1))
      .send(b.gz);
    expect(size.body.error_code).toBe("SIZE_MISMATCH");

    const notGz = await request(app)
      .put(`/api/tmcode/projects/${p.id}/blobs/${b.sha}`)
      .set("Authorization", tok(student))
      .set("Content-Type", "application/gzip")
      .send(Buffer.from("plain text"));
    expect(notGz.body.error_code).toBe("BAD_GZIP");

    process.env.PROJECTS_MAX_FILE_MB = String(100 / (1024 * 1024)); // 100 bytes
    const big = blob("x".repeat(500) + unique(""));
    const tooBig = await upload(student, p.id, big);
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error_code).toBe("FILE_TOO_LARGE");
  });

  it("puts large blobs on the file-server, falling back to the DB when it's unavailable (dev)", async () => {
    const p = await createProject(student);
    process.env.PROJECTS_BLOB_DB_MAX_KB = "1";
    const up = jest.spyOn(fileServer, "uploadFile").mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const big1 = blob("a".repeat(2048) + unique(""));
    const r1 = await upload(student, p.id, big1);
    expect(r1.status).toBe(201);
    expect(r1.body.stored).toBe("db");

    up.mockResolvedValueOnce(undefined);
    const big2 = blob("b".repeat(2048) + unique(""));
    const r2 = await upload(student, p.id, big2);
    expect(r2.body.stored).toBe("fs");
    expect(up).toHaveBeenLastCalledWith(big2.gz, `projects/${big2.sha}`);
    const row = await ProjectBlob.findByPk(big2.sha);
    expect(row?.data_gz).toBeNull();

    // Commit it and read it back through the file-server.
    const c = await commit(student, p.id, null, [{ path: "big.txt", b: big2 }]);
    expect(c.status).toBe(201);
    const down = jest.spyOn(fileServer, "downloadToBuffer").mockResolvedValue(big2.gz);
    const file = await request(app).get(`/api/tmcode/projects/${p.id}/files/big.txt`).set("Authorization", tok(student));
    expect(file.status).toBe(200);
    expect(file.text).toBe(big2.raw.toString());
    expect(down).toHaveBeenCalledWith(`projects/${big2.sha}`);
  });
});

describe("revisions", () => {
  it("commits, detects conflicts, refuses missing blobs, and serves manifest/files/blobs", async () => {
    const p = await createProject(student);
    const main = blob(unique('#include <iostream>\nint main(){std::cout<<"hi";}'));
    const readme = blob(unique("# Readme"));

    const early = await commit(student, p.id, null, [{ path: "src/main.cpp", b: main }]);
    expect(early.status).toBe(422);
    expect(early.body).toMatchObject({ error_code: "BLOBS_MISSING", missing: [main.sha] });

    await upload(student, p.id, main);
    await upload(student, p.id, readme);
    const first = await commit(student, p.id, null, [
      { path: "src/main.cpp", b: main },
      { path: "README.md", b: readme },
    ]);
    expect(first.status).toBe(201);
    expect(first.body.revision).toMatchObject({
      number: 1,
      parent_id: null,
      file_count: 2,
      size_bytes: main.size + readme.size,
      source: "save",
    });
    const rev1 = first.body.revision.id;

    // Another device saving against the old base.
    const conflict = await commit(student, p.id, null, [{ path: "README.md", b: readme }]);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error_code).toBe("REVISION_CONFLICT");
    expect(conflict.body.head).toMatchObject({ id: rev1, number: 1 });

    // Same files again: no new revision.
    const same = await commit(student, p.id, rev1, [
      { path: "README.md", b: readme },
      { path: "src/main.cpp", b: main },
    ]);
    expect(same.status).toBe(200);
    expect(same.body).toMatchObject({ unchanged: true, revision: { id: rev1 } });

    const second = await commit(student, p.id, rev1, [{ path: "src/main.cpp", b: main }], { source: "auto" });
    expect(second.status).toBe(201);
    expect(second.body.revision).toMatchObject({ number: 2, parent_id: rev1, source: "auto", file_count: 1 });

    const details = await request(app).get(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(student));
    expect(details.body.project).toMatchObject({ head_revision_id: second.body.revision.id, file_count: 1 });

    const list = await request(app).get(`/api/tmcode/projects/${p.id}/revisions`).set("Authorization", tok(student));
    expect(list.body.revisions.map((r: any) => r.number)).toEqual([2, 1]);

    const manifest = await request(app)
      .get(`/api/tmcode/projects/${p.id}/revisions/${rev1}/manifest`)
      .set("Authorization", tok(student));
    expect(manifest.status).toBe(200);
    expect(manifest.body.files).toEqual([
      { path: "README.md", sha256: readme.sha, size: readme.size },
      { path: "src/main.cpp", sha256: main.sha, size: main.size },
    ]);
    const head = await request(app)
      .get(`/api/tmcode/projects/${p.id}/revisions/head/manifest`)
      .set("Authorization", tok(student));
    expect(head.body.revision.number).toBe(2);

    const file = await request(app)
      .get(`/api/tmcode/projects/${p.id}/files/README.md?rev=${rev1}`)
      .set("Authorization", tok(student));
    expect(file.status).toBe(200);
    expect(file.text).toBe(readme.raw.toString());
    const gone = await request(app).get(`/api/tmcode/projects/${p.id}/files/README.md`).set("Authorization", tok(student));
    expect(gone.body.error_code).toBe("FILE_NOT_FOUND");

    const gz = await request(app)
      .get(`/api/tmcode/projects/${p.id}/blobs/${main.sha}`)
      .set("Authorization", tok(student))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(gz.status).toBe(200);
    expect(gz.headers["content-type"]).toMatch(/application\/gzip/);
    expect(zlib.gunzipSync(gz.body).toString()).toBe(main.raw.toString());

    // A blob that isn't in this project's revisions is not served from it.
    const other = await createProject(student2);
    const leak = await request(app).get(`/api/tmcode/projects/${other.id}/blobs/${main.sha}`).set("Authorization", tok(student2));
    expect(leak.status).toBe(404);
  });

  it("validates paths and enforces file-count, file-size and project-size quotas", async () => {
    const p = await createProject(student);
    const a = blob(unique("aaaa"));
    const b = blob(unique("bbbb"));
    const c = blob(unique("cccc"));
    for (const x of [a, b, c]) await upload(student, p.id, x);

    for (const bad of ["../x", "/abs", "a\\b", "a\u0000b", "C:/x", "x".repeat(261)]) {
      const res = await commit(student, p.id, null, [{ path: bad, b: a }]);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error_code: "INVALID_PATH", path: bad });
    }
    const dup = await commit(student, p.id, null, [
      { path: "a.txt", b: a },
      { path: "a.txt", b: b },
    ]);
    expect(dup.body.error_code).toBe("DUPLICATE_PATH");

    process.env.PROJECTS_MAX_FILES = "2";
    const files = await commit(student, p.id, null, [
      { path: "a", b: a },
      { path: "b", b: b },
      { path: "c", b: c },
    ]);
    expect(files.status).toBe(413);
    expect(files.body).toMatchObject({ error_code: "QUOTA_EXCEEDED", limit: "files" });
    delete process.env.PROJECTS_MAX_FILES;

    process.env.PROJECTS_MAX_PROJECT_MB = String((a.size + b.size - 1) / (1024 * 1024));
    const size = await commit(student, p.id, null, [
      { path: "a", b: a },
      { path: "b", b: b },
    ]);
    expect(size.status).toBe(413);
    expect(size.body.limit).toBe("project_size");
    delete process.env.PROJECTS_MAX_PROJECT_MB;

    process.env.PROJECTS_MAX_FILE_MB = String((a.size - 1) / (1024 * 1024));
    const one = await commit(student, p.id, null, [{ path: "a", b: a }]);
    expect(one.body.limit).toBe("file_size");
    delete process.env.PROJECTS_MAX_FILE_MB;

    const lying = await request(app)
      .post(`/api/tmcode/projects/${p.id}/revisions`)
      .set("Authorization", tok(student))
      .send({ base_revision_id: null, files: [{ path: "a", sha256: a.sha, size: a.size + 5 }] });
    expect(lying.body.error_code).toBe("SIZE_MISMATCH");
  });

  it("refuses saves on GitHub projects and from non-owners", async () => {
    const gh = await createProject(student, { kind: "github", repo_url: "https://github.com/nga/demo.git" });
    expect(gh.repo_full_name).toBe("nga/demo");
    const res = await commit(student, gh.id, null, []);
    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe("PROJECT_KIND");

    const p = await createProject(student);
    const notMine = await commit(student2, p.id, null, []);
    expect(notMine.status).toBe(404);
  });

  it("deletes a project and the blobs only it used", async () => {
    const keep = await createProject(student);
    const p = await createProject(student);
    const shared = blob(unique("shared"));
    const own = blob(unique("own"));
    for (const x of [shared, own]) await upload(student, p.id, x);
    await commit(student, keep.id, null, [{ path: "s", b: shared }]);
    await commit(student, p.id, null, [
      { path: "s", b: shared },
      { path: "o", b: own },
    ]);
    // Removing is a soft delete; deleting for good is the second step.
    const rm = await request(app).delete(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(student));
    expect(rm.body).toMatchObject({ removed: true, status: "removed" });
    const del = await request(app).delete(`/api/tmcode/projects/${p.id}?permanent=1`).set("Authorization", tok(student));
    expect(del.status).toBe(200);
    await projectsController.pendingBlobGc;
    expect(await Project.findByPk(p.id)).toBeNull();
    expect(await ProjectBlob.findByPk(own.sha)).toBeNull();
    expect(await ProjectBlob.findByPk(shared.sha)).not.toBeNull();
  });
});

// ─── Links and submit ────────────────────────────────────────────────────────

describe("activity links and submit (assignment)", () => {
  let project: any;
  let linkId: number;

  beforeAll(async () => {
    const a = await Assignment.create({
      title: unique("Project assignment"),
      description: "Build it",
      due_date: new Date(Date.now() + 7 * 86_400_000),
      max_score: 100,
      submission_type: "project",
      course_id: COURSE_ID,
      created_by: admin.id,
      status: "published",
    } as any);
    assignmentId = a.id;
  });

  it("lists linkable activities in the user's courses", async () => {
    const res = await request(app).get("/api/tmcode/activities/linkable").set("Authorization", tok(student));
    expect(res.status).toBe(200);
    expect(res.body.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "assignment", id: assignmentId, course_id: COURSE_ID, course_name: "Programming", submission_type: "project" }),
      ]),
    );
    scopes.set(student.id, { scope: "enrolled", subjects: [] });
    const none = await request(app).get("/api/tmcode/activities/linkable").set("Authorization", tok(student));
    expect(none.body.activities).toEqual([]);
  });

  it("links a saved project, refuses duplicates and out-of-scope activities", async () => {
    project = await createProject(student);
    const f = blob(unique("print('hi')"));
    await upload(student, project.id, f);
    const c = await commit(student, project.id, null, [{ path: "main.py", b: f }]);
    project.rev1 = c.body.revision;

    scopes.set(student2.id, { scope: "enrolled", subjects: [{ id: OTHER_COURSE, name: "Other", code: null }] });
    const p2 = await createProject(student2);
    const out = await request(app)
      .post(`/api/tmcode/projects/${p2.id}/links`)
      .set("Authorization", tok(student2))
      .send({ activity_type: "assignment", activity_id: assignmentId });
    expect(out.status).toBe(403);
    expect(out.body.error_code).toBe("ACTIVITY_NOT_IN_SCOPE");

    const res = await request(app)
      .post(`/api/tmcode/projects/${project.id}/links`)
      .set("Authorization", tok(student))
      .send({ activity_type: "assignment", activity_id: assignmentId });
    expect(res.status).toBe(201);
    expect(res.body.link).toMatchObject({ status: "linked", activity_type: "assignment", activity: { course_id: COURSE_ID } });
    linkId = res.body.link.id;

    const dup = await request(app)
      .post(`/api/tmcode/projects/${project.id}/links`)
      .set("Authorization", tok(student))
      .send({ activity_type: "assignment", activity_id: assignmentId });
    expect(dup.status).toBe(409);
    expect(dup.body.error_code).toBe("ALREADY_LINKED");

    const missing = await request(app)
      .post(`/api/tmcode/projects/${project.id}/links`)
      .set("Authorization", tok(student))
      .send({ activity_type: "quiz", activity_id: 999_999_999 });
    expect(missing.body.error_code).toBe("ACTIVITY_NOT_FOUND");
  });

  it("submits: freezes the head and creates the submissions row (project_ref)", async () => {
    const res = await request(app)
      .post(`/api/tmcode/projects/${project.id}/links/${linkId}/submit`)
      .set("Authorization", tok(student));
    expect(res.status).toBe(200);
    expect(res.body.link).toMatchObject({ status: "submitted", revision_id: project.rev1.id, revision_number: 1 });
    expect(res.body.submission).toMatchObject({ status: "submitted", is_late: false });

    const [row] = await sequelize.query<any>(
      "SELECT id, status, student_id, text_submission, project_ref FROM submissions WHERE assignment_id = ?",
      { replacements: [assignmentId], type: QueryTypes.SELECT },
    );
    expect(row.student_id).toBe(student.id); // the LOCAL user id
    expect(row.status).toBe("submitted");
    expect(row.text_submission).toContain("revision #1");
    const ref = typeof row.project_ref === "string" ? JSON.parse(row.project_ref) : row.project_ref;
    expect(ref).toMatchObject({ project_id: project.id, link_id: linkId, revision_id: project.rev1.id, kind: "tm" });

    // Submitted work is locked: saving is refused until it is withdrawn.
    const f2 = blob(unique("print('v2')"));
    await upload(student, project.id, f2);
    const locked = await commit(student, project.id, project.rev1.id, [{ path: "main.py", b: f2 }]);
    expect(locked.status).toBe(409);
    expect(locked.body.error_code).toBe("PROJECT_LOCKED");
    const link = await ProjectActivityLink.findByPk(linkId);
    expect(link?.revision_id).toBe(project.rev1.id);

    // Withdraw, save again, and re-submitting moves the freeze.
    const withdrawn = await request(app)
      .post(`/api/tmcode/projects/${project.id}/withdraw`)
      .set("Authorization", tok(student));
    expect(withdrawn.body.status).toBe("draft");
    const c2 = await commit(student, project.id, project.rev1.id, [{ path: "main.py", b: f2 }]);
    project.rev2 = c2.body.revision;

    const again = await request(app)
      .post(`/api/tmcode/projects/${project.id}/links/${linkId}/submit`)
      .set("Authorization", tok(student));
    expect(again.body.submission.status).toBe("resubmitted");
    expect(again.body.link.revision_id).toBe(project.rev2.id);
    const count = await sequelize.query<any>("SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = ?", {
      replacements: [assignmentId],
      type: QueryTypes.SELECT,
    });
    expect(Number(count[0].n)).toBe(1);
  });

  it("keeps submitted links and projects from being removed", async () => {
    const unlink = await request(app)
      .delete(`/api/tmcode/projects/${project.id}/links/${linkId}`)
      .set("Authorization", tok(student));
    expect(unlink.body.error_code).toBe("LINK_SUBMITTED");
    const del = await request(app).delete(`/api/tmcode/projects/${project.id}`).set("Authorization", tok(student));
    expect(del.body.error_code).toBe("PROJECT_SUBMITTED");
  });

  it("lets the activity's teacher read the frozen revision, not the private head", async () => {
    const res = await request(app)
      .get(`/api/tmcode/activities/assignment/${assignmentId}/projects`)
      .set("Authorization", tok(teacher));
    expect(res.status).toBe(200);
    const entry = res.body.projects.find((x: any) => x.project.id === project.id);
    expect(entry.frozen_revision).toMatchObject({ id: project.rev2.id, number: 2 });
    expect(entry.owner.id).toBe(student.id);

    const view = await request(app).get(`/api/tmcode/projects/${project.id}`).set("Authorization", tok(teacher));
    expect(view.body.project.my_role).toBe("teacher");
    const frozen = await request(app)
      .get(`/api/tmcode/projects/${project.id}/files/main.py?rev=${project.rev2.id}`)
      .set("Authorization", tok(teacher));
    expect(frozen.status).toBe(200);
    const older = await request(app)
      .get(`/api/tmcode/projects/${project.id}/revisions/${project.rev1.id}/manifest`)
      .set("Authorization", tok(teacher));
    expect(older.status).toBe(404);

    // Out of the teacher's courses: no access.
    scopes.set(teacher.id, { scope: "assigned", subjects: [{ id: OTHER_COURSE, name: "Other", code: null }] });
    const out = await request(app)
      .get(`/api/tmcode/activities/assignment/${assignmentId}/projects`)
      .set("Authorization", tok(teacher));
    expect(out.status).toBe(403);
    const hidden = await request(app).get(`/api/tmcode/projects/${project.id}`).set("Authorization", tok(teacher));
    expect(hidden.status).toBe(404);

    // Students can't use the teacher view.
    const stu = await request(app)
      .get(`/api/tmcode/activities/assignment/${assignmentId}/projects`)
      .set("Authorization", tok(student));
    expect(stu.status).toBe(403);
  });

  it("refuses a resubmit once graded", async () => {
    await sequelize.query("UPDATE submissions SET status = 'graded' WHERE assignment_id = ?", {
      replacements: [assignmentId],
    });
    const res = await request(app)
      .post(`/api/tmcode/projects/${project.id}/links/${linkId}/submit`)
      .set("Authorization", tok(student));
    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe("ALREADY_GRADED");
  });
});

// ─── Presence and SSE ────────────────────────────────────────────────────────

describe("presence and live streams", () => {
  afterEach(() => {
    resetPresenceTracking();
  });

  it("upserts one row per device, records 'opened', fans out on the bus, and goes stale after 60 s", async () => {
    const p = await createProject(student);
    const seen: any[] = [];
    const off = projectsBus.subscribe(projectTopic(p.id), (event, data) => seen.push({ event, data }));
    const beat = (state: object, device = "mac-1") =>
      request(app)
        .put(`/api/tmcode/projects/${p.id}/presence`)
        .set("Authorization", tok(student))
        .send({ device_id: device, app_version: "0.4.0", state });

    const r1 = await beat({ file: "main.cpp", dirty: 2 });
    expect(r1.status).toBe(200);
    expect(r1.body.presence).toHaveLength(1);
    expect(r1.body.presence[0]).toMatchObject({ device_id: "mac-1", online: true, state: { open: true, file: "main.cpp" } });
    await beat({ file: "util.cpp" });
    await beat({ file: "x" }, "win-2");
    expect(await ProjectPresence.count({ where: { project_id: p.id } })).toBe(2);

    expect(seen.filter((s) => s.event === "presence")).toHaveLength(3);
    expect(seen.filter((s) => s.event === "event" && s.data.type === "opened")).toHaveLength(2);

    const closed = await beat({ open: false });
    expect(closed.body.presence.find((x: any) => x.device_id === "mac-1").online).toBe(false);

    await ProjectPresence.update(
      { last_seen_at: new Date(Date.now() - 61_000) },
      { where: { project_id: p.id, device_id: "win-2" } },
    );
    const details = await request(app).get(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(student));
    expect(details.body.project.presence.every((x: any) => x.online === false)).toBe(true);
    expect(details.body.project.presence_summary.online).toBe(false);
    off();

    const stranger = await request(app)
      .put(`/api/tmcode/projects/${p.id}/presence`)
      .set("Authorization", tok(student2))
      .send({ device_id: "x", state: {} });
    expect(stranger.status).toBe(404);
  });

  /** Open an SSE stream on a real port; collects everything it receives. */
  async function openStream(path: string, u: User) {
    const port = (app.address() as any).port;
    const req = http.get({ host: "127.0.0.1", port, path, headers: { Authorization: tok(u) } });
    const res: http.IncomingMessage = await new Promise((resolve) => req.on("response", resolve));
    let text = "";
    res.setEncoding("utf8");
    res.on("data", (c: string) => (text += c));
    const waitFor = async (needle: string) => {
      const until = Date.now() + 5000;
      while (!text.includes(needle)) {
        if (Date.now() > until) throw new Error(`timed out waiting for ${needle}`);
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    const close = async () => {
      req.destroy();
      await new Promise((r) => setTimeout(r, 100));
    };
    return { res, waitFor, close, text: () => text };
  }

  const beat = (u: User, projectId: number, device: string) =>
    request(app)
      .put(`/api/tmcode/projects/${projectId}/presence`)
      .set("Authorization", tok(u))
      .send({ device_id: device, state: { file: "a.cpp" } });

  it("streams hello + presence over SSE and cleans up on disconnect", async () => {
    const p = await createProject(student);
    const s = await openStream(`/api/tmcode/projects/${p.id}/live`, student);
    try {
      expect(s.res.statusCode).toBe(200);
      expect(s.res.headers["content-type"]).toMatch(/text\/event-stream/);
      await s.waitFor("event: hello");
      expect(projectsBus.listenerCount(projectTopic(p.id))).toBe(1);

      await beat(student, p.id, "sse-dev");
      await s.waitFor("event: presence");
      expect(s.text()).toContain('"device_id":"sse-dev"');
    } finally {
      await s.close();
    }
    expect(projectsBus.listenerCount(projectTopic(p.id))).toBe(0);
  });

  it("streams to a teacher's monitor only the projects linked to their courses", async () => {
    const linked = await createProject(student2);
    const link = await request(app)
      .post(`/api/tmcode/projects/${linked.id}/links`)
      .set("Authorization", tok(student2))
      .send({ activity_type: "assignment", activity_id: assignmentId });
    expect(link.status).toBe(201);
    const unlinked = await createProject(student2);

    const s = await openStream("/api/tmcode/monitor/live", teacher);
    try {
      expect(s.res.statusCode).toBe(200);
      await s.waitFor("event: hello");
      expect(s.text()).toContain(`"course_ids":[${COURSE_ID}]`);
      await beat(student2, unlinked.id, "hidden-dev");
      await beat(student2, linked.id, "shown-dev");
      await s.waitFor('"device_id":"shown-dev"');
      expect(s.text()).toContain(`"course_ids":[${COURSE_ID}]`);
      expect(s.text()).not.toContain("hidden-dev");
    } finally {
      await s.close();
    }
  });

  it("only lets monitors open the monitor stream", async () => {
    const res = await request(app).get("/api/tmcode/monitor/live").set("Authorization", tok(student));
    expect(res.status).toBe(403);
  });
});

// ─── Members (GitHub only) ───────────────────────────────────────────────────

describe("members", () => {
  it("refuses members on Task Mentor projects", async () => {
    const p = await createProject(student);
    const res = await request(app)
      .post(`/api/tmcode/projects/${p.id}/members`)
      .set("Authorization", tok(student))
      .send({ user_id: student2.id, github_username: "octo" });
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe("MEMBERS_GITHUB_ONLY");
  });

  it("adds a collaborator to a GitHub project who then sees it as shared and reports git", async () => {
    const p = await createProject(student, { kind: "github", repo_url: "https://github.com/nga/team" });
    const add = await request(app)
      .post(`/api/tmcode/projects/${p.id}/members`)
      .set("Authorization", tok(student))
      .send({ user_id: student2.id, github_username: "octo-cat", role: "collaborator" });
    expect(add.status).toBe(201);
    expect(add.body.member).toMatchObject({ user_id: student2.id, role: "collaborator", github_username: "octo-cat", status: "active" });

    const badName = await request(app)
      .post(`/api/tmcode/projects/${p.id}/members`)
      .set("Authorization", tok(student))
      .send({ user_id: student2.id, github_username: "not a name!" });
    expect(badName.status).toBe(400);
    const self = await request(app)
      .post(`/api/tmcode/projects/${p.id}/members`)
      .set("Authorization", tok(student))
      .send({ user_id: student.id });
    expect(self.body.error_code).toBe("ALREADY_OWNER");

    const shared = await request(app).get("/api/tmcode/projects?scope=shared").set("Authorization", tok(student2));
    const row = shared.body.projects.find((x: any) => x.id === p.id);
    expect(row.my_role).toBe("collaborator");

    // Collaborators can't manage members...
    const nope = await request(app)
      .post(`/api/tmcode/projects/${p.id}/members`)
      .set("Authorization", tok(student2))
      .send({ user_id: teacher.id });
    expect(nope.status).toBe(403);

    // ...but report git state.
    const git = await request(app)
      .post(`/api/tmcode/projects/${p.id}/git`)
      .set("Authorization", tok(student2))
      .send({ branch: "main", head_commit: "abc1234def", ahead: 1, behind: 0, changes: 3, pushed: { commit: "abc1234def", message: "feat" } });
    expect(git.status).toBe(200);
    expect(git.body.git).toMatchObject({ branch: "main", ahead: 1, changes: 3, last_push: { commit: "abc1234def" } });
    const details = await request(app).get(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(student));
    expect(details.body.project.git.head_commit).toBe("abc1234def");
    expect(details.body.project.events.some((e: any) => e.type === "pushed")).toBe(true);
    expect(details.body.project.members.map((m: any) => m.role).sort()).toEqual(["collaborator", "owner"]);

    // Leave.
    const leave = await request(app)
      .delete(`/api/tmcode/projects/${p.id}/members/${student2.id}`)
      .set("Authorization", tok(student2));
    expect(leave.status).toBe(200);
    expect((await request(app).get(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(student2))).status).toBe(404);
  });

  it("gives an open link", async () => {
    const p = await createProject(student);
    const res = await request(app).get(`/api/tmcode/projects/${p.id}/open-link`).set("Authorization", tok(student));
    expect(res.body.deeplink).toMatch(new RegExp(`^tmcode://project\\?id=${p.id}&api=`));
  });
});
