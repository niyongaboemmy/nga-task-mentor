// GET /courses/:id/grades end to end through the handler, with the DB and MIS
// mocked. Reproduces the report where a whole MIS-enrolled class showed the
// top scorer's quiz mark.

jest.mock("../../models", () => ({
  Assignment: { findAll: jest.fn() },
  Submission: { findAll: jest.fn() },
  Quiz: { findAll: jest.fn() },
  QuizSubmission: { findAll: jest.fn() },
  QuizQuestion: {},
  User: { findAll: jest.fn(), findByPk: jest.fn() },
}));

jest.mock("../../utils/misUtils", () => ({
  getMisToken: () => "token",
  hasMisToken: () => true,
  resolveAcademicTermId: async () => 1,
  resolveAcademicYearId: async () => 1,
  handleMisError: jest.fn(),
  fetchEnrolledStudents: jest.fn(),
  fetchEnrolledStudentsRaw: jest.fn(),
}));

jest.mock("../../utils/manualAssessments", () => ({
  fetchManualAssessments: async () => ({ assessments: [], scoresByAssessment: new Map() }),
  buildManualAssessmentRow: jest.fn(),
}));

import { getCourseGrades } from "../course.controller";
import * as models from "../../models";
import * as mis from "../../utils/misUtils";

const m = models as any;

// MIS roster: 4 students. Three took the quiz (local users 10-12), one didn't.
const roster = [
  { id: 501, first_name: "Angelo", last_name: "I", email: "a@x" },
  { id: 502, first_name: "Axcel", last_name: "N", email: "b@x" },
  { id: 503, first_name: "Axel", last_name: "K", email: "c@x" },
  { id: 504, first_name: "Bella", last_name: "I", email: "d@x" },
];

const quizSub = (localId: number, misId: number, score: string, pctStr: string) => ({
  student_id: localId,
  quiz_id: 7,
  total_score: score,
  percentage: pctStr,
  passed: true,
  student: { id: localId, mis_user_id: misId },
});

const run = async () => {
  const req: any = {
    params: { id: "9" },
    query: {},
    user: { id: 1, permissions: new Set(["COURSES_VIEW_GRADES"]) },
  };
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await getCourseGrades(req, res);
  expect(res.status).toHaveBeenCalledWith(200);
  return res.json.mock.calls[0][0].data;
};

beforeEach(() => {
  (mis.fetchEnrolledStudentsRaw as jest.Mock).mockResolvedValue(roster);
  m.Assignment.findAll.mockResolvedValue([]);
  m.Submission.findAll.mockResolvedValue([]);
  m.Quiz.findAll.mockResolvedValue([
    { id: 7, title: "Quiz 1", type: "quiz", questions: [{ points: 5 }, { points: 5 }] },
  ]);
  m.QuizSubmission.findAll.mockResolvedValue([
    quizSub(10, 501, "9.00", "90.00"),
    quizSub(11, 502, "6.50", "65.00"),
    quizSub(12, 503, "3.00", "30.00"),
    // A second, better attempt by 502 — numerically higher, lexically lower.
    quizSub(11, 502, "10.00", "100.00"),
  ]);
  m.User.findAll.mockResolvedValue([
    { id: 10, mis_user_id: 501 },
    { id: 11, mis_user_id: 502 },
    { id: 12, mis_user_id: 503 },
  ]);
});

it("gives each student their own quiz score, not the class's best", async () => {
  const data = await run();
  const byId = Object.fromEntries(data.students.map((s: any) => [s.student.id, s]));

  expect(data.students).toHaveLength(4);
  const quizScore = (id: number) => {
    const q = byId[id].quizzes[0];
    return q.submitted ? Number(q.score) : null;
  };
  expect([501, 502, 503, 504].map(quizScore)).toEqual([9, 10, 3, null]);
  expect(typeof byId[501].quizzes[0].score).toBe("number");

  expect(byId[501].summary.total_percentage).toBe(90);
  expect(byId[502].summary.total_percentage).toBe(100);
  expect(byId[503].summary.total_percentage).toBe(30);
});

it("averages marked work only: ungraded or unsubmitted assignments aren't zeros", async () => {
  m.Assignment.findAll.mockResolvedValue([
    { id: 1, title: "Graded", max_score: 20 },
    { id: 2, title: "Awaiting marking", max_score: 20 },
    { id: 3, title: "Not handed in", max_score: 20 },
    { id: 4, title: "Graded zero", max_score: 10 },
  ]);
  m.Submission.findAll.mockResolvedValue([
    { assignment_id: 1, student_id: 10, grade: 18, status: "graded", student: { id: 10, mis_user_id: 501 } },
    { assignment_id: 2, student_id: 10, grade: null, status: "submitted", student: { id: 10, mis_user_id: 501 } },
    { assignment_id: 4, student_id: 10, grade: 0, status: "graded", student: { id: 10, mis_user_id: 501 } },
  ]);
  const data = await run();
  const s501 = data.students.find((s: any) => s.student.id === 501);

  // Assignments 18/20 + 0/10, quiz 9/10 → 27/40. Assignments 2 and 3 don't count.
  expect(s501.summary.total_points_earned).toBe(27);
  expect(s501.summary.total_max_points).toBe(40);
  expect(s501.summary.total_percentage).toBe(67.5);
  expect(s501.summary.assignment_percentage).toBe(60);
  expect(s501.summary.quiz_percentage).toBe(90);

  // Nothing marked at all → no points and no max, not a failing 0 of 70.
  const s504 = data.students.find((s: any) => s.student.id === 504);
  expect(s504.summary.total_max_points).toBe(0);
});

it("keeps an inactive student with marks (tagged, last) and drops one without", async () => {
  (mis.fetchEnrolledStudentsRaw as jest.Mock).mockResolvedValue([
    { ...roster[0], status: "INACTIVE" }, // has a quiz mark
    roster[1],
    { ...roster[3], status: "INACTIVE" }, // no marks
  ]);
  const data = await run();
  expect(data.students.map((s: any) => [s.student.id, s.student.inactive])).toEqual([
    [502, false],
    [503, false], // off the roster, but has a quiz attempt
    [501, true],
  ]);
});
