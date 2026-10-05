import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { Judge0Service } from "../services/Judge0Service";

/**
 * "Run" / "Run tests" for code questions against the dev DB. The judge is
 * stubbed: nothing here reaches Judge0.
 */

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;

const judgeOk = (stdout: string) => ({
  stdout,
  stderr: null,
  compile_output: null,
  message: null,
  time: "0.01",
  memory: 100,
  token: "t",
  status: { id: 3, description: "Accepted" },
});

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  adminToken = signTokenFor(admin.id);
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  await sequelize.close();
});

const asAdmin = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

describe("languages (TM-FIX-4)", () => {
  it("GET /quizzes/code-languages lists judge runtimes and web preview languages", async () => {
    const res = await asAdmin(request(app).get("/api/quizzes/code-languages"));
    expect(res.status).toBe(200);
    const keys = res.body.data.judge.map((l: any) => l.key);
    expect(keys).toEqual(expect.arrayContaining(["python", "javascript", "java", "cpp"]));
    expect(res.body.data.web_preview).toContain("html");
  });

  it("refuses to run an unsupported language with 400 UNSUPPORTED_LANGUAGE", async () => {
    const run = jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("1") as any);
    const res = await asAdmin(request(app).post("/api/quizzes/preview-run")).send({
      code: "SELECT 1;",
      language: "sql",
      test_cases: [{ id: "t", input: "", expected_output: "1" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_LANGUAGE");
    expect(run).not.toHaveBeenCalled();
  });
});
