import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextFunction, Request, Response, Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { protect } from "../middleware/auth";
import fileServer from "../utils/fileServer";
import { getScopedSubjects } from "../utils/scopedSubjects";
import { enterTenant, headerTid, misTokenTid, requestMisToken, resolveTenant, sendTenantGate } from "../tenancy/request";
import { parseTid, PRIMARY_TENANT_ID } from "../vendor/nga-tenancy";
import { tidOrPrimary } from "../tenancy/keys";

/**
 * GET /uploads/<subpath> -- stored files, authorised (TM-8, Phase 0 #1).
 *
 * It used to stream any path to anyone. Now a request must carry one of:
 *  1. a session (Bearer header or the tm_auth_token cookie, which the browser
 *     sends on <img>/<iframe> loads from the same site), and the caller must
 *     be allowed to see the record that owns the file (authorizeUpload);
 *  2. a short-lived signature (?tid=&exp=&sig=) minted by
 *     GET /api/media/upload-url after the same check -- for viewers that
 *     can't send headers (iframes, the document viewer, the desktop app);
 *  3. for rich-text images only, a non-expiring media key (?t=&k=) bound to
 *     the tenant and path, added when the image is uploaded;
 *  4. UPLOADS_LEGACY_MEDIA_PUBLIC (default true, by design): editor images
 *     stored before tenancy, which sit in quiz/assignment HTML without any
 *     key, stay public in their legacy location. They were all school 1's,
 *     so they are served only to an anonymous request or one whose school is
 *     school 1 (TM-ISO-4): a request that carries any sign of another school
 *     (its session, its MIS token, the nga_school cookie, X-NGA-Tenant or a
 *     ?tid=/?t= hint) gets 404, never school 1's legacy media.
 *
 * Responses are `Cache-Control: private, no-store` with `Vary: Authorization,
 * Cookie` (TM-ISO-7): what one person may open must not be replayed from a
 * shared or browser cache to the next person, or the next school, on the
 * same device.
 *
 * The tenant comes from the session or the signature; another school's files
 * are never reachable (fileServer resolves paths inside the tenant).
 */

const secret = () => `${process.env.JWT_SECRET}:uploads`;
const hmac = (data: string) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");
const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const SIGNED_URL_TTL_S = () => Math.max(30, Number(process.env.UPLOADS_SIGNED_TTL_S) || 300);

/** Query string that lets anyone holding it read `subpath` in tenant `tid` until `exp`. */
export function signUploadQuery(tid: number, subpath: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SIGNED_URL_TTL_S();
  return `tid=${tid}&exp=${exp}&sig=${hmac(`sig:${tid}:${subpath}:${exp}`)}`;
}

/** Non-expiring key for a rich-text image (editor-images/*). */
export function mediaKeyQuery(tid: number, subpath: string): string {
  return `t=${tid}&k=${hmac(`media:${tid}:${subpath}`)}`;
}

export function normalizeSubpath(raw: string): string | null {
  const clean = String(raw || "")
    .replace(/^\/+/, "")
    .replace(/^uploads\//, "");
  if (!clean || clean.split("/").some((p) => p === ".." || p === "." || p === "")) return null;
  return clean;
}

type Grant = { tid: number; via: "signature" | "media-key" };

/** A valid signature or media key for this path, or null. */
export function verifyUploadGrant(subpath: string, query: Record<string, unknown>, now = Date.now()): Grant | null {
  const sig = typeof query.sig === "string" ? query.sig : null;
  if (sig) {
    const tid = parseTid(query.tid);
    const exp = Number(query.exp);
    if (!tid || !Number.isFinite(exp) || exp * 1000 < now) return null;
    return safeEqual(sig, hmac(`sig:${tid}:${subpath}:${exp}`)) ? { tid, via: "signature" } : null;
  }
  const k = typeof query.k === "string" ? query.k : null;
  if (k && subpath.startsWith("editor-images/")) {
    const tid = parseTid(query.t);
    if (!tid) return null;
    return safeEqual(k, hmac(`media:${tid}:${subpath}`)) ? { tid, via: "media-key" } : null;
  }
  return null;
}

const perms = (req: Request): Set<string> => req.user?.permissions ?? new Set();
const isSchoolAdmin = (req: Request) => perms(req).has("ASSIGNMENTS_MANAGE_ANY") || perms(req).has("USERS_EDIT");

async function teachesCourse(req: Request, courseId: number | null | undefined): Promise<boolean> {
  if (!perms(req).has("SUBMISSIONS_VIEW_ALL") && !perms(req).has("ASSIGNMENTS_VIEW_SUBMISSIONS")) return false;
  try {
    const { scope, subjects } = await getScopedSubjects(req);
    if (scope === "all") return true;
    return courseId != null && subjects.some((s) => s.id === Number(courseId));
  } catch {
    return false;
  }
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * May the signed-in caller read this stored file? Decided from the record
 * that owns it; unknown kinds of path are for school-wide staff only.
 */
export async function authorizeUpload(req: Request, subpath: string): Promise<boolean> {
  if (!req.user) return false;
  const [kind] = subpath.split("/");
  const name = subpath.split("/").pop()!;

  if (kind === "editor-images" || kind === "assignments" || kind === "profile-pictures" || kind === "quiz-attachments") {
    // Content shared with classes (rich-text images, assignment attachments,
    // pictures): any signed-in member of the school.
    return true;
  }
  if (kind === "projects") return false; // TMCode blobs: only through the projects API

  if (kind === "submissions" || !subpath.includes("/")) {
    if (isSchoolAdmin(req)) return true;
    const rows = (await sequelize.query(
      `SELECT s.student_id, a.created_by, a.course_id
         FROM submissions s LEFT JOIN assignments a ON a.id = s.assignment_id
        WHERE CAST(s.file_submissions AS CHAR) LIKE :p LIMIT 20`,
      { replacements: { p: `%${likeEscape(name)}%` }, type: QueryTypes.SELECT },
    )) as Array<{ student_id: number; created_by: number | null; course_id: number | null }>;
    for (const r of rows) {
      if (Number(r.student_id) === Number(req.user.id)) return true;
      if (r.created_by != null && Number(r.created_by) === Number(req.user.id)) return true;
      if (await teachesCourse(req, r.course_id)) return true;
    }
    return false;
  }

  if (kind === "report-cards") {
    if (perms(req).has("REPORT_CARDS_VIEW_ALL") || isSchoolAdmin(req)) return true;
    const rows = (await sequelize.query(`SELECT student_id FROM report_cards WHERE pdf_path = :p LIMIT 5`, {
      replacements: { p: subpath },
      type: QueryTypes.SELECT,
    })) as Array<{ student_id: number }>;
    const own = [Number(req.user.id), Number(req.user.mis_user_id)].filter((n) => n > 0);
    return rows.some((r) => own.includes(Number(r.student_id)));
  }

  return isSchoolAdmin(req);
}

function cors(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-mis-token");
}

const legacyMediaPublic = () => String(process.env.UPLOADS_LEGACY_MEDIA_PUBLIC ?? "true").toLowerCase() !== "false";
const LEGACY_DIR = path.join(__dirname, "../../uploads");

async function stream(subpath: string, res: Response, opts: { legacyOnly?: boolean } = {}) {
  try {
    const found = opts.legacyOnly ? await fileServer.streamLegacyTo(subpath, res) : await fileServer.streamTo(subpath, res);
    if (found) return;
  } catch (error) {
    console.error("uploads proxy error:", error);
    if (res.headersSent) return;
  }
  // Files that predate the file-server: the old local uploads/ dir, which
  // only ever held the primary tenant's files.
  const tid = res.req.tenant?.tid ?? tidOrPrimary("uploads.serve");
  if (tid === PRIMARY_TENANT_ID) {
    const legacyPath = path.join(LEGACY_DIR, subpath);
    if (legacyPath.startsWith(LEGACY_DIR) && fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile()) {
      return res.sendFile(legacyPath);
    }
  }
  if (!res.headersSent) res.status(404).json({ success: false, message: "Not found" });
}

/**
 * The schools a request hints at without a session: its MIS token (cookie or
 * x-mis-token), the cross-app `nga_school=<tid>.<sid>` cookie, X-NGA-Tenant
 * and ?tid= / ?t=. Unverified -- only ever used to REFUSE legacy media.
 */
export function hintedTids(req: Request): number[] {
  const out: number[] = [];
  const push = (v: unknown) => {
    const t = parseTid(v);
    if (t) out.push(t);
  };
  const mt = misTokenTid(requestMisToken(req));
  if (mt) out.push(mt);
  const school = (req as any).cookies?.nga_school;
  if (typeof school === "string") {
    let raw = school;
    try {
      raw = decodeURIComponent(school);
    } catch {
      /* malformed: use as is */
    }
    push(raw.split(".")[0]);
  }
  push(headerTid(req));
  const q = req.query as Record<string, unknown>;
  push(q?.tid);
  push(q?.t);
  return out;
}

/** Legacy (pre-tenancy) media is school 1's: anonymous or school-1 requests only. */
export const legacyMediaAllowed = (req: Request) => hintedTids(req).every((t) => t === PRIMARY_TENANT_ID);

const hasSession = (req: Request) => {
  const h = req.headers.authorization;
  if (h && /^Bearer\s+\S+/.test(h) && !/^Bearer\s+(none|null|undefined)$/i.test(h)) return true;
  const c = (req as any).cookies?.tm_auth_token;
  return typeof c === "string" && !["", "none", "null", "undefined"].includes(c);
};

export async function serveUpload(req: Request, res: Response, next: NextFunction) {
  cors(req, res);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  const subpath = normalizeSubpath((req.params as Record<string, string>)[0]);
  if (!subpath) return res.status(400).json({ success: false, message: "Bad path" });

  const grant = verifyUploadGrant(subpath, req.query as Record<string, unknown>);
  if (grant) {
    const gate = await resolveTenant(grant.tid);
    if (!gate.ok) return sendTenantGate(res, gate);
    return enterTenant(req, gate.tenant, () => stream(subpath, res));
  }

  if (!hasSession(req)) {
    if (legacyMediaPublic() && subpath.startsWith("editor-images/")) {
      if (!legacyMediaAllowed(req)) return res.status(404).json({ success: false, message: "Not found" });
      const gate = await resolveTenant(PRIMARY_TENANT_ID);
      if (!gate.ok) return sendTenantGate(res, gate);
      return enterTenant(req, gate.tenant, () => stream(subpath, res, { legacyOnly: true }));
    }
    return res.status(401).json({ success: false, message: "Sign in to open this file" });
  }

  return protect(req, res, async () => {
    try {
      if (!(await authorizeUpload(req, subpath))) {
        return res.status(403).json({ success: false, message: "You can't open this file" });
      }
      return stream(subpath, res);
    } catch (err) {
      return next(err);
    }
  });
}

/** GET /api/media/upload-url?path=/uploads/... -> a short-lived signed URL (after authorizeUpload). */
export async function signedUploadUrl(req: Request, res: Response) {
  const subpath = normalizeSubpath(String(req.query.path ?? ""));
  if (!subpath) return res.status(400).json({ success: false, message: "path is required" });
  if (!(await authorizeUpload(req, subpath))) {
    return res.status(403).json({ success: false, message: "You can't open this file" });
  }
  const tid = req.tenant?.tid ?? tidOrPrimary("uploads.store");
  const query = signUploadQuery(tid, subpath);
  return res.status(200).json({ success: true, url: `/uploads/${subpath}?${query}`, expiresIn: SIGNED_URL_TTL_S() });
}

const router = Router();
router.options("/*", (req, res) => {
  cors(req, res);
  res.status(200).end();
});
router.get("/*", serveUpload);

export default router;
