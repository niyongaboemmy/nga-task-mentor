import { canManageAssignment, canManageQuiz, isCreator } from "../ownership";

const user = (id: number, perms: string[] = []) => ({ id, permissions: new Set(perms) });

describe("ownership", () => {
  it("lets the creator manage their own item, even when ids differ in type", () => {
    expect(isCreator(user(7), { created_by: 7 })).toBe(true);
    expect(isCreator(user(7), { created_by: "7" })).toBe(true);
    expect(canManageQuiz(user(7, ["QUIZZES_EDIT"]), { created_by: 7 })).toBe(true);
    expect(canManageAssignment(user(7, ["ASSIGNMENTS_EDIT"]), { created_by: 7 })).toBe(true);
  });

  it("refuses a co-teacher who holds the edit/grade permissions but didn't create it", () => {
    const coTeacher = user(8, ["QUIZZES_EDIT", "QUIZZES_GRADE", "ASSIGNMENTS_EDIT", "SUBMISSIONS_GRADE"]);
    expect(canManageQuiz(coTeacher, { created_by: 7 })).toBe(false);
    expect(canManageAssignment(coTeacher, { created_by: 7 })).toBe(false);
  });

  it("lets a super admin (MANAGE_ANY) manage anyone's item", () => {
    expect(canManageQuiz(user(1, ["QUIZZES_MANAGE_ANY"]), { created_by: 7 })).toBe(true);
    expect(canManageAssignment(user(1, ["ASSIGNMENTS_MANAGE_ANY"]), { created_by: 7 })).toBe(true);
    // the bypass is per resource type
    expect(canManageAssignment(user(1, ["QUIZZES_MANAGE_ANY"]), { created_by: 7 })).toBe(false);
  });

  it("never matches on missing ids", () => {
    expect(isCreator(user(7), { created_by: null })).toBe(false);
    expect(isCreator(undefined, { created_by: 7 })).toBe(false);
    expect(isCreator(user(7), null)).toBe(false);
  });
});
