import { deriveProjectStatus, lockReason } from "../status";

describe("deriveProjectStatus", () => {
  const link = (status: string, activity_type = "assignment") => ({ activity_type, status });

  it("is draft until the project's own link is submitted", () => {
    expect(deriveProjectStatus({ removed: false, links: [], submissions: [] })).toBe("draft");
    expect(deriveProjectStatus({ removed: false, links: [link("linked")], submissions: [] })).toBe("draft");
    // files handed in for the same assignment another way don't count
    expect(deriveProjectStatus({ removed: false, links: [link("linked")], submissions: [{ status: "submitted" }] })).toBe("draft");
    expect(deriveProjectStatus({ removed: false, links: [link("submitted")], submissions: [{ status: "submitted" }] })).toBe("submitted");
  });

  it("is graded once the linked assignment submission is graded", () => {
    expect(deriveProjectStatus({ removed: false, links: [link("submitted")], submissions: [{ status: "graded" }] })).toBe("graded");
  });

  it("stays removed whatever the links say", () => {
    expect(deriveProjectStatus({ removed: true, links: [link("submitted")], submissions: [{ status: "graded" }] })).toBe("removed");
  });
});

describe("lockReason", () => {
  it("only lets a draft be saved", () => {
    expect(lockReason("draft")).toBeNull();
    expect(lockReason(undefined)).toBeNull();
    expect(lockReason("submitted")?.code).toBe("PROJECT_LOCKED");
    expect(lockReason("graded")?.code).toBe("PROJECT_GRADED");
    expect(lockReason("removed")?.code).toBe("PROJECT_REMOVED");
  });
});
