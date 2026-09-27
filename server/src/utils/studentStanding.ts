import { bestBySubmissionScore } from "./gradeMatching";

// ─── Student standing (class ranking) ─────────────────────────────────────────
// GET /users/:userId/standing ranks one student against their classmates in
// every subject they share. The controller gathers the raw rows; everything
// here is pure so the scoring rules can be unit-tested without a database.
//
// The rules match the student profile and the grade screens:
//  - only marked work counts — an unsubmitted assignment, an unattempted quiz
//    or a mark the teacher hasn't entered is "pending", never a zero;
//  - a draft submission is not a submission;
//  - a quiz counts its best completed attempt;
//  - a recorded mark flagged "not in final grade" is left out of the score.
//
// Classmates are anonymised: each gets an opaque key and the member list is
// shuffled, so a caller who knows the (alphabetical) roster still can't line
// keys up with names. Only the target student's key is disclosed.

export type StandingKind = "assignment" | "quiz" | "recorded";

/** [sum of item percentages, number of marked items] */
export type ScoreTally = [number, number];

export type SubjectScores = Partial<Record<StandingKind, ScoreTally>>;

export interface StandingMember {
  key: string;
  /** course id → per-kind tallies; a subject the member has no marks in is absent. */
  scores: Record<string, SubjectScores>;
}

export interface StandingSubject {
  course_id: string;
  subject_name: string;
  subject_code: string;
  roster_size: number;
  /** False when MIS returned no roster — the subject then ranks the student alone. */
  roster_available: boolean;
}

export interface StandingPayload {
  me: string;
  subjects: StandingSubject[];
  members: StandingMember[];
}

export interface Identity {
  mis_user_id: number | null;
  user_id: number | null;
}

export interface StandingInput {
  target: Identity;
  subjects: Array<{
    course_id: number | string;
    subject_name: string;
    subject_code: string;
    /** MIS ids of every enrolled student. */
    roster: number[];
  }>;
  /** MIS id → local users.id, for students who have a local account. */
  localIdByMisId: Map<number, number>;
  assignments: Array<{ id: number; course_id: number | string; max_score: number | string | null }>;
  submissions: Array<{
    assignment_id: number;
    grade: string | null;
    status: string;
    student_id: number;
    student?: { id?: number | null; mis_user_id?: number | null } | null;
  }>;
  quizzes: Array<{ id: number; course_id: number | string }>;
  quizSubmissions: Array<{
    quiz_id: number;
    percentage: number | string;
    total_score: number | string;
    student_id: number;
    student?: { id?: number | null; mis_user_id?: number | null } | null;
  }>;
  /** Recorded marks, already resolved per student (see buildManualAssessmentRow). */
  recorded: Array<{
    course_id: number | string;
    counts_to_final: boolean;
    max_score: number;
    /** This student's percentage, or null when the teacher hasn't entered it. */
    percentageFor: (ids: Identity) => number | null;
  }>;
  /** Injected for tests; defaults to Math.random. */
  random?: () => number;
}

/**
 * Assignment grades are stored as "score/max" (see submission.controller), but
 * older rows hold a bare score against the assignment's max_score.
 */
export const gradePercentage = (
  grade: string | null | undefined,
  fallbackMax: number | string | null | undefined,
): number | null => {
  if (grade === null || grade === undefined || String(grade).trim() === "") return null;
  const [rawScore, rawMax] = String(grade).split("/");
  const score = parseFloat(rawScore);
  const max = rawMax !== undefined ? parseFloat(rawMax) : Number(fallbackMax);
  if (isNaN(score) || !max || isNaN(max) || max <= 0) return null;
  return Math.round((score / max) * 10000) / 100;
};

const add = (scores: Record<string, SubjectScores>, courseId: string, kind: StandingKind, pct: number) => {
  const subject = (scores[courseId] ??= {});
  const tally = (subject[kind] ??= [0, 0]);
  tally[0] = Math.round((tally[0] + pct) * 100) / 100;
  tally[1] += 1;
};

const shuffle = <T,>(items: T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const buildStandingPayload = (input: StandingInput): StandingPayload => {
  const random = input.random ?? Math.random;

  // One identity per student, keyed on the MIS id (every roster row has one).
  // The target may have no MIS roster row at all (roster fetch failed), so
  // they are added explicitly.
  interface Member extends Identity {
    scores: Record<string, SubjectScores>;
    isTarget: boolean;
  }
  const byMis = new Map<number, Member>();
  const byLocal = new Map<number, Member>();
  const register = (identity: Identity, isTarget = false): Member => {
    const existing =
      (identity.mis_user_id !== null ? byMis.get(identity.mis_user_id) : undefined) ??
      (identity.user_id !== null ? byLocal.get(identity.user_id) : undefined);
    if (existing) {
      existing.isTarget ||= isTarget;
      return existing;
    }
    const member: Member = { ...identity, scores: {}, isTarget };
    if (member.mis_user_id !== null) byMis.set(member.mis_user_id, member);
    if (member.user_id !== null) byLocal.set(member.user_id, member);
    return member;
  };

  const target = register(input.target, true);

  // course id → members enrolled in it
  const rosterByCourse = new Map<string, Set<Member>>();
  const subjects: StandingSubject[] = input.subjects.map((s) => {
    const courseId = String(s.course_id);
    const members = new Set<Member>();
    for (const misId of s.roster) {
      members.add(
        register({ mis_user_id: misId, user_id: input.localIdByMisId.get(misId) ?? null }),
      );
    }
    const rosterAvailable = members.size > 0;
    members.add(target);
    rosterByCourse.set(courseId, members);
    return {
      course_id: courseId,
      subject_name: s.subject_name,
      subject_code: s.subject_code,
      roster_size: members.size,
      roster_available: rosterAvailable,
    };
  });

  // Only students on the subject's roster are ranked in it; a local-only
  // submitter from another class is not a classmate.
  const memberOf = (
    sub: { student_id: number; student?: { mis_user_id?: number | null } | null },
    courseId: string,
  ): Member | undefined => {
    const misId = sub.student?.mis_user_id;
    const member =
      (misId !== null && misId !== undefined ? byMis.get(Number(misId)) : undefined) ??
      byLocal.get(Number(sub.student_id));
    return member && rosterByCourse.get(courseId)?.has(member) ? member : undefined;
  };

  // Assignments — one mark per student per assignment: a graded submission if
  // there is one (a resubmission may carry the grade), never a draft.
  const assignmentById = new Map(input.assignments.map((a) => [a.id, a]));
  // Opaque per-member ids, only for composing map keys below.
  const memberIds = new Map<Member, number>();
  const idOf = (m: Member) => {
    if (!memberIds.has(m)) memberIds.set(m, memberIds.size);
    return memberIds.get(m)!;
  };
  const assignmentMarks = new Map<string, { member: Member; courseId: string; pct: number }>();
  for (const sub of input.submissions) {
    if (sub.status === "draft") continue;
    const assignment = assignmentById.get(sub.assignment_id);
    if (!assignment) continue;
    const courseId = String(assignment.course_id);
    const member = memberOf(sub, courseId);
    if (!member) continue;
    const pct = gradePercentage(sub.grade, assignment.max_score);
    if (pct === null) continue;
    const key = `${assignment.id}:${idOf(member)}`;
    const prev = assignmentMarks.get(key);
    if (!prev || pct > prev.pct) assignmentMarks.set(key, { member, courseId, pct });
  }
  for (const { member, courseId, pct } of assignmentMarks.values()) {
    add(member.scores, courseId, "assignment", pct);
  }

  // Quizzes — best completed attempt (callers pass completed attempts only).
  const quizById = new Map(input.quizzes.map((q) => [q.id, q]));
  const attempts = new Map<string, { member: Member; courseId: string; subs: typeof input.quizSubmissions }>();
  for (const sub of input.quizSubmissions) {
    const quiz = quizById.get(sub.quiz_id);
    if (!quiz) continue;
    const courseId = String(quiz.course_id);
    const member = memberOf(sub, courseId);
    if (!member) continue;
    const key = `${quiz.id}:${idOf(member)}`;
    const entry = attempts.get(key) ?? { member, courseId, subs: [] };
    entry.subs.push(sub);
    attempts.set(key, entry);
  }
  for (const { member, courseId, subs } of attempts.values()) {
    const best = bestBySubmissionScore(subs);
    const pct = best ? Number(best.percentage) : NaN;
    if (!isNaN(pct)) add(member.scores, courseId, "quiz", Math.round(pct * 100) / 100);
  }

  // Recorded marks.
  for (const assessment of input.recorded) {
    if (!assessment.counts_to_final || assessment.max_score <= 0) continue;
    const courseId = String(assessment.course_id);
    for (const member of rosterByCourse.get(courseId) ?? []) {
      const pct = assessment.percentageFor(member);
      if (pct !== null) add(member.scores, courseId, "recorded", pct);
    }
  }

  // Everyone enrolled in at least one of the target's subjects.
  const everyone = new Set<Member>();
  for (const set of rosterByCourse.values()) set.forEach((m) => everyone.add(m));
  everyone.add(target);

  const shuffled = shuffle([...everyone], random);
  const members: StandingMember[] = shuffled.map((m, i) => ({
    key: m.isTarget ? "me" : `s${i + 1}`,
    scores: m.scores,
  }));

  return { me: "me", subjects, members };
};
