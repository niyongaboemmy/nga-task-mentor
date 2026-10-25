import { Op } from "sequelize";
import {
  activeUserSql,
  activeUserWhere,
  isActiveStatus,
  isActiveUser,
  misRowStatus,
  misRowUserId,
  normalizeStatus,
} from "../utils/activeUsers";
import { misStatusSweepDisabledReason, plannedStatuses, statusByMisId } from "../services/misStatusSweep";

/** Pure parts of the active-users rule (ACTIVE_USERS_CONTRACTS.md) and the MIS status sweep. */

describe("isActiveStatus", () => {
  it("treats no status (not synced yet) and ACTIVE in any case as active", () => {
    for (const v of [null, undefined, "", "  ", "ACTIVE", "active", " Active ", true, 1]) {
      expect(isActiveStatus(v)).toBe(true);
    }
  });

  it("treats INACTIVE, SUSPENDED, REMOVED and anything else as not active", () => {
    for (const v of ["INACTIVE", "suspended", "REMOVED", "DELETED", false, 0]) {
      expect(isActiveStatus(v)).toBe(false);
    }
  });

  it("normalises to upper case, 16 chars max", () => {
    expect(normalizeStatus(" suspended ")).toBe("SUSPENDED");
    expect(normalizeStatus("x".repeat(40))).toHaveLength(16);
    expect(normalizeStatus(undefined)).toBeNull();
  });

  it("isActiveUser reads mis_status and refuses a missing user", () => {
    expect(isActiveUser({ mis_status: null })).toBe(true);
    expect(isActiveUser({ mis_status: "INACTIVE" })).toBe(false);
    expect(isActiveUser(null)).toBe(false);
  });
});

describe("MIS row shapes", () => {
  it("finds the MIS user id in flat, nested and bare rows", () => {
    expect(misRowUserId({ user_id: 5, id: 99 })).toBe(5);
    expect(misRowUserId({ student_id: "7" })).toBe(7);
    expect(misRowUserId({ user: { user_id: 8 } })).toBe(8);
    expect(misRowUserId({ id: 9 })).toBe(9);
    expect(misRowUserId(10)).toBe(10);
    expect(misRowUserId({ user_id: "x" })).toBeNull();
    expect(misRowUserId(null)).toBeNull();
  });

  it("reads the account status, nested user first", () => {
    expect(misRowStatus({ user: { status: "INACTIVE" }, status: "ACTIVE" })).toBe("INACTIVE");
    expect(misRowStatus({ user_status: "SUSPENDED" })).toBe("SUSPENDED");
    expect(misRowStatus({ status: "ACTIVE" })).toBe("ACTIVE");
    expect(misRowStatus({ first_name: "A" })).toBeNull();
  });
});

describe("query fragments", () => {
  it("matches NULL or ACTIVE, optionally on an include alias", () => {
    expect(activeUserWhere()).toEqual({ [Op.or]: [{ mis_status: null }, { mis_status: "ACTIVE" }] });
    expect(activeUserWhere("student")).toEqual({
      [Op.or]: [{ "$student.mis_status$": null }, { "$student.mis_status$": "ACTIVE" }],
    });
    expect(activeUserSql("u")).toBe("(u.mis_status IS NULL OR u.mis_status = 'ACTIVE')");
  });
});

describe("MIS status sweep planning", () => {
  it("maps MIS people to statuses; no status field counts as ACTIVE", () => {
    const m = statusByMisId([{ id: 1, status: "inactive" }, { id: 2 }, { id: "x" }, { user_id: 3, status: "SUSPENDED" }]);
    expect([...m]).toEqual([
      [1, "INACTIVE"],
      [2, "ACTIVE"],
      [3, "SUSPENDED"],
    ]);
  });

  it("plans only changes, and REMOVED for ids MIS did not return", () => {
    const byMis = new Map([
      [10, "ACTIVE"],
      [11, "INACTIVE"],
    ]);
    const plan = plannedStatuses(
      [
        { id: 1, mis_user_id: 10, mis_status: "ACTIVE" }, // unchanged
        { id: 2, mis_user_id: 11, mis_status: null },
        { id: 3, mis_user_id: 12, mis_status: null },
        { id: 4, mis_user_id: 12, mis_status: "REMOVED" }, // unchanged
        { id: 5, mis_user_id: 10, mis_status: "SUSPENDED" },
      ],
      byMis,
    );
    expect(Object.fromEntries(plan)).toEqual({ INACTIVE: [2], REMOVED: [3], ACTIVE: [5] });
  });

  it("is off without MIS settings, under test without a transport, or when switched off", () => {
    expect(misStatusSweepDisabledReason({ MIS_STATUS_SWEEP: "0" } as any)).toBe("MIS_STATUS_SWEEP=0");
    expect(misStatusSweepDisabledReason({ NODE_ENV: "test" } as any)).toBe("NODE_ENV=test");
    expect(misStatusSweepDisabledReason({} as any)).toBe("NGA_MIS_BASE_URL is not set");
  });
});
