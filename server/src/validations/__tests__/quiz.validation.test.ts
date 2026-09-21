import {
  createQuizSchema,
  updateQuizSchema,
  QUIZ_TYPES,
  QUIZ_STATUSES,
} from "../quiz.validation";

const valid = {
  title: "  Term 1 Algebra  ",
  description: "Covers linear equations",
  type: "Exam",
  show_results_immediately: true,
  randomize_questions: false,
  show_correct_answers: false,
};

const fieldsOf = (result: any) =>
  result.success ? [] : result.error.issues.map((i: any) => i.path.join("."));

describe("createQuizSchema", () => {
  it("accepts a minimal valid payload, trims strings and applies defaults", () => {
    const result = createQuizSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Term 1 Algebra");
    expect(result.data.status).toBe("draft");
    expect(result.data.enable_automatic_grading).toBe(true);
    expect(result.data.require_manual_grading).toBe(false);
    expect(result.data.is_public).toBe(false);
  });

  it("defaults type to Quiz and booleans when omitted", () => {
    const result = createQuizSchema.safeParse({
      title: "T",
      description: "D",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe("Quiz");
    expect(result.data.show_results_immediately).toBe(true);
    expect(result.data.randomize_questions).toBe(false);
  });

  it("rejects missing / blank title and description with field paths", () => {
    const result = createQuizSchema.safeParse({
      ...valid,
      title: "   ",
      description: "",
    });
    expect(result.success).toBe(false);
    expect(fieldsOf(result)).toEqual(
      expect.arrayContaining(["title", "description"]),
    );
  });

  it("rejects a title longer than 200 characters", () => {
    const result = createQuizSchema.safeParse({
      ...valid,
      title: "x".repeat(201),
    });
    expect(fieldsOf(result)).toEqual(["title"]);
  });

  it.each(["practice", "graded", "exam", "quiz", ""])(
    "rejects the legacy/invalid quiz type %j that used to cause a DB ENUM 500",
    (type) => {
      const result = createQuizSchema.safeParse({ ...valid, type });
      expect(result.success).toBe(false);
      expect(fieldsOf(result)).toEqual(["type"]);
    },
  );

  it.each(QUIZ_TYPES)("accepts the valid quiz type %s", (type) => {
    expect(createQuizSchema.safeParse({ ...valid, type }).success).toBe(true);
  });

  it.each(QUIZ_STATUSES)("accepts the valid status %s", (status) => {
    expect(createQuizSchema.safeParse({ ...valid, status }).success).toBe(true);
  });

  it("rejects the legacy 'archived' status", () => {
    const result = createQuizSchema.safeParse({ ...valid, status: "archived" });
    expect(fieldsOf(result)).toEqual(["status"]);
  });

  it("strips the quiz-level time_limit (timing is per question)", () => {
    const result = createQuizSchema.safeParse({ ...valid, time_limit: 45 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as any).time_limit).toBeUndefined();
  });

  describe("max_attempts", () => {
    it("treats empty string / null as not set", () => {
      for (const v of ["", null, undefined]) {
        const result = createQuizSchema.safeParse({ ...valid, max_attempts: v });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.max_attempts ?? null).toBeNull();
      }
    });

    it("coerces numeric strings", () => {
      const result = createQuizSchema.safeParse({ ...valid, max_attempts: "3" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.max_attempts).toBe(3);
    });

    it.each([0, -1, 51, 1.5, "abc"])("rejects %j", (v) => {
      const result = createQuizSchema.safeParse({ ...valid, max_attempts: v });
      expect(fieldsOf(result)).toEqual(["max_attempts"]);
    });
  });

  describe("passing_score", () => {
    it.each([0, 50.5, 100, "60"])("accepts %j", (v) => {
      expect(
        createQuizSchema.safeParse({ ...valid, passing_score: v }).success,
      ).toBe(true);
    });

    it.each([-0.1, 100.1, 150, "high"])("rejects %j", (v) => {
      const result = createQuizSchema.safeParse({ ...valid, passing_score: v });
      expect(fieldsOf(result)).toEqual(["passing_score"]);
    });
  });

  describe("dates", () => {
    it("accepts ISO strings and treats empty strings as unset", () => {
      const result = createQuizSchema.safeParse({
        ...valid,
        start_date: "2026-09-21T08:00:00.000Z",
        end_date: "",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.start_date).toBe("2026-09-21T08:00:00.000Z");
        expect(result.data.end_date ?? null).toBeNull();
      }
    });

    it("rejects an unparseable date", () => {
      const result = createQuizSchema.safeParse({
        ...valid,
        start_date: "next tuesday",
      });
      expect(fieldsOf(result)).toEqual(["start_date"]);
    });

    it("rejects an end date that is not after the start date", () => {
      const result = createQuizSchema.safeParse({
        ...valid,
        start_date: "2026-09-21T10:00:00Z",
        end_date: "2026-09-21T09:00:00Z",
      });
      expect(fieldsOf(result)).toEqual(["end_date"]);
    });
  });

  it("rejects non-boolean flags", () => {
    const result = createQuizSchema.safeParse({
      ...valid,
      is_public: "yes",
      randomize_questions: 1,
    });
    expect(fieldsOf(result)).toEqual(
      expect.arrayContaining(["is_public", "randomize_questions"]),
    );
  });
});

describe("updateQuizSchema", () => {
  it("accepts a partial payload", () => {
    const result = updateQuizSchema.safeParse({ status: "published" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ status: "published" });
  });

  it("accepts an empty payload (no-op update)", () => {
    expect(updateQuizSchema.safeParse({}).success).toBe(true);
  });

  it("still validates fields that are present", () => {
    const result = updateQuizSchema.safeParse({
      title: "",
      type: "graded",
      status: "archived",
      passing_score: 101,
    });
    expect(fieldsOf(result)).toEqual(
      expect.arrayContaining(["title", "type", "status", "passing_score"]),
    );
  });

  it("allows explicitly clearing nullable fields with null", () => {
    const result = updateQuizSchema.safeParse({
      instructions: null,
      max_attempts: null,
      passing_score: null,
      start_date: null,
      end_date: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_attempts).toBeNull();
      expect(result.data.start_date).toBeNull();
    }
  });

  it("strips time_limit", () => {
    const result = updateQuizSchema.safeParse({ time_limit: 30 });
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as any).time_limit).toBeUndefined();
  });
});
