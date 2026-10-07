// POST /api/submissions/:id/ai-feedback: an AI marking draft for the teacher.
// Real dev DB and middleware chain (like desktopWatcherContract.spec.ts), MIS and
// the AI providers mocked; fixtures removed afterwards. Run with
//   cd server && TZ=UTC npx jest --runInBand src/tests/aiMarkingDraft.spec.ts
import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Submission } from "../models";

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
jest.mock("../services/aiProviders", () => {
  const actual = jest.requireActual("../services/aiProviders");
  return { ...actual, generateStructuredContent: jest.fn() };
});
import { generateStructuredContent } from "../services/aiProviders";

const mockedGet = axios.get as jest.Mock;
const ai = generateStructuredContent as jest.Mock;
const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990411;
const CLASS_GROUP = 990488;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let studentToken: string;
let instructorToken: string;
let assignmentId: number;
let submissionId: number;

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const student = await findSeededUserByRole("student");
  const instructor = await findSeededUserByRole("instructor");
  studentToken = signTokenFor(student.id);
  instructorToken = signTokenFor(instructor.id);
  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/academics/my-assigned-subjects")) {
      return { data: { success: true, data: [{ subject_id: SUBJ, subject_name: "Biology", subject_code: "BIO", grades: [{ class_group_id: CLASS_GROUP, class_group_name: "S2 A", academic_year_id: 1 }] }] } };
    }
    return { data: { success: true, data: [] } };
  });
  const a = await Assignment.create({
    title: `Photosynthesis ${RUN}`, description: "<p>Explain photosynthesis in your own words.</p>", due_date: new Date(Date.now() - 86400000),
    max_score: 10, submission_type: "text", course_id: SUBJ, academic_term_id: null, created_by: instructor.id, status: "published",
    rubric: [{ criteria: "Understanding", description: "Correct process", max_score: 6 }, { criteria: "Clarity", max_score: 4 }],
  } as any);
  assignmentId = a.id!;
  const s = await Submission.create({
    assignment_id: assignmentId, student_id: student.id, status: "submitted", is_late: false, submitted_at: new Date(),
    text_submission: "<p>Plants take in light, water and carbon dioxide and make glucose and oxygen.</p>",
  } as any);
  submissionId = s.id!;
});

afterAll(async () => {
  await Submission.destroy({ where: { assignment_id: assignmentId } });
  await Assignment.destroy({ where: { id: assignmentId } });
  await sequelize.close();
});

describe("AI marking draft", () => {
  beforeEach(() => ai.mockReset());

  it("drafts rubric scores and student feedback for the teacher, without the student's name", async () => {
    ai.mockResolvedValue({
      providerUsed: "groq",
      data: {
        criteria: [{ index: 0, score: 5, comment: "Inputs and outputs right; no chlorophyll" }, { index: 1, score: 4, comment: "Clear" }],
        overall_score: 9, feedback: "You described the inputs and outputs clearly.", strengths: ["Accurate"], next_steps: ["Mention chlorophyll"],
        confidence: "high", off_topic: false,
      },
    });
    const res = await request(app).post(`/api/submissions/${submissionId}/ai-feedback`).set("Authorization", `Bearer ${instructorToken}`).set(MIS_HEADER).send({ tone: "encouraging" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ rubric_scores: { 0: 5, 1: 4 }, score: 9, max_score: 10, provider_used: "groq" });
    const prompt = String(ai.mock.calls[0][0].prompt);
    expect(prompt).toContain("Plants take in light");
    expect(prompt).toContain("0. Understanding (max 6)");
    // Nothing was saved.
    const saved = (await Submission.findByPk(submissionId)) as any;
    expect(saved.grade ?? null).toBeNull();
    expect(saved.status).toBe("submitted");
  });

  it("students can't ask for it, bad input is refused, a missing submission is 404", async () => {
    const asStudent = await request(app).post(`/api/submissions/${submissionId}/ai-feedback`).set("Authorization", `Bearer ${studentToken}`).set(MIS_HEADER).send({});
    expect(asStudent.status).toBe(403);
    const badTone = await request(app).post(`/api/submissions/${submissionId}/ai-feedback`).set("Authorization", `Bearer ${instructorToken}`).set(MIS_HEADER).send({ tone: "harsh" });
    expect(badTone.status).toBe(400);
    const missing = await request(app).post(`/api/submissions/999999999/ai-feedback`).set("Authorization", `Bearer ${instructorToken}`).set(MIS_HEADER).send({});
    expect(missing.status).toBe(404);
    expect(ai).not.toHaveBeenCalled();
  });

  it("says when every AI service is busy", async () => {
    ai.mockRejectedValue(new Error("All AI services are busy. Try again in a minute."));
    const res = await request(app).post(`/api/submissions/${submissionId}/ai-feedback`).set("Authorization", `Bearer ${instructorToken}`).set(MIS_HEADER).send({});
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/busy/);
  });
});
