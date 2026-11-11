import { getSession, resetSessions, startSession } from "../sessions";
import { clearContextsForTests, getContext, saveContext } from "../../ai/generationContextStore";
import { clearJobsForTests, createJob, getJob } from "../../ai/generationJobs";
import { primaryTenantCtx, runWithTenant } from "../../../vendor/nga-tenancy";

// Local user ids (and MIS course ids) repeat across schools: an in-memory
// record is its owner's only inside the tenant that created it.
const T2 = { ...primaryTenantCtx(), tid: 2, slug: "two", name: "Two", isPrimary: false };
const ENV = { ...process.env };

describe("in-memory records carry their tenant", () => {
  afterEach(() => {
    process.env = { ...ENV };
    resetSessions();
    clearContextsForTests();
    clearJobsForTests();
    jest.restoreAllMocks();
  });

  it("an interactive run session of user 7 in school 1 is not school 2's user 7's, and starting one there doesn't stop it", async () => {
    process.env.CODERUNNER_ENGINE = "tmjudge";
    let n = 0;
    const calls: string[] = [];
    jest.spyOn(global, "fetch").mockImplementation(async (url: any, init: any) => {
      calls.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).endsWith("/v1/health")) return new Response(JSON.stringify({ features: ["sessions"] }), { status: 200 });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ id: `r${++n}` }), { status: 201 });
    });
    const one = await startSession(7, { files: [{ path: "a.py", content: "print(1)" }] });
    expect(getSession(one.id, 7)).toBe(one);
    expect(() => runWithTenant(T2, () => getSession(one.id, 7))).toThrow(/ended/);
    const two = await runWithTenant(T2, () => startSession(7, { files: [{ path: "a.py", content: "print(2)" }] }));
    expect(one.closed).toBe(false);
    expect(calls.some((c) => c.startsWith("DELETE"))).toBe(false);
    expect(runWithTenant(T2, () => getSession(two.id, 7))).toBe(two);
    expect(() => getSession(two.id, 7)).toThrow(/ended/);
  });

  it("prepared AI generation sources and jobs stay in their school", async () => {
    const ctx = saveContext({ userId: 3, courseId: 9, text: "t", label: "l", origin: "document", parts: [], truncated: false });
    expect(getContext(ctx.id, 3, 9)).not.toBeNull();
    expect(runWithTenant(T2, () => getContext(ctx.id, 3, 9))).toBeNull();
    const job = createJob(3, 9, async () => ({ status: 200, payload: {} }));
    expect(getJob(job.id, 3, 9)).toBe(job);
    expect(runWithTenant(T2, () => getJob(job.id, 3, 9))).toBeNull();
  });
});

describe("code runner stats are per school", () => {
  const { recordRun, resetRunStats, runStats } = require("../stats");
  afterEach(() => resetRunStats());
  it("an admin sees only their own school's runs and errors", () => {
    recordRun({ at: "x", engine: "tmjudge", language: "python", tests: 1, ms: 5, outcome: "ok" });
    runWithTenant(T2, () => recordRun({ at: "y", engine: "tmjudge", language: "c", tests: 1, ms: 9, outcome: "RUNNER_DOWN", message: "school 2" }));
    expect(runStats().window).toBe(1);
    expect(runStats().recent_errors).toEqual([]);
    const two = runWithTenant(T2, () => runStats());
    expect(two.window).toBe(1);
    expect(two.recent_errors).toEqual([expect.objectContaining({ message: "school 2" })]);
    expect(two.recent_errors[0].tid).toBeUndefined();
  });
});
