import { Request, Response } from "express";
import { Op, QueryTypes } from "sequelize";
import { z } from "zod";
import { sequelize } from "../config/database";
import { AiEntitlement, User } from "../models";
import { activeUserWhere, isActiveUser } from "../utils/activeUsers";
import { publishAiChange } from "../services/aiLive";
import { BYOK_SETTING, byokAllowed, effectiveEntitlement, setSetting } from "../services/aiEntitlements";
import { byokProviders, PAID_PROVIDERS, premiumDefaultLimit, premiumModels, premiumModelsConfigured, premiumUsed, isPaidProvider } from "../tmcode/ai/service";

/**
 * Admin → AI: premium & own keys (AI_SETTINGS_MANAGE; GRADING_PREMIUM_CONTRACTS.md).
 *   GET    /api/admin/ai/settings               { allow_byok, premium_default_limit, premium_models, premium_unavailable, byok_providers }
 *   PUT    /api/admin/ai/settings               { allow_byok } → the settings
 *   GET    /api/admin/ai/entitlements           { users: [...], roles_with_premium: [...] }
 *   PUT    /api/admin/ai/entitlements/:userId   { premium?, daily_limit?, note? } → { user }
 *   DELETE /api/admin/ai/entitlements/:userId   → { ok: true }
 *   GET    /api/admin/ai/users?q=               people to grant to (Task Mentor accounts) → { users }
 * The free AI stays everyone's default; changes reach open TMCode apps live (publishAiChange).
 */

const actor = (req: Request) => Number((req as any).user?.id) || null;

async function settingsBody() {
  const configured = premiumModelsConfigured();
  return {
    allow_byok: await byokAllowed(),
    premium_default_limit: premiumDefaultLimit(),
    premium_models: premiumModels(),
    // Listed in TMCODE_AI_PREMIUM_MODELS but not offered (unknown provider, or no key on the server).
    premium_unavailable: configured
      .filter((e) => !e.configured)
      .map((e) => ({
        entry: `${e.provider}/${e.model}`,
        reason: !isPaidProvider(e.provider) ? "Unknown provider" : !e.model ? "No model named" : `No ${PAID_PROVIDERS[e.provider].label} key on the server`,
      })),
    byok_providers: byokProviders(),
  };
}

// @route GET /api/admin/ai/settings
export const getAiSettings = async (_req: Request, res: Response) => {
  res.json({ success: true, data: await settingsBody() });
};

const SettingsSchema = z.object({ allow_byok: z.boolean() });

// @route PUT /api/admin/ai/settings
export const putAiSettings = async (req: Request, res: Response) => {
  const parsed = SettingsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, message: "allow_byok must be true or false." });
  await setSetting(BYOK_SETTING, parsed.data.allow_byok, actor(req));
  publishAiChange({ cause: "access" });
  res.json({ success: true, data: await settingsBody() });
};

async function rolesWithPremium(): Promise<{ id: number; name: string }[]> {
  return sequelize.query(
    "SELECT r.id, r.name FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` = 'AI_PREMIUM' ORDER BY r.name",
    { type: QueryTypes.SELECT },
  );
}

async function rolesOf(userIds: number[]): Promise<Map<number, { role: string | null; rolePremium: boolean }>> {
  const out = new Map<number, { role: string | null; rolePremium: boolean }>();
  if (!userIds.length) return out;
  const rows = await sequelize.query<{ id: number; role: string | null; premium: number | null }>(
    `SELECT u.id, r.name AS role,
            (SELECT COUNT(*) FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
              WHERE rp.role_id = u.role_id AND p.\`key\` = 'AI_PREMIUM') AS premium
       FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id IN (:ids)`,
    { type: QueryTypes.SELECT, replacements: { ids: userIds } },
  );
  for (const r of rows) out.set(Number(r.id), { role: r.role ?? null, rolePremium: Number(r.premium) > 0 });
  return out;
}

const nameOf = (u: User | undefined) => (u ? [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email : null);

async function entitlementRows(rows: AiEntitlement[]) {
  const ids = [...new Set(rows.flatMap((r) => [r.user_id, r.granted_by].filter((x): x is number => !!x)))];
  const [users, roles] = await Promise.all([
    ids.length ? User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "first_name", "last_name", "email", "mis_status"] }) : [],
    rolesOf(rows.map((r) => r.user_id)),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = byId.get(r.user_id);
    const role = roles.get(r.user_id);
    const e = effectiveEntitlement(!!role?.rolePremium, r);
    return {
      user_id: r.user_id,
      name: nameOf(u) ?? `User #${r.user_id}`,
      email: u?.email ?? null,
      // History stays: a grant to someone MIS has since disabled is listed, badged.
      inactive: u ? !isActiveUser(u) : false,
      role: role?.role ?? null,
      premium: !!r.premium,
      entitled: e.entitled,
      via: e.via,
      daily_limit: r.daily_limit ?? null,
      effective_limit: e.limit,
      used_today: premiumUsed(r.user_id),
      note: r.note ?? null,
      granted_by: r.granted_by ? { id: r.granted_by, name: nameOf(byId.get(r.granted_by)) ?? `User #${r.granted_by}` } : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
  });
}

// @route GET /api/admin/ai/entitlements
export const listEntitlements = async (_req: Request, res: Response) => {
  const rows = await AiEntitlement.findAll({ order: [["updated_at", "DESC"]] });
  res.json({ success: true, data: { users: await entitlementRows(rows), roles_with_premium: await rolesWithPremium(), default_limit: premiumDefaultLimit() } });
};

const EntitlementSchema = z.object({
  premium: z.boolean().default(true),
  daily_limit: z.number().int().min(1).max(10_000).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

// @route PUT /api/admin/ai/entitlements/:userId
export const putEntitlement = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const parsed = EntitlementSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Invalid entitlement.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  const user = await User.findByPk(userId, { attributes: ["id", "mis_status"] });
  if (!user) return res.status(404).json({ success: false, message: "That user has no Task Mentor account yet." });
  const existing = await AiEntitlement.findByPk(userId);
  const b = parsed.data;
  if (b.premium && !isActiveUser(user)) {
    return res.status(409).json({ success: false, code: "USER_INACTIVE", message: "That account is no longer active in NGA MIS." });
  }
  await AiEntitlement.upsert({
    user_id: userId,
    premium: b.premium,
    daily_limit: b.daily_limit !== undefined ? b.daily_limit : existing?.daily_limit ?? null,
    note: b.note !== undefined ? b.note?.trim() || null : existing?.note ?? null,
    granted_by: actor(req),
    updated_at: new Date(),
  } as any);
  publishAiChange({ cause: "access" });
  const [row] = await entitlementRows([(await AiEntitlement.findByPk(userId))!]);
  res.json({ success: true, data: { user: row } });
};

// @route DELETE /api/admin/ai/entitlements/:userId
export const deleteEntitlement = async (req: Request, res: Response) => {
  const n = await AiEntitlement.destroy({ where: { user_id: Number(req.params.userId) } });
  if (n) publishAiChange({ cause: "access" });
  res.json({ success: true, data: { ok: true, removed: n > 0 } });
};

// @route GET /api/admin/ai/users?q=
export const searchUsers = async (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  if (q.length < 2) return res.json({ success: true, data: { users: [] } });
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const parts = q.split(/\s+/).filter(Boolean);
  // Active users only (ACTIVE_USERS_CONTRACTS.md): no grants to disabled accounts.
  const where: any = {
    [Op.and]: [activeUserWhere()],
    [Op.or]: [
      { email: { [Op.like]: like } },
      { first_name: { [Op.like]: like } },
      { last_name: { [Op.like]: like } },
      ...(parts.length >= 2 ? [{ [Op.and]: [{ first_name: { [Op.like]: `%${parts[0]}%` } }, { last_name: { [Op.like]: `%${parts.slice(1).join(" ")}%` } }] }] : []),
    ],
  };
  const users = await User.findAll({ where, attributes: ["id", "first_name", "last_name", "email"], limit: 20, order: [["first_name", "ASC"], ["last_name", "ASC"]] });
  const [roles, rows] = await Promise.all([rolesOf(users.map((u) => u.id)), AiEntitlement.findAll({ where: { user_id: { [Op.in]: users.map((u) => u.id) } } })]);
  const granted = new Map(rows.map((r) => [r.user_id, r]));
  res.json({
    success: true,
    data: {
      users: users.map((u) => {
        const role = roles.get(u.id);
        return { id: u.id, name: nameOf(u), email: u.email, role: role?.role ?? null, entitled: effectiveEntitlement(!!role?.rolePremium, granted.get(u.id) ?? null).entitled };
      }),
    },
  });
};
