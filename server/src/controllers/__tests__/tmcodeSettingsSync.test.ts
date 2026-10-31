const rows = new Map<number, { data: string; updated_at: Date }>();
jest.mock("../../config/database", () => ({
  sequelize: {
    query: jest.fn(async (sql: string, opts?: { replacements?: unknown[] }) => {
      const r = opts?.replacements ?? [];
      if (sql.startsWith("CREATE TABLE")) return [];
      if (sql.startsWith("SELECT data")) return rows.has(r[0] as number) ? [rows.get(r[0] as number)] : [];
      if (sql.startsWith("SELECT updated_at")) return rows.has(r[0] as number) ? [{ updated_at: rows.get(r[0] as number)!.updated_at }] : [];
      if (sql.startsWith("INSERT")) return rows.set(r[0] as number, { data: r[1] as string, updated_at: r[2] as Date }), [];
      if (sql.startsWith("DELETE")) return rows.delete(r[0] as number), [];
      return [];
    }),
  },
}));

import type { Request, Response } from "express";
import { deleteSettingsSync, getSettingsSync, MAX_SYNC_CHARS, putSettingsSync } from "../tmcodeSettingsSync.controller";

function call(fn: (req: Request, res: Response) => Promise<unknown>, body?: unknown) {
  const out: { status: number; body: unknown } = { status: 200, body: undefined };
  const res = {
    status(s: number) {
      out.status = s;
      return this;
    },
    json(b: unknown) {
      out.body = b;
      return this;
    },
    end() {
      return this;
    },
  } as unknown as Response;
  return fn({ user: { id: 7 }, body } as unknown as Request, res).then(() => out);
}

describe("TMCode Settings Sync", () => {
  beforeEach(() => rows.clear());

  it("starts empty, stores a document, and reads it back with its version", async () => {
    expect((await call(getSettingsSync)).body).toEqual({ data: null, updated_at: null });
    const put = await call(putSettingsSync, { data: { settings: { "editor.fontSize": 16 } }, base: null });
    expect(put.status).toBe(200);
    const version = (put.body as { updated_at: string }).updated_at;
    const got = (await call(getSettingsSync)).body as { data: unknown; updated_at: string };
    expect(got).toEqual({ data: { settings: { "editor.fontSize": 16 } }, updated_at: version });
  });

  it("refuses a write based on an older version (another computer wrote since)", async () => {
    const first = (await call(putSettingsSync, { data: { a: 1 }, base: null })).body as { updated_at: string };
    const stale = await call(putSettingsSync, { data: { a: 2 }, base: "2020-01-01T00:00:00.000Z" });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error_code: "CONFLICT", updated_at: first.updated_at });
    expect((await call(putSettingsSync, { data: { a: 3 }, base: first.updated_at })).status).toBe(200);
  });

  it("validates and limits the document; delete forgets it", async () => {
    expect((await call(putSettingsSync, { data: "nope" })).status).toBe(400);
    expect((await call(putSettingsSync, { data: { big: "x".repeat(MAX_SYNC_CHARS) } })).status).toBe(413);
    await call(putSettingsSync, { data: { a: 1 } });
    await call(deleteSettingsSync);
    expect(((await call(getSettingsSync)).body as { data: unknown }).data).toBeNull();
  });
});
