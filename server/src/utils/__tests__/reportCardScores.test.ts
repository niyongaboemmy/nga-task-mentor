const findAll = jest.fn();
jest.mock("../../models/User.model", () => ({ User: { findAll: (...a: unknown[]) => findAll(...a) } }));
jest.mock("../../models/QuizSubmission.model", () => ({ QuizSubmission: {} }));
jest.mock("../../models/Submission.model", () => ({ Submission: {} }));
jest.mock("../../models/ManualAssessment.model", () => ({ ManualAssessment: {} }));
jest.mock("../../models/ManualAssessmentScore.model", () => ({ ManualAssessmentScore: {} }));

import { resolveCardStudent } from "../reportCardScores";

/**
 * Which local accounts a report card's student_id stands for. A card keyed on
 * MIS id 48 must never pull in the marks of an unrelated local account whose
 * primary key happens to be 48.
 */
describe("resolveCardStudent", () => {
  beforeEach(() => findAll.mockReset());

  it("ignores a local-only account that merely shares the MIS id's number", async () => {
    findAll.mockResolvedValue([
      { id: 90, mis_user_id: 48 }, // student B, the card's owner
      { id: 48, mis_user_id: null }, // student A, local-only, same number
    ]);
    expect(await resolveCardStudent(48)).toEqual({ localIds: [90], manualIds: [48] });
  });

  it("ignores a local account linked to a different MIS id", async () => {
    findAll.mockResolvedValue([
      { id: 90, mis_user_id: 48 },
      { id: 48, mis_user_id: 77 },
    ]);
    expect(await resolveCardStudent(48)).toEqual({ localIds: [90], manualIds: [48] });
  });

  it("keeps the same person when local id and MIS id coincide", async () => {
    findAll.mockResolvedValue([{ id: 48, mis_user_id: 48 }]);
    expect(await resolveCardStudent(48)).toEqual({ localIds: [48], manualIds: [48] });
  });

  it("treats an id with no linked account as a local card", async () => {
    findAll.mockResolvedValue([{ id: 2, mis_user_id: 23 }]);
    expect(await resolveCardStudent(2)).toEqual({ localIds: [2], manualIds: [2, 23] });
    findAll.mockResolvedValue([{ id: 5, mis_user_id: null }]);
    expect(await resolveCardStudent(5)).toEqual({ localIds: [5], manualIds: [5] });
  });
});
