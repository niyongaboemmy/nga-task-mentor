import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";

/**
 * Authentication/authorization for the live proctoring socket server.
 *
 * The browser authenticates its Socket.IO handshake with either:
 *   1. a short-lived "live ticket" from `GET /api/proctoring/live-ticket` on the
 *      main API (preferred) — carries the verified user id AND whether the user
 *      may act as a proctor, resolved from their permissions server-side; or
 *   2. the normal TaskMentor session JWT (`tm_auth_token`) — proves identity
 *      only, so the socket is treated as a non-proctor (student-level).
 *
 * Identity and proctor status always come from the verified token, never from
 * the event payloads the client sends.
 *
 * The ticket constants below MUST stay in sync with
 * server/src/utils/liveSocketTicket.ts.
 */
export const LIVE_TICKET_TYPE = "live-socket-ticket";
export const liveTicketSecret = (jwtSecret: string): string =>
  `${jwtSecret}:${LIVE_TICKET_TYPE}`;

/** Socket.IO room every authenticated proctor socket joins on connect. */
export const PROCTORS_ROOM = "proctors";

export interface SocketIdentity {
  userId: number;
  isProctor: boolean;
  via: "ticket" | "session";
}

export class SocketAuthError extends Error {
  data: { code: string };
  constructor(message: string, code = "UNAUTHORIZED") {
    super(message);
    this.name = "SocketAuthError";
    this.data = { code };
  }
}

const PLACEHOLDER_TOKENS = new Set(["", "none", "null", "undefined"]);

interface HandshakeLike {
  auth?: Record<string, unknown> | null;
  headers?: Record<string, string | string[] | undefined>;
}

const readCookie = (cookieHeader: string, name: string): string | undefined => {
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      const raw = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
};

/**
 * Pull the bearer credential from a handshake: `auth.token` first, then an
 * `Authorization: Bearer` header, then the `tm_auth_token` cookie.
 */
export const extractHandshakeToken = (
  handshake: HandshakeLike,
): string | undefined => {
  const fromAuth = handshake.auth?.token;
  if (typeof fromAuth === "string" && !PLACEHOLDER_TOKENS.has(fromAuth)) {
    return fromAuth;
  }

  const authHeader = handshake.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const t = authHeader.slice("Bearer ".length).trim();
    if (!PLACEHOLDER_TOKENS.has(t)) return t;
  }

  const cookieHeader = handshake.headers?.cookie;
  if (typeof cookieHeader === "string") {
    const t = readCookie(cookieHeader, "tm_auth_token");
    if (t && !PLACEHOLDER_TOKENS.has(t)) return t;
  }

  return undefined;
};

const toUserId = (value: unknown): number | undefined => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * Verify a token and resolve the socket identity. Throws SocketAuthError when
 * the token is missing, invalid, expired, or carries no user id.
 */
export const verifySocketToken = (
  token: string | undefined,
  jwtSecret: string | undefined,
): SocketIdentity => {
  if (!jwtSecret) {
    throw new SocketAuthError(
      "Live server is not configured for authentication",
      "SERVER_MISCONFIGURED",
    );
  }
  if (!token) {
    throw new SocketAuthError("Authentication required");
  }

  // 1. Live ticket (signed with the derived key).
  try {
    const payload = jwt.verify(token, liveTicketSecret(jwtSecret), {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    const userId = toUserId(payload.id);
    if (payload.typ !== LIVE_TICKET_TYPE || !userId) {
      throw new SocketAuthError("Invalid live ticket");
    }
    return { userId, isProctor: payload.proctor === true, via: "ticket" };
  } catch (err) {
    if (err instanceof SocketAuthError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new SocketAuthError("Live ticket expired", "TOKEN_EXPIRED");
    }
    // Not a ticket — fall through and try it as a session JWT.
  }

  // 2. Session JWT (same secret the main API signs with in User.model.ts).
  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    const userId = toUserId(payload.id);
    if (!userId) throw new SocketAuthError("Invalid token");
    // A session JWT proves identity only; proctor rights require a ticket.
    return { userId, isProctor: false, via: "session" };
  } catch (err) {
    if (err instanceof SocketAuthError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new SocketAuthError("Token expired", "TOKEN_EXPIRED");
    }
    throw new SocketAuthError("Invalid token");
  }
};

export const authenticateHandshake = (
  handshake: HandshakeLike,
  jwtSecret: string | undefined,
): SocketIdentity => verifySocketToken(extractHandshakeToken(handshake), jwtSecret);

/**
 * Socket.IO middleware: rejects the connection (client gets `connect_error`
 * with the message) unless the handshake carries a valid token; on success
 * stores the verified identity in `socket.data.identity`.
 */
export const createSocketAuthMiddleware =
  (getSecret: () => string | undefined, log: Pick<Console, "warn"> = console) =>
  (socket: Socket, next: (err?: Error) => void): void => {
    try {
      const identity = authenticateHandshake(socket.handshake, getSecret());
      socket.data.identity = identity;
      next();
    } catch (err) {
      const e =
        err instanceof SocketAuthError
          ? err
          : new SocketAuthError("Authentication failed");
      log.warn(
        `[live-server] Rejected socket connection from ${socket.handshake.address} (origin ${
          socket.handshake.headers.origin ?? "n/a"
        }): ${e.message}`,
      );
      next(e);
    }
  };

export const getIdentity = (socket: Socket): SocketIdentity | undefined =>
  socket.data?.identity as SocketIdentity | undefined;

export const isProctorSocket = (socket: Socket): boolean =>
  getIdentity(socket)?.isProctor === true;

/**
 * Decide the effective role for `join-proctoring-session`. A client may always
 * join as a lower-privilege role ("student" / "monitor"); claiming "dashboard"
 * is only honoured for a verified proctor.
 */
export const resolveProctoringRole = (
  identity: SocketIdentity | undefined,
  claimedRole: unknown,
): { allowed: true; role: string } | { allowed: false; reason: string } => {
  const role =
    typeof claimedRole === "string" && claimedRole ? claimedRole : "student";
  if (role === "dashboard" && !identity?.isProctor) {
    return {
      allowed: false,
      reason: "Not authorized to join as a proctoring dashboard",
    };
  }
  return { allowed: true, role };
};

/**
 * Events only a proctor (dashboard) socket may send — commands aimed at a
 * student's exam, or reads of other students' streams. Students never emit
 * these in the existing client code.
 */
export const PROCTOR_ONLY_EVENTS: ReadonlySet<string> = new Set([
  "get-active-streams",
  "webrtc-offer",
  "request-student-audio-confirmation",
  "force-student-audio",
  "send-warning-to-student",
  "send-note-to-student",
  "pause-student-exam",
  "resume-student-exam",
  "restart-student-quiz",
  "end-student-quiz",
  "request-student-camera-screenshot",
  "request-student-interface-screenshot",
]);

/**
 * Parse the allowed CORS origins. Reuses the env vars the main API reads
 * (ALLOWED_ORIGINS, CORS_ORIGIN, FRONTEND_URL). `*` is honoured only when
 * explicitly configured; with nothing configured, only local dev origins are
 * allowed outside production and nothing cross-origin in production.
 */
export const DEV_DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];

export const resolveAllowedOrigins = (
  env: NodeJS.ProcessEnv,
): "*" | string[] => {
  const configured = [env.ALLOWED_ORIGINS, env.CORS_ORIGIN, env.FRONTEND_URL]
    .filter((v): v is string => Boolean(v))
    .flatMap((v) => v.split(","))
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

  if (configured.includes("*")) return "*";
  if (configured.length > 0) return configured;
  return env.NODE_ENV === "production" ? [] : DEV_DEFAULT_ORIGINS;
};
