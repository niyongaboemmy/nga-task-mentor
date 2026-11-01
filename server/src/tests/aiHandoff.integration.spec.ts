import request from "supertest";
import axios from "axios";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import * as registry from "../services/aiProviders/registry";
import * as jobs from "../services/ai/generationJobs";
import { saveContext, clearContextsForTests } from "../services/ai/generationContextStore";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { AI_POLICY_DEFAULT } from "../vendor/nga-access";
import {
  __setMisPermissionsFetcher,
  assertHandoffAllowed,
  parseHandoff,
  readPastedJson,
  scrub,
} from "../services/aiHandoff";
import { generateStructuredContent } from "../services/aiProviders/generate";

/**
 * "Open in Claude / ChatGPT" + "Paste the answer" (EXTERNAL_AI_CONTRACT.md §1) on the real
 * routes and dev DB: the rubric, the report comment (pupil data) and the question generator
 * (incl. its job path). No provider is ever called: registry.orderedProviders is watched.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const SUBJ = 990777;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };
const ON: { connector: boolean; handoff: boolean; pupilNames: "never" | "with_consent" } = { connector: true, handoff: true, pupilNames: "with_consent" };
const policy = (external: Partial<typeof ON> = {}, extra: Record<string, unknown> = {}) =>
  setAiPolicyForTests({ ...AI_POLICY_DEFAULT, v: 1, enabled: true, external: { ...ON, ...external }, ...extra } as any);

let app: ReturnType<typeof buildTestApp>;
let instructorId: number;
let instructorToken: string;
let providers: jest.SpyInstance;
let externalPerms: string[] = ["AI_EXTERNAL_CONNECT"];

const as = (r: request.Test, token = instructorToken) => r.set("Authorization", `Bearer ${token}`).set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  instructorId = instructor.id;
  instructorToken = signTokenFor(instructor.id);
});

beforeEach(() => {
  policy();
  externalPerms = ["AI_EXTERNAL_CONNECT"];
  __setMisPermissionsFetcher(async () => externalPerms);
  mockedGet.mockReset();
  mockedGet.mockImplementation(async (url: string) => {
    if (String(url).includes("/users/me")) return { data: { success: true, data: { currentAcademicTerms: [] } } };
    return { data: { success: true, data: [] } };
  });
  providers = jest.spyOn(registry, "orderedProviders");
});

afterEach(() => providers.mockRestore());

afterAll(async () => {
  __setMisPermissionsFetcher(null);
  resetAiPolicyCache();
  clearContextsForTests();
  await sequelize.close();
});

const RUBRIC = {
  title: "Landing page",
  description: "<p>Build a landing page. Questions to teacher@school.rw or +250 788 123 456.</p>",
  max_score: 10,
};

describe("rubric hand-off", () => {
  const post = (body: object) => as(request(app).post("/api/assignments/ai/rubric")).send({ ...RUBRIC, ...body });

  it("prompt mode returns the exact prompt, scrubbed, with the JSON instruction, and calls no provider", async () => {
    const res = await post({ aiHandoff: { mode: "prompt" } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.handoff).toMatchObject({ expects: "json", schemaName: "assignment_rubric" });
    const prompt: string = res.body.handoff.prompt;
    expect(prompt).toContain("TOTAL MARKS: 10");
    expect(prompt).toContain("Answer with ONLY one JSON object that matches this JSON Schema, inside a ```json code block");
    expect(prompt).toContain('"found_in_description"');
    expect(prompt).toContain("[email]");
    expect(prompt).toContain("[phone]");
    expect(prompt).not.toContain("teacher@school.rw");
    expect(providers).not.toHaveBeenCalled();
  });

  it("import mode uses the pasted JSON as the AI answer and runs the normal post-processing", async () => {
    const pasted = `Sure! Here it is:\n\`\`\`json\n${JSON.stringify({
      found_in_description: false,
      note: "Built from the task.",
      criteria: [
        { name: "Layout", description: "Grid", points: 3 },
        { name: "Copy", description: "Clear text", points: 1 },
      ],
    })}\n\`\`\``;
    const res = await post({ aiHandoff: { mode: "import", text: pasted } });
    expect(res.status).toBe(200);
    expect(res.body.ai).toEqual({ route: "handoff", reason: "HANDOFF" });
    expect(res.body.data.total).toBe(10);
    expect(res.body.data.criteria.map((c: any) => c.max_score)).toEqual([8, 2]);
    expect(res.body.data.provider_used).toBe("handoff");
    expect(providers).not.toHaveBeenCalled();
  });

  it("a paste that doesn't match the schema is a 400 the teacher can act on", async () => {
    const res = await post({ aiHandoff: { mode: "import", text: '```json\n{"criteria": "nope"}\n```' } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("AI_HANDOFF_BAD_ANSWER");
    expect(res.body.message).toMatch(/isn't in the expected format/);
    const empty = await post({ aiHandoff: { mode: "import", text: "   " } });
    expect(empty.status).toBe(400);
  });

  it("is refused when the school has hand-off off (AI_HANDOFF_OFF)", async () => {
    policy({ handoff: false });
    const res = await post({ aiHandoff: { mode: "prompt" } });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: "AI_HANDOFF_OFF" });
  });

  it("is refused without AI_EXTERNAL_CONNECT in the person's MIS permissions (AI_HANDOFF_NOT_ALLOWED)", async () => {
    externalPerms = ["AI_USE"];
    __setMisPermissionsFetcher(async () => externalPerms);
    const res = await post({ aiHandoff: { mode: "prompt" } });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("AI_HANDOFF_NOT_ALLOWED");
  });

  it("still sits behind the school's AI switch (AI_DISABLED)", async () => {
    policy({}, { enabled: false });
    const res = await post({ aiHandoff: { mode: "prompt" } });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("AI_DISABLED");
  });
});

describe("report comment hand-off (pupil data)", () => {
  const body = {
    term: "Term 1",
    academic_year: "2026",
    subjects: [{ name: "Maths", score: 81 }],
    attributes: [{ attribute_name: "Punctuality", rating: "Excellent" }],
  };
  const post = (aiHandoff: object) => as(request(app).post("/api/report-cards/ai-comment")).send({ ...body, aiHandoff });

  it("needs the teacher's consent for this request", async () => {
    const res = await post({ mode: "prompt" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("AI_HANDOFF_PUPIL_CONSENT");
    const ok = await post({ mode: "prompt", pupilConsent: true });
    expect(ok.status).toBe(200);
    expect(ok.body.handoff.prompt).toContain("Maths: 81/100");
    expect(providers).not.toHaveBeenCalled();
  });

  it("is refused even with consent when the school says never", async () => {
    policy({ pupilNames: "never" });
    const res = await post({ mode: "prompt", pupilConsent: true });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("AI_HANDOFF_PUPIL_CONSENT");
  });

  it("imports a pasted comment (no consent needed to bring an answer back)", async () => {
    const res = await post({ mode: "import", text: '{"comment":"[NAME] works hard in Maths."}' });
    expect(res.status).toBe(200);
    expect(res.body.data.comment).toContain("[NAME]");
    expect(res.body.ai.route).toBe("handoff");
  });
});

describe("question generator hand-off (incl. the job path)", () => {
  const base = `/api/courses/${SUBJ}/question-bank`;
  const plan = [{ question_type: "single_choice", EASY: 1, MEDIUM: 0, DIFFICULT: 0 }];
  const ctx = () =>
    saveContext({
      userId: instructorId,
      courseId: SUBJ,
      text: "HTTP is the protocol browsers use to ask servers for pages. ".repeat(10),
      label: "Web notes",
      origin: "document",
      parts: [],
      truncated: false,
    } as any);

  it("prompt mode with async:true answers with the batch prompt at once and starts no job", async () => {
    const createJob = jest.spyOn(jobs, "createJob");
    const res = await as(request(app).post(`${base}/ai/generate`)).send({
      context_id: ctx().id,
      plan,
      async: true,
      aiHandoff: { mode: "prompt" },
    });
    expect(res.status).toBe(200);
    expect(res.body.handoff.expects).toBe("json");
    expect(res.body.handoff.prompt).toContain("HTTP is the protocol");
    expect(res.body.handoff.prompt).toContain("inside a ```json code block");
    expect(res.body.job_id).toBeUndefined();
    expect(createJob).not.toHaveBeenCalled();
    expect(providers).not.toHaveBeenCalled();
    createJob.mockRestore();
  });

  it("import mode returns the pasted questions through the normal validation path", async () => {
    const question = {
      question_type: "single_choice",
      question_text: `Which program asks a web server for a page? ${Date.now()}`,
      question_data: { options: ["Browser", "Server", "Router", "Cable"], correct_option_index: 0 },
      correct_answer: { selected_option_index: 0 },
      explanation: "The browser is the client.",
      difficulty_level: "EASY",
    };
    const bad = { question_type: "single_choice", question_text: "Broken", question_data: {} };
    const res = await as(request(app).post(`${base}/ai/generate`)).send({
      context_id: ctx().id,
      plan,
      async: true,
      aiHandoff: { mode: "import", text: "```json\n" + JSON.stringify({ questions: [question, bad] }) + "\n```" },
    });
    expect(res.status).toBe(200);
    expect(res.body.ai).toEqual({ route: "handoff", reason: "HANDOFF" });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].question_text).toBe(question.question_text);
    expect(res.body.meta.provider_used).toBe("handoff");
    expect(res.body.meta.skipped.length).toBeGreaterThanOrEqual(1);
    expect(providers).not.toHaveBeenCalled();
  });

  it("is refused like the other features when the person may not hand off", async () => {
    externalPerms = [];
    __setMisPermissionsFetcher(async () => externalPerms);
    const res = await as(request(app).post(`${base}/ai/generate`)).send({
      context_id: ctx().id,
      plan,
      async: true,
      aiHandoff: { mode: "prompt" },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("AI_HANDOFF_NOT_ALLOWED");
  });
});

describe("hand-off rules (unit)", () => {
  it("never for the Socratic hint or inside an assessment, whatever the policy", async () => {
    const allowed = async () => true;
    await expect(assertHandoffAllowed({ task: "hint", externalAllowed: allowed })).rejects.toMatchObject({ code: "AI_HANDOFF_NOT_ALLOWED", statusCode: 403 });
    await expect(assertHandoffAllowed({ task: "author", inAssessment: true, externalAllowed: allowed })).rejects.toMatchObject({ code: "AI_HANDOFF_NOT_ALLOWED" });
    await expect(
      generateStructuredContent(
        { prompt: "hint please", schema: { type: "object", properties: { hint: { type: "string" } }, required: ["hint"] }, schemaName: "socratic_hint" },
        {
          personal: {
            misUserId: 1,
            task: "hint",
            feature: "tm.socratic-hint",
            inAssessment: true,
            handoff: { handoff: { mode: "prompt" }, externalAllowed: allowed },
          },
        },
      ),
    ).rejects.toMatchObject({ code: "AI_HANDOFF_NOT_ALLOWED" });
  });

  it("parses aiHandoff from JSON or a multipart string and ignores junk", () => {
    expect(parseHandoff({ mode: "prompt", pupilConsent: true })).toEqual({ mode: "prompt", pupilConsent: true });
    expect(parseHandoff(JSON.stringify({ mode: "import", text: "x" }))).toEqual({ mode: "import", text: "x" });
    expect(parseHandoff({ mode: "other" })).toBeUndefined();
    expect(parseHandoff("not json")).toBeUndefined();
  });

  it("reads the last fenced JSON block that matches the schema", () => {
    const schema = { type: "object" as const, properties: { a: { type: "number" as const } }, required: ["a"] };
    expect(readPastedJson<any>('```json\n{"a":"x"}\n```\nfixed:\n```json\n{"a":2}\n```', schema)).toEqual({ a: 2 });
    expect(readPastedJson<any>('the answer is {"a": 1} ok', schema)).toEqual({ a: 1 });
    expect(() => readPastedJson('{"b":1}', schema)).toThrow(/expected format/);
    expect(scrub("mail a.b@c.rw or call 0788 123 456")).toBe("mail [email] or call [phone]");
  });
});
