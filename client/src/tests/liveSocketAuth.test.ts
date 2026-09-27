import { describe, it, expect, vi, beforeEach } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: { get: getMock } }));

import {
  fetchLiveSocketToken,
  liveServerAuthHeaders,
  liveSocketAuth,
} from "../utils/liveSocketAuth";

// Node 22+ ships a partial global localStorage that shadows jsdom's; use a
// plain in-memory Storage so the test is independent of the Node version.
const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  };
};

describe("liveSocketAuth", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    getMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("uses the live ticket from the API when available", async () => {
    localStorage.setItem("tm_auth_token", "session-jwt");
    getMock.mockResolvedValue({ data: { success: true, ticket: "ticket-123" } });
    expect(await fetchLiveSocketToken()).toBe("ticket-123");
    expect(getMock).toHaveBeenCalledWith("/proctoring/live-ticket");
  });

  it("falls back to the session JWT when the ticket request fails", async () => {
    localStorage.setItem("tm_auth_token", "session-jwt");
    getMock.mockRejectedValue(new Error("network"));
    expect(await fetchLiveSocketToken()).toBe("session-jwt");
  });

  it("hands socket.io an auth payload with the token", async () => {
    getMock.mockResolvedValue({ data: { ticket: "t" } });
    const payload = await new Promise((resolve) => liveSocketAuth(resolve));
    expect(payload).toEqual({ token: "t" });
  });

  it("hands socket.io an empty payload when there is no credential at all", async () => {
    getMock.mockRejectedValue(new Error("401"));
    const payload = await new Promise((resolve) => liveSocketAuth(resolve));
    expect(payload).toEqual({});
  });

  it("builds a bearer header for HTTP calls", () => {
    expect(liveServerAuthHeaders()).toEqual({});
    localStorage.setItem("tm_auth_token", "abc");
    expect(liveServerAuthHeaders()).toEqual({ Authorization: "Bearer abc" });
  });
});
