import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { resetRunStats } from "../services/coderunner/stats";

/** Admin → Code runner status (CODE_RUNNER_PLAN.md phase 1). */

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let studentToken: string;
const ENV = { ...process.env };

beforeAll(async () => {
  await ensureModelsRegistered();
  // The real migration (idempotent): CODE_RUNNER_ADMIN for the admin role.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration = require("../../migrations/20261012160000-add-code-runner-admin-permission.js");
  await migration.up(sequelize.getQueryInterface());
  await migration.up(sequelize.getQueryInterface()); // twice: no duplicates
  app = buildTestApp();
  adminToken = signTokenFor((await findSeededUserByRole("admin")).id);
  studentToken = signTokenFor((await findSeededUserByRole("student")).id);
});
afterAll(async () => {
  process.env = ENV;
  await sequelize.close();
});

describe("GET /api/code-runner/status", () => {
  it("tells an admin which engine runs which language, and that tm-judge is unreachable", async () => {
    resetRunStats();
    process.env.CODERUNNER_ENGINE = "tmjudge";
    process.env.TMJUDGE_TOKEN = "x".repeat(32);
    process.env.TMJUDGE_URL = "http://127.0.0.1:9"; // nothing listens here
    process.env.JUDGE0_API_KEY = "test-key";
    const res = await request(app).get("/api/code-runner/status").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.engine).toBe("tmjudge");
    expect(d.engines.tmjudge).toMatchObject({ configured: true, reachable: false });
    expect(d.engines.judge0.role).toBe("fallback");
    const lang = (k: string) => d.languages.find((l: any) => l.key === k);
    expect(lang("python")).toMatchObject({ engine: "tmjudge", available: true });
    expect(lang("go")).toMatchObject({ engine: "judge0", available: true });
    expect(d.runs).toMatchObject({ window: 0 });
  });

  it("is admin-only", async () => {
    const res = await request(app).get("/api/code-runner/status").set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});
