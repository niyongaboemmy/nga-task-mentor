jest.mock("../../models/User.model", () => ({ User: { findOne: jest.fn(), create: jest.fn() } }));
jest.mock("../../models/Role.model", () => ({ Role: { findOne: jest.fn(async () => ({ id: 1 })), findByPk: jest.fn(async () => ({ is_system: true })) } }));
import { User } from "../../models/User.model";
import { upsertMisUser } from "../misUserSync";

/**
 * SSO sign-in for MIS accounts without a full name (production 2026-11-20: the
 * super admin ngacodingacademy@... has no first or last name, and every sign-in
 * failed with "Last name must be between 1 and 50 characters").
 */
const findOne = User.findOne as jest.Mock;
const create = User.create as jest.Mock;

beforeEach(() => {
  findOne.mockReset().mockResolvedValue(null);
  create.mockReset().mockImplementation(async (v: any) => ({ id: 7, ...v }));
});

describe("upsertMisUser names", () => {
  it("creates an account with no name at all: username first, '-' last", async () => {
    await upsertMisUser({ user_id: 18, username: "AssadouAdmin", email: "office@school.test", status: "ACTIVE" } as any, { first_name: null, last_name: null }, [{ name: "SUPER_ADMIN" }] as any);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ first_name: "AssadouAdmin", last_name: "-", mis_user_id: 18 }));
  });

  it("falls back to the email's local part, and keeps real names", async () => {
    await upsertMisUser({ user_id: 19, username: "", email: "j.doe@school.test" } as any, null, []);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ first_name: "j.doe", last_name: "-" }));
    await upsertMisUser({ user_id: 20, username: "aline", email: "a@school.test" } as any, { first_name: " Aline ", last_name: "Uwase" }, []);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ first_name: "Aline", last_name: "Uwase" }));
  });

  it("an existing account with an empty last name is repaired on the next sign-in", async () => {
    const save = jest.fn();
    const local: any = { id: 3, first_name: "", last_name: "", email: "a@school.test", role_id: 1, save };
    findOne.mockImplementation(async ({ where }: any) => (where.mis_user_id ? local : null));
    await upsertMisUser({ user_id: 21, username: "kezo", email: "a@school.test" } as any, { first_name: null, last_name: "" }, []);
    expect(local.first_name).toBe("a");
    expect(local.last_name).toBe("-");
    expect(save).toHaveBeenCalled();
  });
});
