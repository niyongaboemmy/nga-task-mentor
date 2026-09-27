import { buildStandingPayload, gradePercentage, type StandingInput } from "../studentStanding";

// Two subjects. MAT roster: target (MIS 1) + MIS 2 + MIS 3. ENG roster: target + MIS 2.
// Local users.id = MIS id + 100.
const base = (over: Partial<StandingInput> = {}): StandingInput => ({
  target: { mis_user_id: 1, user_id: 101 },
  subjects: [
    { course_id: 10, subject_name: "Maths", subject_code: "MAT", roster: [1, 2, 3] },
    { course_id: 20, subject_name: "English", subject_code: "ENG", roster: [1, 2] },
  ],
  localIdByMisId: new Map([
    [1, 101],
    [2, 102],
    [3, 103],
  ]),
  assignments: [],
  submissions: [],
  quizzes: [],
  quizSubmissions: [],
  recorded: [],
  random: () => 0.5,
  ...over,
});

const sub = (localId: number, misId: number | null) => ({
  student_id: localId,
  student: { id: localId, mis_user_id: misId },
});

const me = (p: ReturnType<typeof buildStandingPayload>) => p.members.find((m) => m.key === p.me)!;

describe("gradePercentage", () => {
  it("reads a score/max grade against its own max", () => {
    expect(gradePercentage("8/10", 20)).toBe(80);
  });
  it("falls back to the assignment max for a bare score", () => {
    expect(gradePercentage("15", 20)).toBe(75);
  });
  it("treats an empty or unusable grade as unmarked", () => {
    expect(gradePercentage(null, 20)).toBeNull();
    expect(gradePercentage("", 20)).toBeNull();
    expect(gradePercentage("abc", 20)).toBeNull();
    expect(gradePercentage("5", 0)).toBeNull();
  });
});

describe("buildStandingPayload", () => {
  it("lists every classmate across the target's subjects once, anonymised", () => {
    const payload = buildStandingPayload(base());
    expect(payload.members).toHaveLength(3);
    expect(payload.members.filter((m) => m.key === "me")).toHaveLength(1);
    expect(payload.subjects.map((s) => s.roster_size)).toEqual([3, 2]);
    // No identifying field leaks out.
    expect(JSON.stringify(payload)).not.toMatch(/mis_user_id|user_id/);
  });

  it("ignores drafts and keeps the best mark per assignment", () => {
    const payload = buildStandingPayload(
      base({
        assignments: [{ id: 1, course_id: 10, max_score: 10 }],
        submissions: [
          { assignment_id: 1, grade: "4/10", status: "graded", ...sub(101, 1) },
          { assignment_id: 1, grade: "9/10", status: "resubmitted", ...sub(101, 1) },
          { assignment_id: 1, grade: "10/10", status: "draft", ...sub(102, 2) },
        ],
      }),
    );
    expect(me(payload).scores["10"].assignment).toEqual([90, 1]);
    const others = payload.members.filter((m) => m.key !== "me");
    expect(others.every((m) => !m.scores["10"]?.assignment)).toBe(true);
  });

  it("counts a quiz's best completed attempt, compared numerically", () => {
    const payload = buildStandingPayload(
      base({
        quizzes: [{ id: 5, course_id: 20 }],
        quizSubmissions: [
          { quiz_id: 5, total_score: "9.00", percentage: "45.00", ...sub(101, 1) },
          { quiz_id: 5, total_score: "10.00", percentage: "50.00", ...sub(101, 1) },
        ],
      }),
    );
    expect(me(payload).scores["20"].quiz).toEqual([50, 1]);
  });

  it("matches a submission by local id when the joined user has no MIS id", () => {
    const payload = buildStandingPayload(
      base({
        assignments: [{ id: 1, course_id: 10, max_score: 10 }],
        submissions: [{ assignment_id: 1, grade: "7/10", status: "graded", ...sub(101, null) }],
      }),
    );
    expect(me(payload).scores["10"].assignment).toEqual([70, 1]);
  });

  it("does not rank a submitter who isn't on the subject's roster", () => {
    const payload = buildStandingPayload(
      base({
        assignments: [{ id: 1, course_id: 20, max_score: 10 }],
        // MIS 3 isn't enrolled in ENG.
        submissions: [{ assignment_id: 1, grade: "10/10", status: "graded", ...sub(103, 3) }],
      }),
    );
    expect(payload.members.some((m) => m.scores["20"])).toBe(false);
  });

  it("leaves out recorded marks that don't count to the final grade", () => {
    const payload = buildStandingPayload(
      base({
        recorded: [
          { course_id: 10, counts_to_final: true, max_score: 20, percentageFor: () => 60 },
          { course_id: 10, counts_to_final: false, max_score: 20, percentageFor: () => 100 },
          { course_id: 10, counts_to_final: true, max_score: 20, percentageFor: () => null },
        ],
      }),
    );
    expect(me(payload).scores["10"].recorded).toEqual([60, 1]);
  });

  it("still scores the target when MIS returned no roster", () => {
    const payload = buildStandingPayload(
      base({
        subjects: [{ course_id: 10, subject_name: "Maths", subject_code: "MAT", roster: [] }],
        recorded: [{ course_id: 10, counts_to_final: true, max_score: 20, percentageFor: () => 55 }],
      }),
    );
    expect(payload.subjects[0]).toMatchObject({ roster_size: 1, roster_available: false });
    expect(me(payload).scores["10"].recorded).toEqual([55, 1]);
  });
});
