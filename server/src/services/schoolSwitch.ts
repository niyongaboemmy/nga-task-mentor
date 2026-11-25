import axios from "axios";
import type { Request, Response } from "express";
import { parseTid } from "../vendor/nga-tenancy";
import { getMisToken } from "../utils/misUtils";
import { tk } from "../tenancy/keys";

/**
 * The signed-in person's school, for the header, and their other schools, for
 * the account menu's "Switch school" (TENANT_SWITCHING_PLAN.md Appendix A.4/A.5):
 *
 *  - name + logo: MIS public `GET /tenant/branding?tid=<tid>` -> data.school_name, data.logoUrl
 *  - schools:     MIS `GET /auth/my-schools` with the person's MIS token
 *                 -> data.schools[{ tid, slug, name, logoUrl, status, current, roles[] }]
 *
 * Both are best effort: an MIS that doesn't have them yet (404) or can't be
 * reached leaves the registry's school name and an empty list (no "Switch").
 */

export interface MySchool {
  tid: number;
  slug: string | null;
  name: string;
  logoUrl: string | null;
  current: boolean;
}

export interface SchoolInfo {
  tid: number;
  name: string | null;
  logoUrl: string | null;
  schools: MySchool[];
  canSwitch: boolean;
}

const BRANDING_TTL_MS = 10 * 60 * 1000;
const SCHOOLS_TTL_MS = 60 * 1000;
const brandingCache = new Map<number, { at: number; name: string | null; logoUrl: string | null }>();
const schoolsCache = new Map<string, { at: number; schools: MySchool[] }>();

const misBase = () => (process.env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Normalise MIS's my-schools answer (unknown shapes -> []). */
export function normalizeMySchools(body: unknown, currentTid: number): MySchool[] {
  const b = body as { data?: { schools?: unknown }; schools?: unknown } | null;
  const raw = b?.data?.schools ?? b?.schools;
  if (!Array.isArray(raw)) return [];
  const out: MySchool[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const tid = parseTid(r?.tid);
    if (!tid || out.some((s) => s.tid === tid)) continue;
    out.push({
      tid,
      slug: text(r.slug),
      name: text(r.name) ?? `School ${tid}`,
      logoUrl: text(r.logoUrl ?? r.logo_url),
      current: r.current === true || tid === currentTid,
    });
  }
  return out;
}

async function branding(tid: number): Promise<{ name: string | null; logoUrl: string | null }> {
  const hit = brandingCache.get(tid);
  if (hit && Date.now() - hit.at < BRANDING_TTL_MS) return hit;
  const base = misBase();
  if (!base) return { name: null, logoUrl: null };
  try {
    const res = await axios.get(`${base}/tenant/branding`, { params: { tid }, timeout: 5000 });
    const d = res.data?.data ?? {};
    const value = { name: text(d.school_name ?? d.name), logoUrl: text(d.logoUrl ?? d.logo_url) };
    brandingCache.set(tid, { at: Date.now(), ...value });
    return value;
  } catch {
    // Remember the miss briefly so every page view doesn't retry.
    const value = { name: hit?.name ?? null, logoUrl: hit?.logoUrl ?? null };
    brandingCache.set(tid, { at: Date.now() - BRANDING_TTL_MS + 60_000, ...value });
    return value;
  }
}

async function mySchools(req: Request, tid: number): Promise<MySchool[]> {
  const key = tk("my-schools", req.user?.id);
  const hit = schoolsCache.get(key);
  if (hit && Date.now() - hit.at < SCHOOLS_TTL_MS) return hit.schools;
  const base = misBase();
  const token = getMisToken(req, { quiet: true });
  if (!base || !token) return [];
  try {
    const res = await axios.get(`${base}/auth/my-schools`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const schools = normalizeMySchools(res.data, tid);
    schoolsCache.set(key, { at: Date.now(), schools });
    return schools;
  } catch {
    schoolsCache.set(key, { at: Date.now(), schools: [] });
    return [];
  }
}

export async function schoolInfo(req: Request): Promise<SchoolInfo> {
  const tid = req.tenant?.tid ?? req.user?.tid;
  const [brand, schools] = await Promise.all([branding(tid), mySchools(req, tid)]);
  const fromList = schools.find((s) => s.tid === tid);
  return {
    tid,
    name: brand.name ?? fromList?.name ?? req.tenant?.name ?? null,
    logoUrl: brand.logoUrl ?? fromList?.logoUrl ?? null,
    schools,
    canSwitch: schools.length >= 2,
  };
}

/** GET /api/auth/school */
export async function getSchoolInfo(req: Request, res: Response) {
  try {
    return res.status(200).json({ success: true, data: await schoolInfo(req) });
  } catch (err: any) {
    console.error("getSchoolInfo failed:", err?.message ?? err);
    return res.status(200).json({
      success: true,
      data: { tid: req.tenant?.tid ?? null, name: req.tenant?.name ?? null, logoUrl: null, schools: [], canSwitch: false },
    });
  }
}

/** Tests only. */
export function resetSchoolInfoCacheForTests() {
  brandingCache.clear();
  schoolsCache.clear();
}
