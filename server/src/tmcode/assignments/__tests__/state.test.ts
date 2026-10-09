import { gradeNumber, pendingReturn } from "../state";

describe("pendingReturn", () => {
  const submitted = (id: number, at: string, assignment = 7) => ({
    id,
    type: "submitted",
    data: { activity_type: "assignment", activity_id: assignment },
    created_at: at,
  });
  const returned = (id: number, at: string, message: string | null = "Fix it", assignment = 7) => ({
    id,
    type: "returned",
    data: JSON.stringify({ assignment_id: assignment, message }),
    created_at: at,
  });

  it("is the latest return not yet followed by a hand-in", () => {
    expect(pendingReturn([submitted(1, "2026-10-01T10:00:00Z"), returned(2, "2026-10-02T10:00:00Z")], 7)).toEqual({
      returned_at: "2026-10-02T10:00:00.000Z",
      returned_message: "Fix it",
    });
    expect(
      pendingReturn([submitted(1, "2026-10-01T10:00:00Z"), returned(2, "2026-10-02T10:00:00Z"), submitted(3, "2026-10-03T10:00:00Z")], 7),
    ).toBeNull();
  });

  it("ignores other assignments, blank messages, and breaks ties by id", () => {
    expect(pendingReturn([returned(2, "2026-10-02T10:00:00Z", "x", 8)], 7)).toBeNull();
    expect(pendingReturn([returned(2, "2026-10-02T10:00:00Z", "  ")], 7)).toEqual({
      returned_at: "2026-10-02T10:00:00.000Z",
      returned_message: null,
    });
    const same = "2026-10-02T10:00:00Z";
    expect(pendingReturn([returned(5, same), submitted(4, same)], 7)?.returned_message).toBe("Fix it");
    expect(pendingReturn([returned(4, same), submitted(5, same)], 7)).toBeNull();
    expect(pendingReturn([], 7)).toBeNull();
  });
});

describe("gradeNumber", () => {
  it("reads plain and x/max grades", () => {
    expect(gradeNumber("7")).toBe(7);
    expect(gradeNumber("7.5/10")).toBe(7.5);
    expect(gradeNumber(null)).toBeNull();
    expect(gradeNumber("")).toBeNull();
    expect(gradeNumber("A+")).toBeNull();
  });
});
