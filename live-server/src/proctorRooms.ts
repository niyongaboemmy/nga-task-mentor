import { tenantRoom } from "./vendor/nga-tenancy";

/**
 * Who receives what on the live proctoring server (TM-9).
 *
 * There used to be one global "proctors" room: every proctor socket of every
 * class (and, with tenancy, every school) received every student's stream
 * notices, camera/screen screenshots and violations. Now:
 *
 *  - every room name carries the tenant: `t<tid>:...` (CONTRACT.md §8);
 *  - a proctor joins `t<tid>:proctors:all` (school-wide staff) or one
 *    `t<tid>:proctors:course:<id>` room per course their ticket lists;
 *  - a student's stream goes to `t<tid>:proctors:all` plus the room of the
 *    session's course, when known (from the student's own live ticket, which
 *    the API fills from the quiz the session belongs to). A session whose
 *    course is unknown reaches school-wide proctors only;
 *  - stream lists (`get-active-streams`, GET /proctoring/streams) only list
 *    streams the proctor may watch, and proctor commands aimed at a session of
 *    another course are dropped.
 */

export type CourseScope = "all" | number[];

export interface LiveIdentity {
  userId: number;
  isProctor: boolean;
  /** Tenant (school) id; 1 for tokens minted before tenancy. */
  tid: number;
  /** Proctor tickets: what they may watch. Absent = nothing course-scoped. */
  courses?: CourseScope;
  /** The caller's own live sessions: sessionToken -> course id (null = unknown). */
  sessions?: Record<string, number | null>;
}

export interface StreamLike {
  tid: number;
  courseId: number | null;
}

export const proctorsAllRoom = (tid: number) => tenantRoom("proctors:all", tid);
export const proctorsCourseRoom = (tid: number, courseId: number) => tenantRoom(`proctors:course:${courseId}`, tid);
export const sessionRoom = (tid: number, sessionToken: string) => tenantRoom(`proctoring-${sessionToken}`, tid);
export const streamKey = (tid: number, sessionToken: string) => tenantRoom(sessionToken, tid);
export const generalRoom = (tid: number, roomId: string) => tenantRoom(`room:${roomId}`, tid);

/** The proctor rooms a socket joins on connect. */
export function proctorRoomsFor(identity: LiveIdentity | undefined): string[] {
  if (!identity?.isProctor) return [];
  if (identity.courses === "all") return [proctorsAllRoom(identity.tid)];
  return (identity.courses ?? []).map((c) => proctorsCourseRoom(identity.tid, c));
}

/** The proctor rooms a stream event of a session in `courseId` goes to. */
export function streamTargets(tid: number, courseId: number | null | undefined): string[] {
  const rooms = [proctorsAllRoom(tid)];
  if (typeof courseId === "number") rooms.push(proctorsCourseRoom(tid, courseId));
  return rooms;
}

/** May this proctor see/command a stream? Same tenant, and the course is theirs. */
export function canWatch(identity: LiveIdentity | undefined, stream: StreamLike | undefined | null): boolean {
  if (!identity?.isProctor || !stream) return false;
  if (stream.tid !== identity.tid) return false;
  if (identity.courses === "all") return true;
  return stream.courseId !== null && (identity.courses ?? []).includes(stream.courseId);
}

/**
 * May a proctor join/command the session room? Known course: canWatch. A
 * session the server knows nothing about yet (the dashboard opened before the
 * student connected) is reachable only by its unguessable token, within the
 * proctor's own tenant (the room name carries it).
 */
export function canControlSession(identity: LiveIdentity | undefined, stream: StreamLike | undefined | null): boolean {
  if (!identity?.isProctor) return false;
  if (!stream) return true;
  return canWatch(identity, stream);
}

/** The course of a session, from the student's ticket or an existing stream. */
export function courseOfSession(
  identity: LiveIdentity | undefined,
  sessionToken: string,
  existing?: StreamLike | null,
): number | null {
  const fromTicket = identity?.sessions?.[sessionToken];
  if (typeof fromTicket === "number") return fromTicket;
  return existing?.courseId ?? null;
}

/** Normalise the ticket's `courses` claim. */
export function parseCourses(raw: unknown): CourseScope | undefined {
  if (raw === "all") return "all";
  if (!Array.isArray(raw)) return undefined;
  return raw.map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

/** Normalise the ticket's `sessions` claim. */
export function parseSessions(raw: unknown): Record<string, number | null> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    out[k] = v !== null && Number.isInteger(n) && n > 0 ? n : null;
  }
  return out;
}
