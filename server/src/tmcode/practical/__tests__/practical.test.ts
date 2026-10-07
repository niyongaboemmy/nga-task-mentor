import { parsePracticalAnswer, parsePracticalData, validatePracticalData } from "../question";
import { previewEntry, previewToken, readPreviewToken } from "../../../controllers/tmcodePracticals.controller";
import { AdvancedQuizGrader } from "../../../utils/quizGrader";

describe("practical question data", () => {
  it("normalises kind, starter and rubric", () => {
    const d = parsePracticalData({ kind: "case_study", language: "web", starter_project_id: "7", rubric: [{ criteria: " Layout ", max_score: "4" }, { criteria: "" }] });
    expect(d).toMatchObject({ kind: "case_study", language: "web", starter_project_id: 7, starter_revision_id: null });
    expect(d.rubric).toEqual([{ criteria: "Layout", description: null, max_score: 4 }]);
  });

  it("validates criteria marks and starter consistency", () => {
    expect(validatePracticalData({ rubric: [{ criteria: "A", max_score: 0 }] }).isValid).toBe(false);
    expect(validatePracticalData({ starter_revision_id: 3 }).isValid).toBe(false);
    const ok = validatePracticalData({ kind: "practical", rubric: [] });
    expect(ok.isValid).toBe(true);
    expect(ok.warnings.join()).toMatch(/one overall mark/);
  });

  it("reads the submitted answer, plain or wrapped", () => {
    expect(parsePracticalAnswer({ project_id: 4, link_id: 9, revision_id: 12, revision_number: 2 })).toEqual({ project_id: 4, link_id: 9, revision_id: 12, revision_number: 2 });
    expect(parsePracticalAnswer({ answer: { project_id: 4, link_id: 9 } })?.link_id).toBe(9);
    expect(parsePracticalAnswer({})).toBeNull();
  });
});

describe("grading a practical answer", () => {
  const question: any = { id: 1, points: 10, questionBank: { question_type: "tmcode_practical", question_data: {} } };

  it("is pending for the teacher when a project was submitted", async () => {
    const r = await AdvancedQuizGrader.gradeWithConfig(question, { project_id: 4, link_id: 9, revision_id: 12 });
    expect(r.points_earned).toBe(0);
    expect((r.detailed_feedback as any).grade_status).toBe("pending");
    expect((r.detailed_feedback as any).practical.link_id).toBe(9);
  });

  it("is 0, not pending, when nothing was submitted (never graded as single choice)", async () => {
    const r = await AdvancedQuizGrader.gradeWithConfig(question, {});
    expect(r.points_earned).toBe(0);
    expect((r.detailed_feedback as any)?.grade_status).toBeUndefined();
    expect(r.feedback).toMatch(/No project/);
  });
});

describe("preview", () => {
  it("opens index.html, else the shallowest page", () => {
    expect(previewEntry(["css/a.css", "index.html", "x/index.html"])).toBe("index.html");
    expect(previewEntry(["src/app.js", "site/pages/a.html", "site/home.html"])).toBe("site/home.html");
    expect(previewEntry(["main.py"])).toBeNull();
  });

  it("signs short-lived tokens and refuses tampered or expired ones", () => {
    const t = previewToken(5, 99, 1_000);
    expect(readPreviewToken(t, 2_000)).toEqual({ p: 5, r: 99 });
    expect(readPreviewToken(t, 1_000 + 31 * 60 * 1000)).toBeNull();
    const [payload] = t.split(".");
    const forged = `${Buffer.from(JSON.stringify({ p: 6, r: 99, e: 9e15 })).toString("base64url")}.${t.split(".")[1]}`;
    expect(readPreviewToken(forged, 2_000)).toBeNull();
    expect(readPreviewToken(`${payload}.nope`, 2_000)).toBeNull();
  });
});
