import crypto from "crypto";
import { Request, Response } from "express";
import { ProctoringSettings } from "../models";

/**
 * `lockdown_browser` (TM-FIX-5 part B): the quiz must be taken in Safe Exam
 * Browser. Until TMCode exists this is the only lockdown we can verify on the
 * server, so the setting means "SEB required".
 *
 * SEB sends, with each request, `X-SafeExamBrowser-ConfigKeyHash` =
 * hex(SHA-256(<absolute request URL without fragment> + <Config Key>)). We
 * recompute it with the quiz's `seb_config_key` and the URL SEB requested.
 *
 * The URL: behind nginx the app sees http://127.0.0.1:<port>, not the URL SEB
 * hashed. So the origin is taken from `SEB_PUBLIC_ORIGIN` when set (e.g.
 * https://taskmentor-api.amashuri.com), else from X-Forwarded-Proto /
 * X-Forwarded-Host (first value), falling back to the request's own protocol
 * and Host header; the path is `req.originalUrl` (path + query, as sent).
 * This assumes the proxy forwards the original path and query unchanged.
 */

export const SEB_CONFIG_KEY_HASH_HEADER = "x-safeexambrowser-configkeyhash";
export const SEB_REQUEST_HASH_HEADER = "x-safeexambrowser-requesthash";

const firstValue = (v: string | string[] | undefined): string | undefined => {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.split(",")[0]?.trim() || undefined;
};

/** The absolute URL SEB requested (what it hashed). */
export function sebRequestUrl(req: Request): string {
  const configured = process.env.SEB_PUBLIC_ORIGIN?.replace(/\/+$/, "");
  const origin =
    configured ||
    `${firstValue(req.headers["x-forwarded-proto"]) || req.protocol}://${
      firstValue(req.headers["x-forwarded-host"]) || req.headers.host
    }`;
  return `${origin}${req.originalUrl}`;
}

export const sebConfigKeyHash = (url: string, configKey: string): string =>
  crypto.createHash("sha256").update(url + configKey).digest("hex");

/** True when the request carries a valid Config Key hash for `configKey`. */
export function hasValidSebConfigKey(req: Request, configKey: string | null | undefined): boolean {
  if (!configKey) return false;
  const sent = firstValue(req.headers[SEB_CONFIG_KEY_HASH_HEADER])?.toLowerCase();
  if (!sent || !/^[0-9a-f]{64}$/.test(sent)) return false;
  const expected = sebConfigKeyHash(sebRequestUrl(req), configKey.trim());
  return crypto.timingSafeEqual(Buffer.from(sent, "hex"), Buffer.from(expected, "hex"));
}

export interface LockdownRequirement {
  required: boolean;
  configKey: string | null;
}

/** Settings are only active while proctoring is enabled for the quiz. */
export async function lockdownRequirement(quizId: number): Promise<LockdownRequirement> {
  const settings = await ProctoringSettings.findOne({
    where: { quiz_id: quizId },
    attributes: ["enabled", "lockdown_browser", "seb_config_key"],
  });
  return {
    required: !!settings?.enabled && !!settings?.lockdown_browser,
    configKey: settings?.seb_config_key ?? null,
  };
}

/**
 * Refuses (409 LOCKDOWN_REQUIRED) when the quiz needs Safe Exam Browser and
 * the request doesn't come from it with the quiz's configuration. Returns
 * true when the caller may go on. Used on start, answer saves and submit.
 */
export async function enforceLockdown(
  req: Request,
  res: Response,
  quizId: number,
): Promise<boolean> {
  const { required, configKey } = await lockdownRequirement(quizId);
  if (!required || hasValidSebConfigKey(req, configKey)) return true;
  res.status(409).json({
    success: false,
    code: "LOCKDOWN_REQUIRED",
    message: configKey
      ? "This quiz must be taken in Safe Exam Browser. Open it from the exam configuration your teacher gave you."
      : "This quiz requires Safe Exam Browser, but its configuration key hasn't been set yet. Ask your teacher.",
  });
  return false;
}
