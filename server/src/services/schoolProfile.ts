import type { Request } from "express";
import axios from "axios";
import { AppSetting } from "../models";
import { tk } from "../tenancy/keys";
import { getMisToken } from "../utils/misUtils";

/**
 * The school's identity block as MIS keeps it (School: name, district,
 * contacts, sector, trade, qualification, head of school), per tenant: each
 * tenant has its own MIS database, and MIS answers GET /schools/profile for
 * the tenant of the caller's token. Report cards print it.
 *
 * Read with the request's MIS token and cached briefly; the last copy read is
 * also kept in this tenant's app_settings, so a card built without a token
 * (the publish sweep, verification) still prints the school's details.
 */

export interface SchoolProfile {
  school_id: number | null;
  name: string | null;
  address: string | null;
  district: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  sector: string | null;
  trade: string | null;
  qualification_title: string | null;
  head_teacher_name: string | null;
  logo_url: string | null;
  /** The document letterhead (services/documentLetterhead.ts); null on an MIS that doesn't have it yet. */
  documents_logo_url: string | null;
  documents_footer_url: string | null;
  /** Up to four lines, separated by line breaks. */
  documents_footer_text: string | null;
}

export const SCHOOL_PROFILE_FIELDS = [
  "name",
  "address",
  "district",
  "contact_email",
  "contact_phone",
  "sector",
  "trade",
  "qualification_title",
  "head_teacher_name",
] as const;
export type SchoolProfileField = (typeof SCHOOL_PROFILE_FIELDS)[number];

const LAST_KEY = "school.profile.last";
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; profile: SchoolProfile; canEdit: boolean }>();

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function normalizeProfile(raw: any): SchoolProfile {
  return {
    school_id: raw?.school_id != null ? Number(raw.school_id) : null,
    name: text(raw?.name),
    address: text(raw?.address),
    district: text(raw?.district),
    contact_email: text(raw?.contact_email),
    contact_phone: text(raw?.contact_phone),
    sector: text(raw?.sector),
    trade: text(raw?.trade),
    qualification_title: text(raw?.qualification_title),
    head_teacher_name: text(raw?.head_teacher_name),
    logo_url: text(raw?.logo_url),
    documents_logo_url: text(raw?.documents_logo_url),
    documents_footer_url: text(raw?.documents_footer_url),
    documents_footer_text: text(raw?.documents_footer_text),
  };
}

async function readLast(): Promise<SchoolProfile | null> {
  try {
    const row: any = await AppSetting.findByPk(LAST_KEY);
    return row?.value ? normalizeProfile(JSON.parse(row.value)) : null;
  } catch {
    return null;
  }
}

async function keepLast(p: SchoolProfile) {
  try {
    await AppSetting.upsert({ key: LAST_KEY, value: JSON.stringify(p), updated_by: null, updated_at: new Date() } as any);
  } catch {
    // No database (scripts, unit tests): the cache is enough.
  }
}

/** The school's profile (null when MIS can't be reached and none was read before) and whether the caller may edit it in MIS. */
export async function getSchoolProfile(req: Request | null, opts: { fresh?: boolean } = {}): Promise<{ profile: SchoolProfile | null; canEdit: boolean; source: "mis" | "last" | "none" }> {
  const key = tk("school-profile");
  const hit = cache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.at < TTL_MS) return { profile: hit.profile, canEdit: hit.canEdit, source: "mis" };
  const token = req ? getMisToken(req, { quiet: true }) : null;
  if (token && process.env.NGA_MIS_BASE_URL) {
    try {
      const res = await axios.get(`${process.env.NGA_MIS_BASE_URL}/schools/profile`, { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 });
      const profile = normalizeProfile(res.data?.data);
      const canEdit = !!res.data?.can_edit;
      cache.set(key, { at: Date.now(), profile, canEdit });
      void keepLast(profile);
      return { profile, canEdit, source: "mis" };
    } catch (e: any) {
      if (e?.response?.status !== 404) console.error("getSchoolProfile: MIS unavailable:", e?.message ?? e);
    }
  }
  const last = hit?.profile ?? (await readLast());
  return { profile: last, canEdit: false, source: last ? "last" : "none" };
}

/** Saves identity fields to MIS (MIS checks MANAGE_SCHOOLS); returns the saved profile or throws with MIS's status/message. */
export async function saveSchoolProfile(req: Request, patch: Partial<Record<SchoolProfileField, string | null>>): Promise<SchoolProfile> {
  const token = getMisToken(req, { quiet: true });
  if (!token || !process.env.NGA_MIS_BASE_URL) {
    const err: any = new Error("Sign in again: MIS couldn't be reached with your session.");
    err.status = 401;
    throw err;
  }
  const body: Record<string, string | null> = {};
  for (const f of SCHOOL_PROFILE_FIELDS) if (f in patch) body[f] = patch[f] == null ? null : String(patch[f]);
  try {
    const res = await axios.put(`${process.env.NGA_MIS_BASE_URL}/schools/profile`, body, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
    const profile = normalizeProfile(res.data?.data);
    cache.set(tk("school-profile"), { at: Date.now(), profile, canEdit: true });
    void keepLast(profile);
    return profile;
  } catch (e: any) {
    const status = e?.response?.status ?? 502;
    const err: any = new Error(
      status === 403 ? "Only an MIS administrator (Manage schools) can change the school's details." : e?.response?.data?.message || "MIS couldn't save the school's details.",
    );
    err.status = status === 403 || status === 400 ? status : 502;
    throw err;
  }
}

/** Saves a module's weight on the MIS subject (MIS checks MANAGE_ACADEMICS). */
export async function saveModuleWeight(req: Request, subjectId: number, weight: number | null): Promise<void> {
  const token = getMisToken(req, { quiet: true });
  if (!token || !process.env.NGA_MIS_BASE_URL) {
    const err: any = new Error("Sign in again: MIS couldn't be reached with your session.");
    err.status = 401;
    throw err;
  }
  try {
    await axios.put(`${process.env.NGA_MIS_BASE_URL}/academics/subjects/${subjectId}`, { module_weight: weight }, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
  } catch (e: any) {
    const status = e?.response?.status ?? 502;
    const err: any = new Error(
      status === 403 ? "Only an MIS administrator (Manage academics) can change module weights in MIS." : e?.response?.data?.message || "MIS couldn't save the weight.",
    );
    err.status = status === 403 || status === 400 || status === 404 ? status : 502;
    throw err;
  }
}

/** Tests only. */
export function clearSchoolProfileCache() {
  cache.clear();
}
