import axios from "axios";
import type { AccessSnapshot } from "../../vendor/nga-access";
import {
  __setSnapshotFetcher,
  clearSnapshotCache,
  getSnapshot,
  LAST_GOOD_MS,
  noteAccessVersion,
} from "../snapshot";
import { fetchSnapshotFromMis, SnapshotFetchError } from "../misClient";
import { accessMode } from "../mode";

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn(), put: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const snap = (v: number, userId = 42): AccessSnapshot => ({
  v,
  app: "tm",
  core: "1.0.0",
  user: { id: userId, persona: "TEACHER", school_id: 1 },
  year: 5,
  caps: { COURSES_VIEW: [{ depth: "detail", scope: { subjects: [31] }, via: [1] }] },
  grants: {},
  home: null,
  systems: ["tm"],
  generated_at: "2026-09-27T00:00:00.000Z",
});

const T0 = 1_800_000_000_000;

describe("access snapshot cache", () => {
  let fetcher: jest.Mock;
  beforeEach(() => {
    clearSnapshotCache();
    fetcher = jest.fn();
    __setSnapshotFetcher(fetcher);
  });
  afterAll(() => __setSnapshotFetcher(null));

  it("fetches once per user and serves the cached copy", async () => {
    fetcher.mockResolvedValue(snap(3));
    expect((await getSnapshot({ misUserId: 42, misToken: "t", now: T0 }))?.v).toBe(3);
    expect((await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + 1000 }))?.v).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shares one request between concurrent misses", async () => {
    fetcher.mockResolvedValue(snap(3));
    await Promise.all([1, 2, 3].map(() => getSnapshot({ misUserId: 42, misToken: "t", now: T0 })));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-fetches only when /auth/verify reports a different access_version", async () => {
    fetcher.mockResolvedValueOnce(snap(3)).mockResolvedValueOnce(snap(4));
    await getSnapshot({ misUserId: 42, misToken: "t", now: T0 });
    noteAccessVersion(42, 3); // same version: nothing to do
    expect((await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + 1 }))?.v).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(1);
    noteAccessVersion(42, 4);
    expect((await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + 2 }))?.v).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(2);
    noteAccessVersion(42, null); // MIS without v2: ignored
    expect((await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + 3 }))?.v).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good snapshot for up to 24 h when MIS is unreachable, then fails closed", async () => {
    fetcher.mockResolvedValueOnce(snap(3)).mockRejectedValue(new SnapshotFetchError("down", null));
    await getSnapshot({ misUserId: 42, misToken: "t", now: T0 });
    noteAccessVersion(42, 9); // force a refresh attempt
    expect((await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + 60_000 }))?.v).toBe(3);
    // within the retry window no new request is made
    await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + 70_000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + LAST_GOOD_MS - 1000 }))?.v).toBe(3);
    expect(await getSnapshot({ misUserId: 42, misToken: "t", now: T0 + LAST_GOOD_MS + 1000 })).toBeNull();
  });

  it("is unavailable (null) with no snapshot ever, no MIS id, or a foreign token", async () => {
    fetcher.mockRejectedValue(new SnapshotFetchError("503", 503));
    expect(await getSnapshot({ misUserId: 42, misToken: "t", now: T0 })).toBeNull();
    expect(await getSnapshot({ misUserId: null, misToken: "t", now: T0 })).toBeNull();
    fetcher.mockResolvedValue(snap(1, 999));
    expect(await getSnapshot({ misUserId: 43, misToken: "t", now: T0 })).toBeNull();
  });
});

describe("fetchSnapshotFromMis", () => {
  const base = process.env.NGA_MIS_BASE_URL;
  beforeAll(() => {
    process.env.NGA_MIS_BASE_URL = "http://mis.test/api";
  });
  afterAll(() => {
    process.env.NGA_MIS_BASE_URL = base;
  });

  it("calls /access/me?app=tm with the user's bearer token and a short timeout", async () => {
    mockedGet.mockResolvedValue({ status: 200, data: { success: true, data: snap(7) } });
    const s = await fetchSnapshotFromMis("user-token");
    expect(s.v).toBe(7);
    const [url, cfg] = mockedGet.mock.calls[0];
    expect(url).toBe("http://mis.test/api/access/me");
    expect(cfg.params).toEqual({ app: "tm" });
    expect(cfg.headers.Authorization).toBe("Bearer user-token");
    expect(cfg.timeout).toBeLessThanOrEqual(5000);
  });

  it("reports 503 (v2 not installed) and malformed bodies as fetch errors", async () => {
    mockedGet.mockRejectedValueOnce(Object.assign(new Error("503"), { response: { status: 503 } }));
    await expect(fetchSnapshotFromMis("t")).rejects.toMatchObject({ status: 503 });
    mockedGet.mockResolvedValueOnce({ status: 200, data: { success: true, data: { nope: 1 } } });
    await expect(fetchSnapshotFromMis("t")).rejects.toBeInstanceOf(SnapshotFetchError);
  });
});

describe("ACCESS_V2_MODE", () => {
  const saved = process.env.ACCESS_V2_MODE;
  afterEach(() => {
    if (saved === undefined) delete process.env.ACCESS_V2_MODE;
    else process.env.ACCESS_V2_MODE = saved;
  });

  it("defaults to off under NODE_ENV=test and accepts the three modes", () => {
    delete process.env.ACCESS_V2_MODE;
    expect(process.env.NODE_ENV).toBe("test");
    expect(accessMode()).toBe("off");
    for (const m of ["off", "shadow", "enforce"]) {
      process.env.ACCESS_V2_MODE = m.toUpperCase();
      expect(accessMode()).toBe(m);
    }
    process.env.ACCESS_V2_MODE = "bogus";
    expect(accessMode()).toBe("off");
  });

  it("defaults to shadow outside tests", () => {
    delete process.env.ACCESS_V2_MODE;
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(accessMode()).toBe("shadow");
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});
