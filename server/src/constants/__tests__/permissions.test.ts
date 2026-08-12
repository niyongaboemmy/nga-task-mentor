import {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  PERMISSION_CATEGORIES,
  DEFAULT_ROLE_PERMISSIONS,
} from "../permissions";

describe("permission catalog", () => {
  it("has no duplicate keys", () => {
    const unique = new Set(ALL_PERMISSION_KEYS);
    expect(unique.size).toBe(ALL_PERMISSION_KEYS.length);
  });

  it("assigns every permission a known category", () => {
    for (const perm of PERMISSIONS) {
      expect(PERMISSION_CATEGORIES).toContain(perm.category);
    }
  });

  it("gives every permission a non-empty description", () => {
    for (const perm of PERMISSIONS) {
      expect(perm.description.length).toBeGreaterThan(0);
    }
  });
});

describe("default role -> permission mapping", () => {
  const validKeys = new Set(ALL_PERMISSION_KEYS);

  it("only references keys that exist in the catalog", () => {
    for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const key of keys) {
        expect(validKeys.has(key)).toBe(true);
      }
      // no duplicates within a role's own list
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("grants admin every permission in the catalog", () => {
    expect(new Set(DEFAULT_ROLE_PERMISSIONS.admin)).toEqual(validKeys);
  });

  it("does not grant instructor admin-only management permissions", () => {
    const adminOnly = [
      "USERS_CREATE",
      "USERS_DELETE",
      "COURSES_CREATE",
      "COURSES_DELETE",
      "DATABASE_ADMIN_ACCESS",
      "ROLES_PERMISSIONS_MANAGE",
      "ASSIGNMENTS_MANAGE_ANY",
      "QUIZZES_MANAGE_ANY",
      "QUESTION_BANK_MANAGE_ANY",
      "REPORT_CARDS_APPROVE",
    ];
    for (const key of adminOnly) {
      expect(DEFAULT_ROLE_PERMISSIONS.instructor).not.toContain(key);
    }
  });

  it("does not grant student any management/admin permission", () => {
    const nonStudent = [
      "USERS_CREATE",
      "COURSES_CREATE",
      "ASSIGNMENTS_CREATE",
      "QUIZZES_CREATE",
      "DATABASE_ADMIN_ACCESS",
      "ROLES_PERMISSIONS_MANAGE",
      "REPORT_CARDS_APPROVE",
    ];
    for (const key of nonStudent) {
      expect(DEFAULT_ROLE_PERMISSIONS.student).not.toContain(key);
    }
  });
});
