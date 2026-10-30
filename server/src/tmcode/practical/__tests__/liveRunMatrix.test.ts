import crypto from "crypto";
import zlib from "zlib";
import { runProject, runTargets, startProjectSession } from "../../../controllers/tmcodePracticals.controller";
import { getSession, openEvents, resetSessions, sendInput } from "../../../services/coderunner/sessions";
import { practiceRun } from "../../../controllers/codeRun.controller";
import * as access from "../../projects/access";
import * as storage from "../../projects/storage";
import { ProjectRevision } from "../../../models";
import { refreshJudgeInfo, resetJudgeInfo } from "../../../services/coderunner/judgeInfo";
import { LIVE_CASES, type LiveCase } from "./cases.live";

/**
 * The run matrix against a REAL tm-judge (TMJUDGE_LIVE=1, TMJUDGE_URL,
 * TMJUDGE_TOKEN): each submission through grading's Run (run-targets, then
 * /run as the Run tab sends it) and through the MIS Code Playground's path
 * (practiceRun with the relay's request). Skipped without a judge.
 */

const live = process.env.TMJUDGE_LIVE === "1";
const d = live ? describe : describe.skip;
jest.setTimeout(600_000);

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function mockRevision(files: Record<string, string>) {
  jest.spyOn(access, "resolveProjectAccess").mockResolvedValue({ project: { id: 5, head_revision_id: 9, language: null } } as any);
  jest.spyOn(access, "canReadRevision").mockReturnValue(true);
  jest.spyOn(ProjectRevision, "findByPk").mockResolvedValue({ id: 9, project_id: 5, number: 1 } as any);
  jest.spyOn(storage, "readManifest").mockReturnValue(Object.entries(files).map(([p, c]) => ({ path: p, sha256: sha(c), size: Buffer.byteLength(c) })) as any);
  jest.spyOn(storage, "readBlobGz").mockImplementation(async (h: string) => {
    const c = Object.values(files).find((x) => sha(x) === h);
    return c === undefined ? null : zlib.gzipSync(Buffer.from(c));
  });
}

const fakeRes = () => {
  const res: any = { statusCode: 200, body: null };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  return res;
};

/** The relay's main-file naming (nga_central_mis backend relay.ts mainFileFor). */
function relayRequest(c: LiveCase) {
  const paths = Object.keys(c.files);
  if (paths.length === 1 && !c.entry) {
    const code = c.files[paths[0]];
    const main =
      c.language === "java"
        ? `${code.match(/\bpublic\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_]\w*)/)?.[1] ?? "Main"}.java`
        : paths[0];
    return { language: c.language, entry: main, files: [{ path: main, content: code }] };
  }
  const entry = c.entry ?? paths[0];
  return { language: c.language, entry, files: [{ path: entry, content: c.files[entry] }, ...paths.filter((p) => p !== entry).map((p) => ({ path: p, content: c.files[p] }))] };
}

export type Outcome = { verdict: string; out: string; note: string };

const summarise = (res: any): Outcome => {
  if (res.statusCode !== 200) return { verdict: `HTTP ${res.statusCode} ${res.body?.code ?? ""}`, out: "", note: String(res.body?.message ?? "").slice(0, 160) };
  const b = res.body?.data ?? res.body;
  const t = b?.tests?.[0];
  const compileFailed = b?.compile && !b.compile.ok;
  return {
    verdict: compileFailed ? "compile-error" : t?.verdict ?? "?",
    out: String(t?.stdout ?? ""),
    note: String((compileFailed ? b.compile.output : t?.stderr) ?? b?.error?.message ?? "")
      .replace(/\s+/g, " ")
      .slice(0, 160),
  };
};

export async function gradingRun(c: LiveCase): Promise<Outcome> {
  mockRevision(c.files);
  const t = fakeRes();
  await runTargets({ params: { id: "5" }, query: {}, user: { id: 1 } } as any, t);
  const targets = t.body;
  const project = targets?.project ?? null;
  const language = project?.language ?? targets?.language ?? null;
  // The teacher picks the program to run when the case names one.
  const entry = c.entry ?? project?.entry ?? targets?.entries?.[0] ?? null;
  // LIVE_OLD_CLIENT=1: the Run tab before this change (always the detected kind).
  const body = {
    ...(project && process.env.LIVE_OLD_CLIENT === "1" ? { kind: project.kind, entry: project.chooses_entry ? entry : null } : { language, entry: !project || project.chooses_entry ? entry : null }),
    tests: [{ id: "c1", input: c.input, expected_output: c.expected }],
  };
  const res = fakeRes();
  await runProject({ params: { id: "5" }, body, user: { id: 1 } } as any, res);
  return summarise(res);
}

export async function playgroundRun(c: LiveCase): Promise<Outcome> {
  const res = fakeRes();
  await practiceRun({ body: { ...relayRequest(c), tests: [{ id: "run", input: c.input, expected_output: c.expected }] }, user: { id: 1 } } as any, res);
  return summarise(res);
}

/**
 * Grading's live Console: start the revision's program (POST /projects/:id/sessions, as
 * the Run tab does), read its output as it streams, and type each input line once the
 * program has printed its prompt (or has been quiet a moment), then wait for it to exit.
 */
export async function gradingLive(c: LiveCase): Promise<Outcome> {
  mockRevision(c.files);
  const t = fakeRes();
  await runTargets({ params: { id: "5" }, query: {}, user: { id: 1 } } as any, t);
  const project = t.body?.project ?? null;
  const entry = c.entry ?? project?.entry ?? t.body?.entries?.[0] ?? null;
  const res = fakeRes();
  await startProjectSession({ params: { id: "5" }, body: { language: project?.language ?? t.body?.language, entry: !project || project.chooses_entry ? entry : null }, user: { id: 1 } } as any, res);
  if (res.statusCode !== 201) return { verdict: `HTTP ${res.statusCode} ${res.body?.code ?? ""}`, out: "", note: String(res.body?.message ?? "") };
  const s = getSession(res.body.id, 1);
  const lines = c.input.split(/(?<=\n)/).filter(Boolean);
  const ctrl = new AbortController();
  const stream = await openEvents(s, ctrl.signal);
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  let err = "";
  let exit: any = null;
  let pending = lines.length ? setTimeout(() => void typeNext(), 2500) : null;
  async function typeNext() {
    const line = lines.shift();
    if (pending) clearTimeout(pending);
    pending = null;
    if (line === undefined) return;
    await sendInput(s, { data: line });
    // After the last line, "End input" if the program still waits (readline, read to the end).
    pending = setTimeout(() => (lines.length ? void typeNext() : void sendInput(s, { eof: true }).catch(() => undefined)), lines.length ? 2500 : 3000);
  }
  const deadline = setTimeout(() => ctrl.abort(), 120_000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const event = /^event: (.*)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (!event || !data) continue;
        const d = JSON.parse(data);
        if (event === "stdout") {
          out += d.data;
          // A prompt (no newline after it): the program waits, type the next line.
          if (!out.endsWith("\n") && lines.length) void typeNext();
        } else if (event === "stderr") err += d.data;
        else if (event === "exit") exit = d;
      }
      if (exit) break;
    }
  } catch {
    // aborted
  } finally {
    clearTimeout(deadline);
    if (pending) clearTimeout(pending);
    ctrl.abort();
  }
  const verdict = !exit ? "no-exit" : exit.verdict !== "ok" ? exit.verdict : out === c.expected ? "accepted" : "wrong-answer";
  return { verdict, out, note: err.replace(/\s+/g, " ").slice(0, 160) || JSON.stringify(out) };
}

d("live run matrix (real tm-judge)", () => {
  const rows: string[] = [];
  beforeAll(async () => {
    process.env.CODERUNNER_ENGINE = "tmjudge";
    resetJudgeInfo();
    await refreshJudgeInfo();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    console.log(["case | grading /run | grading live | playground /run", ...rows].join("\n"));
  });

  const only = process.env.LIVE_ONLY ? new RegExp(process.env.LIVE_ONLY, "i") : null;
  for (const c of LIVE_CASES.filter((x) => !only || only.test(x.name))) {
    it(c.name, async () => {
      const g = await gradingRun(c);
      jest.restoreAllMocks();
      const p = await playgroundRun(c);
      jest.restoreAllMocks();
      resetSessions();
      const l = await gradingLive(c);
      const cell = (o: Outcome) => `${o.verdict}${o.verdict === "accepted" ? "" : ` (${o.note || JSON.stringify(o.out)})`}`;
      rows.push(`${c.name} | ${cell(g)} | ${cell(l)} | ${cell(p)}`);
      // Cases needing what this machine may lack (Maven Central, cmake, the JUnit jar) are reported only.
      if (!c.optional) {
        expect(g.verdict).toBe("accepted");
        expect(p.verdict).toBe("accepted");
        // Live output carries what was typed only on a terminal: compare without it.
        expect(c.readsAllAtOnce || l.verdict === "accepted" || (l.verdict === "wrong-answer" && l.out.replace(/\s+/g, "") === c.expected.replace(/\s+/g, ""))).toBe(true);
      }
    });
  }
});
