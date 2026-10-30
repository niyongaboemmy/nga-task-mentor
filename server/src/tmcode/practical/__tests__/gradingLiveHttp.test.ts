import crypto from "crypto";
import http from "http";
import zlib from "zlib";
import express from "express";
import type { AddressInfo } from "net";
import * as access from "../../projects/access";
import * as storage from "../../projects/storage";
import { ProjectRevision } from "../../../models";
import { refreshJudgeInfo, resetJudgeInfo } from "../../../services/coderunner/judgeInfo";
import { resetSessions } from "../../../services/coderunner/sessions";

/**
 * Grading's live Console over HTTP against a REAL tm-judge (TMJUDGE_LIVE=1):
 * the /api/tmcode router as mounted, its session routes, the SSE relay and
 * input, as the Run tab calls them. Only sign-in and the project's storage
 * are stand-ins.
 */

jest.mock("../../../middleware/tmcodeUserAuth", () => ({
  tmcodeUserAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 42, permissions: new Set(["PROJECTS_MONITOR"]) };
    next();
  },
  requireTmPermission: () => (_req: any, _res: any, next: any) => next(),
}));
// eslint-disable-next-line import/first
import tmcodeRoutes from "../../../routes/tmcode";

const live = process.env.TMJUDGE_LIVE === "1";
const d = live ? describe : describe.skip;
jest.setTimeout(120_000);

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const TASKS: Record<string, string> = {
  "Task1/Task1.java": 'public class Task1 { public static void main(String[] a) { System.out.println("Task1"); } }\n',
  "Task3/Task3.java":
    'import java.util.Scanner;\nclass Pet { String name; int age; Pet(String n, int a) { name = n; age = a; } }\npublic class Task3 {\n  public static void main(String[] a) {\n    Scanner in = new Scanner(System.in);\n    System.out.print("Pet name: ");\n    Pet p = new Pet(in.nextLine(), 3);\n    System.out.println(p.name + " is " + p.age);\n  }\n}\n',
  "Task7/Task7.java": 'class Pet { Pet(String n, String k) {} void displayRecords() {} }\npublic class Task7 { public static void main(String[] a) { new Pet("Rex", "dog").displayRecords(); } }\n',
};

d("grading's live Console over HTTP (real tm-judge)", () => {
  let server: http.Server;
  let base = "";
  beforeAll(async () => {
    process.env.CODERUNNER_ENGINE = "tmjudge";
    resetJudgeInfo();
    await refreshJudgeInfo();
    const app = express();
    app.use("/api/tmcode", express.json(), tmcodeRoutes);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/tmcode`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => {
    resetSessions();
    jest.spyOn(access, "resolveProjectAccess").mockResolvedValue({ project: { id: 5, head_revision_id: 9, language: "java" } } as any);
    jest.spyOn(access, "canReadRevision").mockReturnValue(true);
    jest.spyOn(ProjectRevision, "findByPk").mockResolvedValue({ id: 9, project_id: 5, number: 2 } as any);
    jest.spyOn(storage, "readManifest").mockReturnValue(Object.entries(TASKS).map(([p, c]) => ({ path: p, sha256: sha(c), size: c.length })) as any);
    jest.spyOn(storage, "readBlobGz").mockImplementation(async (h: string) => {
      const c = Object.values(TASKS).find((x) => sha(x) === h);
      return c === undefined ? null : zlib.gzipSync(Buffer.from(c));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it("starts Task3 alone, streams its prompt, takes the typed answer, and ends; Stop ends another run", async () => {
    const started = await fetch(`${base}/projects/5/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rev: 9, language: "java", entry: "Task3/Task3.java" }) });
    expect(started.status).toBe(201);
    const info: any = await started.json();
    expect(info).toMatchObject({ language: "java", entry: "Task3/Task3.java", files_sent: ["Task3/Task3.java"] });

    const events = await fetch(`${base}/projects/5/sessions/${info.id}/events`, { headers: { Accept: "text/event-stream" } });
    expect(events.headers.get("content-type")).toMatch(/text\/event-stream/);
    const reader = events.body!.getReader();
    const dec = new TextDecoder();
    let text = "";
    let typed = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      if (!typed && text.includes("Pet name: ")) {
        typed = true;
        const sent = await fetch(`${base}/projects/5/sessions/${info.id}/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: "Rex\n" }) });
        expect(sent.status).toBe(204);
      }
      if (text.includes("event: exit")) break;
    }
    expect(typed).toBe(true);
    expect(text).toContain("Rex is 3");
    expect(text).toMatch(/event: exit\ndata: \{[^}]*"verdict":"ok"/);

    // A program waiting for input, stopped from the page.
    const again: any = await (await fetch(`${base}/projects/5/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rev: 9, language: "java", entry: "Task3/Task3.java" }) })).json();
    const stopped = await fetch(`${base}/projects/5/sessions/${again.id}`, { method: "DELETE" });
    expect(stopped.status).toBe(204);
    const gone = await fetch(`${base}/projects/5/sessions/${again.id}/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: "x\n" }) });
    expect(gone.status).toBe(409);
  });

  it("runs the saved tests on Task1 alone and compares the expected output", async () => {
    const res = await fetch(`${base}/projects/5/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rev: 9, language: "java", entry: "Task1/Task1.java", tests: [{ id: "t1", input: "", expected_output: "Task1\n" }, { id: "t2", input: "", expected_output: "Task one\n" }] }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.files_sent).toEqual(["Task1/Task1.java"]);
    expect(body.tests.map((t: any) => t.verdict)).toEqual(["accepted", "wrong-answer"]);
  });
});
