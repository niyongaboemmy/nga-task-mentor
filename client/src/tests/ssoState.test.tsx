import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  SSO_STATE_KEY,
  buildSsoAuthorizeUrl,
  consumeSsoState,
  generateSsoState,
} from "../utils/ssoState";

const { postMock, beginSsoLoginMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  beginSsoLoginMock: vi.fn(),
}));

vi.mock("../utils/axiosConfig", () => ({
  default: { post: postMock, get: vi.fn() },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ loginWithSSOData: vi.fn(), isAuthenticated: false }),
}));

vi.mock("../utils/ssoState", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/ssoState")>();
  return { ...actual, beginSsoLogin: beginSsoLoginMock };
});

import Callback from "../components/Auth/Callback";

describe("ssoState helpers", () => {
  beforeEach(() => sessionStorage.clear());

  it("generates unpredictable 256-bit hex states", () => {
    const a = generateSsoState();
    const b = generateSsoState();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it("puts client_id, redirect_uri and state on the authorize URL", () => {
    const url = new URL(
      buildSsoAuthorizeUrl({
        loginUrl: "https://mis.example/login",
        clientId: "taskmentor_app",
        redirectUri: "https://tm.example/sso/callback",
        state: "abc",
      }),
    );
    expect(url.searchParams.get("client_id")).toBe("taskmentor_app");
    expect(url.searchParams.get("redirect_uri")).toBe("https://tm.example/sso/callback");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("validates and clears a matching state (single use)", () => {
    sessionStorage.setItem(SSO_STATE_KEY, "s1");
    expect(consumeSsoState("s1")).toBe("valid");
    expect(sessionStorage.getItem(SSO_STATE_KEY)).toBeNull();
    expect(consumeSsoState("s1")).toBe("unsolicited");
  });

  it("flags a missing or different state as a mismatch and still clears it", () => {
    sessionStorage.setItem(SSO_STATE_KEY, "s1");
    expect(consumeSsoState(null)).toBe("mismatch");
    sessionStorage.setItem(SSO_STATE_KEY, "s1");
    expect(consumeSsoState("s2")).toBe("mismatch");
    expect(sessionStorage.getItem(SSO_STATE_KEY)).toBeNull();
  });
});

describe("Callback state verification", () => {
  beforeEach(() => {
    sessionStorage.clear();
    postMock.mockReset();
    beginSsoLoginMock.mockReset();
  });

  const renderAt = (search: string) => {
    window.history.replaceState({}, "", `/sso/callback${search}`);
    return render(
      <MemoryRouter>
        <Callback />
      </MemoryRouter>,
    );
  };

  it("exchanges the code when the returned state matches", async () => {
    sessionStorage.setItem(SSO_STATE_KEY, "good-state");
    postMock.mockResolvedValue({ data: { success: false, message: "x" } });
    renderAt("?code=c1&state=good-state");
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/auth/sso/callback", { code: "c1" }),
    );
  });

  it("refuses to exchange the code and shows the error UI on a state mismatch", async () => {
    sessionStorage.setItem(SSO_STATE_KEY, "good-state");
    renderAt("?code=c2&state=evil-state");
    expect(await screen.findByText("Sign-in failed")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(SSO_STATE_KEY)).toBeNull();
  });

  it("refuses when the state is missing from the callback", async () => {
    sessionStorage.setItem(SSO_STATE_KEY, "good-state");
    renderAt("?code=c3");
    expect(await screen.findByText("Sign-in failed")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("restarts a fresh login instead of exchanging an unsolicited code", async () => {
    renderAt("?code=c4&state=from-mis-apps-menu");
    await waitFor(() => expect(beginSsoLoginMock).toHaveBeenCalledTimes(1));
    expect(postMock).not.toHaveBeenCalled();
  });
});
