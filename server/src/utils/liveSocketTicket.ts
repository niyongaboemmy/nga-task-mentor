import jwt from "jsonwebtoken";

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

export const signLiveSocketTicket = (
  user: { id: number; permissions?: Set<string> | null },
  jwtSecret: string | undefined = process.env.JWT_SECRET,
): { ticket: string; proctor: boolean; expiresIn: number } => {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
  }
  const proctor = isLiveProctor(user.permissions);
  const ticket = jwt.sign(
    { typ: LIVE_TICKET_TYPE, id: user.id, proctor },
    liveTicketSecret(jwtSecret),
    { algorithm: "HS256", expiresIn: LIVE_TICKET_TTL_SECONDS },
  );
  return { ticket, proctor, expiresIn: LIVE_TICKET_TTL_SECONDS };
};
