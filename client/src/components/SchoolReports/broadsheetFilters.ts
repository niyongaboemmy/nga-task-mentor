import type { SchoolReports } from "../../services/reportCardWorkflowApi";

// ─── Broadsheet filters, sorting and summary ──────────────────────────────────
// Pure (no React) so every rule is unit-tested. The page keeps the filters in
// the URL so a filtered broadsheet can be shared or bookmarked.

export type BroadsheetStudent = SchoolReports["broadsheet"]["students"][number];

export type GenderFilter = "all" | "female" | "male" | "unknown";
export type ResultFilter = "all" | "passed_all" | "failed_any" | "failed_2" | "below_pass";
export type SortKey = "position" | "name" | "total" | "average" | "passed" | "failed" | "attendance" | `subject:${number}`;
export type SortDir = "asc" | "desc";

export interface BroadsheetFilters {
  q: string;
  gender: GenderFilter;
  result: ResultFilter;
  grades: string[];
  statuses: string[];
  classes: string[];
  /** Average range, inclusive; null = open. */
  minAvg: number | null;
  maxAvg: number | null;
  /** Attendance strictly below this rate (e.g. 85); null = any. */
  attendanceBelow: number | null;
  /** Only students below the pass mark in this subject. */
  failingSubject: number | null;
}

export const EMPTY_FILTERS: BroadsheetFilters = {
  q: "",
  gender: "all",
  result: "all",
  grades: [],
  statuses: [],
  classes: [],
  minAvg: null,
  maxAvg: null,
  attendanceBelow: null,
  failingSubject: null,
};

export const RESULT_LABEL: Record<ResultFilter, string> = {
  all: "Any result",
  passed_all: "Passed every subject",
  failed_any: "Failed 1+ subjects",
  failed_2: "Failed 2+ subjects",
  below_pass: "Average below pass mark",
};

export const GENDER_LABEL: Record<GenderFilter, string> = { all: "Everyone", female: "Girls", male: "Boys", unknown: "Gender not set" };

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  approved: "Approved",
  published: "Published",
};

export function filterStudents(students: BroadsheetStudent[], f: BroadsheetFilters, passMark: number): BroadsheetStudent[] {
  const q = f.q.trim().toLowerCase();
  return students.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q) && !(s.registration_number ?? "").toLowerCase().includes(q)) return false;
    if (f.gender !== "all" && s.gender !== f.gender) return false;
    if (f.result === "passed_all" && s.failed > 0) return false;
    if (f.result === "failed_any" && s.failed < 1) return false;
    if (f.result === "failed_2" && s.failed < 2) return false;
    if (f.result === "below_pass" && !(s.average != null && s.average < passMark)) return false;
    if (f.grades.length && !f.grades.includes(s.grade ?? "—")) return false;
    if (f.statuses.length && !f.statuses.includes(s.status)) return false;
    if (f.classes.length && !f.classes.includes(s.class_name ?? "—")) return false;
    if (f.minAvg != null && !(s.average != null && s.average >= f.minAvg)) return false;
    if (f.maxAvg != null && !(s.average != null && s.average <= f.maxAvg)) return false;
    if (f.attendanceBelow != null && !(s.attendance_rate != null && s.attendance_rate < f.attendanceBelow)) return false;
    if (f.failingSubject != null) {
      const v = s.subjects[f.failingSubject];
      if (!(v != null && v < passMark)) return false;
    }
    return true;
  });
}

/** Missing values always sort last, whichever the direction. */
export function sortStudents(students: BroadsheetStudent[], key: SortKey, dir: SortDir): BroadsheetStudent[] {
  const value = (s: BroadsheetStudent): number | string | null => {
    if (key === "name") return s.name.toLowerCase();
    if (key === "position") return s.position;
    if (key === "total") return s.total;
    if (key === "average") return s.average;
    if (key === "passed") return s.passed;
    if (key === "failed") return s.failed;
    if (key === "attendance") return s.attendance_rate;
    const v = s.subjects[Number(key.slice(8))];
    return v == null ? null : v;
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...students].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va == null && vb == null) return a.name.localeCompare(b.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return c !== 0 ? c * sign : a.name.localeCompare(b.name);
  });
}

/** The natural first direction for a column: best first for marks, A→Z / 1st for name and position. */
export const defaultDir = (key: SortKey): SortDir => (key === "name" || key === "position" || key === "failed" ? "asc" : "desc");

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface BroadsheetSummary {
  students: number;
  average: number | null;
  passRate: number | null;
  failingAny: number;
  attendance: number | null;
  top: BroadsheetStudent | null;
}

/** Live numbers for the rows currently shown. */
export function summarise(rows: BroadsheetStudent[], passMark: number): BroadsheetSummary {
  const avgs = rows.map((r) => r.average).filter((x): x is number => x != null);
  const att = rows.map((r) => r.attendance_rate).filter((x): x is number => x != null);
  const top = rows.filter((r) => r.average != null).sort((a, b) => b.average! - a.average!)[0] ?? null;
  return {
    students: rows.length,
    average: mean(avgs),
    passRate: avgs.length ? (avgs.filter((a) => a >= passMark).length / avgs.length) * 100 : null,
    failingAny: rows.filter((r) => r.failed > 0).length,
    attendance: mean(att),
    top,
  };
}

/** Per-subject mean / highest / lowest / pass rate over the rows shown. */
export function subjectStatsFor(rows: BroadsheetStudent[], subjectIds: number[], passMark: number) {
  return subjectIds.map((id) => {
    const xs = rows.map((r) => r.subjects[id]).filter((x): x is number => x != null);
    return {
      subject_id: id,
      mean: mean(xs),
      max: xs.length ? Math.max(...xs) : null,
      min: xs.length ? Math.min(...xs) : null,
      pass_rate: xs.length ? (xs.filter((x) => x >= passMark).length / xs.length) * 100 : null,
    };
  });
}

/** How many filters are narrowing the list (search included). */
export function activeFilterCount(f: BroadsheetFilters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    (f.gender !== "all" ? 1 : 0) +
    (f.result !== "all" ? 1 : 0) +
    (f.grades.length ? 1 : 0) +
    (f.statuses.length ? 1 : 0) +
    (f.classes.length ? 1 : 0) +
    (f.minAvg != null || f.maxAvg != null ? 1 : 0) +
    (f.attendanceBelow != null ? 1 : 0) +
    (f.failingSubject != null ? 1 : 0)
  );
}

// ─── URL ⇄ filters ───────────────────────────────────────────────────────────

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const numOrNull = (v: string | null) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function filtersFromParams(p: URLSearchParams): BroadsheetFilters {
  const g = p.get("g");
  const r = p.get("r");
  return {
    q: p.get("q") ?? "",
    gender: g === "female" || g === "male" || g === "unknown" ? g : "all",
    result: r && r in RESULT_LABEL ? (r as ResultFilter) : "all",
    grades: list(p.get("gr")),
    statuses: list(p.get("st")),
    classes: list(p.get("cl")),
    minAvg: numOrNull(p.get("min")),
    maxAvg: numOrNull(p.get("max")),
    attendanceBelow: numOrNull(p.get("att")),
    failingSubject: numOrNull(p.get("fs")),
  };
}

export function writeFilters(p: URLSearchParams, f: BroadsheetFilters): URLSearchParams {
  const next = new URLSearchParams(p);
  const set = (k: string, v: string | null) => (v ? next.set(k, v) : next.delete(k));
  set("q", f.q.trim() || null);
  set("g", f.gender === "all" ? null : f.gender);
  set("r", f.result === "all" ? null : f.result);
  set("gr", f.grades.join(",") || null);
  set("st", f.statuses.join(",") || null);
  set("cl", f.classes.join(",") || null);
  set("min", f.minAvg == null ? null : String(f.minAvg));
  set("max", f.maxAvg == null ? null : String(f.maxAvg));
  set("att", f.attendanceBelow == null ? null : String(f.attendanceBelow));
  set("fs", f.failingSubject == null ? null : String(f.failingSubject));
  return next;
}
