import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { QuestionBank } from "../models";
import { generateFreeformJSON } from "../services/aiProviders/generate";
import { packParts, tiptapToText, htmlToText, weekText } from "../services/ai/misCourseResources";
import { buildGenerateFromSourcePrompt } from "../services/ai/prompts/generateFromDocumentPrompt";
import { clearContextsForTests } from "../services/ai/generationContextStore";
import { clearJobsForTests } from "../services/ai/generationJobs";

/**
 * AI Question Generator (prepare → generate batches) against the real dev DB
 * and middleware chain. The MIS and the AI provider call are mocked. Run
 * with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
jest.mock("../services/aiProviders/generate", () => ({
  generateFreeformJSON: jest.fn(),
  generateStructuredContent: jest.fn(),
}));
const mockedGet = axios.get as jest.Mock;
const mockedAI = generateFreeformJSON as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990201;
const CLASS = 7701;
const TERM = 31;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };
const base = `/api/courses/${SUBJ}/question-bank`;

let app: ReturnType<typeof buildTestApp>;
let instructorToken: string;
let otherToken: string;
let studentToken: string;
const bankIds: number[] = [];

const ENTRY = {
  entry_id: 5001,
  week_number: "3",
  topic: "Internet vs the Web",
  sub_topic: "Clients and servers",
  objective: "Explain how a browser requests a page from a web server over HTTP",
  methodology: "Demonstration",
  competency: { title: "Describe web fundamentals" },
  criteria: [{ description: "Request/response cycle is explained" }],
};
const FOREIGN_ENTRY_ID = 9999;

function misRoutes(overrides: Record<string, (url: string, cfg: any) => any> = {}) {
  mockedGet.mockImplementation(async (url: string, cfg: any) => {
    const u = String(url);
    for (const [frag, fn] of Object.entries(overrides)) if (u.includes(frag)) return fn(u, cfg);
    if (u.includes("/users/me")) {
      return { data: { success: true, data: { currentAcademicTerms: [{ academic_term_id: TERM, is_current: 1 }] } } };
    }
    if (u.includes("/academics/my-assigned-subjects")) {
      return { data: { success: true, data: [{ subject_id: SUBJ, subject_name: "Web UI", class_group_id: CLASS, class_group_name: "L5 SOD" }] } };
    }
    if (u.includes(`/curriculum/subjects/${SUBJ}/competencies`)) {
      return {
        data: {
          success: true,
          data: [
            {
              competency_id: 11,
              element_number: 1,
              title: "Describe web fundamentals",
              description: "Learners distinguish the Internet from the World Wide Web and name core protocols.",
              criteria: [{ criteria_number: "1.1", description: "HTTP is described" }],
            },
          ],
        },
      };
    }
    if (u.includes("/scheme-of-work/entries")) {
      expect(cfg.params).toMatchObject({ subject_id: SUBJ, class_group_id: CLASS, academic_term_id: TERM });
      return { data: { success: true, data: { scheme: {}, entries: [ENTRY] } } };
    }
    if (u.includes(`/lesson-plans/entry/${ENTRY.entry_id}`)) {
      // bare array, no envelope
      return { data: [{ id: 77, week: 3, big_question: "What happens when you type a URL?", outcomes: [{ code: "LO1", title: "Trace an HTTP request", activities: [] }], sections: [] }] };
    }
    if (u.includes("/lesson-notes")) return { data: { success: true, data: [] } };
    if (u.includes(`/curriculum/subjects/${SUBJ}/documents`)) {
      return { data: { success: true, data: [{ document_id: 400, original_name: "slides.pptx", file_size: 2048 }, { document_id: 401, original_name: "notes.pdf" }] } };
    }
    if (u.includes("/elearning/courses/mine")) return { data: { success: true, data: [] } };
    return { data: { success: true, data: [] } };
  });
}

const auth = (r: request.Test, token = instructorToken) =>
  r.set("Authorization", `Bearer ${token}`).set(MIS_HEADER);

async function prepareResources(sources: any[], token = instructorToken) {
  return auth(request(app).post(`${base}/ai/prepare/resources`), token).send({ sources });
}

const goodSingle = (text: string, difficulty = "EASY") => ({
  question_type: "single_choice",
  question_text: text,
  question_data: { options: ["Browser", "Server", "Router", "Cable"], correct_option_index: 0 },
  correct_answer: { selected_option_index: 0 },
  explanation: "The browser is the client.",
  difficulty_level: difficulty,
  tags: ["Web", "HTTP"],
  time_limit_seconds: 45,
});

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  instructorToken = signTokenFor(instructor.id);
  otherToken = signTokenFor((await findSeededUserByRole("admin")).id);
  studentToken = signTokenFor((await findSeededUserByRole("student")).id);
  const q = await QuestionBank.create({
    course_id: SUBJ,
    question_type: "single_choice",
    question_text: `Which layer carries web pages ${RUN}?`,
    question_data: { options: ["a", "b"], correct_option_index: 0 },
    created_by: instructor.id,
  } as any);
  bankIds.push(q.id);
});

beforeEach(() => {
  mockedGet.mockReset();
  mockedAI.mockReset();
  clearContextsForTests();
  clearJobsForTests();
  misRoutes();
});

afterAll(async () => {
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  await sequelize.close();
});

describe("access", () => {
  it("refuses students on every AI endpoint", async () => {
    expect((await auth(request(app).get(`${base}/ai/providers`), studentToken)).status).toBe(403);
    expect((await auth(request(app).get(`${base}/ai/sources`), studentToken)).status).toBe(403);
    expect((await prepareResources([{ kind: "sow_entry", id: 1 }], studentToken)).status).toBe(403);
  });
});

describe("GET /ai/providers", () => {
  it("lists every provider with its model and fallback position", async () => {
    const res = await auth(request(app).get(`${base}/ai/providers`));
    expect(res.status).toBe(200);
    const names = res.body.data.providers.map((p: any) => p.name).sort();
    expect(names).toEqual(["gemini", "glm", "groq", "openai"]);
    for (const p of res.body.data.providers) {
      expect(typeof p.model).toBe("string");
      expect(typeof p.configured).toBe("boolean");
    }
  });
});

describe("GET /ai/sources", () => {
  it("groups the subject's MIS resources and flags unreadable files", async () => {
    const res = await auth(request(app).get(`${base}/ai/sources`));
    expect(res.status).toBe(200);
    const { scope, groups } = res.body.data;
    expect(scope).toMatchObject({ class_group_id: CLASS, academic_term_id: TERM, class_groups: [{ id: CLASS, name: "L5 SOD" }] });
    const byKey = Object.fromEntries(groups.map((g: any) => [g.key, g]));
    expect(byKey.curriculum.items[0]).toMatchObject({ kind: "competency", id: "11", supported: true });
    expect(byKey.weeks.items[0]).toMatchObject({ kind: "sow_entry", id: "5001", week: "3", title: ENTRY.topic });
    expect(byKey.lesson_plans.items[0]).toMatchObject({ kind: "lesson_plan", id: "5001:77", week: "3" });
    const pptx = byKey.materials.items.find((i: any) => i.id === "400");
    expect(pptx).toMatchObject({ supported: false });
    expect(byKey.materials.items.find((i: any) => i.id === "401").supported).toBe(true);
  });

  it("marks one failing group unavailable instead of failing the whole list", async () => {
    misRoutes({
      "/lesson-notes": () => {
        throw Object.assign(new Error("forbidden"), { response: { status: 403 } });
      },
    });
    const res = await auth(request(app).get(`${base}/ai/sources`));
    expect(res.status).toBe(200);
    const notes = res.body.data.groups.find((g: any) => g.key === "notes");
    expect(notes).toMatchObject({ status: "unavailable", items: [] });
    expect(res.body.data.groups.find((g: any) => g.key === "weeks").status).toBe("ok");
  });

  it("passes an expired MIS session through as 401", async () => {
    misRoutes({
      "/curriculum/subjects": () => {
        throw Object.assign(new Error("expired"), { response: { status: 401 } });
      },
    });
    const res = await auth(request(app).get(`${base}/ai/sources`));
    expect(res.status).toBe(401);
    expect(res.body.logout).toBe(true);
  });
});

describe("POST /ai/prepare/resources", () => {
  it("builds one source text from the chosen resources, in a stable order", async () => {
    const res = await prepareResources([
      { kind: "lesson_plan", id: "5001:77" },
      { kind: "sow_entry", id: 5001 },
      { kind: "competency", id: 11 },
    ]);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.context_id).toMatch(/[0-9a-f-]{36}/);
    expect(d.origin).toBe("resources");
    expect(d.parts.map((p: any) => p.kind)).toEqual(["competency", "sow_entry", "lesson_plan"]);
    expect(d.preview).toContain("LEARNING OUTCOME 1");
    expect(d.label).toContain("Web UI");
    expect(d.missing).toEqual([]);
  });

  it("refuses ids that don't belong to this subject", async () => {
    const res = await prepareResources([
      { kind: "sow_entry", id: 5001 },
      { kind: "sow_entry", id: FOREIGN_ENTRY_ID },
      { kind: "lesson_plan", id: `${FOREIGN_ENTRY_ID}:1` },
      { kind: "competency", id: 999 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.parts).toHaveLength(1);
    expect(res.body.data.missing.map((m: any) => `${m.kind}:${m.id}`).sort()).toEqual(
      ["competency:999", `lesson_plan:${FOREIGN_ENTRY_ID}:1`, `sow_entry:${FOREIGN_ENTRY_ID}`].sort(),
    );
    // Never asked the MIS for the foreign entry's lesson plans.
    expect(mockedGet.mock.calls.some(([u]) => String(u).includes(`/lesson-plans/entry/${FOREIGN_ENTRY_ID}`))).toBe(false);
  });

  it("422s when nothing readable was selected", async () => {
    const res = await prepareResources([{ kind: "competency", id: 999 }]);
    expect(res.status).toBe(422);
    expect(res.body.data.missing).toHaveLength(1);
  });

  it("validates the body", async () => {
    expect((await prepareResources([])).status).toBe(400);
    expect((await prepareResources([{ kind: "whatever", id: 1 }])).status).toBe(400);
  });
});

describe("POST /ai/prepare/document", () => {
  const docx = path.resolve(__dirname, "../../../question-bank-upload-ready.docx");

  it("extracts an uploaded DOCX into a context", async () => {
    if (!fs.existsSync(docx)) return;
    const res = await auth(request(app).post(`${base}/ai/prepare/document`)).attach("file", docx);
    expect(res.status).toBe(200);
    expect(res.body.data.origin).toBe("document");
    expect(res.body.data.char_count).toBeGreaterThan(50);
  });

  it("400s without a (supported) file", async () => {
    const res = await auth(request(app).post(`${base}/ai/prepare/document`)).attach(
      "file",
      Buffer.from("hello"),
      "notes.txt",
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /ai/generate", () => {
  async function contextId(token = instructorToken) {
    const res = await prepareResources([{ kind: "sow_entry", id: 5001 }], token);
    return res.body.data.context_id as string;
  }
  const gen = (body: any, token = instructorToken) =>
    auth(request(app).post(`${base}/ai/generate`), token).send(body);

  it("generates a mixed-difficulty batch, cleaning up what the AI got wrong", async () => {
    const id = await contextId();
    mockedAI.mockResolvedValue({
      providerUsed: "groq",
      data: [
        goodSingle("What sends the HTTP request?", "EASY"),
        goodSingle("Why does a browser need DNS before HTTP?", "DIFFICULT"),
        goodSingle("What sends the HTTP request?", "EASY"), // duplicate within the batch
        goodSingle(`Which layer carries web pages ${RUN}?`, "EASY"), // already in the bank
        { ...goodSingle("Broken one"), question_data: { options: [] } }, // invalid structure
        { ...goodSingle("Not asked for"), question_type: "matching" }, // wrong type
        goodSingle("Extra easy one", "EASY"), // over-delivery
      ],
    });

    const res = await gen({
      context_id: id,
      plan: [{ question_type: "single_choice", EASY: 1, MEDIUM: 0, DIFFICULT: 1 }],
      additional_context: "Focus on HTTP",
      provider: "gemini",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.map((q: any) => [q.question_text, q.difficulty_level])).toEqual([
      ["What sends the HTTP request?", "EASY"],
      ["Why does a browser need DNS before HTTP?", "DIFFICULT"],
    ]);
    expect(res.body.data[0].tags).toEqual(["web", "http"]);
    expect(res.body.meta).toMatchObject({
      requested: 2,
      returned: 2,
      provider_used: "groq",
      provider_requested: "gemini",
      fell_back: true,
    });
    const reasons = res.body.meta.skipped.map((s: any) => s.reason);
    expect(reasons).toEqual(
      expect.arrayContaining(["Type was not requested", "More than requested", "Duplicate of an existing question"]),
    );

    // Preferred provider goes first, the rest of the chain still backs it up.
    const [prompt, , options] = mockedAI.mock.calls[0];
    expect(options.providerOrder[0]).toBe("gemini");
    expect(options.providerOrder.length).toBeGreaterThan(1);
    expect(prompt).toContain("- single_choice: 1 EASY, 1 DIFFICULT");
    expect(prompt).toContain("Focus on HTTP");
    expect(prompt).toContain(ENTRY.topic);
    expect(prompt).toContain(`Which layer carries web pages ${RUN}?`); // told to avoid it
  });

  it("410s on an unknown context and on someone else's context", async () => {
    const theirs = await contextId(otherToken);
    const plan = [{ question_type: "true_false", EASY: 1 }];
    const unknown = await gen({ context_id: crypto.randomUUID(), plan });
    expect(unknown.status).toBe(410);
    expect(unknown.body.code).toBe("CONTEXT_EXPIRED");
    expect((await gen({ context_id: theirs, plan })).status).toBe(410);
    expect(mockedAI).not.toHaveBeenCalled();
  });

  it("rejects bad plans before calling the AI", async () => {
    const id = await contextId();
    const tooMany = await gen({ context_id: id, plan: [{ question_type: "single_choice", EASY: 10, MEDIUM: 3 }] });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toMatch(/At most 12/);
    expect((await gen({ context_id: id, plan: [{ question_type: "single_choice" }] })).status).toBe(400);
    expect((await gen({ context_id: id, plan: [{ question_type: "essay", EASY: 1 }] })).status).toBe(400);
    expect(
      (
        await gen({
          context_id: id,
          plan: [
            { question_type: "single_choice", EASY: 1 },
            { question_type: "single_choice", MEDIUM: 1 },
          ],
        })
      ).status,
    ).toBe(400);
    expect((await gen({ context_id: id, plan: [{ question_type: "single_choice", EASY: 1 }], provider: "bard" })).status).toBe(400);
    expect(mockedAI).not.toHaveBeenCalled();
  });

  it("maps provider failures to useful statuses", async () => {
    const id = await contextId();
    const plan = [{ question_type: "single_choice", EASY: 1 }];
    mockedAI.mockRejectedValueOnce(new Error("The AI is temporarily rate-limited. Please try again in a few minutes."));
    expect((await gen({ context_id: id, plan })).status).toBe(429);
    mockedAI.mockRejectedValueOnce(new Error("AI generation is not configured. Add an API key"));
    expect((await gen({ context_id: id, plan })).status).toBe(503);
  });
});

describe("async generation jobs", () => {
  const plan = [{ question_type: "single_choice", EASY: 1 }];
  async function ctxId(token = instructorToken) {
    return (await prepareResources([{ kind: "sow_entry", id: 5001 }], token)).body.data.context_id as string;
  }
  const poll = (jobId: string, token = instructorToken) => auth(request(app).get(`${base}/ai/jobs/${jobId}`), token);

  it("answers 202 at once, reports running, then hands back the batch", async () => {
    let finish!: (v: any) => void;
    mockedAI.mockReturnValue(new Promise((r) => (finish = r)));
    const id = await ctxId();
    const start = await auth(request(app).post(`${base}/ai/generate`)).send({ context_id: id, plan, async: true });
    expect(start.status).toBe(202);
    const jobId = start.body.job_id;
    expect((await poll(jobId)).body).toMatchObject({ state: "running" });

    finish({ providerUsed: "gemini", data: [goodSingle("Which part renders HTML?")] });
    await new Promise((r) => setTimeout(r, 50));
    const done = await poll(jobId);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ state: "done", success: true, meta: { returned: 1, provider_used: "gemini" } });
  });

  it("keeps the batch's own error status (e.g. 410) and hides jobs from other users", async () => {
    const start = await auth(request(app).post(`${base}/ai/generate`)).send({ context_id: crypto.randomUUID(), plan, async: true });
    expect(start.status).toBe(202);
    await new Promise((r) => setTimeout(r, 20));
    const res = await poll(start.body.job_id);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("CONTEXT_EXPIRED");
    expect((await poll(start.body.job_id, otherToken)).status).toBe(404);
    expect((await poll(crypto.randomUUID())).body.code).toBe("JOB_NOT_FOUND");
  });
});

describe("helpers", () => {
  it("packParts keeps short parts whole and shares the rest", () => {
    const parts = [
      { text: "a".repeat(1000), chars: 0 },
      { text: "b".repeat(50_000), chars: 0 },
      { text: "c".repeat(50_000), chars: 0 },
    ];
    const { text, truncated } = packParts(parts, 20_000);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(20_000);
    expect(parts[0].chars).toBe(1000);
    expect(Math.abs(parts[1].chars - parts[2].chars)).toBeLessThanOrEqual(1);
    expect(packParts([{ text: "short", chars: 0 }], 20_000)).toEqual({ text: "short", truncated: false });
  });

  it("labels weeks without doubling 'Week'", () => {
    expect(weekText("3")).toBe("Week 3");
    expect(weekText("Week 7")).toBe("Week 7");
    expect(weekText(null)).toBe("Week ?");
  });

  it("reads Tiptap JSON and HTML as plain text", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "HTTP" }] },
        { type: "paragraph", content: [{ type: "text", text: "A request" }, { type: "hardBreak" }, { type: "text", text: "and a response." }] },
      ],
    };
    expect(tiptapToText(doc)).toBe("HTTP\nA request\nand a response.\n");
    expect(tiptapToText(JSON.stringify(doc))).toContain("A request");
    expect(htmlToText("<p>One &amp; two</p><ul><li>three</li></ul>")).toBe("One & two\n- three");
  });

  it("prompt spells out the per-difficulty breakdown and omits empty cells", () => {
    const p = buildGenerateFromSourcePrompt({
      sourceText: "x",
      plan: [
        { question_type: "true_false", EASY: 2, MEDIUM: 0, DIFFICULT: 0 },
        { question_type: "numerical", EASY: 0, MEDIUM: 1, DIFFICULT: 3 },
      ],
    });
    expect(p).toContain("Generate exactly 6 question(s)");
    expect(p).toContain("- true_false: 2 EASY\n- numerical: 1 MEDIUM, 3 DIFFICULT");
    expect(p).toContain("TYPE: numerical");
    expect(p).not.toContain("TYPE: coding");
  });
});
