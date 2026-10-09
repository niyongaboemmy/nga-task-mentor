import { handInIsLate, pastDue } from "../lateness";

describe("handInIsLate", () => {
  const due = new Date("2026-10-10T12:00:00Z");
  const before = new Date("2026-10-10T11:00:00Z");
  const after = new Date("2026-10-10T13:00:00Z");
  const ref = (revision_id: number | null, git_commit: string | null = null) => JSON.stringify({ revision_id, git_commit });

  it("is late only after the due date", () => {
    expect(handInIsLate({ now: before, due, previous: null, revisionId: 5, commit: null })).toBe(false);
    expect(handInIsLate({ now: after, due, previous: null, revisionId: 5, commit: null })).toBe(true);
    expect(handInIsLate({ now: after, due: null, previous: null, revisionId: 5, commit: null })).toBe(false);
  });

  it("keeps an on-time hand-in on time when the same version is handed in again", () => {
    expect(handInIsLate({ now: after, due, previous: { is_late: 0, project_ref: ref(5) }, revisionId: 5, commit: null })).toBe(false);
    expect(
      handInIsLate({ now: after, due, previous: { is_late: false, project_ref: { revision_id: null, git_commit: "abc" } }, revisionId: null, commit: "abc" }),
    ).toBe(false);
  });

  it("is late when the work changed, or was late already", () => {
    expect(handInIsLate({ now: after, due, previous: { is_late: 0, project_ref: ref(5) }, revisionId: 6, commit: null })).toBe(true);
    expect(handInIsLate({ now: after, due, previous: { is_late: 1, project_ref: ref(5) }, revisionId: 5, commit: null })).toBe(true);
    expect(handInIsLate({ now: after, due, previous: { is_late: 0, project_ref: null }, revisionId: 5, commit: null })).toBe(true);
    expect(handInIsLate({ now: after, due, previous: { is_late: 0, project_ref: ref(null, "abc") }, revisionId: null, commit: "def" })).toBe(true);
  });
});

describe("pastDue", () => {
  it("says whether the due date has passed", () => {
    expect(pastDue(null)).toBe(false);
    expect(pastDue("2026-10-10T12:00:00Z", new Date("2026-10-10T13:00:00Z"))).toBe(true);
    expect(pastDue("2026-10-10T12:00:00Z", new Date("2026-10-10T11:00:00Z"))).toBe(false);
  });
});
