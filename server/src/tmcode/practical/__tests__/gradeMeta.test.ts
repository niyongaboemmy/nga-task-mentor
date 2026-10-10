import { assignmentMeta, gradeFingerprint, isHandIn, releasedAnnotations, versionOf, withMeta } from "../gradeMeta";
import { sessionStatus } from "../../../controllers/tmcodeSessions.controller";

describe("grade meta in submissions.project_ref", () => {
  it("keeps the hand-in fields when grading data is written, and reads it back", () => {
    const ref = JSON.stringify({ project_id: 3, revision_id: 9 });
    const next = JSON.parse(withMeta(ref, { graded_by: 5 }));
    expect(next).toEqual({ project_id: 3, revision_id: 9, grading: { graded_by: 5 } });
    expect(assignmentMeta(next)).toEqual({ graded_by: 5 });
    expect(assignmentMeta(null)).toEqual({});
    expect(isHandIn(next)).toBe(true);
    expect(isHandIn(withMeta(null, { saved_at: "x" }))).toBe(false);
  });

  it("shows students annotations only for the released grade still stored", () => {
    const meta = { annotations: [{ path: "a.js", line: 2, text: "Hm" }], fp: gradeFingerprint("8/10", "Good") };
    const project_ref = withMeta(null, meta);
    expect(releasedAnnotations({ status: "graded", grade: "8/10", feedback: "Good", project_ref })).toHaveLength(1);
    // Re-graded on the web since (different grade): hidden.
    expect(releasedAnnotations({ status: "graded", grade: "9/10", feedback: "Good", project_ref })).toEqual([]);
    // Not graded (a draft, or reopened): hidden.
    expect(releasedAnnotations({ status: "submitted", grade: "8/10", feedback: "Good", project_ref })).toEqual([]);
  });

  it("versions change with any part of the state", () => {
    expect(versionOf(["a", 1, "graded"])).toBe(versionOf(["a", 1, "graded"]));
    expect(versionOf(["a", 1, "graded"])).not.toBe(versionOf(["a", 1, "submitted"]));
  });
});

describe("TMCode session status", () => {
  const now = Date.parse("2026-10-10T10:00:00Z");
  it("active within 90 s of a heartbeat, offline after, submitted once ended", () => {
    expect(sessionStatus({ status: "active", last_heartbeat: new Date(now - 30_000) }, "in_progress", now)).toBe("active");
    expect(sessionStatus({ status: "active", last_heartbeat: new Date(now - 120_000) }, "in_progress", now)).toBe("offline");
    expect(sessionStatus({ status: "ended", last_heartbeat: new Date(now) }, "in_progress", now)).toBe("submitted");
    expect(sessionStatus({ status: "active", last_heartbeat: new Date(now) }, "completed", now)).toBe("submitted");
    expect(sessionStatus({ status: "superseded", last_heartbeat: new Date(now) }, "in_progress", now)).toBe("offline");
  });
});
