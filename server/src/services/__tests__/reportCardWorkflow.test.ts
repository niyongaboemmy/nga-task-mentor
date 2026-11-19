import {
  actionsFrom,
  checkTransition,
  isEditable,
  isFrozen,
  isVisibleToStudent,
  legacyStatusToActions,
  reviewBlockers,
  reviewWarnings,
  type ReadinessFacts,
} from "../reportCardWorkflow";
import { normalizeScheme, DEFAULT_REPORT_CARD_SCHEME, NGA_GRADING_BANDS, DEFAULT_GRADING_BANDS, letterFor } from "../tenantSettings";
import { calculateSubjectGrade } from "../reportCardGrader.service";
import { resolveMark } from "../../utils/reportCardScores";
import { rankAverages } from "../reportCardDocument";
import { diffDocumentTotals } from "../../controllers/reportCardWorkflow.controller";

const ready: ReadinessFacts = {
  unsubmitted_subjects: [],
  empty_subjects: [],
  missing_marks: 0,
  has_comment: true,
  attributes_rated: 8,
  attributes_expected: 8,
  attendance_days: 60,
};

describe("report card state machine", () => {
  it("only lets a draft be edited, and only a published card be seen by students", () => {
    expect(isEditable("draft")).toBe(true);
    for (const s of ["reviewed", "approved", "published"]) expect(isEditable(s)).toBe(false);
    expect(isFrozen("approved")).toBe(true);
    expect(isFrozen("published")).toBe(true);
    expect(isFrozen("reviewed")).toBe(false);
    expect(isVisibleToStudent("approved")).toBe(false);
    expect(isVisibleToStudent("published")).toBe(true);
  });

  it("walks draft -> reviewed -> approved -> published and back only by return/unpublish/reopen", () => {
    expect(checkTransition("review", "draft", { readiness: ready })).toEqual({ ok: true, to: "reviewed" });
    expect(checkTransition("approve", "reviewed")).toEqual({ ok: true, to: "approved" });
    expect(checkTransition("publish", "approved")).toEqual({ ok: true, to: "published" });
    expect(checkTransition("unpublish", "published", { reason: "typo" })).toEqual({ ok: true, to: "approved" });
    expect(checkTransition("reopen", "published", { reason: "wrong mark" })).toEqual({ ok: true, to: "draft" });
    expect(checkTransition("reopen", "approved", { reason: "wrong mark" })).toEqual({ ok: true, to: "draft" });
    expect(checkTransition("return", "reviewed", { reason: "comment missing" })).toEqual({ ok: true, to: "draft" });
  });

  it("refuses skipped steps", () => {
    expect(checkTransition("approve", "draft")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(checkTransition("publish", "reviewed")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(checkTransition("publish", "draft")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(checkTransition("review", "approved")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(checkTransition("return", "published", { reason: "x" })).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("needs a reason to go backwards", () => {
    for (const [a, from] of [
      ["return", "reviewed"],
      ["unpublish", "published"],
      ["reopen", "approved"],
    ] as const) {
      expect(checkTransition(a, from)).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
      expect(checkTransition(a, from, { reason: "   " })).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    }
  });

  it("blocks a review until the card is complete, but only warns about empty subjects and attendance", () => {
    const facts: ReadinessFacts = {
      ...ready,
      unsubmitted_subjects: [{ subject_id: 1, name: "Maths" }],
      missing_marks: 2,
      has_comment: false,
      attributes_rated: 5,
      empty_subjects: [{ subject_id: 9, name: "Art" }],
      attendance_days: 0,
    };
    expect(reviewBlockers(facts).map((b) => b.code)).toEqual([
      "SUBJECT_NOT_SUBMITTED",
      "MISSING_MARKS",
      "NO_COMMENT",
      "ATTRIBUTES_INCOMPLETE",
    ]);
    expect(reviewWarnings(facts).map((b) => b.code)).toEqual(["SUBJECT_EMPTY", "NO_ATTENDANCE"]);
    const r = checkTransition("review", "draft", { readiness: facts });
    expect(r).toMatchObject({ ok: false, code: "NOT_READY" });
    expect(checkTransition("review", "draft", { readiness: { ...ready, empty_subjects: facts.empty_subjects, attendance_days: 0 } })).toMatchObject({
      ok: true,
    });
  });

  it("enforces four eyes when the school asks for it", () => {
    expect(checkTransition("approve", "reviewed", { actorId: 5, reviewedBy: 5, requireDistinctApprover: true })).toMatchObject({
      ok: false,
      code: "SAME_PERSON",
    });
    expect(checkTransition("approve", "reviewed", { actorId: 5, reviewedBy: 5 })).toMatchObject({ ok: true });
    expect(checkTransition("approve", "reviewed", { actorId: 6, reviewedBy: 5, requireDistinctApprover: true })).toMatchObject({ ok: true });
  });

  it("lists the actions available from each status", () => {
    expect(actionsFrom("draft")).toEqual(["review"]);
    expect(actionsFrom("reviewed")).toEqual(["return", "approve"]);
    expect(actionsFrom("approved")).toEqual(["publish", "reopen"]);
    expect(actionsFrom("published")).toEqual(["unpublish", "reopen"]);
  });

  it("maps the legacy status endpoint onto actions", () => {
    expect(legacyStatusToActions("draft", "saved")).toEqual(["review"]);
    expect(legacyStatusToActions("reviewed", "approved")).toEqual(["approve"]);
    expect(legacyStatusToActions("reviewed", "published")).toEqual(["approve", "publish"]);
    expect(legacyStatusToActions("published", "draft")).toEqual(["reopen"]);
    expect(legacyStatusToActions("draft", "approved")).toBeNull();
    expect(legacyStatusToActions("draft", "draft")).toEqual([]);
  });
});

describe("report card scheme", () => {
  it("defaults to the NGA card (15/10/25/50, pass 50, 8 attributes)", () => {
    const s = normalizeScheme({});
    expect(typeof s).toBe("object");
    expect(s).toMatchObject({ category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 }, pass_mark: 50 });
    expect((s as any).attributes).toHaveLength(8);
    expect(DEFAULT_REPORT_CARD_SCHEME.show_class_average).toBe(true);
  });

  it("refuses weights that don't add up, bad pass marks and duplicate attributes", () => {
    expect(normalizeScheme({ category_weights: { CW: 20, HW: 10, MD: 25, EOT: 50 } })).toMatch(/add up to 100/);
    expect(normalizeScheme({ pass_mark: 120 })).toMatch(/Pass mark/);
    expect(normalizeScheme({ attributes: ["Punctuality", "punctuality"] })).toMatch(/distinct/);
    expect(normalizeScheme({ attributes: [] })).toMatch(/between 1 and 16/);
  });

  it("keeps a subject in one group only", () => {
    const s: any = normalizeScheme({
      subject_groups: [
        { name: "Core modules", subject_ids: [1, 2] },
        { name: "Specific modules", subject_ids: [2, 3] },
      ],
    });
    expect(s.subject_groups).toEqual([
      { name: "Core modules", subject_ids: [1, 2] },
      { name: "Specific modules", subject_ids: [3] },
    ]);
  });

  it("grades on the school's A*-U scale (85 is an A, not a B)", () => {
    expect(letterFor(85, NGA_GRADING_BANDS).letter).toBe("A");
    expect(letterFor(90, NGA_GRADING_BANDS).letter).toBe("A*");
    expect(letterFor(19.9, NGA_GRADING_BANDS).letter).toBe("U");
    expect(letterFor(85, DEFAULT_GRADING_BANDS).letter).toBe("B");
  });

  it("scales categories with the school's own weights", () => {
    const g = calculateSubjectGrade(
      1,
      [
        { assessment_id: 1, assessment_type: "manual", category: "CW", raw_score: 8, max_score: 10 },
        { assessment_id: 2, assessment_type: "manual", category: "EOT", raw_score: 50, max_score: 100 },
      ],
      { CW: 40, HW: 0, MD: 0, EOT: 60 },
    );
    expect(g.categories.CW?.scaled_score).toBe(32);
    expect(g.categories.EOT?.scaled_score).toBe(30);
    expect(g.total_score).toBe(62);
  });
});

describe("absent / exempt marks", () => {
  const marks = {
    scores: new Map([["manual:1", { raw_score: 7, max_score: 10 }]]) as any,
    statuses: new Map([["manual:2", "exempt"]]) as any,
  };
  it("absent counts 0, exempt is left out, a recorded mark is used", () => {
    expect(resolveMark("manual:1" as any, marks)).toEqual({ raw_score: 7, max_score: 10 });
    expect(resolveMark("manual:1" as any, marks, "absent")).toEqual({ raw_score: 0, max_score: 10 });
    expect(resolveMark("quiz:9" as any, marks, "absent")).toEqual({ raw_score: 0, max_score: 1 });
    expect(resolveMark("manual:2" as any, marks)).toBeNull();
    expect(resolveMark("manual:1" as any, marks, "exempt")).toBeNull();
    expect(resolveMark("quiz:9" as any, marks)).toBeNull();
  });
});

describe("class positions and approval diffs", () => {
  it("ranks 1,2,2,4 and leaves students without marks unranked", () => {
    const r = rankAverages([
      { id: 1, average: 80 },
      { id: 2, average: 75 },
      { id: 3, average: 75 },
      { id: 4, average: 60 },
      { id: 5, average: null },
    ]);
    expect([r.get(1), r.get(2), r.get(3), r.get(4), r.get(5)]).toEqual([1, 2, 2, 4, undefined]);
  });

  it("reports the subjects whose total moved since approval", () => {
    const frozen: any = {
      groups: [
        {
          name: null,
          subjects: [
            { subject_id: 1, name: "Maths", total: 70 },
            { subject_id: 2, name: "Physics", total: 60 },
          ],
        },
      ],
    };
    const live: any = { grades: [{ subject_id: 1, total_score: 70 }, { subject_id: 2, total_score: 64.5 }, { subject_id: 3, total_score: 50 }] };
    expect(diffDocumentTotals(frozen, live)).toEqual([
      { subject_id: 2, name: "Physics", approved: 60, now: 64.5 },
      { subject_id: 3, name: "Subject #3", approved: null, now: 50 },
    ]);
  });
});
