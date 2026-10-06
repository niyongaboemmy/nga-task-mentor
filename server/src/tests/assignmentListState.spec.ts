import { studentAssignmentState } from "../utils/assignmentListState";

describe("studentAssignmentState", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  const future = { status: "published", due_date: "2026-10-07T12:00:00Z" };
  const past = { status: "published", due_date: "2026-10-05T12:00:00Z" };

  it("is to do while open and nothing is handed in", () => {
    expect(studentAssignmentState(future, null, now)).toBe("todo");
  });

  it("is missed once past due, or closed by the teacher, with nothing handed in", () => {
    expect(studentAssignmentState(past, null, now)).toBe("missed");
    expect(studentAssignmentState({ ...future, status: "completed" }, null, now)).toBe("missed");
  });

  it("treats a saved draft as not handed in", () => {
    expect(studentAssignmentState(past, { status: "draft" }, now)).toBe("missed");
  });

  it("is submitted, then graded once a grade exists", () => {
    expect(studentAssignmentState(past, { status: "late" }, now)).toBe("submitted");
    expect(studentAssignmentState(future, { status: "submitted", grade: "7/10" }, now)).toBe("graded");
    expect(studentAssignmentState(future, { status: "graded", grade: null }, now)).toBe("graded");
  });
});
