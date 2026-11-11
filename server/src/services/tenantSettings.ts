import { AppSetting } from "../models";
import { tk } from "../tenancy/keys";
import { currentTenantOrNull } from "../vendor/nga-tenancy";

/**
 * Per-school settings kept in each tenant database's app_settings (TM-12).
 *
 *  grading.bands    the letter-grade scale of report cards; default = the
 *                   scale NGA has always used (A>=90 B>=75 C>=60 D>=45 F).
 *  branding         report-card header: { name, address_line }. The primary
 *                   tenant keeps NGA's header; another school defaults to its
 *                   name from the tenant registry and no address line.
 */

export interface GradeBand {
  /** Lowest score (percent, inclusive) that earns this letter. */
  min: number;
  letter: string;
  remark: string;
}

export const DEFAULT_GRADING_BANDS: readonly GradeBand[] = Object.freeze([
  { min: 90, letter: "A", remark: "Distinction" },
  { min: 75, letter: "B", remark: "Merit" },
  { min: 60, letter: "C", remark: "Credit" },
  { min: 45, letter: "D", remark: "Pass" },
  { min: 0, letter: "F", remark: "Fail" },
]);

export const GRADING_BANDS_KEY = "grading.bands";
export const BRANDING_KEY = "branding";

const TTL_MS = 60_000;
const bandCache = new Map<string, { at: number; bands: GradeBand[] }>();

/** Valid, sorted (highest first) bands with a 0 floor, or null. */
export function normalizeBands(raw: unknown): GradeBand[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const bands: GradeBand[] = [];
  for (const b of raw as any[]) {
    const min = Number(b?.min);
    const letter = String(b?.letter ?? "").trim();
    const remark = String(b?.remark ?? "").trim();
    if (!Number.isFinite(min) || min < 0 || min > 100 || !letter || letter.length > 4 || remark.length > 40) return null;
    bands.push({ min, letter, remark });
  }
  bands.sort((a, b) => b.min - a.min);
  if (new Set(bands.map((b) => b.min)).size !== bands.length) return null;
  if (bands[bands.length - 1].min !== 0) return null;
  return bands;
}

async function readSetting(key: string): Promise<unknown> {
  const row: any = await AppSetting.findByPk(key).catch(() => null);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

/** The current tenant's bands (cached 60 s). */
export async function getGradingBands(): Promise<GradeBand[]> {
  const key = tk("grading-bands");
  const hit = bandCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.bands;
  const bands = normalizeBands(await readSetting(GRADING_BANDS_KEY)) ?? [...DEFAULT_GRADING_BANDS];
  bandCache.set(key, { at: Date.now(), bands });
  return bands;
}

/** Synchronous read of what getGradingBands() last loaded for this tenant (default otherwise). */
export function cachedGradingBands(): readonly GradeBand[] {
  return bandCache.get(tk("grading-bands"))?.bands ?? DEFAULT_GRADING_BANDS;
}

export async function setGradingBands(raw: unknown, by: number | null): Promise<GradeBand[]> {
  const bands = normalizeBands(raw);
  if (!bands) throw new Error("Grade bands need a letter, a remark and a distinct minimum (0-100) each, including one at 0.");
  await AppSetting.upsert({ key: GRADING_BANDS_KEY, value: JSON.stringify(bands), updated_by: by, updated_at: new Date() } as any);
  bandCache.delete(tk("grading-bands"));
  return bands;
}

export function letterFor(score: number, bands: readonly GradeBand[] = cachedGradingBands()): { letter: string; remark: string } {
  for (const b of bands) if (score >= b.min) return { letter: b.letter, remark: b.remark };
  const last = bands[bands.length - 1] ?? DEFAULT_GRADING_BANDS[DEFAULT_GRADING_BANDS.length - 1];
  return { letter: last.letter, remark: last.remark };
}

export interface Branding {
  name: string;
  address_line: string;
}

export const NGA_BRANDING: Branding = {
  name: "NATIONAL GRAMMAR ACADEMY",
  address_line: "P.O. Box 1234, Kigali, Rwanda  |  www.nga.ac.rw",
};

/** Report-card header for the current tenant. */
export async function getBranding(): Promise<Branding> {
  const tenant = currentTenantOrNull();
  const stored = (await readSetting(BRANDING_KEY)) as Partial<Branding> | null;
  const base: Branding =
    !tenant || tenant.isPrimary ? NGA_BRANDING : { name: tenant.name.toUpperCase(), address_line: "" };
  return {
    name: typeof stored?.name === "string" && stored.name.trim() ? stored.name.trim() : base.name,
    address_line: typeof stored?.address_line === "string" ? stored.address_line.trim() : base.address_line,
  };
}

/** Tests only. */
export function clearTenantSettingsCache() {
  bandCache.clear();
}
