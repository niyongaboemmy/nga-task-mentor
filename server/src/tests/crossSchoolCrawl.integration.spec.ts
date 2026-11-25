import "./isolationEnv";
import "reflect-metadata";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { Role, User } from "../models";
import authRoutes from "../routes/auth";
import academicsRoutes from "../routes/academics";
import tmcodeCodeRoutes from "../routes/tmcodeCode";
import tmcodeExamCodeRoutes from "../routes/tmcodeExamCode";
import { verifyReportCard } from "../controllers/reportCard.controller";
import { tenantFromCallerHint } from "../tenancy/request";
import { fixedRegistry, setTenantRegistryForTests } from "../tenancy/registry";
import { provisionTenant } from "../tenancy/provision";
import { signDbStepUpToken, signSessionToken } from "../utils/sessionToken";
import { primaryTenantCtx, runWithTenant, TenantCtx } from "../vendor/nga-tenancy";
import { buildTestApp, ensureModelsRegistered } from "./testApp";

/**
 * Cross-school canary crawl (school isolation audit 2026-11-25, re-run after
 * the TM-ISO fixes). Each school gets canary rows -- some with the SAME ids
 * in both schools, some only in one -- then every GET route on the router
 * stack is called by the other school's people, in both directions, with
 * header/query/cookie spoofing and with DB step-up tokens as credentials.
 * Any response containing the other school's canary is a leak.
 *
 * Default: a trimmed matrix (admin + student, header spoof) that runs in
 * seconds. CRAWL_FULL=1: every caller x every spoof x both id variants.
 * Runs only on a throw-away tm_mt_* database; all outbound calls go to a
 * closed port (isolationEnv).
 */

const safe = /^tm_mt_/.test(process.env.DB_NAME || "");
const d = safe ? describe : describe.skip;
const FULL = process.env.CRAWL_FULL === "1";

const T1 = primaryTenantCtx();
const T2: TenantCtx = { ...T1, tid: 2, slug: "school-two", name: "School Two", isPrimary: false, pkg: "starter" };
const RUN = `${Date.now()}`.slice(-7);
const canary = (tid: number) => `CANARY${tid}X${RUN}`;
const inT = <R>(t: TenantCtx, fn: () => Promise<R>) => runWithTenant(t, fn);
const q = (sql: string, replacements: Record<string, unknown> = {}) => sequelize.query(sql, { replacements, type: QueryTypes.RAW });

// Ids: SHARED exist in both schools (different canary text), ONLY_n in school n only.
const SHARED = 990_000;
const ONLY = (tid: number) => 990_000 + tid * 1_000;
const KIND_OFFSET = { user: 101, course: 301, quiz: 201, assignment: 401, question: 501, report: 601, project: 701, manual: 801, submission: 901 } as const;
type Kind = keyof typeof KIND_OFFSET;
const idOf = (base: number, kind: Kind) => base + KIND_OFFSET[kind];
const reportUuid = (tid: number, shared: boolean) =>
  `${shared ? "5" : String(tid)}${RUN}`.padEnd(8, "0").slice(0, 8) + "-iso0-4000-8000-" + `${tid}${shared ? 1 : 0}`.padEnd(12, "0");

async function seedCanaries(t: TenantCtx) {
  const c = canary(t.tid);
  await inT(t, async () => {
    for (const base of [SHARED, ONLY(t.tid)]) {
      const shared = base === SHARED;
      const uid = idOf(base, "user");
      await q("DELETE FROM users WHERE id = :id", { id: uid });
      await q(
        "INSERT INTO users (id, first_name, last_name, email, password, role, created_at, updated_at) VALUES (:id, :f, :l, :e, 'MIS_AUTH', 'student', NOW(), NOW())",
        { id: uid, f: c, l: `${c}-L`, e: `${c.toLowerCase()}.${base}@canary.test` },
      );
      const course = idOf(base, "course");
      await q("DELETE FROM quizzes WHERE id = :id", { id: idOf(base, "quiz") });
      await q(
        "INSERT INTO quizzes (id, title, description, created_by, course_id, status, created_at, updated_at) VALUES (:id, :t, :t, :u, :c, 'published', NOW(), NOW())",
        { id: idOf(base, "quiz"), t: `${c} quiz`, u: uid, c: course },
      );
      await q("DELETE FROM assignments WHERE id = :id", { id: idOf(base, "assignment") });
      await q(
        "INSERT INTO assignments (id, title, description, due_date, max_score, course_id, created_by, status, created_at, updated_at) VALUES (:id, :t, :t, NOW() + INTERVAL 7 DAY, 100, :c, :u, 'published', NOW(), NOW())",
        { id: idOf(base, "assignment"), t: `${c} assignment`, c: course, u: uid },
      );
      await q("DELETE FROM question_bank WHERE id = :id", { id: idOf(base, "question") });
      await q(
        "INSERT INTO question_bank (id, course_id, question_type, question_text, question_data, created_by, created_at, updated_at) VALUES (:id, :c, 'short_answer', :t, '{}', :u, NOW(), NOW())",
        { id: idOf(base, "question"), c: course, t: `${c} question`, u: uid },
      );
      await q("DELETE FROM quiz_questions WHERE quiz_id = :q", { q: idOf(base, "quiz") });
      await q("INSERT INTO quiz_questions (quiz_id, question_id, `order`, created_at, updated_at) VALUES (:q, :qq, 1, NOW(), NOW())", {
        q: idOf(base, "quiz"),
        qq: idOf(base, "question"),
      });
      await q("DELETE FROM report_cards WHERE id = :id", { id: idOf(base, "report") });
      await q(
        "INSERT INTO report_cards (id, uuid, student_id, term, academic_year, status, version, created_at, updated_at) VALUES (:id, :uuid, :s, :t, '2026', 'published', 1, NOW(), NOW())",
        { id: idOf(base, "report"), uuid: reportUuid(t.tid, shared), s: uid, t: `${c} term` },
      );
      await q("DELETE FROM projects WHERE id = :id", { id: idOf(base, "project") });
      await q(
        "INSERT INTO projects (id, owner_id, name, slug, description, kind, visibility, size_bytes, file_count, share_presence, status, created_at, updated_at) VALUES (:id, :u, :n, :s, :n, 'tm', 'course', 0, 0, 0, 'draft', NOW(), NOW())",
        { id: idOf(base, "project"), u: uid, n: `${c} project`, s: `${c.toLowerCase()}-${base}` },
      );
      await q("DELETE FROM manual_assessments WHERE id = :id", { id: idOf(base, "manual") });
      await q(
        "INSERT INTO manual_assessments (id, course_id, title, max_score, term, academic_year, created_at, updated_at) VALUES (:id, :c, :t, 100, 'Term 1', '2026', NOW(), NOW())",
        { id: idOf(base, "manual"), c: course, t: `${c} manual` },
      );
      await q("DELETE FROM submissions WHERE id = :id", { id: idOf(base, "submission") });
      await q(
        "INSERT INTO submissions (id, assignment_id, student_id, text_submission, file_submissions, is_late, status, created_at, updated_at) VALUES (:id, :a, :s, :t, :f, 0, 'submitted', NOW(), NOW())",
        { id: idOf(base, "submission"), a: idOf(base, "assignment"), s: uid, t: `${c} submission`, f: JSON.stringify([{ path: `submissions/${c}.pdf`, filename: `${c}.pdf` }]) },
      );
    }
  });
}

async function dropCanaries(t: TenantCtx) {
  await inT(t, async () => {
    for (const base of [SHARED, ONLY(t.tid)]) {
      await q("DELETE FROM quiz_questions WHERE quiz_id = :q", { q: idOf(base, "quiz") });
      for (const [table, kind] of [
        ["submissions", "submission"],
        ["manual_assessments", "manual"],
        ["projects", "project"],
        ["report_cards", "report"],
        ["question_bank", "question"],
        ["assignments", "assignment"],
        ["quizzes", "quiz"],
        ["users", "user"],
      ] as Array<[string, Kind]>) {
        await q(`DELETE FROM ${table} WHERE id = :id`, { id: idOf(base, kind) });
      }
    }
  });
}

const callers: Array<{ t: TenantCtx; id: number }> = [];
async function mkCaller(t: TenantCtx, role: "admin" | "instructor" | "student") {
  return inT(t, async () => {
    const r = await Role.findOne({ where: { name: role } });
    const u = await User.create({
      first_name: "Crawl",
      last_name: `${role}${t.tid}`,
      email: `crawl.${role}.${t.tid}.${RUN}@local.test`,
      password: "MIS_AUTH",
      role,
      role_id: r?.id ?? null,
      mis_user_id: 760000 + t.tid * 10 + ["admin", "instructor", "student"].indexOf(role),
    } as any);
    callers.push({ t, id: u.id });
    return u;
  });
}

/** Rebuild "/api/x/:p" from an Express 4 mount layer's regexp + keys. */
function mountPath(layer: any): string {
  let i = 0;
  const keys = layer.keys ?? [];
  return String(layer.regexp.source)
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/i, "")
    .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, () => `:${keys[i++]?.name ?? "p"}`)
    .replace(/\\\//g, "/")
    .replace(/\\\./g, ".")
    .replace(/\\-/g, "-");
}

/** Every GET route reachable on the app: [path template]. */
function getRoutes(app: express.Express): string[] {
  const out = new Set<string>();
  const walk = (stack: any[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        if (layer.route.methods?.get) for (const p of paths) if (typeof p === "string") out.add(`${prefix}${p}`.replace(/\/+$/, "") || "/");
      } else if (layer.name === "router" && layer.handle?.stack) {
        walk(layer.handle.stack, `${prefix}${mountPath(layer)}`);
      }
    }
  };
  walk((app as any)._router.stack, "");
  return [...out].sort();
}

/** Which kind of record a path parameter most likely names. */
function kindFor(path: string, param: string): Kind | "uuid" {
  const p = `${path} ${param}`.toLowerCase();
  if (/uuid/.test(param.toLowerCase())) return "uuid";
  if (/submission/.test(param.toLowerCase())) return "submission";
  if (/quiz/.test(param.toLowerCase())) return "quiz";
  if (/assignment/.test(param.toLowerCase())) return "assignment";
  if (/(student|user|owner|teacher|instructor)/.test(param.toLowerCase())) return "user";
  if (/(course|subject)/.test(param.toLowerCase())) return "course";
  if (/question/.test(param.toLowerCase())) return "question";
  if (/(report|card)/.test(param.toLowerCase())) return "report";
  if (/project/.test(param.toLowerCase())) return "project";
  if (/report-card/.test(p)) return "report";
  if (/(quizzes|quiz)/.test(p)) return "quiz";
  if (/assignment/.test(p)) return "assignment";
  if (/submission/.test(p)) return "submission";
  if (/(question)/.test(p)) return "question";
  if (/(project|tmcode|code)/.test(p)) return "project";
  if (/manual/.test(p)) return "manual";
  if (/(users|student|ranking)/.test(p)) return "user";
  return "quiz";
}

function fill(path: string, victim: number, shared: boolean): string {
  const base = shared ? SHARED : ONLY(victim);
  return path
    .replace(/:([A-Za-z0-9_]+)\??/g, (_m, name: string) => {
      const k = kindFor(path, name);
      return k === "uuid" ? reportUuid(victim, shared) : String(idOf(base, k));
    })
    .replace(/\*/g, "editor-images/x.png")
    .replace(/\([^)]*\)/g, "");
}

d("cross-school canary crawl", () => {
  let app: express.Express;
  const people: Record<number, { admin: User; instructor: User; student: User }> = {};

  beforeAll(async () => {
    await ensureModelsRegistered();
    setTenantRegistryForTests(fixedRegistry([T1, T2]));
    await provisionTenant(T2);
    app = buildTestApp();
    app.use("/api/auth", authRoutes);
    app.use("/api/academics", academicsRoutes);
    app.use("/api/tmcode/code", tmcodeCodeRoutes);
    app.use("/api/tmcode/sessions/:sid/code", tmcodeExamCodeRoutes);
    app.get("/api/public/verify/report-card/:uuid", tenantFromCallerHint, verifyReportCard);
    for (const t of [T1, T2]) {
      await seedCanaries(t);
      people[t.tid] = { admin: await mkCaller(t, "admin"), instructor: await mkCaller(t, "instructor"), student: await mkCaller(t, "student") };
    }
  }, 180_000);

  afterAll(async () => {
    for (const t of [T1, T2]) await dropCanaries(t);
    for (const { t, id } of callers) await inT(t, () => User.destroy({ where: { id } }));
    setTenantRegistryForTests(null);
    await sequelize.close();
  });

  it("finds the GET routes on the router stack", () => {
    const routes = getRoutes(app);
    expect(routes.length).toBeGreaterThan(150);
    expect(routes).toContain("/api/quizzes/:id");
    expect(routes).toContain("/api/auth/me");
  });

  it(
    `0 cross-school leaks over every GET route, both directions (${FULL ? "full" : "trimmed"} matrix)`,
    async () => {
      const routes = getRoutes(app);
      const leaks: string[] = [];
      const statuses: Record<string, number> = {};
      let requests = 0;
      let ownSeen = 0;
      const slow = new Set<string>();

      const probe = async (label: string, url: string, headers: Record<string, string>, victim: number, own: number) => {
        requests++;
        let res: request.Response;
        try {
          let r = request(app).get(url).timeout({ response: 2_000, deadline: 3_000 });
          for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
          res = await r;
        } catch (e: any) {
          statuses[e?.timeout ? "timeout" : "error"] = (statuses[e?.timeout ? "timeout" : "error"] ?? 0) + 1;
          slow.add(url.split("?")[0]);
          return;
        }
        statuses[res.status] = (statuses[res.status] ?? 0) + 1;
        const text = `${res.text ?? ""} ${JSON.stringify(res.headers)}`;
        if (text.includes(canary(victim))) leaks.push(`${label} GET ${url} -> ${res.status}`);
        if (text.includes(canary(own))) ownSeen++;
      };

      for (const [attacker, victim] of [
        [T2, T1],
        [T1, T2],
      ] as Array<[TenantCtx, TenantCtx]>) {
        const p = people[attacker.tid];
        const roles = FULL ? (["admin", "instructor", "student"] as const) : (["admin", "student"] as const);
        const sessions = roles.map((r) => [r, signSessionToken({ id: p[r].id, role: r, tid: attacker.tid })] as const);
        const misVictim = jwt.sign({ sub: "1", tid: victim.tid }, "any-mis-key");
        const stepUp = signDbStepUpToken(p.admin.id, attacker.tid);
        const oldStepUp = jwt.sign({ id: p.admin.id, dbAccess: true }, process.env.JWT_SECRET!, { expiresIn: 1200 });
        const adminTok = sessions[0][1];
        const spoofs: Array<[string, Record<string, string>, string]> = [
          ["X-NGA-Tenant", { Authorization: `Bearer ${adminTok}`, "X-NGA-Tenant": String(victim.tid) }, ""],
          ...(FULL
            ? ([
                ["?tid", { Authorization: `Bearer ${adminTok}` }, `tid=${victim.tid}`],
                ["nga_school", { Authorization: `Bearer ${adminTok}`, Cookie: `nga_school=${victim.tid}.abcdefgh12` }, ""],
                ["x-mis-token", { Authorization: `Bearer ${adminTok}`, "x-mis-token": misVictim }, ""],
                ["anon+X-NGA-Tenant", { "X-NGA-Tenant": String(victim.tid) }, `tid=${victim.tid}`],
              ] as Array<[string, Record<string, string>, string]>)
            : []),
          ["step-up as session", { Authorization: `Bearer ${stepUp}`, "X-Db-Access-Token": stepUp }, ""],
          ["old step-up as session", { Authorization: `Bearer ${oldStepUp}`, Cookie: `tm_auth_token=${oldStepUp}` }, ""],
        ];

        for (const route of routes) {
          // TM-ISO-5 (by design): the public QR check ignores any session; who
          // holds a card's uuid may verify it in the school ?tid/X-NGA-Tenant
          // names (else school 1). Checked on its own in the next test.
          if (route.startsWith("/api/public/verify/")) continue;
          // Server-sent streams never finish; the trimmed run skips them (full run probes them with a timeout).
          if (!FULL && /\/(events|live)$/.test(route)) continue;
          for (const shared of [true, false]) {
            const url = fill(route, victim.tid, shared);
            for (const [role, tok] of sessions) {
              await probe(`t${attacker.tid}:${role}`, url, { Authorization: `Bearer ${tok}` }, victim.tid, attacker.tid);
            }
            for (const [label, headers, query] of spoofs) {
              const u = query ? `${url}${url.includes("?") ? "&" : "?"}${query}` : url;
              await probe(`t${attacker.tid}:${label}`, u, headers, victim.tid, attacker.tid);
            }
          }
        }
      }

      // eslint-disable-next-line no-console
      console.info(
        `[crawl] ${routes.length} GET routes, ${requests} requests, statuses ${JSON.stringify(statuses)}, ` +
          `own-school canary seen ${ownSeen}x, leaks ${leaks.length}` +
          (slow.size ? `, no answer in 2 s: ${[...slow].slice(0, 12).join(" ")}` : ""),
      );
      expect(ownSeen).toBeGreaterThan(0); // the crawl does reach data
      expect(leaks).toEqual([]);
    },
    FULL ? 1_800_000 : 600_000,
  );
  it("TM-ISO-5: the public QR check reads only the school it names; no ?tid means school 1 only", async () => {
    const verify = (uuid: string, extra = "") => request(app).get(`/api/public/verify/report-card/${uuid}${extra}`);
    // A school-2 card without ?tid is NOT found (school 1 is searched, never all schools).
    const noTid = await verify(reportUuid(2, false));
    expect(noTid.status).toBe(404);
    expect(noTid.text).not.toContain(canary(2));
    // With ?tid=2 it is (the QR printed on school 2's cards carries it).
    const withTid = await verify(reportUuid(2, false), "?tid=2");
    expect(withTid.status).toBe(200);
    // The same uuid shape in both schools: each hint returns its own school's card only.
    const s1 = await verify(reportUuid(1, true), "?tid=2");
    expect(s1.text).not.toContain(canary(1));
    const t1Card = await verify(reportUuid(1, false), "?tid=2");
    expect(t1Card.status).toBe(404);
    expect(t1Card.text).not.toContain(canary(1));
  });
});
