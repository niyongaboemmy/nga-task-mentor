import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { startActivity } from "../activity";
import { API_BASE_URL } from "../utils/axiosConfig";
import { store } from "../store";
import { loginSuccess, logout } from "../store/slices/authSlice";
import { _resetActivityForTests, flushActivity, trackPage } from "../vendor/nga-activity";

/**
 * The Task Mentor wiring of the shared tracker: it posts to this app's own API
 * (cross-origin, so with cookies), sends the session token, and records route
 * patterns -- never the concrete path with its ids.
 */
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

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterEach(() => {
  _resetActivityForTests();
  vi.unstubAllGlobals();
  store.dispatch(logout());
});

describe("startActivity", () => {
  it("sends page views to /api/activity with the session token and the route pattern", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      String(url).includes("/activity/config")
        ? new Response(JSON.stringify({ enabled: true, v: 1 }), { status: 200 })
        : new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("tm_auth_token", "tok-123");
    store.dispatch(loginSuccess({ id: 7, mis_user_id: 412, user_type: "STUDENT" }));

    startActivity();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [configUrl, configInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(configUrl.startsWith(`${API_BASE_URL}/activity/config?did=`)).toBe(true);
    expect(configInit.credentials).toBe("include");

    await new Promise((r) => setTimeout(r, 0));
    trackPage("/quizzes/55/take", "load");
    await flushActivity();

    const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST") as unknown as Array<[string, RequestInit]>;
    expect(posts.length).toBeGreaterThan(0);
    const [url, init] = posts[0];
    expect(url).toBe(`${API_BASE_URL}/activity`);
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
    const body = JSON.parse(String(init.body));
    expect(body.app).toBe("tm");
    expect(body.user_id).toBeUndefined();
    const pv = body.events.find((e: { n: string }) => e.n === "page_view");
    expect(pv).toMatchObject({ r: "/quizzes/:id/take", f: "tm.quiz.take" });
    expect(String(init.body)).not.toContain("/quizzes/55");
  });

  it("sends no token for a public visitor", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      String(url).includes("/activity/config")
        ? new Response(JSON.stringify({ enabled: true, v: 1 }), { status: 200 })
        : new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    startActivity();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    trackPage("/login", "load");
    await flushActivity();
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST") as unknown as [string, RequestInit];
    expect((post[1].headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(String(post[1].body)).events[0]).toMatchObject({ n: "page_view", r: "/login", f: "tm.login" });
  });
});
