import type { CsvCell } from "../../utils/csvExport";
import type { SchoolReports, Stat } from "../../services/reportCardWorkflowApi";

// ─── CSV rows for each tab of /reports/school ─────────────────────────────────
// Numbers stay numbers (so a spreadsheet can sum them); "no data" is an empty
// cell, never 0. Multi-table tabs write one block per table, separated by a
// blank row and headed by the table's name.

type Rows = CsvCell[][];

const r1 = (n: number | null | undefined): number | null => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);

const basisLine = (d: SchoolReports): Rows => [
  [`${d.term} ${d.academic_year}`, d.provisional ? "Provisional: includes draft report cards" : "Issued (approved/published) report cards only"],
  [],
];

const statHeader = ["Marks (n)", "Mean", "Median", "SD", "Min", "Max", "Pass rate %"];
const statCells = (s: Stat): CsvCell[] => [s.n, r1(s.mean), r1(s.median), r1(s.sd), r1(s.min), r1(s.max), r1(s.pass_rate)];

export const broadsheetRows = (d: SchoolReports): Rows => {
  const subjects = d.broadsheet.subjects;
  const header = [
    "Position",
    "Student",
    "Registration no.",
    "Gender",
    "Class",
    ...subjects.map((s) => s.name),
    "Total",
    "Average",
    "Grade",
    "Passed",
    "Failed",
    "Attendance %",
  ];
  const rows: Rows = d.broadsheet.students.map((s) => [
    s.position == null ? null : s.position_of ? `${s.position}/${s.position_of}` : s.position,
    s.name,
    s.registration_number,
    s.gender === "unknown" ? "" : s.gender,
    s.class_name,
    ...subjects.map((sub) => r1(s.subjects[sub.subject_id])),
    r1(s.total),
    r1(s.average),
    s.grade,
    s.passed,
    s.failed,
    r1(s.attendance_rate),
  ]);
  const statOf = (id: number) => d.broadsheet.subject_stats.find((x) => x.subject_id === id);
  const pad = ["", "", "", ""];
  const footer: Rows = [
    ["", "Subject mean", ...pad.slice(1), ...subjects.map((s) => r1(statOf(s.subject_id)?.mean))],
    ["", "Highest", ...pad.slice(1), ...subjects.map((s) => r1(statOf(s.subject_id)?.max))],
    ["", "Lowest", ...pad.slice(1), ...subjects.map((s) => r1(statOf(s.subject_id)?.min))],
    ["", "Pass rate %", ...pad.slice(1), ...subjects.map((s) => r1(statOf(s.subject_id)?.pass_rate))],
  ];
  return [...basisLine(d), header, ...rows, [], ...footer];
};

export const performanceRows = (d: SchoolReports): Rows => {
  const p = d.performance;
  const letters = d.bands.map((b) => b.letter);
  const countOf = (dist: SchoolReports["performance"]["overall"]["distribution"], letter: string) =>
    dist.find((x) => x.letter === letter)?.count ?? 0;
  return [
    ...basisLine(d),
    ["Overall"],
    ["Students", "With marks", ...statHeader],
    [d.students, d.with_marks, ...statCells(p.overall)],
    [],
    ["Grade distribution"],
    ["Grade", "From %", "Students"],
    ...d.bands.map((b) => [b.letter, b.min, countOf(p.overall.distribution, b.letter)]),
    [],
    ["Subjects (by mean)"],
    ["Subject", ...statHeader, ...letters],
    ...[...p.subjects]
      .sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1))
      .map((s) => [s.name, ...statCells(s), ...letters.map((l) => countOf(s.distribution, l))]),
    [],
    ["Classes"],
    ["Class", "Programme", "Students", ...statHeader, "At risk"],
    ...p.classes.map((c) => [c.name, c.program_name, c.students, ...statCells(c), c.at_risk]),
    [],
    ["Hardest subjects"],
    ["Subject", "Mean", "Pass rate %"],
    ...p.hardest_subjects.map((s) => [s.name, r1(s.mean), r1(s.pass_rate)]),
  ];
};

export const genderRows = (d: SchoolReports): Rows => {
  const g = d.gender;
  const genders = ["female", "male", "unknown"] as const;
  return [
    ...basisLine(d),
    ["Overall"],
    ["Gender", "Students", ...statHeader],
    ...genders.map((k) => [k, g.overall[k].students, ...statCells(g.overall[k])]),
    ["Gap (female - male) mean", r1(g.gap)],
    ["Gap (female - male) pass rate", r1(g.pass_rate_gap)],
    ...(g.unknown_count > 0 ? [["Gender missing in MIS", g.unknown_count]] : []),
    [],
    ["Subjects"],
    ["Subject", "Female n", "Female mean", "Female pass rate %", "Male n", "Male mean", "Male pass rate %", "Gap (F - M)"],
    ...g.subjects.map((s) => [s.name, s.female.n, r1(s.female.mean), r1(s.female.pass_rate), s.male.n, r1(s.male.mean), r1(s.male.pass_rate), r1(s.gap)]),
    [],
    ["Classes"],
    ["Class", "Female students", "Female mean", "Male students", "Male mean", "Unknown students", "Gap (F - M)"],
    ...g.classes.map((c) => [c.name, c.female.students, r1(c.female.mean), c.male.students, r1(c.male.mean), c.unknown.students, r1(c.gap)]),
  ];
};

export const trendsRows = (d: SchoolReports): Rows => {
  const t = d.trends;
  const meanIn = (terms: Array<{ term: string; mean: number | null }>, term: string) => r1(terms.find((x) => x.term === term)?.mean);
  return [
    ...basisLine(d),
    ["Overall by term"],
    ["Term", ...statHeader],
    ...t.overall.map((o) => [o.term, ...statCells(o)]),
    [],
    ["Subjects by term (mean)"],
    ["Subject", ...t.terms],
    ...t.subjects.map((s) => [s.name, ...t.terms.map((term) => meanIn(s.terms, term))]),
    [],
    ["Classes by term (mean)"],
    ["Class", ...t.terms],
    ...t.classes.map((c) => [c.name, ...t.terms.map((term) => meanIn(c.terms, term))]),
    [],
    [`Change since ${t.previous_term ?? "previous term"}`],
    ["Student", "Class", "Previous", "Current", "Change"],
    ...t.improvement.map((i) => [i.name, i.class_name, r1(i.previous), r1(i.current), r1(i.change)]),
  ];
};

export const atRiskRows = (d: SchoolReports): Rows => [
  ...basisLine(d),
  ["Severity", "Student", "Class", "Gender", "Average", "Failed subjects", "Attendance %", "Reasons"],
  ...d.at_risk.map((s) => [
    s.severity,
    s.name,
    s.class_name,
    s.gender === "unknown" ? "" : s.gender,
    r1(s.average),
    s.failed_subjects.join("; "),
    r1(s.attendance_rate),
    s.reasons.join("; "),
  ]),
];
