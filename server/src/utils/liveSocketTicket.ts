import jwt from "jsonwebtoken";
import { currentTenantOrNull, PRIMARY_TENANT_ID } from "../vendor/nga-tenancy";

/**
 * Short-lived "live ticket" handed to the browser so it can authenticate its
 * Socket.IO connection to the proctoring live-server (live-server/).
 *
 * The live-server has no database access, so it cannot resolve a user's
 * permissions itself. Instead this API (which can) signs a ticket carrying the
 * verified user id plus a single `proctor` bit, and the live-server trusts that
 * bit instead of the `role` a client claims in `join-proctoring-session`.
 *
 * The ticket is signed with a key DERIVED from JWT_SECRET (not JWT_SECRET
 * itself) so a ticket can never be replayed as a normal session token against
 * this API's `protect` middleware. The derivation and `typ` value below MUST
 * stay in sync with live-server/src/socketAuth.ts.
 */
export const LIVE_TICKET_TYPE = "live-socket-ticket";
export const LIVE_TICKET_TTL_SECONDS = 120;

// A user may watch/control live proctoring streams if they hold either of
// these — the same permissions that gate the /proctoring/live and
// /quizzes/:quizId/proctoring/monitoring pages.
export const LIVE_PROCTOR_PERMISSIONS = [
  "PROCTORING_JOIN_LIVE_STREAM",
  "PROCTORING_VIEW_SESSIONS",
];

export const liveTicketSecret = (jwtSecret: string): string =>
  `${jwtSecret}:${LIVE_TICKET_TYPE}`;

export const isLiveProctor = (permissions?: Set<string> | null): boolean =>
  LIVE_PROCTOR_PERMISSIONS.some((p) => permissions?.has(p) ?? false);

/**
 * What a proctor may watch (TM-9): every course of the school ("all", for
 * school-wide staff) or only the listed MIS subject ids. Students carry the
 * course of each proctoring session they stream, so the live-server can send
 * a stream only to the proctors of that course.
 */
export type ProctorScope = "all" | number[];

export interface LiveTicketExtras {
  /** Tenant (school) id; every live-server room is prefixed with it. */
  tid?: number;
  /** Proctor tickets only. */
  courses?: ProctorScope;
  /** sessionToken -> course id (null = unknown) for the caller's own live sessions. */
  sessions?: Record<string, number | null>;
}

export const MAX_TICKET_COURSES = 300;
export const MAX_TICKET_SESSIONS = 20;

export const signLiveSocketTicket = (
  user: { id: number; permissions?: Set<string> | null },
  jwtSecret: string | undefined = process.env.JWT_SECRET,
  extras: LiveTicketExtras = {},
): { ticket: string; proctor: boolean; expiresIn: number } => {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
  }
  const proctor = isLiveProctor(user.permissions);
  const payload: Record<string, unknown> = {
    typ: LIVE_TICKET_TYPE,
    id: user.id,
    proctor,
    tid: extras.tid ?? currentTenantOrNull()?.tid ?? PRIMARY_TENANT_ID,
  };
  if (proctor) {
    const courses = extras.courses ?? [];
    payload.courses = courses === "all" ? "all" : courses.slice(0, MAX_TICKET_COURSES);
  }
  if (extras.sessions) {
    payload.sessions = Object.fromEntries(Object.entries(extras.sessions).slice(0, MAX_TICKET_SESSIONS));
  }
  const ticket = jwt.sign(payload, liveTicketSecret(jwtSecret), {
    algorithm: "HS256",
    expiresIn: LIVE_TICKET_TTL_SECONDS,
  });
  return { ticket, proctor, expiresIn: LIVE_TICKET_TTL_SECONDS };
};
