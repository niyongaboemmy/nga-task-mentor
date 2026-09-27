import axios from "../utils/axiosConfig";

// ─── Class standing ───────────────────────────────────────────────────────────
// GET /users/:misId/standing returns every classmate's mark tallies per
// subject and per kind of work, anonymised (see server utils/studentStanding).
// Ranking happens here so the subject / kind filters on the profile are
// instant and need no further requests.
//
// A student's score:
//  - within one subject: the mean of their marked items of the chosen kind(s);
//  - across subjects: the mean of those subject scores, so each subject weighs
//    the same (this matches the profile's overall average).
// Only students with at least one mark are ranked; ties share a rank
// (1, 2, 2, 4).

export type StandingKind = "assignment" | "quiz" | "recorded";
export type StandingKindFilter = "all" | StandingKind;

export type ScoreTally = [number, number];
export type SubjectScores = Partial<Record<StandingKind, ScoreTally>>;

export interface StandingMember {
  key: string;
  scores: Record<string, SubjectScores>;
}

export interface StandingSubject {
  course_id: string;
  subject_name: string;
  subject_code: string;
  roster_size: number;
  roster_available: boolean;
}

export interface StandingPayload {
  me: string;
  subjects: StandingSubject[];
  members: StandingMember[];
}

export const fetchStudentStanding = async (misUserId: string | number): Promise<StandingPayload> => {
  const res = await axios.get(`/users/${misUserId}/standing`);
  if (!res.data?.success) throw new Error("Failed to load class standing");
  return res.data.data as StandingPayload;
};

const KINDS: StandingKind[] = ["assignment", "quiz", "recorded"];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** One subject, one kind filter → mean of marked items, or null. */
export const subjectScore = (
  scores: SubjectScores | undefined,
  kind: StandingKindFilter,
): number | null => {
  if (!scores) return null;
  let sum = 0;
  let count = 0;
  for (const k of kind === "all" ? KINDS : [kind]) {
    const tally = scores[k];
    if (tally) {
      sum += tally[0];
      count += tally[1];
    }
  }
  return count > 0 ? round1(sum / count) : null;
};

export const memberScore = (
  member: StandingMember,
  courseIds: string[],
  kind: StandingKindFilter,
): number | null => {
  const perSubject = courseIds
    .map((id) => subjectScore(member.scores[id], kind))
    .filter((s): s is number => s !== null);
  if (perSubject.length === 0) return null;
  return round1(perSubject.reduce((a, s) => a + s, 0) / perSubject.length);
};

export interface StandingResult {
  /** The student's score under this filter, null when they have no marks. */
  score: number | null;
  /** 1-based, null when the student isn't ranked (no marks). */
  rank: number | null;
  /** Classmates with at least one mark under this filter. */
  rankedCount: number;
  /** Everyone enrolled, marked or not. */
  cohortSize: number;
  classAverage: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
  /** "Top N%" — rank as a share of the ranked cohort, at least 1. */
  topPercent: number | null;
  /** Every ranked score, highest first — for the distribution strip. */
  scores: number[];
  /** False when a subject's MIS roster was unavailable. */
  rosterAvailable: boolean;
}

export const computeStanding = (
  payload: StandingPayload,
  courseId: string | null,
  kind: StandingKindFilter,
): StandingResult => {
  const subject = courseId ? payload.subjects.find((s) => s.course_id === courseId) : null;
  const courseIds = courseId ? [courseId] : payload.subjects.map((s) => s.course_id);

  const eligible = courseId
    ? payload.members.filter((m) => m.key === payload.me || m.scores[courseId] !== undefined)
    : payload.members;

  const scored = eligible
    .map((m) => ({ key: m.key, score: memberScore(m, courseIds, kind) }))
    .filter((m): m is { key: string; score: number } => m.score !== null);

  const scores = scored.map((m) => m.score).sort((a, b) => b - a);
  const mine = scored.find((m) => m.key === payload.me)?.score ?? null;
  const rank = mine === null ? null : scores.filter((s) => s > mine).length + 1;
  const n = scores.length;
  const mid = Math.floor(n / 2);

  return {
    score: mine,
    rank,
    rankedCount: n,
    cohortSize: subject ? subject.roster_size : payload.members.length,
    classAverage: n ? round1(scores.reduce((a, s) => a + s, 0) / n) : null,
    median: n ? (n % 2 ? scores[mid] : round1((scores[mid - 1] + scores[mid]) / 2)) : null,
    highest: n ? scores[0] : null,
    lowest: n ? scores[n - 1] : null,
    topPercent: rank === null || n === 0 ? null : Math.max(1, Math.round((rank / n) * 100)),
    scores,
    rosterAvailable: subject
      ? subject.roster_available
      : payload.subjects.some((s) => s.roster_available),
  };
};

/** Per-subject standing for the subject list, under one kind filter. */
export const subjectStandings = (
  payload: StandingPayload,
  kind: StandingKindFilter,
): Record<string, StandingResult> =>
  Object.fromEntries(
    payload.subjects.map((s) => [s.course_id, computeStanding(payload, s.course_id, kind)]),
  );
