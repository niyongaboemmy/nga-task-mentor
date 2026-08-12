import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "../hooks/usePermissions";

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("usePermissions", () => {
  it("can() returns true when the user holds the exact permission", () => {
    mockUseAuth.mockReturnValue({
      user: { localPermissions: ["QUIZZES_VIEW"], roleName: "instructor" },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("QUIZZES_VIEW")).toBe(true);
  });

  it("can() returns false when the user lacks the permission", () => {
    mockUseAuth.mockReturnValue({
      user: { localPermissions: ["QUIZZES_VIEW"], roleName: "student" },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("QUIZZES_DELETE")).toBe(false);
  });

  it("can() with an array uses OR semantics", () => {
    mockUseAuth.mockReturnValue({
      user: { localPermissions: ["QUIZZES_VIEW"], roleName: "student" },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can(["QUIZZES_DELETE", "QUIZZES_VIEW"])).toBe(true);
    expect(result.current.can(["QUIZZES_DELETE", "QUIZZES_EDIT"])).toBe(false);
  });

  it("canAll() uses AND semantics", () => {
    mockUseAuth.mockReturnValue({
      user: { localPermissions: ["A", "B"], roleName: "admin" },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canAll(["A", "B"])).toBe(true);
    expect(result.current.canAll(["A", "C"])).toBe(false);
  });

  it("treats a missing/null user as having no permissions", () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("ANYTHING")).toBe(false);
    expect(result.current.permissions.size).toBe(0);
  });
});
