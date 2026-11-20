import type { DocumentSubject, ReportCardDocument, TvetTermCell, TvetTotals } from "../../../services/reportCardApi";

/**
 * Sample documents for previewing the two templates (template gallery,
 * "View template"): a Normal term card and a TVET card (termly or Term 3),
 * with made-up learners and marks shaped like real ones.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

const base = (over: Partial<ReportCardDocument>): ReportCardDocument =>
  ({
    schema: 2,
    card: { id: 0, uuid: "sample", version: 1, status: "published", term: "Term 2", academic_year: "2025/2026", approved_at: "2026-04-01T08:00:00Z", published_at: null },
    school: { name: "Sample Technical Secondary School", address_line: "Kigali, Rwanda", contact_line: "Tel: 0788 000 000 · info@school.rw", logo: null },
    student: { id: 0, name: "Uwase Aline", registration_number: "330400000001", gender: "F", class_group_id: 1, class_name: "L3 SOD A", grade_name: "Level 3", program_name: "Software Development" },
    scheme: {
      category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 },
      pass_mark: 50,
      bands: [
        { min: 80, letter: "A", remark: "Excellent" },
        { min: 70, letter: "B", remark: "Very good" },
        { min: 60, letter: "C", remark: "Good" },
        { min: 50, letter: "D", remark: "Satisfactory" },
        { min: 0, letter: "F", remark: "Weak" },
      ],
      show_position: true,
      show_class_average: true,
      show_subject_teacher: true,
      head_title: "Head teacher",
      show_subject_rank: true,
      show_competence: true,
      competence_thresholds: { specific: 70, general: 50, complementary: 50 },
    },
    groups: [],
    summary: { average: null, grade: null, remark: null, total_marks: 0, subjects_counted: 0, subjects_passed: 0, subjects_failed: 0, position: 3, position_of: 32, class_average: 68.4 },
    attendance: { present: 58, absent: 2, excused: 1, late: 2, sick: 0, total: 63, source: "imported" },
    attributes: [
      { attribute_name: "Punctuality", rating: "Excellent" },
      { attribute_name: "Co-operation and teamwork", rating: "Very good" },
    ],
    comments: { class_teacher: "A focused learner who helps others. Keep practising the end-of-term topics.", head_teacher: null },
    next_term_begins_on: "2026-04-20",
    grades: [],
    behaviour: { mark: 36, max: 40 },
    ...over,
  }) as ReportCardDocument;

const letter = (t: number) => (t >= 80 ? ["A", "Excellent"] : t >= 70 ? ["B", "Very good"] : t >= 60 ? ["C", "Good"] : t >= 50 ? ["D", "Satisfactory"] : ["F", "Weak"]);

export function sampleNormalDocument(): ReportCardDocument {
  const rows: Array<[string, string, "specific" | "general" | "complementary", number, number, number, number, number]> = [
    ["SWDCB301", "Coding Basics", "specific", 13, 9, 21, 42, 74],
    ["SWDWD301", "Web Design", "specific", 14, 8.5, 22, 44, 71],
    ["SWDDB301", "Database Fundamentals", "specific", 11, 7, 18, 31, 69],
    ["GENMA301", "Mathematics", "general", 12, 8, 19, 36, 66],
    ["GENEG301", "English", "general", 13.5, 9, 20, 40, 72],
    ["CCMBC301", "Entrepreneurship", "complementary", 14, 9.5, 23, 45, 78],
  ];
  const subjects: DocumentSubject[] = rows.map(([code, name, category, cw, hw, md, eot, avg], i) => {
    const total = r2(cw + hw + md + eot);
    const [g, remark] = letter(total);
    const threshold = category === "specific" ? 70 : 50;
    return {
      subject_id: i + 1,
      name,
      group: null,
      teacher: ["Mugisha J.", "Uwimana C.", "Habimana E."][i % 3],
      categories: { CW: cw, HW: hw, MD: md, EOT: eot },
      total,
      grade: g,
      remark,
      passed: total >= 50,
      class_average: avg,
      missing_marks: 0,
      code,
      category,
      points: total,
      weight_covered: 100,
      threshold,
      competent: total >= threshold,
      rank: (i % 5) + 1,
      rank_of: 32,
      mapped: true,
    };
  });
  const groups = (["specific", "general", "complementary"] as const).map((c) => ({
    name: { specific: "Specific modules", general: "General modules", complementary: "Complementary modules" }[c],
    subjects: subjects.filter((s) => s.category === c),
  }));
  const average = r2(subjects.reduce((a, s) => a + (s.total ?? 0), 0) / subjects.length);
  const [g, remark] = letter(average);
  return base({
    builder: "normal",
    groups,
    summary: {
      average,
      grade: g,
      remark,
      total_marks: r2(subjects.reduce((a, s) => a + (s.total ?? 0), 0)),
      subjects_counted: subjects.length,
      subjects_passed: subjects.filter((s) => s.passed).length,
      subjects_failed: subjects.filter((s) => s.passed === false).length,
      position: 3,
      position_of: 32,
      class_average: 68.4,
      modules_competent: subjects.filter((s) => s.competent).length,
      modules_nyc: subjects.filter((s) => s.competent === false).length,
    },
  });
}

const cell = (w: number, fa: number | null, ca: number | null, ia: number | null): TvetTermCell | null => {
  const parts = [fa, ca, ia].filter((x): x is number => x != null);
  if (!parts.length) return null;
  const to = r2(parts.reduce((a, b) => a + b, 0));
  const max = w * parts.length;
  return { fa, ia, ca, to, max, pct: r2((to / max) * 100) };
};
const totals = (cells: Array<TvetTermCell | null>): TvetTotals => {
  const got = cells.filter((c): c is TvetTermCell => !!c);
  const sum = (k: "fa" | "ia" | "ca") => {
    const v = got.map((c) => c[k]).filter((x): x is number => x != null);
    return v.length ? r2(v.reduce((a, b) => a + b, 0)) : null;
  };
  const to = r2(got.reduce((a, c) => a + (c.to ?? 0), 0));
  const max = r2(got.reduce((a, c) => a + (c.max ?? 0), 0));
  return { fa: sum("fa"), ia: sum("ia"), ca: sum("ca"), to, max, pct: max ? r2((to / max) * 100) : null };
};

export function sampleTvetDocument(final = true): ReportCardDocument {
  type Row = [string, string, "specific" | "general" | "complementary", number, [number, number], [number, number], [number, number | null, number]];
  const rows: Row[] = [
    ["CCMKN302", "Gukoresha Ikinyarwanda Kiboneye", "complementary", 30, [22.5, 27.5], [27.5, 27.5], [24, null, 25]],
    ["CCMBC302", "Entrepreneurship", "complementary", 30, [25, 29], [25, 29], [25, null, 29]],
    ["GENPH302", "Design Electrical and Electronics Circuits", "general", 100, [84, 100], [88, 84], [91, null, 91]],
    ["GENEG302", "Maintain professional conversation in English", "general", 80, [78.4, 65.2], [73.6, 58], [70.8, null, 69.2]],
    ["GENMA301", "Apply Algebra, Trigonometry and Statistics", "general", 100, [94, 88], [94, 88], [83, null, 70]],
    ["SPEWI302", "Develop web user interface", "specific", 80, [61.7, 62.4], [59.2, 70.4], [74.7, 75.9, 73.6]],
    ["SPENF302", "Apply Networking fundamentals", "specific", 60, [50.4, 35.2], [52.8, 36], [52.5, 50, 54]],
    ["SPEPE302", "Apply Fundamentals of Programming using C", "specific", 120, [91, 110], [86, 110], [111, 120, 108]],
    ["SPEDB302", "Develop basic database", "specific", 80, [80, 72], [66, 74], [75, 80, 69]],
  ];
  const th = { specific: 70, general: 50, complementary: 50 };
  const termNames = final ? ["Term 1", "Term 2", "Term 3"] : ["Term 2"];
  const subjects: DocumentSubject[] = rows.map(([code, name, category, w, t1, t2, t3], i) => {
    const all = [cell(w, t1[0], t1[1], null), cell(w, t2[0], t2[1], null), cell(w, t3[0], t3[2], t3[1])];
    const cells = final ? all : [all[1]];
    const cur = cells[cells.length - 1]!;
    const at = r2(all.reduce((a, c) => a + (c?.to ?? 0), 0));
    const max = all.reduce((a, c) => a + (c?.max ?? 0), 0);
    const pct = r2((at / max) * 100);
    return {
      subject_id: i + 1,
      name,
      group: null,
      teacher: null,
      categories: {},
      total: cur.pct,
      grade: null,
      remark: null,
      passed: true,
      class_average: null,
      missing_marks: 0,
      code,
      category,
      threshold: th[category],
      competent: (cur.pct ?? 0) >= th[category],
      mapped: true,
      tvet: { weight: w, weight_source: "mis", terms: cells, annual: final ? { at, max, pct, competent: pct >= th[category] } : null },
    };
  });
  const termTotals = termNames.map((_, i) => totals(subjects.map((s) => s.tvet!.terms[i])));
  const yearAt = r2(subjects.reduce((a, s) => a + (s.tvet!.annual?.at ?? 0), 0));
  const yearMax = subjects.reduce((a, s) => a + (s.tvet!.annual?.max ?? 0), 0);
  const positions = final ? [2, 1, 4] : [1];
  return base({
    builder: "tvet",
    card: { id: 0, uuid: "sample", version: 1, status: "published", term: final ? "Term 3" : "Term 2", academic_year: "2025/2026", approved_at: "2026-07-20T08:00:00Z", published_at: null },
    student: { id: 0, name: "Mukamana Ange Sample", registration_number: "100000000001", gender: "F", class_group_id: 1, class_name: "SPES Year 1 A", grade_name: "Level 3", program_name: "Software Programming and Embedded Systems" },
    groups: [{ name: null, subjects }],
    summary: {
      average: termTotals[termTotals.length - 1].pct,
      grade: null,
      remark: null,
      total_marks: termTotals[termTotals.length - 1].to ?? 0,
      subjects_counted: subjects.length,
      subjects_passed: subjects.length,
      subjects_failed: 0,
      position: positions[positions.length - 1],
      position_of: 10,
      class_average: null,
      modules_competent: subjects.filter((s) => s.competent).length,
      modules_nyc: subjects.filter((s) => s.competent === false).length,
    },
    qualification: { rqf_level: "3", trade: "Software Programming and Embedded Systems", title: "Level 3", sector: "ICT and Multimedia" },
    tvet: {
      final,
      terms: termNames.map((t, i) => ({
        term: t,
        current: i === termNames.length - 1,
        totals: termTotals[i],
        position: positions[i],
        position_of: 10,
        conduct: 35,
        comment: i === termNames.length - 1 ? "A consistent, hard-working learner." : "Good term.",
      })),
      annual: final ? { total: yearAt, max: yearMax, pct: r2((yearAt / yearMax) * 100), position: 2, position_of: 10, conduct: 35 } : null,
      school: { district: "Gasabo", email: "info@school.rw", phone: "0788 000 000", headmaster: "Head Teacher's name" },
      conditions: [
        "Each module is independently deliberated",
        "The passing line for Complementary and General modules is 50%",
        "The passing line for Specific modules is 70%",
      ],
      decision: final ? "Promoted" : null,
      show_attendance: false,
      show_attributes: false,
    },
  });
}
