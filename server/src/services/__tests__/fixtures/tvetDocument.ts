import { tvetCell, tvetTotals, deliberationConditions, type ReportCardDocument, type TvetTermCell } from "../../reportCardDocument";
import { NGA_GRADING_BANDS } from "../../tenantSettings";

/**
 * A TVET (CAMIS) document built from an issued Level 3 card: 15 modules,
 * three terms, IA on the specific modules in Term 3. Used by the PDF tests
 * and to eyeball the template.
 */
type Row = [code: string, title: string, cat: "complementary" | "general" | "specific", w: number, t1: [number, number], t2: [number, number], t3: [number, number | null, number]];
const ROWS: Row[] = [
  ["CCMKN302", "Gukoresha Ikinyarwanda Kiboneye", "complementary", 30, [22.5, 27.5], [27.5, 27.5], [24, null, 25]],
  ["CCMBC302", "Entrepreneurship", "complementary", 30, [25, 29], [25, 29], [25, null, 29]],
  ["CCMCZ301", "Comply with Citizenship values", "complementary", 30, [25, 27], [25, 27], [25, null, 27]],
  ["GENPH302", "Design Electrical and Electronics Circuits using optical instruments", "general", 100, [84, 100], [88, 84], [91, null, 91]],
  ["GENEG302", "Maintain professional conversation in Upper intermediate English", "general", 80, [78.4, 65.2], [73.6, 58], [70.8, null, 69.2]],
  ["GENMA301", "Apply Algebra, Trigonometry, Probability and Statistics", "general", 100, [94, 88], [94, 88], [83, null, 70]],
  ["GENCB302", "Apply Computer Basics", "general", 60, [45, 56], [57, 59], [57, null, 59]],
  ["SPEWI302", "Develop web user interface", "specific", 80, [61.7, 62.4], [59.2, 70.4], [74.7, 75.9, 73.6]],
  ["SPEES302", "Design Embedded system Hardware", "specific", 100, [78, 90], [88, 90], [86.3, 86.3, 70]],
  ["SPENF302", "Apply Networking fundamentals", "specific", 60, [50.4, 35.2], [52.8, 36], [52.5, 50, 54]],
  ["SPEPE302", "Apply Fundamentals of Programming using C", "specific", 120, [91, 110], [86, 110], [111, 120, 108]],
  ["SPEGI302", "Design graphic user interface", "specific", 80, [64, 72], [73.6, 73.6], [76, 74.4, 77.6]],
  ["SPEWJ302", "Develop web Application using Java script", "specific", 120, [96, 115], [97, 92], [115, 108, 119]],
  ["SPEDB302", "Develop basic database", "specific", 80, [80, 72], [66, 74], [75, 80, 69]],
  ["SPEWP302", "Develop web application using PHP", "specific", 110, [84, 84], [95, 106], [107, 110, 83]],
];

const pctGrade = (w: number, fa: number, ca: number, ia: number | null) => ({
  categories: {
    FA: { scaled_score: (fa / w) * 100, weight: 100, avg_percentage: (fa / w) * 100 },
    CA: { scaled_score: (ca / w) * 100, weight: 100, avg_percentage: (ca / w) * 100 },
    ...(ia != null ? { IA: { scaled_score: (ia / w) * 100, weight: 100, avg_percentage: (ia / w) * 100 } } : {}),
  },
});

export function tvetDocument(final = true, status = "published"): ReportCardDocument {
  const th = { specific: 70, general: 50, complementary: 50 };
  const terms = final ? ["Term 1", "Term 2", "Term 3"] : ["Term 2"];
  const subjects = ROWS.map(([code, name, category, w, t1, t2, t3], i) => {
    const all: Array<TvetTermCell | null> = [
      tvetCell(pctGrade(w, t1[0], t1[1], null) as any, w),
      tvetCell(pctGrade(w, t2[0], t2[1], null) as any, w),
      tvetCell(pctGrade(w, t3[0], t3[2], t3[1]) as any, w),
    ];
    const cells = final ? all : [all[1]];
    const cur = cells[cells.length - 1]!;
    const at = all.reduce((a, c) => a + (c?.to ?? 0), 0);
    const max = all.reduce((a, c) => a + (c?.max ?? 0), 0);
    const pct = Math.round((at / max) * 10000) / 100;
    const threshold = th[category];
    return {
      subject_id: i + 1,
      name,
      group: null,
      teacher: null,
      categories: { CW: null, HW: null, MD: null, EOT: null, FA: null, CA: null, IA: null },
      total: cur.pct,
      grade: null,
      remark: null,
      passed: true,
      class_average: null,
      missing_marks: 0,
      code,
      category,
      threshold,
      competent: (cur.pct ?? 0) >= threshold,
      mapped: true,
      tvet: { weight: w, weight_source: "mis" as const, terms: cells, annual: final ? { at: Math.round(at * 100) / 100, max, pct, competent: pct >= threshold } : null },
    };
  });
  const totalsOf = (i: number) => tvetTotals(subjects.map((s) => s.tvet.terms[i]));
  const positions = final ? [2, 1, 4] : [1];
  const conduct = final ? [35, 35, 35] : [35];
  const yearAt = subjects.reduce((a, s) => a + (s.tvet.annual?.at ?? 0), 0);
  const yearMax = subjects.reduce((a, s) => a + (s.tvet.annual?.max ?? 0), 0);
  return {
    schema: 2,
    builder: "tvet",
    card: { id: 1, uuid: "tvet-123", version: 3, status, term: final ? "Term 3" : "Term 2", academic_year: "2025/2026", approved_at: "2026-07-20T08:00:00Z", published_at: null },
    school: { name: "Sample Technical School", address_line: "Kigali, Rwanda", contact_line: "", logo: "nga" },
    student: { id: 7, name: "Mukamana Ange Sample", registration_number: "100000000001", gender: "F", class_group_id: 3, class_name: "L3 SPE A", grade_name: null, program_name: "Software Programming and Embedded Systems" },
    scheme: { category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50, IA: 100, FA: 100, CA: 100 }, pass_mark: 50, bands: [...NGA_GRADING_BANDS], show_position: true, show_class_average: false, show_subject_teacher: false, head_title: "Headmaster", show_competence: true, competence_thresholds: th },
    groups: [{ name: null, subjects }],
    summary: { average: totalsOf(terms.length - 1).pct, grade: null, remark: null, total_marks: totalsOf(terms.length - 1).to ?? 0, subjects_counted: 15, subjects_passed: 15, subjects_failed: 0, position: positions[positions.length - 1], position_of: 10, class_average: null, modules_competent: 15, modules_nyc: 0 },
    attendance: { present: 60, absent: 1, excused: 0, late: 2, sick: 0, total: 63, source: "imported" },
    attributes: [{ attribute_name: "Punctuality", rating: "Excellent" }],
    comments: { class_teacher: "A consistent, hard-working learner. Keep it up.", head_teacher: null },
    next_term_begins_on: final ? null : "2026-04-20",
    grades: [],
    behaviour: { mark: 35, max: 40 },
    qualification: { rqf_level: "3", trade: "Software Programming and Embedded Systems", title: "TVET Certificate III in Software Programming and Embedded Systems", sector: "ICT and Multimedia" },
    tvet: {
      final,
      terms: terms.map((t, i) => ({
        term: t,
        current: i === terms.length - 1,
        totals: totalsOf(i),
        position: positions[i],
        position_of: 10,
        conduct: conduct[i],
        comment: i === terms.length - 1 ? "A consistent, hard-working learner. Keep it up." : "Good term.",
      })),
      annual: final ? { total: Math.round(yearAt * 100) / 100, max: yearMax, pct: Math.round((yearAt / yearMax) * 10000) / 100, position: 2, position_of: 10, conduct: 35 } : null,
      school: { district: "Gasabo", email: "info@school.rw", phone: "0788 000 000", headmaster: "Head Teacher Sample" },
      conditions: deliberationConditions(th),
      decision: final ? "Promoted" : null,
      show_attendance: false,
      show_attributes: false,
    },
  } as ReportCardDocument;
}
