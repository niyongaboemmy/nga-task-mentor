import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { BloomsTaxonomyLevel, QuestionBank, Quiz, QuizQuestion } from "../models";
import { buildAlerts, healthScore } from "../controllers/questionBankHub.controller";

/**
 * GET /api/question-bank/overview (the Question Bank hub dashboard) against
 * the real dev DB and middleware chain, with the MIS "my assigned subjects"
 * call mocked. Fixtures use subject ids no real subject has and are removed
 * afterwards. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ_A = 990101; // taught, well-stocked
const SUBJ_B = 990102; // taught, empty
const SUBJ_C = 990103; // NOT taught -- must never leak
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let instructorToken: string;
let adminToken: string;
let studentToken: string;
let instructorId: number;
const bankIds: number[] = [];
const bloomsIds: number[] = [];
let quizId: number | null = null;

function assignedSubjects(ids: number[]) {
  mockedGet.mockImplementation(async (url: string) => {
    if (String(url).includes("/academics/my-assigned-subjects")) {
      return {
        data: {
          success: true,
          data: ids.map((id) => ({ id, name: `Hub Subject ${id}`, code: `HUB${id}` })),
        },
      };
    }
    return { data: { success: true, data: [] } };
  });
}

const get = (query = "", token = instructorToken) =>
  request(app)
    .get(`/api/question-bank/overview${query}`)
    .set("Authorization", `Bearer ${token}`)
    .set(MIS_HEADER);

async function addQuestion(courseId: number, extra: Record<string, any> = {}) {
  const q = await QuestionBank.create({
    course_id: courseId,
    question_type: "single_choice",
    question_text: `Hub fixture ${RUN} #${bankIds.length}`,
    question_data: { options: ["a", "b"] },
    created_by: instructorId,
    ...extra,
  } as any);
  bankIds.push(q.id);
  return q;
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  instructorId = instructor.id;
  instructorToken = signTokenFor(instructor.id);
  adminToken = signTokenFor((await findSeededUserByRole("admin")).id);
  studentToken = signTokenFor((await findSeededUserByRole("student")).id);

  const recall = await BloomsTaxonomyLevel.create({ name: `Remember ${RUN}`, level_order: 1 } as any);
  const create = await BloomsTaxonomyLevel.create({ name: `Create ${RUN}`, level_order: 6 } as any);
  bloomsIds.push(recall.id, create.id);

  // SUBJ_A: 6 questions -- 2 easy, 3 medium, 1 unassigned; 2 with an
  // explanation (plus one empty-editor `<p></p>` that must NOT count);
  // 5 classified (4 recall, 1 higher-order); 2 linked to one SoW topic.
  const a1 = await addQuestion(SUBJ_A, { difficulty_level: "EASY", explanation: "Because.", blooms_taxonomy_level_id: recall.id, scheme_of_work_entry_id: 501, scheme_of_work_entry_title: "Topic One" });
  await addQuestion(SUBJ_A, { difficulty_level: "EASY", explanation: "<p>Why</p>", blooms_taxonomy_level_id: recall.id, scheme_of_work_entry_id: 501, scheme_of_work_entry_title: "Topic One" });
  await addQuestion(SUBJ_A, { difficulty_level: "MEDIUM", explanation: "<p></p>", blooms_taxonomy_level_id: recall.id });
  await addQuestion(SUBJ_A, { difficulty_level: "MEDIUM", blooms_taxonomy_level_id: recall.id, question_type: "true_false" });
  await addQuestion(SUBJ_A, { difficulty_level: "MEDIUM", blooms_taxonomy_level_id: create.id });
  await addQuestion(SUBJ_A, { created_by: instructorId + 100000 }); // someone else's, no difficulty
  await addQuestion(SUBJ_C, { difficulty_level: "DIFFICULT" });

  const quiz = await Quiz.create({
    title: `Hub quiz ${RUN}`,
    description: "questionBankHub spec",
    course_id: SUBJ_A,
    created_by: instructorId,
  } as any);
  quizId = quiz.id;
  await QuizQuestion.create({ quiz_id: quiz.id, question_id: a1.id, order: 1, points: 1 } as any);
});

beforeEach(() => {
  mockedGet.mockReset();
  assignedSubjects([SUBJ_A, SUBJ_B]);
});

afterAll(async () => {
  if (quizId) {
    await QuizQuestion.destroy({ where: { quiz_id: quizId } });
    await Quiz.destroy({ where: { id: quizId } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  if (bloomsIds.length) await BloomsTaxonomyLevel.destroy({ where: { id: bloomsIds } });
  await sequelize.close();
});

describe("GET /api/question-bank/overview -- access", () => {
  it("is refused to admins (teacher-only permission) and students", async () => {
    expect((await get("", adminToken)).status).toBe(403);
    expect((await get("", studentToken)).status).toBe(403);
  });

  it("refuses a subject the teacher does not teach", async () => {
    const res = await get(`?subjectId=${SUBJ_C}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/question-bank/overview -- all my subjects", () => {
  it("aggregates only the teacher's subjects", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.available_subjects.map((s: any) => s.id).sort()).toEqual([SUBJ_A, SUBJ_B]);
    expect(d.subjects.map((s: any) => s.subject_id).sort()).toEqual([SUBJ_A, SUBJ_B]);
    expect(d.totals.total).toBe(6); // SUBJ_C's question is excluded

    const a = d.subjects.find((s: any) => s.subject_id === SUBJ_A);
    expect(a).toMatchObject({
      total: 6,
      mine: 5,
      easy: 2,
      medium: 3,
      difficult: 0,
      no_difficulty: 1,
      with_explanation: 2,
      blooms_classified: 5,
      higher_order: 1,
      sow_linked: 2,
      topics_covered: 1,
      used_in_quizzes: 1,
      added_7d: 6,
      added_30d: 6,
    });
    expect(a.health_score).toBe(healthScore(a));

    const b = d.subjects.find((s: any) => s.subject_id === SUBJ_B);
    expect(b.total).toBe(0);
    expect(b.health_score).toBe(0);
  });

  it("returns chart series and a 12-week trend that includes this week's additions", async () => {
    const d = (await get()).body.data;
    expect(d.by_type).toEqual(
      expect.arrayContaining([
        { type: "single_choice", count: 5 },
        { type: "true_false", count: 1 },
      ]),
    );
    const mine = d.by_blooms.filter((b: any) => bloomsIds.includes(b.level_id));
    expect(mine.map((b: any) => b.count)).toEqual([4, 1]);
    expect(d.by_blooms.find((b: any) => b.level_id === null)).toMatchObject({ name: "Unclassified", count: 1 });
    expect(d.top_topics).toEqual([{ title: "Topic One", count: 2 }]);
    expect(d.most_used).toHaveLength(1);
    expect(d.most_used[0]).toMatchObject({ subject_id: SUBJ_A, uses: 1 });
    expect(d.trend).toHaveLength(12);
    expect(d.trend[11].count).toBe(6);
  });

  it("raises alerts, most severe first", async () => {
    const alerts = (await get()).body.data.alerts;
    const ids = alerts.map((a: any) => a.id);
    expect(ids[0]).toBe(`empty:${SUBJ_B}`);
    expect(ids).toEqual(
      expect.arrayContaining([
        `thin:${SUBJ_A}`,
        `explanations:${SUBJ_A}`,
        `no-difficult:${SUBJ_A}`,
        `activity:${SUBJ_A}`,
      ]),
    );
    expect(alerts.at(-1).severity).toBe("success");
  });
});

describe("GET /api/question-bank/overview?subjectId=", () => {
  it("narrows every figure to that subject", async () => {
    const res = await get(`?subjectId=${SUBJ_B}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.subject_id).toBe(SUBJ_B);
    expect(d.subjects).toHaveLength(1);
    expect(d.totals.total).toBe(0);
    expect(d.by_type).toEqual([]);
    expect(d.most_used).toEqual([]);
    // The picker still lists every subject the teacher can switch to.
    expect(d.available_subjects).toHaveLength(2);
  });
});

describe("healthScore / buildAlerts", () => {
  const base = {
    subject_id: 1, subject_name: "S", subject_code: null, mine: 0, higher_order: 0,
    topics_covered: 0, used_in_quizzes: 0, added_7d: 0, added_30d: 0,
    last_added_at: null, health_score: 0,
  };

  it("scores a fully curated, balanced bank 100 and an empty one 0", () => {
    const full = { total: 9, easy: 3, medium: 3, difficult: 3, no_difficulty: 0, with_explanation: 9, blooms_classified: 9, sow_linked: 9 };
    expect(healthScore(full)).toBe(100);
    expect(healthScore({ ...full, total: 0 })).toBe(0);
  });

  it("stays quiet for a healthy bank", () => {
    const healthy = {
      ...base, total: 20, easy: 7, medium: 7, difficult: 6, no_difficulty: 0,
      with_explanation: 20, blooms_classified: 20, higher_order: 8, sow_linked: 20, used_in_quizzes: 15,
    };
    expect(buildAlerts([healthy])).toEqual([]);
  });
});
