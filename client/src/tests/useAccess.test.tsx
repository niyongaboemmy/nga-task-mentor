import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: { get: getMock } }));
const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

import { useAccess, __resetAccessCache } from "../hooks/useAccess";

const snapshot = {
  v: 2,
  app: "tm",
  core: "1.1.0",
  user: { id: 42, persona: "TEACHER", school_id: 1 },
  year: 5,
  caps: {
    REPORT_CARDS_VIEW_ALL: [{ depth: "detail", scope: { class_groups: [7] }, via: [1] }],
  },
  grants: {},
  home: null,
  systems: ["tm"],
  generated_at: "2026-09-27T00:00:00.000Z",
};

describe("useAccess", () => {
  beforeEach(() => {
    __resetAccessCache();
    getMock.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: 3 } });
  });

  it("loads /access/me and decides with the shared core", async () => {
    getMock.mockResolvedValue({ data: { success: true, data: { mode: "shadow", available: true, snapshot } } });
    const { result } = renderHook(() => useAccess());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(getMock).toHaveBeenCalledWith("/access/me");
    expect(result.current.mode).toBe("shadow");
    expect(result.current.can("REPORT_CARDS_VIEW_ALL", { classGroupId: 7 }, "detail")).toBe(true);
    expect(result.current.can("REPORT_CARDS_VIEW_ALL", { classGroupId: 8 })).toBe(false);
    expect(result.current.depthAt("REPORT_CARDS_VIEW_ALL", { classGroupId: 7 })).toBe("detail");
    expect(result.current.scopeFor("REPORT_CARDS_VIEW_ALL")).toEqual({ class_groups: [7] });
  });

  it("denies everything when there is no snapshot", async () => {
    getMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAccess());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.available).toBe(false);
    expect(result.current.can("REPORT_CARDS_VIEW_ALL")).toBe(false);
  });
});
