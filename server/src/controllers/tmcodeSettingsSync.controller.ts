import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { z } from "zod";
import { sequelize } from "../config/database";
import { tmcodeError } from "../middleware/tmcodeAuth";

/**
 * TMCode Settings Sync: one JSON document per user (settings, keyboard
 * shortcuts, snippets, profiles, extension ids), so TMCode on another
 * computer starts the way the student left it. A write names the version it
 * was based on; a newer one on the server is a conflict (409) for TMCode to
 * resolve. Nothing here is graded or shown to teachers.
 */

/** The synced document's size limit (characters). */
export const MAX_SYNC_CHARS = 512 * 1024;

let ensured: Promise<void> | null = null;
export const ensureSettingsSyncTable = () => {
  if (!ensured) {
    ensured = sequelize
      .query(
        `CREATE TABLE IF NOT EXISTS tmcode_settings_sync (
           user_id INT NOT NULL PRIMARY KEY,
           data MEDIUMTEXT NOT NULL,
           updated_at DATETIME(3) NOT NULL
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      )
      .then(() => undefined)
      .catch((e) => {
        ensured = null;
        throw e;
      });
  }
  return ensured;
};

export const PutSchema = z.object({
  /** The synced document: an object TMCode reads back as it wrote it. */
  data: z.record(z.string(), z.unknown()),
  /** The version this write starts from (null: the first write from this computer). */
  base: z.string().datetime({ offset: true }).nullable().optional(),
});

const userId = (req: Request) => (req.user as { id: number }).id;

export async function getSettingsSync(req: Request, res: Response) {
  await ensureSettingsSyncTable();
  const rows = await sequelize.query<{ data: string; updated_at: Date }>("SELECT data, updated_at FROM tmcode_settings_sync WHERE user_id = ?", {
    replacements: [userId(req)],
    type: QueryTypes.SELECT,
  });
  if (!rows.length) return res.json({ data: null, updated_at: null });
  let data: unknown = null;
  try {
    data = JSON.parse(rows[0].data);
  } catch {
    data = null;
  }
  res.json({ data, updated_at: new Date(rows[0].updated_at).toISOString() });
}

export async function putSettingsSync(req: Request, res: Response) {
  const parsed = PutSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That settings document isn't valid.");
  const text = JSON.stringify(parsed.data.data);
  if (text.length > MAX_SYNC_CHARS) return tmcodeError(res, 413, "TOO_LARGE", "Your synced settings are larger than 512 KB.");
  await ensureSettingsSyncTable();
  const id = userId(req);
  const rows = await sequelize.query<{ updated_at: Date }>("SELECT updated_at FROM tmcode_settings_sync WHERE user_id = ?", { replacements: [id], type: QueryTypes.SELECT });
  const current = rows[0] ? new Date(rows[0].updated_at).toISOString() : null;
  // Someone else (another computer) wrote since this one last read: the student chooses.
  if (current && parsed.data.base !== undefined && parsed.data.base !== current) {
    return tmcodeError(res, 409, "CONFLICT", "Your settings changed on another computer.", { updated_at: current });
  }
  const now = new Date();
  await sequelize.query(
    "INSERT INTO tmcode_settings_sync (user_id, data, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)",
    { replacements: [id, text, now] },
  );
  res.json({ updated_at: now.toISOString() });
}

export async function deleteSettingsSync(req: Request, res: Response) {
  await ensureSettingsSyncTable();
  await sequelize.query("DELETE FROM tmcode_settings_sync WHERE user_id = ?", { replacements: [userId(req)] });
  res.status(204).end();
}
