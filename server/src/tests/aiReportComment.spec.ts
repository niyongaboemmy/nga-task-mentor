// POST /api/report-cards/ai-comment: a class-teacher comment draft. Real middleware
// chain on the dev DB, AI mocked. Run with
//   cd server && TZ=UTC npx jest --runInBand src/tests/aiReportComment.spec.ts
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";

jest.mock("../services/aiProviders", () => {
  const actual = jest.requireActual("../services/aiProviders");
  return { ...actual, generateStructuredContent: jest.fn() };
});
import { generateStructuredContent } from "../services/aiProviders";
const ai = generateStructuredContent as jest.Mock;

let app: ReturnType<typeof buildTestApp>;
let teacher: string;
let student: string;
const body = {
  term: "Term 1", academic_year: "2026-2027",
  subjects: [{ name: "Mathematics", score: 78 }], attributes: [{ attribute_name: "Respect", rating: "Very good" }], attendance: "present", tone: "balanced",
};

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  teacher = signTokenFor((await findSeededUserByRole("instructor")).id);
  student = signTokenFor((await findSeededUserByRole("student")).id);
});
afterAll(async () => {
  await sequelize.close();
});

describe("AI report-card comment", () => {
  beforeEach(() => ai.mockReset());

  it("drafts a comment with [NAME] for the teacher", async () => {
    ai.mockResolvedValue({ providerUsed: "groq", data: { comment: "[NAME] works with care in Mathematics; the next step is to explain reasoning aloud in class." } });
    const res = await request(app).post("/api/report-cards/ai-comment").set("Authorization", `Bearer ${teacher}`).send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.comment).toMatch(/^\[NAME\] works with care/);
    expect(String(ai.mock.calls[0][0].prompt)).toContain("Mathematics: 78/100 (very good)");
  });

  it("is refused to students and validates input", async () => {
    expect((await request(app).post("/api/report-cards/ai-comment").set("Authorization", `Bearer ${student}`).send(body)).status).toBe(403);
    expect((await request(app).post("/api/report-cards/ai-comment").set("Authorization", `Bearer ${teacher}`).send({ ...body, tone: "harsh" })).status).toBe(400);
    expect((await request(app).post("/api/report-cards/ai-comment").set("Authorization", `Bearer ${teacher}`).send({ ...body, subjects: [{ name: "X", score: 140 }] })).status).toBe(400);
    expect(ai).not.toHaveBeenCalled();
  });
});
