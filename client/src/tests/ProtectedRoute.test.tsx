import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../components/Auth/ProtectedRoute";

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while auth is being resolved", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: true, user: null });
    renderAt("/protected", (
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    ));
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false, user: null });
    renderAt("/protected", (
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    ));
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders children when authenticated and no permissions/roles are required", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { role: "student", localPermissions: [] },
    });
    renderAt("/protected", (
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    ));
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });

  it("redirects to /dashboard when the user lacks the required permission", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { role: "student", localPermissions: ["QUIZZES_ATTEMPT"] },
    });
    renderAt("/protected", (
      <ProtectedRoute permissions={["DATABASE_ADMIN_ACCESS"]}>
        <div>Secret</div>
      </ProtectedRoute>
    ));
    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
  });

  it("renders children when the user holds one of the required permissions (OR)", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { role: "admin", localPermissions: ["DATABASE_ADMIN_ACCESS"] },
    });
    renderAt("/protected", (
      <ProtectedRoute permissions={["DATABASE_ADMIN_ACCESS", "OTHER_PERM"]}>
        <div>Secret</div>
      </ProtectedRoute>
    ));
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });

  it("still honors the deprecated roles prop for lagging call sites", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { role: "student", localPermissions: [] },
    });
    renderAt("/protected", (
      <ProtectedRoute roles={["instructor", "admin"]}>
        <div>Secret</div>
      </ProtectedRoute>
    ));
    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
  });
});
