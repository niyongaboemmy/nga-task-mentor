import crypto from "crypto";
import zlib from "zlib";
import { runProject, startProjectSession } from "../../../controllers/tmcodePracticals.controller";
import * as access from "../../projects/access";
import * as storage from "../../projects/storage";
import * as coderunner from "../../../services/coderunner";
import * as sessions from "../../../services/coderunner/sessions";
import * as projectKind from "../../../services/coderunner/projectKind";
import * as judgeInfo from "../../../services/coderunner/judgeInfo";
import { ProjectRevision } from "../../../models";

/**
 * Grading's Run tab: the live Console (POST /projects/:id/sessions) and the
 * saved inputs (POST /projects/:id/run) send the revision's program the way
 * the playground sends files (planRun): one Task folder of "Assignment 1 of
 * Java Programming" at a time, never the whole repository.
 */

const TASKS: Record<string, string> = {
  "Task1/Task1.java": 'public class Task1 { public static void main(String[] a) { System.out.println("1"); } }\n',
  "Task3/Task3.java": 'class Pet { Pet(String n, int a) {} }\npublic class Task3 { public static void main(String[] a) { new Pet("Rex", 3); } }\n',
  "Task7/Task7.java": 'class Pet { Pet(String n, String k) {} void displayRecords() {} }\npublic class Task7 { public static void main(String[] a) { new Pet("Rex", "dog").displayRecords(); } }\n',
};
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const javaSingle = { kind: "java/single", label: "Java – source files (no build tool)", language: "java", entry: "Task1/Task1.java", actions: ["build", "run", "test"], available: true, webApp: false };

const res = () => {
  const r: any = { statusCode: 0, body: null };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  return r;
};

let files: Record<string, string> = TASKS;
const run = jest.fn();
beforeEach(() => {
  files = TASKS;
  jest.spyOn(access, "resolveProjectAccess").mockResolvedValue({ project: { id: 5, head_revision_id: 9, language: "java" } } as any);
  jest.spyOn(access, "canReadRevision").mockReturnValue(true);
  jest.spyOn(ProjectRevision, "findByPk").mockResolvedValue({ id: 9, project_id: 5, number: 4 } as any);
  jest.spyOn(storage, "readManifest").mockImplementation(() => Object.entries(files).map(([p, c]) => ({ path: p, sha256: sha(c), size: c.length })) as any);
  jest.spyOn(storage, "readBlobGz").mockImplementation(async (h: string) => {
    const c = Object.values(files).find((x) => sha(x) === h);
    return c === undefined ? null : zlib.gzipSync(Buffer.from(c));
  });
  jest.spyOn(projectKind, "detectProject").mockResolvedValue(javaSingle);
  jest.spyOn(judgeInfo, "judgeHas").mockReturnValue(true);
  jest.spyOn(judgeInfo, "judgeRunsLanguage").mockReturnValue(true);
  jest.spyOn(coderunner, "getCodeRunner").mockReturnValue({ name: "tmjudge", engineFor: () => "tmjudge", supportsLanguage: () => true, languages: () => ["java"], run } as any);
  run.mockReset().mockResolvedValue({ engine: "tmjudge", compile: { ok: true, output: "" }, tests: [{ id: "t1", verdict: "accepted", passed: true, stdout: "Rex is 3\n", stderr: null, exit_code: 0, time_ms: 40, memory_kb: 9000 }] });
});
afterEach(() => jest.restoreAllMocks());

describe("POST /projects/:id/sessions (grading's live Console)", () => {
  it("starts only the chosen Task folder, as the playground would send it", async () => {
    const start = jest.spyOn(sessions, "startSession").mockResolvedValue({ id: "abc123def456", runnerId: "r1", userId: 7, createdAt: 0, closed: false });
    const r = res();
    await startProjectSession({ params: { id: "5" }, body: { rev: 9, language: "java", entry: "Task3/Task3.java" }, user: { id: 7 } } as any, r);
    expect(r.statusCode).toBe(201);
    expect(r.body).toMatchObject({ id: "abc123def456", language: "java", entry: "Task3/Task3.java", revision: { id: 9, number: 4 }, files_sent: ["Task3/Task3.java"] });
    expect(start).toHaveBeenCalledWith(7, { language: "java", kind: null, entry: "Task3/Task3.java", files: [{ path: "Task3/Task3.java", content: TASKS["Task3/Task3.java"] }] });
  });

  it("says plainly that a browser app has no program to run", async () => {
    jest.spyOn(projectKind, "detectProject").mockResolvedValue({ kind: "js/vite", label: "React app (Vite)", language: "javascript", entry: null, actions: ["build"], available: true, webApp: true });
    const start = jest.spyOn(sessions, "startSession");
    const r = res();
    await startProjectSession({ params: { id: "5" }, body: {}, user: { id: 7 } } as any, r);
    expect(r.statusCode).toBe(422);
    expect(r.body.error_code ?? r.body.code).toBe("NOT_A_PROGRAM");
    expect(start).not.toHaveBeenCalled();
  });

  it("passes on the runner's refusal (live runs off) for the page to fall back to the tests", async () => {
    jest.spyOn(sessions, "startSession").mockRejectedValue(new sessions.SessionError(409, "INTERACTIVE_UNAVAILABLE", "Interactive runs aren't available here yet: use Run with input."));
    const r = res();
    await startProjectSession({ params: { id: "5" }, body: { entry: "Task1/Task1.java" }, user: { id: 7 } } as any, r);
    expect(r.statusCode).toBe(409);
    expect(r.body.error_code ?? r.body.code).toBe("INTERACTIVE_UNAVAILABLE");
  });
});

describe("POST /projects/:id/run (grading's saved inputs)", () => {
  it("runs one Task folder with the expected output to compare, Java named after its public class", async () => {
    files = { ...TASKS, "Task3/Main.java": "x" };
    delete files["Task3/Task3.java"];
    files["Task3/Main.java"] = TASKS["Task3/Task3.java"];
    const r = res();
    await runProject({ params: { id: "5" }, body: { language: "java", entry: "Task3/Main.java", tests: [{ id: "t1", input: "Rex\n", expected_output: "Rex is 3\n" }] }, user: { id: 7 } } as any, r);
    expect(r.statusCode).toBe(200);
    const req = run.mock.calls[0][0];
    expect(req).toMatchObject({ language: "java", entry: "Task3/Task3.java", tests: [{ id: "t1", input: "Rex\n", expected_output: "Rex is 3\n" }] });
    expect(req.kind).toBeUndefined();
    expect(req.files.map((f: any) => f.path)).toEqual(["Task3/Task3.java"]);
    // The teacher sees the student's own file name.
    expect(r.body).toMatchObject({ entry: "Task3/Main.java", language: "java", tests: [{ verdict: "accepted" }] });
  });
});
