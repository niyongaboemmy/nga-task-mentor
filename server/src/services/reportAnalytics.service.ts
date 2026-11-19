/**
 * School report analytics (docs/REPORTS_AND_REPORT_CARD_REVIEW.md §5): the
 * broadsheet, performance, gender, trends and at-risk views, all computed
 * from report-card rows so the figures match the cards. Pure: the
 * controller loads rows (snapshots for approved/published cards, live grades
 * for drafts when asked) and this does the maths.
 */

import type { GradeBand } from "./tenantSettings";

export type Gender = "female" | "male" | "unknown";

export interface AnalyticsRow {
  card_id: number;
  student_id: number;
  name: string;
  registration_number: string | null;
  gender: Gender;
  class_group_id: number | null;
  class_name: string | null;
  program_name: string | null;
  term: string;
  status: string;
  /** subject id -> total out of 100 (subjects with marks only). */
  subjects: Record<number, number>;
  /** Mean of the subject totals; null with no marks. */
  average: number | null;
  attendance: { present: number; absent: number; late: number; excused: number; sick: number };
}

export interface AnalyticsOptions {
  pass_mark: number;
  bands: GradeBand[];
  subject_names: Record<number, string>;
  /** The term the main views are about; trends span every term in `rows`. */
  term: string;
  /** Term order for trends (oldest first). */
  term_order: string[];
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (n: number | null) => (n == null ? null : round(n));

export function normalizeGender(raw: string | null | undefined): Gender {
  const g = String(raw ?? "").trim().toLowerCase();
  if (["f", "female", "girl", "woman", "gore"].includes(g)) return "female";
  if (["m", "male", "boy", "man", "gabo"].includes(g)) return "male";
  return "unknown";
}

export function letterOf(score: number, bands: GradeBand[]): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  for (const b of sorted) if (score >= b.min) return b.letter;
  return sorted[sorted.length - 1]?.letter ?? "";
}

/** Count per band letter, in band order (highest first). */
export function distribution(scores: number[], bands: GradeBand[]): Array<{ letter: string; min: number; count: number }> {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const counts = new Map(sorted.map((b) => [b.letter, 0]));
  for (const s of scores) {
    const l = letterOf(s, sorted);
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return sorted.map((b) => ({ letter: b.letter, min: b.min, count: counts.get(b.letter) ?? 0 }));
}

export interface Stat {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  pass_rate: number | null;
}

export function statOf(xs: number[], passMark: number): Stat {
  return {
    n: xs.length,
    mean: r2(mean(xs)),
    median: r2(median(xs)),
    sd: r2(sd(xs)),
    min: xs.length ? round(Math.min(...xs)) : null,
    max: xs.length ? round(Math.max(...xs)) : null,
    pass_rate: xs.length ? round((xs.filter((x) => x >= passMark).length / xs.length) * 100, 1) : null,
  };
}

const attendanceRate = (a: AnalyticsRow["attendance"]) => {
  const total = a.present + a.absent + a.late + a.excused + a.sick;
  return total > 0 ? round(((a.present + a.late + a.excused) / total) * 100, 1) : null;
};

/** Competition ranks (1,2,2,4) by average within each class group. */
export function classPositions(rows: AnalyticsRow[]): Map<number, { position: number; of: number }> {
  const out = new Map<number, { position: number; of: number }>();
  const byClass = new Map<string, AnalyticsRow[]>();
  for (const r of rows) {
    if (r.average == null) continue;
    const k = String(r.class_group_id ?? "none");
    byClass.set(k, [...(byClass.get(k) ?? []), r]);
  }
  for (const members of byClass.values()) {
    const s = [...members].sort((a, b) => (b.average as number) - (a.average as number));
    s.forEach((r, i) => {
      const prev = s[i - 1];
      const pos = prev && prev.average === r.average ? out.get(prev.card_id)!.position : i + 1;
      out.set(r.card_id, { position: pos, of: s.length });
    });
  }
  return out;
}

export function computeSchoolAnalytics(allRows: AnalyticsRow[], o: AnalyticsOptions) {
  const rows = allRows.filter((r) => r.term === o.term);
  const subjectIds = [...new Set(rows.flatMap((r) => Object.keys(r.subjects).map(Number)))].sort((a, b) =>
    (o.subject_names[a] ?? "").localeCompare(o.subject_names[b] ?? ""),
  );
  const nameOf = (id: number) => o.subject_names[id] ?? `Subject #${id}`;
  const averages = rows.map((r) => r.average).filter((x): x is number => x != null);
  const positions = classPositions(rows);

  // ── Performance ─────────────────────────────────────────────────────────
  const subjects = subjectIds.map((sid) => {
    const xs = rows.map((r) => r.subjects[sid]).filter((x): x is number => x != null);
    return { subject_id: sid, name: nameOf(sid), ...statOf(xs, o.pass_mark), distribution: distribution(xs, o.bands) };
  });
  const classes = [...new Map(rows.map((r) => [r.class_group_id, r.class_name])).entries()]
    .map(([cg, name]) => {
      const members = rows.filter((r) => r.class_group_id === cg);
      const xs = members.map((r) => r.average).filter((x): x is number => x != null);
      return {
        class_group_id: cg,
        name: name ?? "No class",
        program_name: members[0]?.program_name ?? null,
        students: members.length,
        ...statOf(xs, o.pass_mark),
        at_risk: members.filter((m) => m.average != null && m.average < o.pass_mark).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const performance = {
    overall: { ...statOf(averages, o.pass_mark), distribution: distribution(averages, o.bands) },
    subjects,
    classes,
    hardest_subjects: [...subjects].filter((s) => s.n > 0).sort((a, b) => (a.mean ?? 0) - (b.mean ?? 0)).slice(0, 5),
  };

  // ── Gender ──────────────────────────────────────────────────────────────
  const genders: Gender[] = ["female", "male", "unknown"];
  const gStat = (members: AnalyticsRow[]) => {
    const xs = members.map((r) => r.average).filter((x): x is number => x != null);
    return { students: members.length, ...statOf(xs, o.pass_mark), distribution: distribution(xs, o.bands) };
  };
  const gap = (f: number | null, m: number | null) => (f != null && m != null ? round(f - m) : null);
  const byGender = Object.fromEntries(genders.map((g) => [g, gStat(rows.filter((r) => r.gender === g))]));
  const gender = {
    overall: byGender,
    /** female mean - male mean (positive = girls ahead). */
    gap: gap(byGender.female.mean, byGender.male.mean),
    pass_rate_gap: gap(byGender.female.pass_rate, byGender.male.pass_rate),
    subjects: subjectIds.map((sid) => {
      const per = Object.fromEntries(
        genders.map((g) => {
          const xs = rows.filter((r) => r.gender === g).map((r) => r.subjects[sid]).filter((x): x is number => x != null);
          return [g, statOf(xs, o.pass_mark)];
        }),
      ) as Record<Gender, Stat>;
      return { subject_id: sid, name: nameOf(sid), ...per, gap: gap(per.female.mean, per.male.mean) };
    }),
    classes: classes.map((c) => {
      const members = rows.filter((r) => r.class_group_id === c.class_group_id);
      const per = Object.fromEntries(genders.map((g) => [g, gStat(members.filter((m) => m.gender === g))]));
      return { class_group_id: c.class_group_id, name: c.name, ...per, gap: gap(per.female.mean, per.male.mean) };
    }),
    unknown_count: rows.filter((r) => r.gender === "unknown").length,
  };

  // ── Trends ──────────────────────────────────────────────────────────────
  const terms = o.term_order.filter((t) => allRows.some((r) => r.term === t));
  const trendSubjects = [...new Set(allRows.flatMap((r) => Object.keys(r.subjects).map(Number)))];
  const trends = {
    terms,
    overall: terms.map((t) => {
      const xs = allRows.filter((r) => r.term === t && r.average != null).map((r) => r.average as number);
      return { term: t, ...statOf(xs, o.pass_mark) };
    }),
    subjects: trendSubjects
      .map((sid) => ({
        subject_id: sid,
        name: nameOf(sid),
        terms: terms.map((t) => {
          const xs = allRows.filter((r) => r.term === t).map((r) => r.subjects[sid]).filter((x): x is number => x != null);
          return { term: t, mean: r2(mean(xs)), n: xs.length };
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    classes: [...new Set(allRows.map((r) => r.class_group_id))].map((cg) => ({
      class_group_id: cg,
      name: allRows.find((r) => r.class_group_id === cg)?.class_name ?? "No class",
      terms: terms.map((t) => {
        const xs = allRows.filter((r) => r.term === t && r.class_group_id === cg && r.average != null).map((r) => r.average as number);
        return { term: t, mean: r2(mean(xs)), n: xs.length };
      }),
    })),
    improvement: [] as Array<{ student_id: number; name: string; class_name: string | null; previous: number; current: number; change: number }>,
    previous_term: null as string | null,
  };
  const idx = terms.indexOf(o.term);
  if (idx > 0) {
    const prevTerm = terms[idx - 1];
    trends.previous_term = prevTerm;
    const prevBy = new Map(allRows.filter((r) => r.term === prevTerm && r.average != null).map((r) => [r.student_id, r.average as number]));
    trends.improvement = rows
      .filter((r) => r.average != null && prevBy.has(r.student_id))
      .map((r) => ({
        student_id: r.student_id,
        name: r.name,
        class_name: r.class_name,
        previous: prevBy.get(r.student_id)!,
        current: r.average as number,
        change: round((r.average as number) - prevBy.get(r.student_id)!),
      }))
      .sort((a, b) => b.change - a.change);
  }

  // ── At risk ─────────────────────────────────────────────────────────────
  const atRisk = rows
    .map((r) => {
      const failed = Object.entries(r.subjects).filter(([, v]) => v < o.pass_mark).map(([sid]) => nameOf(Number(sid)));
      const att = attendanceRate(r.attendance);
      const reasons: string[] = [];
      if (r.average != null && r.average < o.pass_mark) reasons.push(`Average ${round(r.average, 1)}% is below the pass mark (${o.pass_mark}%)`);
      if (failed.length >= 2) reasons.push(`Failed ${failed.length} subjects`);
      if (att != null && att < 85) reasons.push(`Attendance ${att}%`);
      const prev = trends.improvement.find((i) => i.student_id === r.student_id);
      if (prev && prev.change <= -10) reasons.push(`Dropped ${Math.abs(prev.change)} points since ${trends.previous_term}`);
      return {
        student_id: r.student_id,
        name: r.name,
        gender: r.gender,
        class_name: r.class_name,
        average: r.average,
        failed_subjects: failed,
        attendance_rate: att,
        reasons,
        severity: reasons.length >= 2 || (r.average != null && r.average < o.pass_mark - 10) ? "high" : "medium",
      };
    })
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => (a.severity === b.severity ? (a.average ?? 0) - (b.average ?? 0) : a.severity === "high" ? -1 : 1));

  // ── Broadsheet ──────────────────────────────────────────────────────────
  const broadsheet = {
    subjects: subjectIds.map((sid) => ({ subject_id: sid, name: nameOf(sid) })),
    students: [...rows]
      .sort((a, b) => (positions.get(a.card_id)?.position ?? 1e9) - (positions.get(b.card_id)?.position ?? 1e9) || a.name.localeCompare(b.name))
      .map((r) => ({
        student_id: r.student_id,
        name: r.name,
        registration_number: r.registration_number,
        gender: r.gender,
        class_name: r.class_name,
        status: r.status,
        subjects: r.subjects,
        total: round(Object.values(r.subjects).reduce((a, b) => a + b, 0)),
        average: r.average,
        grade: r.average != null ? letterOf(r.average, o.bands) : null,
        position: positions.get(r.card_id)?.position ?? null,
        position_of: positions.get(r.card_id)?.of ?? null,
        passed: Object.values(r.subjects).filter((v) => v >= o.pass_mark).length,
        failed: Object.values(r.subjects).filter((v) => v < o.pass_mark).length,
        attendance_rate: attendanceRate(r.attendance),
      })),
    subject_stats: subjects.map((s) => ({ subject_id: s.subject_id, mean: s.mean, max: s.max, min: s.min, pass_rate: s.pass_rate })),
  };

  return {
    students: rows.length,
    with_marks: averages.length,
    performance,
    gender,
    trends,
    at_risk: atRisk,
    broadsheet,
  };
}

export type SchoolAnalytics = ReturnType<typeof computeSchoolAnalytics>;
