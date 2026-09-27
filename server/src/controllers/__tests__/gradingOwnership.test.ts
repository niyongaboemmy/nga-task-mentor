// Manual grading is reserved for the item's creator or a super admin: a
// co-teacher holding SUBMISSIONS_GRADE / QUIZZES_GRADE must get a 403.

jest.mock("../../models", () => ({
  Submission: { findByPk: jest.fn(), update: jest.fn() },
  Assignment: {},
  User: {},
  Quiz: {},
  QuizSubmission: { findByPk: jest.fn() },
  QuizAttempt: {},
  QuizQuestion: {},
  QuestionBank: {},
}));

const transaction = { commit: jest.fn(), rollback: jest.fn() };
jest.mock("../../config/database", () => ({
  sequelize: { transaction: jest.fn(async () => transaction) },
}));

import { gradeSubmission as gradeAssignmentSubmission } from "../submission.controller";
import { gradeSubmission as gradeQuizSubmission } from "../grading.controller";
import * as models from "../../models";

const m = models as any;

const res = () => {
  const r: any = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const teacher = (id: number, perms: string[]) => ({ id, permissions: new Set(perms) });

const OWNER = 7;
const CO_TEACHER = 8;
const ADMIN = 1;

describe("assignment submission grading (PATCH /submissions/:id/grade)", () => {
  const graders = ["SUBMISSIONS_GRADE"];
  beforeEach(() => {
    jest.clearAllMocks();
    m.Submission.findByPk.mockResolvedValue({
      id: 5,
      feedback: null,
      Assignment: { id: 2, max_score: "10", created_by: OWNER },
    });
    m.Submission.update.mockResolvedValue([1]);
  });

  const call = async (user: any) => {
    const r = res();
    await gradeAssignmentSubmission(
      { params: { id: "5" }, body: { score: 6 }, user } as any,
      r,
    );
    return r;
  };

  it("rejects a co-teacher", async () => {
    const r = await call(teacher(CO_TEACHER, graders));
    expect(r.status).toHaveBeenCalledWith(403);
    expect(m.Submission.update).not.toHaveBeenCalled();
  });

  it("lets the creator grade", async () => {
    const r = await call(teacher(OWNER, graders));
    expect(r.status).toHaveBeenCalledWith(200);
    expect(m.Submission.update).toHaveBeenCalledWith(
      expect.objectContaining({ grade: "6/10", status: "graded" }),
      expect.anything(),
    );
  });

  it("lets a super admin grade", async () => {
    const r = await call(teacher(ADMIN, [...graders, "ASSIGNMENTS_MANAGE_ANY"]));
    expect(r.status).toHaveBeenCalledWith(200);
  });
});

describe("quiz submission grading (POST /quizzes/submissions/:id/grade)", () => {
  const graders = ["QUIZZES_GRADE"];
  const update = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    m.QuizSubmission.findByPk.mockResolvedValue({
      id: 9,
      quiz: { created_by: OWNER, passing_score: 50, questions: [{ id: 1, points: 10 }] },
      attempts: [{ question_id: 1, points_earned: 0, update: jest.fn() }],
      update,
    });
  });

  const call = async (user: any) => {
    const r = res();
    await gradeQuizSubmission(
      { params: { submissionId: "9" }, body: { grades: { 1: 8 } }, user } as any,
      r,
    );
    return r;
  };

  it("rejects a co-teacher", async () => {
    const r = await call(teacher(CO_TEACHER, graders));
    expect(r.status).toHaveBeenCalledWith(403);
    expect(update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  it("lets the creator grade", async () => {
    const r = await call(teacher(OWNER, graders));
    expect(r.status).toHaveBeenCalledWith(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_score: 8, grade_status: "graded" }),
      expect.anything(),
    );
  });

  it("lets a super admin grade", async () => {
    const r = await call(teacher(ADMIN, [...graders, "QUIZZES_MANAGE_ANY"]));
    expect(r.status).toHaveBeenCalledWith(200);
  });
});
