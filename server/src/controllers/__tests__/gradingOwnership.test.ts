// Manual grading is open to any teacher assigned (in the MIS) to the item's
// subject, plus its creator and a super admin. A teacher holding
// SUBMISSIONS_GRADE / QUIZZES_GRADE who teaches a different subject gets a 403.

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

jest.mock("../../models/User.model", () => ({ User: { findByPk: jest.fn() } }));

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() }, get: jest.fn() }));

const transaction = { commit: jest.fn(), rollback: jest.fn() };
jest.mock("../../config/database", () => ({
  sequelize: { transaction: jest.fn(async () => transaction) },
}));

import axios from "axios";
import { gradeSubmission as gradeAssignmentSubmission } from "../submission.controller";
import { gradeSubmission as gradeQuizSubmission } from "../grading.controller";
import * as models from "../../models";
import { User } from "../../models/User.model";

const m = models as any;
const axiosGet = (axios as any).get as jest.Mock;
const findUser = (User as any).findByPk as jest.Mock;

const res = () => {
  const r: any = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const teacher = (id: number, perms: string[], misUserId?: number) => ({
  id,
  mis_user_id: misUserId,
  permissions: new Set(perms),
});
const request = (user: any, extra: any) =>
  ({ ...extra, user, cookies: { misToken: "mis-token" }, headers: {}, query: {} }) as any;

const OWNER = 7;
const SUBJECT_TEACHER = 8;
const OTHER_TEACHER = 9;
const ADMIN = 1;
const SUBJECT = 42;

/** MIS my-assigned-subjects: SUBJECT_TEACHER teaches SUBJECT, OTHER_TEACHER teaches 99. */
const mockAssignedSubjects = (subjectIds: number[]) =>
  axiosGet.mockResolvedValue({ data: { success: true, data: subjectIds.map((id) => ({ id })) } });

beforeEach(() => {
  jest.clearAllMocks();
  findUser.mockResolvedValue({ id: OWNER, mis_user_id: 700 });
  mockAssignedSubjects([]);
});

describe("assignment submission grading (PATCH /submissions/:id/grade)", () => {
  const graders = ["SUBMISSIONS_GRADE"];
  beforeEach(() => {
    m.Submission.findByPk.mockResolvedValue({
      id: 5,
      feedback: null,
      Assignment: { id: 2, max_score: "10", created_by: OWNER, course_id: SUBJECT, academic_term_id: 3 },
    });
    m.Submission.update.mockResolvedValue([1]);
  });

  const call = async (user: any) => {
    const r = res();
    await gradeAssignmentSubmission(request(user, { params: { id: "5" }, body: { score: 6 } }), r);
    return r;
  };

  it("lets a teacher assigned to the subject grade, though someone else created it", async () => {
    mockAssignedSubjects([SUBJECT]);
    const r = await call(teacher(SUBJECT_TEACHER, graders, 800));
    expect(r.status).toHaveBeenCalledWith(200);
    expect(axiosGet).toHaveBeenCalledWith(
      expect.stringContaining("/academics/my-assigned-subjects"),
      expect.objectContaining({ params: { academic_term_id: 3 } }),
    );
  });

  it("rejects a teacher of another subject", async () => {
    mockAssignedSubjects([99]);
    const r = await call(teacher(OTHER_TEACHER, graders, 900));
    expect(r.status).toHaveBeenCalledWith(403);
    expect(m.Submission.update).not.toHaveBeenCalled();
  });

  it("rejects a subject teacher without SUBMISSIONS_GRADE", async () => {
    mockAssignedSubjects([SUBJECT]);
    const r = await call(teacher(SUBJECT_TEACHER, [], 800));
    expect(r.status).toHaveBeenCalledWith(403);
  });

  it("lets the creator grade", async () => {
    const r = await call(teacher(OWNER, graders, 700));
    expect(r.status).toHaveBeenCalledWith(200);
    expect(m.Submission.update).toHaveBeenCalledWith(
      expect.objectContaining({ grade: "6/10", status: "graded" }),
      expect.anything(),
    );
  });

  it("recognises the creator under a second local account with the same MIS user", async () => {
    const r = await call(teacher(70, graders, 700));
    expect(r.status).toHaveBeenCalledWith(200);
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
    m.QuizSubmission.findByPk.mockResolvedValue({
      id: 9,
      quiz: { created_by: OWNER, course_id: SUBJECT, passing_score: 50, questions: [{ id: 1, points: 10 }] },
      attempts: [{ question_id: 1, points_earned: 0, update: jest.fn() }],
      update,
    });
  });

  const call = async (user: any) => {
    const r = res();
    await gradeQuizSubmission(request(user, { params: { submissionId: "9" }, body: { grades: { 1: 8 } } }), r);
    return r;
  };

  it("lets a teacher assigned to the subject grade", async () => {
    mockAssignedSubjects([SUBJECT]);
    const r = await call(teacher(SUBJECT_TEACHER, graders, 800));
    expect(r.status).toHaveBeenCalledWith(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_score: 8, grade_status: "graded" }),
      expect.anything(),
    );
  });

  it("rejects a teacher of another subject", async () => {
    mockAssignedSubjects([99]);
    const r = await call(teacher(OTHER_TEACHER, graders, 900));
    expect(r.status).toHaveBeenCalledWith(403);
    expect(update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
  });

  it("lets the creator grade", async () => {
    const r = await call(teacher(OWNER, graders, 700));
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it("lets a super admin grade", async () => {
    const r = await call(teacher(ADMIN, [...graders, "QUIZZES_MANAGE_ANY"]));
    expect(r.status).toHaveBeenCalledWith(200);
  });
});
