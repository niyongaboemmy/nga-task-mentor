import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Judge0Service, RunnerRejectedError } from "../services/Judge0Service";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";

/** POST /api/code/run: practice runs for the Playground and the project editor. */

let app: ReturnType<typeof buildTestApp>;
let token: string;
let studentId: number;
const ENV = { ...process.env };

const ok = (stdout: string) => ({
  stdout, stderr: null, compile_output: null, message: null, time: "0.01", memory: 100, token: "t",
  status: { id: 3, description: "Accepted" },
});

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const student = await findSeededUserByRole("student");
  studentId = student.id;
  token = signTokenFor(student.id);
  delete process.env.CODERUNNER_ENGINE; // Judge0, stubbed
});
beforeEach(() => codeRunLimiter.resetKey(`code-run:${studentId}`));
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  process.env = ENV;
  await sequelize.close();
});

const run = (body: object) => request(app).post("/api/code/run").set("Authorization", `Bearer ${token}`).send(body);

describe("practice runs", () => {
  it("runs the detected program with each input and reports the verdicts", async () => {
    const single = jest.spyOn(Judge0Service, "runSingle").mockResolvedValueOnce(ok("5\n") as any).mockResolvedValueOnce(ok("9\n") as any);
    const res = await run({
      files: [
        { path: "helpers.py", content: "def add(a, b):\n    return a + b\n" },
        { path: "main.py", content: "a, b = map(int, input().split())\nprint(a + b)\n" },
      ],
      tests: [
        { id: "a", input: "2 3" },
        { id: "b", input: "4 4", expected_output: "8" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ language: "python", entry: "main.py" });
    expect(res.body.data.tests.map((t: any) => t.verdict)).toEqual(["ok", "wrong-answer"]);
    expect(single.mock.calls[0][0]).toContain("input().split()");
  });

  it("explains what it can't run", async () => {
    expect((await run({ files: [{ path: "index.html", content: "<p>hi</p>" }], tests: [{ id: "a", input: "" }] })).body.code).toBe("NOTHING_TO_RUN");
    expect((await run({ language: "html", files: [{ path: "index.html", content: "x" }], tests: [{ id: "a", input: "" }] })).body.code).toBe("USE_PREVIEW");
    expect((await run({ files: [{ path: "../etc/passwd.py", content: "x" }], tests: [{ id: "a", input: "" }] })).status).toBe(400);
    expect((await run({ files: [], tests: [{ id: "a", input: "" }] })).status).toBe(400);
  });

  it("takes a project up to 1 MB, refuses more", async () => {
    jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(ok("x") as any);
    const big = "#".repeat(600 * 1024);
    const fine = await run({ files: [{ path: "main.py", content: "print(1)\n" }, { path: "notes.txt", content: big }], tests: [{ id: "a", input: "" }] });
    expect(fine.status).toBe(200);
    const tooBig = await run({ files: [{ path: "main.py", content: big + big }], tests: [{ id: "a", input: "" }] });
    expect(tooBig.status).toBe(413);
  });

  it("answers clearly when the runner refuses", async () => {
    jest.spyOn(Judge0Service, "runSingle").mockRejectedValue(new RunnerRejectedError("The code runner refused the request (403).", 403));
    const res = await run({ files: [{ path: "main.py", content: "print(1)" }], tests: [{ id: "a", input: "" }] });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("RUNNER_REJECTED");
  });

  it("lists the languages the runner runs", async () => {
    const res = await request(app).get("/api/code/languages").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: any) => l.key)).toEqual(expect.arrayContaining(["python", "java", "cpp"]));
  });
});

describe("catalog and starters", () => {
  const get = (path: string) => request(app).get(path).set("Authorization", `Bearer ${token}`);

  it("lists languages with their project types and whether they run here", async () => {
    const res = await get("/api/code/catalog");
    expect(res.status).toBe(200);
    const lang = (k: string) => res.body.data.languages.find((l: any) => l.key === k);
    expect(lang("python")).toMatchObject({ enabled: true, runnable: true });
    expect(lang("python").kinds.map((k: any) => k.id)).toEqual(expect.arrayContaining(["python/single", "python/project"]));
    expect(lang("csharp")).toMatchObject({ enabled: false, runnable: false });
    expect(res.body.data.version).toMatch(/^\d{4}\./);
  });

  it("filters starters, and serves one with its files", async () => {
    const all = (await get("/api/code/starters")).body.data;
    expect(all.length).toBeGreaterThan(40);
    expect(all[0].files).toBeUndefined(); // the list has no file contents
    const java = (await get("/api/code/starters?language=java&purpose=project")).body.data;
    expect(java.length).toBeGreaterThan(0);
    expect(java.every((s: any) => s.language === "java" && s.purpose === "project")).toBe(true);
    const one = (await get(`/api/code/starters/${java[0].id}`)).body.data;
    expect(one.files.length).toBe(one.paths.length);
    expect(one.files.find((f: any) => f.path === "pom.xml" || f.path.endsWith(".java"))).toBeTruthy();
    expect((await get("/api/code/starters/nope")).status).toBe(404);
  });

  it("finds a migrated TMCode template by its old id", async () => {
    const res = await get("/api/code/starters/node-express");
    expect(res.status).toBe(200);
    expect(res.body.data.paths).toContain("src/index.js");
  });
});
